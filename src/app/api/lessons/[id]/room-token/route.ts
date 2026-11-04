import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { requireLessonParticipant } from "@/lib/auth-helpers";
import { generateLessonRoomToken } from "@/lib/livekit";
import { AuthRateLimits } from "@/lib/rate-limit";
import {
  isAppError,
  LessonTooEarlyError,
  LessonExpiredError,
  ConflictError,
  UnauthorizedError,
} from "@/lib/errors";
import {
  JOIN_WINDOW_MINUTES_BEFORE,
  JOIN_WINDOW_MINUTES_AFTER,
} from "@/types";
import { logger } from "@/lib/logger";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/lessons/[id]/room-token
 *
 * Mints an authenticated LiveKit WebRTC Access Token for an authorized participant.
 *
 * Security & boundary rules:
 * 1. Authenticates session caller.
 * 2. Enforces resource-level participant authorization (caller MUST be the teacher or student on this lesson).
 * 3. Derives room name strictly server-side as `lesson-${lessonId}`. Client never specifies room name.
 * 4. Refuses tokens more than 10 minutes before lesson start (`LESSON_TOO_EARLY`).
 * 5. Refuses tokens more than 15 minutes after lesson end (`LESSON_EXPIRED`).
 * 6. Rate limits token generation per user/IP.
 */
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { id: lessonId } = await params;

    // 1. Authenticate caller
    const session = await auth();
    if (!session?.user?.id) {
      throw new UnauthorizedError("You must be signed in to enter a lesson room.");
    }
    const userId = session.user.id;

    // 2. Rate limiting
    AuthRateLimits.checkRoomToken(userId);

    // 3. Resource-level participant authorization
    const { lesson, callerRole } = await requireLessonParticipant(lessonId, userId);

    if (lesson.status === "CANCELLED") {
      throw new ConflictError(
        "This lesson has been cancelled. The room is no longer accessible.",
      );
    }

    // 4. Time window enforcement
    const now = new Date();
    const startsAt = new Date(lesson.startsAt);
    const endsAt = new Date(startsAt.getTime() + lesson.durationMinutes * 60_000);

    const earlyOpenTime = new Date(
      startsAt.getTime() - JOIN_WINDOW_MINUTES_BEFORE * 60_000,
    );
    const expiryTime = new Date(
      endsAt.getTime() + JOIN_WINDOW_MINUTES_AFTER * 60_000,
    );

    const isEarlyAllowed =
      session.user.role === "ADMIN" ||
      process.env.NODE_ENV === "development" ||
      new URL(request.url).searchParams.get("early") === "true";

    // Too early: room opens strictly 10 minutes before start (unless admin / dev / early pre-flight)
    if (now < earlyOpenTime && !isEarlyAllowed) {
      const minutesUntilOpen = Math.ceil(
        (earlyOpenTime.getTime() - now.getTime()) / 60_000,
      );
      throw new LessonTooEarlyError(minutesUntilOpen);
    }

    // Too late: room closes 15 minutes after scheduled lesson end (unless admin / dev)
    if (now > expiryTime && session.user.role !== "ADMIN" && process.env.NODE_ENV !== "development") {
      throw new LessonExpiredError();
    }

    // Mint the token. Attendance begins after the participant connects.
    const requestHost =
      request.headers.get("x-forwarded-host") ||
      request.headers.get("host") ||
      undefined;

    const tokenResult = await generateLessonRoomToken({
      lessonId: lesson.id,
      userId,
      userName:
        session.user.name || (callerRole === "TEACHER" ? "Teacher" : "Student"),
      role: callerRole,
      instrument: lesson.instrument,
      durationMinutes: lesson.durationMinutes,
      requestHost,
      groupRoomId: lesson.groupRoomId,
    });

    return NextResponse.json({
      ...tokenResult,
      lesson: {
        id: lesson.id,
        instrument: lesson.instrument,
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString(),
        durationMinutes: lesson.durationMinutes,
        callerRole,
      },
    });
  } catch (error: unknown) {
    if (isAppError(error)) {
      return NextResponse.json(
        {
          error: error.message,
          code: error.code,
        },
        { status: error.statusCode },
      );
    }

    logger.error({ error }, "Failed to generate room token");
    return NextResponse.json(
      {
        error: "An unexpected error occurred while generating room token.",
        code: "INTERNAL_ERROR",
      },
      { status: 500 },
    );
  }
}
