import { db } from "@/lib/db";
import { BookingRequestSchema, BookingRequestInput } from "@/schemas/booking";
import {
  isAppError,
  ConflictError,
  SlotUnavailableError,
  NoTrialOrEnrollmentError,
} from "@/lib/errors";
import { sendBookingConfirmationEmails } from "@/lib/email";
import { generateAndStoreCertificate } from "@/lib/certificate";
import {
  SLOT_DURATION_MINUTES,
  LessonSource,
  TrialStatus,
  EnrollmentStatus,
  LessonStatus,
} from "@/types";
import { logger } from "@/lib/logger";
import { revalidatePath } from "next/cache";
import { AuthRateLimits } from "@/lib/rate-limit";
import { getLocalDateString } from "@/lib/timezone";
import { formatInTimeZone } from "date-fns-tz";
import type { Lesson } from "@prisma/client";
import { generateUniqueLessonTrackingCode } from "@/lib/lesson-tracking";
import { calculateLessonPayoutMinor } from "@/lib/teacher-payout";

export type BookingActionResponse = {
  success: boolean;
  lessonId?: string;
  error?: string;
  code?: string;
};

export type BookingCoreStudent = {
  id: string;
  email?: string | null;
  name?: string | null;
  emailVerified?: Date | null;
  timezone?: string | null;
};

export type BookingCoreOptions = {
  skipRateLimit?: boolean;
};

/**
 * Core transactional booking execution logic.
 *
 * Enforces:
 * 1. Email verification check
 * 2. Rate limiting (max 10 requests / 5 mins)
 * 3. Schema validation
 * 4. Teacher profile published & valid instrument
 * 5. Slot validity in teacher's schedule and exceptions
 * 6. Concurrency-safe Serializable transaction with student row lock
 * 7. Trial status / active course enrollment gating (NO_TRIAL_OR_ENROLLMENT)
 * 8. Confirmation email & cache revalidation
 */
