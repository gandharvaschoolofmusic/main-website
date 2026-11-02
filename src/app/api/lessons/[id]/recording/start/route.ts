import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { startLessonRoomEgress } from "@/lib/livekit";
import { logger } from "@/lib/logger";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: lessonId } = await params;

    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const lesson = await db.lesson.findUnique({
      where: { id: lessonId },
      select: {
        id: true,
        teacherId: true,
        studentId: true,
        groupRoomId: true,
      },
    });

    if (!lesson) {
      return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
    }

    const userId = session.user.id;
    const isParticipant =
      lesson.teacherId === userId ||
      lesson.studentId === userId ||
      session.user.role === "ADMIN";

    if (!isParticipant) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const roomName = lesson.groupRoomId || `lesson-${lesson.id}`;

    const result = await startLessonRoomEgress({
      roomName,
      lessonId: lesson.id,
      groupRoomId: lesson.groupRoomId,
    });

    logger.info({ lessonId, roomName, result }, "Recording start endpoint invoked");
    return NextResponse.json(result);
  } catch (error) {
    logger.error({ error }, "Error starting room recording via API");
    return NextResponse.json(
      { error: "Failed to start recording" },
      { status: 500 },
    );
  }
}

