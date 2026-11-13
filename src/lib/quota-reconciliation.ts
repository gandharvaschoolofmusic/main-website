import { Prisma, LessonSource, TrialStatus, EnrollmentStatus, TrialRequestStatus } from "@prisma/client";
import { logger } from "@/lib/logger";

/**
 * Reconciles student and enrollment quota when a lesson is CANCELLED.
 * 
 * 1. For Course Enrollments:
 *    - Increments `sessionsRemaining` by 1.
 *    - If enrollment was marked `COMPLETED` because sessions ran out, reverts status back to `ACTIVE`
 *      and clears `completedAt`.
 * 
 * 2. For Free Trials:
 *    - Decrements `lessonsUsed` in `StudentTrialStatus` (minimum 0).
 *    - If `lessonsUsed < lessonsGranted`, restores `TrialStatus.ACTIVE`.
 *    - If a linked `TrialRequest` is in `ALLOTTED` status, updates it to `CANCELLED`.
 */
export async function restoreLessonAllocationTx(
  tx: Prisma.TransactionClient,
  lesson: {
    id: string;
    studentId: string;
    lessonSource?: LessonSource | null;
    enrollmentId?: string | null;
  }
): Promise<{ restoredType: "ENROLLMENT" | "TRIAL" | "NONE"; success: boolean }> {
  try {
    if (lesson.lessonSource === LessonSource.ENROLLMENT && lesson.enrollmentId) {
      const enrollment = await tx.enrollment.findUnique({
        where: { id: lesson.enrollmentId },
        select: { id: true, sessionsRemaining: true, status: true },
      });

      if (enrollment) {
        const nextSessions = enrollment.sessionsRemaining + 1;
        await tx.enrollment.update({
          where: { id: enrollment.id },
          data: {
            sessionsRemaining: nextSessions,
            status: EnrollmentStatus.ACTIVE,
            completedAt: null,
          },
        });
        return { restoredType: "ENROLLMENT", success: true };
      }
    } else if (lesson.lessonSource === LessonSource.TRIAL) {
      // 1. Refund quota in StudentTrialStatus
      const trialStatus = await tx.studentTrialStatus.findUnique({
        where: { studentId: lesson.studentId },
      });

      if (trialStatus && trialStatus.lessonsUsed > 0) {
        const nextUsed = Math.max(0, trialStatus.lessonsUsed - 1);
        const nextStatus =
          nextUsed < trialStatus.lessonsGranted ? TrialStatus.ACTIVE : trialStatus.status;

        await tx.studentTrialStatus.update({
          where: { studentId: lesson.studentId },
          data: {
            lessonsUsed: nextUsed,
            status: nextStatus,
          },
        });
      }

      // 2. If a trial request was allotted to this lesson, mark it cancelled
      await tx.trialRequest.updateMany({
        where: {
          allottedLessonId: lesson.id,
          status: TrialRequestStatus.ALLOTTED,
        },
        data: {
          status: TrialRequestStatus.CANCELLED,
        },
      });

      return { restoredType: "TRIAL", success: true };
    }

    return { restoredType: "NONE", success: true };
  } catch (err) {
    logger.error({ err, lessonId: lesson.id }, "Failed to restore lesson allocation in transaction");
    return { restoredType: "NONE", success: false };
  }
}

/**
 * Re-consumes student or enrollment quota when a previously CANCELLED lesson is
 * restored or rescheduled into an active state (SCHEDULED / RESCHEDULED).
 */
export async function consumeLessonAllocationTx(
  tx: Prisma.TransactionClient,
  lesson: {
    id: string;
    studentId: string;
    lessonSource?: LessonSource | null;
    enrollmentId?: string | null;
  }
): Promise<{ consumedType: "ENROLLMENT" | "TRIAL" | "NONE"; success: boolean }> {
  try {
    if (lesson.lessonSource === LessonSource.ENROLLMENT && lesson.enrollmentId) {
      const enrollment = await tx.enrollment.findUnique({
        where: { id: lesson.enrollmentId },
        select: { id: true, sessionsRemaining: true },
      });

      if (enrollment && enrollment.sessionsRemaining > 0) {
        const nextSessions = Math.max(0, enrollment.sessionsRemaining - 1);
        const isCompleted = nextSessions === 0;

        await tx.enrollment.update({
          where: { id: enrollment.id },
          data: {
            sessionsRemaining: nextSessions,
            status: isCompleted ? EnrollmentStatus.COMPLETED : EnrollmentStatus.ACTIVE,
            completedAt: isCompleted ? new Date() : null,
          },
        });
        return { consumedType: "ENROLLMENT", success: true };
      }
    } else if (lesson.lessonSource === LessonSource.TRIAL) {
      const trialStatus = await tx.studentTrialStatus.findUnique({
        where: { studentId: lesson.studentId },
      });

      if (trialStatus) {
        const nextUsed = trialStatus.lessonsUsed + 1;
        const nextStatus =
          nextUsed >= trialStatus.lessonsGranted ? TrialStatus.EXHAUSTED : TrialStatus.ACTIVE;

        await tx.studentTrialStatus.update({
          where: { studentId: lesson.studentId },
          data: {
            lessonsUsed: nextUsed,
            status: nextStatus,
          },
        });
        return { consumedType: "TRIAL", success: true };
      }
    }

    return { consumedType: "NONE", success: true };
  } catch (err) {
    logger.error({ err, lessonId: lesson.id }, "Failed to consume lesson allocation in transaction");
    return { consumedType: "NONE", success: false };
  }
}