export async function bookLessonCore(
  student: BookingCoreStudent,
  input: BookingRequestInput,
  options?: BookingCoreOptions,
): Promise<BookingActionResponse> {
  try {
    if (!options?.skipRateLimit) {
      AuthRateLimits.checkBooking(student.id);
    }

    if (!student.emailVerified) {
      return {
        success: false,
        error: "Please verify your email address before booking a lesson.",
        code: "EMAIL_NOT_VERIFIED",
      };
    }

    const parsed = BookingRequestSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message || "Invalid booking data",
        code: "VALIDATION_ERROR",
      };
    }

    const { teacherProfileId, startsAt, instrument } = parsed.data;
    const startsAtDate = new Date(startsAt);

    // Fetch teacher profile with availability rules and exceptions
    const teacherProfile = await db.teacherProfile.findUnique({
      where: { id: teacherProfileId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            timezone: true,
            emailVerified: true,
          },
        },
        availabilityRules: true,
        availabilityExceptions: true,
      },
    });

    if (!teacherProfile || !teacherProfile.isPublished || teacherProfile.approvalStatus !== "APPROVED") {
      return {
        success: false,
        error: "This teacher's profile is currently unavailable for booking.",
        code: "TEACHER_NOT_AVAILABLE",
      };
    }

    if (teacherProfile.userId === student.id) {
      return {
        success: false,
        error: "You cannot book a lesson with yourself.",
        code: "SELF_BOOKING_FORBIDDEN",
      };
    }

    if (!teacherProfile.instruments.includes(instrument)) {
      return {
        success: false,
        error: `This teacher does not teach ${instrument}.`,
        code: "INVALID_INSTRUMENT",
      };
    }

    // Server-side validation: Ensure slot is within teacher's working hours and not on an exception
    const teacherTimezone = teacherProfile.user.timezone || "UTC";
    const teacherDateStr = getLocalDateString(startsAtDate, teacherTimezone);
    const localHour = parseInt(
      formatInTimeZone(startsAtDate, teacherTimezone, "H"),
      10,
    );
    const localMin = parseInt(
      formatInTimeZone(startsAtDate, teacherTimezone, "m"),
      10,
    );
    const slotMinute = localHour * 60 + localMin;

    const [year, month, day] = teacherDateStr.split("-").map(Number);
    const dayOfWeek = new Date(Date.UTC(year, month - 1, day)).getUTCDay();

    // Check date exceptions
    const dateExceptions = teacherProfile.availabilityExceptions.filter(
      (e) => e.date.toISOString().split("T")[0] === teacherDateStr,
    );

    const isFullDayBlocked = dateExceptions.some(
      (e) => e.isBlocked && e.startMinute === null,
    );
    if (isFullDayBlocked) {
      return {
        success: false,
        error:
          "The teacher has blocked bookings on this date. Please select another date.",
        code: "SLOT_BLOCKED",
      };
    }

    const isMinuteBlocked = dateExceptions.some(
      (e) =>
        e.isBlocked &&
        e.startMinute !== null &&
        e.endMinute !== null &&
        slotMinute >= e.startMinute &&
        slotMinute < e.endMinute,
    );
    if (isMinuteBlocked) {
      return {
        success: false,
        error: "The teacher is unavailable at this specific time on this date.",
        code: "SLOT_BLOCKED",
      };
    }

    // Verify slot matches weekly recurring availability rules
    const matchingRule = teacherProfile.availabilityRules.some(
      (r) =>
        r.dayOfWeek === dayOfWeek &&
        slotMinute >= r.startMinute &&
        slotMinute + SLOT_DURATION_MINUTES <= r.endMinute &&
        (slotMinute - r.startMinute) % SLOT_DURATION_MINUTES === 0,
    );

    if (!matchingRule) {
      return {
        success: false,
        error:
          "The selected time slot is outside the teacher's scheduled working hours.",
        code: "SLOT_NOT_OFFERED",
      };
    }

    // Atomic transaction creating the lesson with row-locking concurrency guard
    let lesson: Lesson | undefined;
    let completedEnrollmentId: string | null = null;
    const MAX_RETRIES = 3;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        lesson = await db.$transaction(
          async (tx) => {
            // Acquire row lock on student record to serialize concurrent bookings by the same student
            await tx.$executeRaw`SELECT id FROM "User" WHERE id = ${student.id} FOR UPDATE`;

            // Check teacher conflict at this time
            const teacherConflict = await tx.lesson.findFirst({
              where: {
                teacherProfileId,
                startsAt: startsAtDate,
                status: LessonStatus.SCHEDULED,
              },
            });

            if (teacherConflict) {
              throw new SlotUnavailableError();
            }

            // Check student conflict at this time
            const studentConflict = await tx.lesson.findFirst({
              where: {
                studentId: student.id,
                startsAt: startsAtDate,
                status: LessonStatus.SCHEDULED,
              },
            });

            if (studentConflict) {
              throw new ConflictError(
                "You already have another lesson scheduled at this time.",
              );
            }

            // Check trial status or active course enrollment
            let trialStatus = await tx.studentTrialStatus.findUnique({
              where: { studentId: student.id },
            });

            if (!trialStatus) {
              // Lazy-create from PlatformSettings on first booking
              const settings = await tx.platformSettings.findUnique({
                where: { id: 1 },
              });
              const granted = settings?.freeTrialLessonCount ?? 2;
              trialStatus = await tx.studentTrialStatus.create({
                data: {
                  studentId: student.id,
                  lessonsGranted: granted,
                  lessonsUsed: 0,
                  status: TrialStatus.ACTIVE,
                },
              });
            }

            let lessonSource: LessonSource = LessonSource.TRIAL;
            let enrollmentId: string | null = null;

            if (
              trialStatus.status === TrialStatus.ACTIVE &&
              trialStatus.lessonsUsed < trialStatus.lessonsGranted
            ) {
              // Student has available trial lesson
              lessonSource = LessonSource.TRIAL;
              const newLessonsUsed = trialStatus.lessonsUsed + 1;
              const newStatus =
                newLessonsUsed >= trialStatus.lessonsGranted
                  ? TrialStatus.EXHAUSTED
                  : TrialStatus.ACTIVE;

              await tx.studentTrialStatus.update({
                where: { id: trialStatus.id },
                data: {
                  lessonsUsed: newLessonsUsed,
                  status: newStatus,
                },
              });
            } else {
              // Trials exhausted; check for active enrollment matching assigned teacher
              const activeEnrollment = await tx.enrollment.findFirst({
                where: {
                  studentId: student.id,
                  status: EnrollmentStatus.ACTIVE,
                  sessionsRemaining: { gt: 0 },
                  teacherId: teacherProfile.userId,
                },
                include: {
                  course: true,
                },
                orderBy: {
                  startedAt: "asc",
                },
              });

              if (!activeEnrollment) {
                throw new NoTrialOrEnrollmentError();
              }

              lessonSource = LessonSource.ENROLLMENT;
              enrollmentId = activeEnrollment.id;

              const newSessionsRemaining = activeEnrollment.sessionsRemaining - 1;
              const isCompleted = newSessionsRemaining === 0;

              if (isCompleted) {
                completedEnrollmentId = activeEnrollment.id;
              }

              await tx.enrollment.update({
                where: { id: activeEnrollment.id },
                data: {
                  sessionsRemaining: newSessionsRemaining,
                  status: isCompleted
                    ? EnrollmentStatus.COMPLETED
                    : EnrollmentStatus.ACTIVE,
                  completedAt: isCompleted ? new Date() : null,
                },
              });
            }

            const trackingCode = await generateUniqueLessonTrackingCode(student.id, tx);
            const payoutAmountMinor = calculateLessonPayoutMinor(startsAtDate, teacherProfile);

            return await tx.lesson.create({
              data: {
                teacherProfileId,
                teacherId: teacherProfile.userId,
                studentId: student.id,
                instrument,
                startsAt: startsAtDate,
                durationMinutes: SLOT_DURATION_MINUTES,
                status: LessonStatus.SCHEDULED,
                lessonSource,
                enrollmentId,
                trackingCode,
                payoutAmountMinor,
              },
            });
          },
          {
            isolationLevel: "Serializable",
          },
        );

        break;
      } catch (err: unknown) {
        const error = err as { code?: string; message?: string };

        // Serialization failure or deadlock: retry up to MAX_RETRIES
        const isSerializationFailure =
          error?.code === "P2034" ||
          error?.message?.includes("could not serialize access") ||
          error?.message?.includes("write conflict") ||
          error?.message?.includes("deadlock detected");

        if (isSerializationFailure && attempt < MAX_RETRIES) {
          logger.info(
            { attempt, studentId: student.id },
            "Retrying booking transaction due to serialization conflict",
          );
          await new Promise((res) =>
            setTimeout(res, 50 * attempt + Math.floor(Math.random() * 50)),
          );
          continue;
        }

        // Catch Postgres partial unique index conflict: uq_teacher_scheduled_slot
        if (error?.code === "P2002") {
          logger.warn(
            { teacherProfileId, startsAt },
            "Slot booking conflict caught by Postgres unique constraint uq_teacher_scheduled_slot",
          );
          return {
            success: false,
            error:
              "This time slot was just booked by another student. Please choose a different time.",
            code: "SLOT_UNAVAILABLE",
          };
        }

        if (isAppError(err)) {
          return {
            success: false,
            error: err.message,
            code: err.code,
          };
        }

        throw err;
      }
    }

    if (!lesson) {
      return {
        success: false,
        error: "Unable to complete booking. Please try again.",
        code: "BOOKING_FAILED",
      };
    }

    // Fire-and-forget certificate generation if enrollment reached completion
    if (completedEnrollmentId) {
      const enrollmentIdToCertify = completedEnrollmentId;
      setImmediate(() => {
        generateAndStoreCertificate({
          enrollmentId: enrollmentIdToCertify,
          studentId: student.id,
        }).catch((err) => {
          logger.error(
            { err, enrollmentId: enrollmentIdToCertify },
            "Background certificate generation failed",
          );
        });
      });
    }

    // Send confirmation emails in background
    try {
      await sendBookingConfirmationEmails({
        lessonId: lesson.id,
        instrument: lesson.instrument,
        startsAt: lesson.startsAt,
        durationMinutes: lesson.durationMinutes,
        teacher: {
          name: teacherProfile.user.name || "Teacher",
          email: teacherProfile.user.email,
          timezone: teacherProfile.user.timezone || "UTC",
        },
        student: {
          name: student.name || "Student",
          email: student.email || "",
          timezone: student.timezone || "UTC",
        },
      });
    } catch (emailErr) {
      logger.error(
        { emailErr, lessonId: lesson.id },
        "Error sending booking confirmation emails",
      );
    }

    try {
      revalidatePath("/student/dashboard");
      revalidatePath(`/teachers/${teacherProfileId}`);
    } catch {
      // Ignore if outside Next.js request context (e.g. test runner)
    }

    return {
      success: true,
      lessonId: lesson.id,
    };
  } catch (error: unknown) {
    if (isAppError(error)) {
      return {
        success: false,
        error: error.message,
        code: error.code,
      };
    }

    logger.error({ error }, "Unexpected error in bookLessonCore");
    return {
      success: false,
      error: "An unexpected error occurred while booking. Please try again.",
      code: "INTERNAL_ERROR",
    };
  }
}
