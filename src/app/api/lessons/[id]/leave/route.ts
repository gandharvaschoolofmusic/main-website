import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/lessons/[id]/leave
 *
 * Records participant departure timestamp (teacherLeftAt / studentLeftAt)
 * when a user leaves the classroom or closes the tab.
 * Uses keepalive: true / sendBeacon support.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: lessonId } = await params;
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const lesson = await db.lesson.findUnique({
      where: { id: lessonId },
      include: { teacherProfile: true },
    });

    if (!lesson) {
      return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
    }

    const userId = session.user.id;
    const now = new Date();
    const isTeacher =
      lesson.teacherId === userId || lesson.teacherProfile?.userId === userId;
    const isStudent = lesson.studentId === userId;

    if (!isTeacher && !isStudent && session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const updateData: {
      teacherLeftAt?: Date;
      studentLeftAt?: Date;
    } = {};

    if (isTeacher) {
      updateData.teacherLeftAt = now;
    }
    if (isStudent) {
      updateData.studentLeftAt = now;
    }

    if (Object.keys(updateData).length > 0) {
      await db.lesson.update({
        where: { id: lessonId },
        data: updateData,
      });

      try {
        revalidateTag("admin-recordings", "max");
        revalidateTag("admin-lessons", "max");
      } catch {}

      logger.info(
        { lessonId, userId, isTeacher, isStudent, timestamp: now },
        "Recorded participant room exit timestamp",
      );
    }

    return NextResponse.json({ success: true, timestamp: now.toISOString() });
  } catch (error) {
    logger.error({ error }, "Error recording participant room exit");
    return NextResponse.json(
      { error: "Failed to record exit timestamp" },
      { status: 500 },
    );
  }
}

