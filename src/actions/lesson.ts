"use server";

import { db } from "@/lib/db";
import { requireUser, requireLessonParticipant } from "@/lib/auth-helpers";
import { CancelLessonSchema, CancelLessonInput } from "@/schemas/lesson";
import { sendLessonCancellationEmail } from "@/lib/email";
import { isAppError, ConflictError } from "@/lib/errors";
import { CANCELLATION_NOTICE_HOURS } from "@/types";
import { logger } from "@/lib/logger";
import { revalidatePath } from "next/cache";

export type CancelLessonResponse = {
  success: boolean;
  message?: string;
  error?: string;
  code?: string;
  isUnder24Hours?: boolean;
};

/**
 * Cancel a scheduled lesson.
 *
 * Rules:
 * 1. Must be authenticated and a verified participant on the lesson.
 * 2. Lesson status must be SCHEDULED (cannot cancel completed or already cancelled lessons).
 * 3. Updates status to CANCELLED, recording cancelledBy and cancelledAt.
 * 4. Slot immediately reverts to available for future bookings.
 * 5. Sends dual-timezone cancellation email to the partner.
 * 6. Revalidates dashboard and studio routes.
 */
export async function cancelLessonAction(
  input: CancelLessonInput,
): Promise<CancelLessonResponse> {
  try {
    const user = await requireUser();

    const parsed = CancelLessonSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message || "Invalid cancellation request",
        code: "VALIDATION_ERROR",
      };
    }

    const { lessonId, reason } = parsed.data;

    // Authorization & participant verification
    const { lesson, callerRole } = await requireLessonParticipant(
      lessonId,
      user.id,
    );

    if (lesson.status !== "SCHEDULED") {
      throw new ConflictError(
        `Cannot cancel a lesson with status '${lesson.status}'. Only scheduled lessons can be cancelled.`,
      );
    }

    const now = new Date();
    const startsAt = new Date(lesson.startsAt);
    const endsAt = new Date(startsAt.getTime() + lesson.durationMinutes * 60_000);

    // If lesson has already ended or started, reject cancellation
    if (now >= endsAt) {
      throw new ConflictError(
        "This lesson has already concluded and cannot be cancelled.",
      );
    }

    if (now >= startsAt) {
      throw new ConflictError(
        "This lesson is already in progress and cannot be cancelled.",
      );
    }

    const hoursNotice =
      (startsAt.getTime() - now.getTime()) / (1000 * 60 * 60);
    const isUnder24Hours = hoursNotice < CANCELLATION_NOTICE_HOURS;

    // Update lesson status to CANCELLED atomically
    const updateResult = await db.lesson.updateMany({
      where: { id: lesson.id, status: "SCHEDULED" },
      data: {
        status: "CANCELLED",
        cancelledBy: user.id,
        cancelledAt: now,
      },
    });

    if (updateResult.count === 0) {
      throw new ConflictError("This lesson has already been cancelled or modified.");
    }

    logger.info(
      {
        lessonId: lesson.id,
        cancelledBy: user.id,
        callerRole,
        hoursNotice: hoursNotice.toFixed(1),
        isUnder24Hours,
      },
      "Lesson cancelled by participant",
    );

    // Fetch recipient details to send notification email
    const recipientId =
      callerRole === "TEACHER" ? lesson.studentId : lesson.teacherId;

    const recipient = await db.user.findUnique({
      where: { id: recipientId },
      select: { name: true, email: true, timezone: true },
    });

    if (recipient && recipient.email) {
      try {
        await sendLessonCancellationEmail({
          lessonId: lesson.id,
          instrument: lesson.instrument,
          startsAt: lesson.startsAt,
          cancelledByName: user.name || (callerRole === "TEACHER" ? "Teacher" : "Student"),
          cancelledByRole: callerRole,
          recipient: {
            name: recipient.name || "Musician",
            email: recipient.email,
            timezone: recipient.timezone || "UTC",
          },
          reason: reason || undefined,
        });
      } catch (emailErr) {
        logger.error({ emailErr, lessonId: lesson.id }, "Failed to send cancellation email");
      }
    }

    revalidatePath("/student/dashboard");
    revalidatePath("/teacher/dashboard");
    revalidatePath(`/teachers/${lesson.teacherProfileId}`);
    revalidatePath(`/lesson/${lesson.id}`);

    return {
      success: true,
      message: "Lesson has been successfully cancelled.",
      isUnder24Hours,
    };
  } catch (error: unknown) {
    if (isAppError(error)) {
      return {
        success: false,
        error: error.message,
        code: error.code,
      };
    }

    logger.error({ error }, "Unexpected error cancelling lesson");
    return {
      success: false,
      error: "Failed to cancel lesson. Please try again.",
      code: "INTERNAL_ERROR",
    };
  }
}
