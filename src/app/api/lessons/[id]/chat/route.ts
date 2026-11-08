import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import {
  generateChatlogText,
  LessonChatMessageItem,
} from "@/lib/chatlog";
import { parseAttendanceLogs } from "@/lib/attendance";
import { getLessonTrackingId } from "@/lib/lesson-tracking";
import { JOIN_WINDOW_MINUTES_AFTER } from "@/types";
import { formatInViewerTimezone } from "@/lib/timezone";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/lessons/[id]/chat
 * Fetches the archived chat log or triggers text file download (?download=1).
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: lessonId } = await params;
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const lesson = await db.lesson.findUnique({
      where: { id: lessonId },
      include: {
        teacher: { select: { id: true, name: true, email: true } },
        student: { select: { id: true, name: true, email: true } },
        enrollment: {
          include: {
            course: { select: { id: true, title: true, instrument: true } },
          },
        },
        teacherProfile: { select: { userId: true } },
      },
    });

    if (!lesson) {
      return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
    }

    const userId = session.user.id;
    const isTeacher =
      lesson.teacherId === userId || lesson.teacherProfile?.userId === userId;
    const isStudent = lesson.studentId === userId;
    const isAdmin = session.user.role === "ADMIN";

    if (!isTeacher && !isStudent && !isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const searchParams = request.nextUrl.searchParams;
    const isDownload =
      searchParams.get("download") === "1" ||
      searchParams.get("download") === "true";

    const chatLogs = (Array.isArray(lesson.chatLogs)
      ? lesson.chatLogs
      : []) as unknown as LessonChatMessageItem[];

    if (isDownload) {
      const adminTimezone = "Asia/Kolkata";
      const trackingCode = getLessonTrackingId(lesson);

      const parsedAtt = parseAttendanceLogs(
        lesson.attendanceLogs,
        {
          status: lesson.status,
          roomClosesAt: new Date(
            lesson.startsAt.getTime() +
              (lesson.durationMinutes + JOIN_WINDOW_MINUTES_AFTER) * 60_000,
          ),
          teacherJoinedAt: lesson.teacherJoinedAt,
          teacherLeftAt: lesson.teacherLeftAt,
          studentJoinedAt: lesson.studentJoinedAt,
          studentLeftAt: lesson.studentLeftAt,
          timezone: adminTimezone,
        },
        (d, fmt) => formatInViewerTimezone(d, adminTimezone, fmt),
      );

      const textOutput = generateChatlogText({
        sessionCode: trackingCode,
        courseTitle: lesson.enrollment?.course?.title,
        instrument: lesson.instrument || lesson.enrollment?.course?.instrument,
        startsAt: lesson.startsAt,
        status: lesson.status,
        teacherName: lesson.teacher?.name || "Teacher",
        teacherEmail: lesson.teacher?.email,
        studentName: lesson.student?.name || "Student",
        studentEmail: lesson.student?.email,
        teacherDurationSeconds: parsedAtt.totalTeacherDurationSeconds,
        studentDurationSeconds: parsedAtt.totalStudentDurationSeconds,
        overlapDurationSeconds: parsedAtt.overlapDurationSeconds,
        teacherSessions: parsedAtt.teacherSessions,
        studentSessions: parsedAtt.studentSessions,
        chatLogs,
        timezone: adminTimezone,
      });

      const dateStr = lesson.startsAt.toISOString().slice(0, 10);
      const filename = `Chatlog_${trackingCode}_${dateStr}.txt`;

      return new NextResponse(textOutput, {
        status: 200,
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      });
    }

    return NextResponse.json({
      success: true,
      lessonId: lesson.id,
      chatLogs,
    });
  } catch (error) {
    logger.error({ error }, "Error retrieving lesson chat logs");
    return NextResponse.json(
      { error: "Failed to retrieve chat logs" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/lessons/[id]/chat
 * Archives an in-classroom chat message into Lesson.chatLogs.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: lessonId } = await params;
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const rawMessage = typeof body.message === "string" ? body.message.trim() : "";

    if (!rawMessage) {
      return NextResponse.json({ error: "Message cannot be empty" }, { status: 400 });
    }

    if (rawMessage.length > 2000) {
      return NextResponse.json({ error: "Message exceeds 2000 character limit" }, { status: 400 });
    }

    const lesson = await db.lesson.findUnique({
      where: { id: lessonId },
      include: {
        teacherProfile: true,
      },
    });

    if (!lesson) {
      return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
    }

    const userId = session.user.id;
    const isTeacher =
      lesson.teacherId === userId || lesson.teacherProfile?.userId === userId;
    const isStudent = lesson.studentId === userId;
    const isAdmin = session.user.role === "ADMIN";

    if (!isTeacher && !isStudent && !isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const resolvedRole = isAdmin
      ? "ADMIN"
      : isTeacher
      ? "TEACHER"
      : "STUDENT";

    const resolvedName = (
      session.user.name ||
      (typeof body.senderName === "string" ? body.senderName : "") ||
      (isTeacher ? "Instructor" : "Student")
    ).trim();

    const timestamp =
      typeof body.timestamp === "string" && !isNaN(Date.parse(body.timestamp))
        ? new Date(body.timestamp).toISOString()
        : new Date().toISOString();

    const newEntry: LessonChatMessageItem = {
      id: crypto.randomUUID(),
      senderId: userId,
      senderName: resolvedName,
      senderRole: resolvedRole,
      message: rawMessage,
      timestamp,
    };

    const existingLogs = (Array.isArray(lesson.chatLogs)
      ? lesson.chatLogs
      : []) as unknown as LessonChatMessageItem[];

    const updatedLogs = [...existingLogs, newEntry];

    await db.lesson.update({
      where: { id: lessonId },
      data: {
        chatLogs: updatedLogs as any,
      },
    });

    return NextResponse.json({ success: true, item: newEntry });
  } catch (error) {
    logger.error({ error }, "Error recording classroom chat message");
    return NextResponse.json(
      { error: "Failed to record message" },
      { status: 500 },
    );
  }
}
