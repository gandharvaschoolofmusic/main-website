"use server";

import { db } from "@/lib/db";
import { requireUser, requireLessonParticipant } from "@/lib/auth-helpers";
import { CancelLessonSchema, CancelLessonInput } from "@/schemas/lesson";
import {
  sendLessonCancellationEmail,
  sendLessonCancelledNotificationEmails,
} from "@/lib/email";
import { isAppError, ConflictError } from "@/lib/errors";
import { CANCELLATION_NOTICE_HOURS } from "@/types";
import { logger } from "@/lib/logger";
import { revalidatePath } from "next/cache";
import { restoreLessonAllocationTx } from "@/lib/quota-reconciliation";

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

    // Update lesson status to CANCELLED atomically and restore quota (trial quota or enrollment sessions)
    const updateResult = await db.$transaction(async (tx) => {
      const res = await tx.lesson.updateMany({
        where: { id: lesson.id, status: "SCHEDULED" },
        data: {
          status: "CANCELLED",
          cancelledBy: user.id,
          cancelledAt: now,
        },
      });

      if (res.count > 0) {
        await restoreLessonAllocationTx(tx, {
          id: lesson.id,
          studentId: lesson.studentId,
          lessonSource: lesson.lessonSource,
          enrollmentId: lesson.enrollmentId,
        });
      }

      return res;
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

    // Fetch student and teacher details to send cancellation notification emails
    const [studentUser, teacherUser] = await Promise.all([
      db.user.findUnique({
        where: { id: lesson.studentId },
        select: { name: true, email: true, timezone: true },
      }),
      db.user.findUnique({
        where: { id: lesson.teacherId },
        select: { name: true, email: true, timezone: true },
      }),
    ]);

    if (studentUser?.email && teacherUser?.email) {
      sendLessonCancelledNotificationEmails({
        lessonId: lesson.id,
        trackingCode: lesson.trackingCode,
        instrument: lesson.instrument,
        startsAt: lesson.startsAt,
        cancelledByName:
          user.name || (callerRole === "TEACHER" ? "Teacher" : "Student"),
        cancelledByRole: callerRole,
        reason: reason || undefined,
        student: {
          name: studentUser.name || "Student",
          email: studentUser.email,
          timezone: studentUser.timezone || "Asia/Kolkata",
        },
        teacher: {
          name: teacherUser.name || "Teacher",
          email: teacherUser.email,
          timezone: teacherUser.timezone || "Asia/Kolkata",
        },
      }).catch((emailErr) => {
        logger.error(
          { emailErr, lessonId: lesson.id },
          "Failed to send cancellation notification emails",
        );
      });
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
