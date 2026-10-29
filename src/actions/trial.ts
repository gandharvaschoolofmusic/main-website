"use server";

import { getCurrentUser } from "@/lib/auth-helpers";
import { hashPassword } from "@/lib/password";
import { db } from "@/lib/db";
import { TrialRequestStatus, Role, TrialStatus, NotificationType, EnrollmentStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fromZonedTime } from "date-fns-tz";
import { normalizePhoneNumber, isValidPhoneNumber, validateAndConsumePhoneOtp } from "@/lib/phone";
import { createNotification, notifyAdmins } from "@/actions/notifications";
import { generateNextStudentId } from "@/lib/id-generator";

const CreateTrialRequestSchema = z.object({
  category: z.string().min(1, "Category is required"),
  instrument: z.string().min(1, "Instrument or discipline is required"),
  requestedDate: z.string().min(1, "Requested date is required"), // YYYY-MM-DD
  timeSlot: z.string().min(1, "Time slot is required"), // e.g. "10:30 AM"
  timezone: z.string().default("UTC"),
  ageGroup: z.string().min(1, "Student age group is required"),
  studentName: z.string().min(2, "Name must be at least 2 characters"),
  studentEmail: z.string().email("Valid email address is required"),
  studentPhone: z.string().optional(),
  otpCode: z.string().optional(),
  studentNotes: z.string().optional(),
  password: z.string().optional(),
});

export type CreateTrialRequestInput = z.infer<typeof CreateTrialRequestSchema>;


/**
 * Parses date string (YYYY-MM-DD) and 12-hour time string ("10:30 AM" or "04:00 PM")
 * in the student's local timezone and converts to a proper UTC Date.
 *
 * Previously this appended "Z" to the ISO string, incorrectly treating the local
 * wall-clock time as UTC. Now it uses fromZonedTime to correctly offset.
 */
function parseDateTimeToUTC(dateStr: string, timeStr: string, timezone: string): Date {
  const [year, month, day] = dateStr.split("-").map(Number);
  const match = timeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  
  let hours = 10;
  let minutes = 0;
  if (match) {
    hours = parseInt(match[1], 10);
    minutes = parseInt(match[2], 10);
    const meridiem = match[3].toUpperCase();
    if (meridiem === "PM" && hours < 12) hours += 12;
    if (meridiem === "AM" && hours === 12) hours = 0;
  }

  // Build a local wall-clock datetime string (no Z suffix — this is local time)
  const pad = (n: number) => String(n).padStart(2, "0");
  const localDateTimeStr = `${year}-${pad(month)}-${pad(day)}T${pad(hours)}:${pad(minutes)}:00`;

  // Convert from the student's timezone to UTC
  try {
    const utcDate = fromZonedTime(localDateTimeStr, timezone);
    if (isNaN(utcDate.getTime())) {
      return new Date(Date.now() + 24 * 3600 * 1000);
    }
    return utcDate;
  } catch {
    // fallback if timezone is invalid
    return new Date(Date.now() + 24 * 3600 * 1000);
  }
}

/**
 * Creates a trial lesson request from the student booking wizard.
 * When the user is not signed in, a proper student account is created
 * with a hashed password so they can log in afterwards.
 */
export async function createTrialRequestAction(input: CreateTrialRequestInput) {
  try {
    const validated = CreateTrialRequestSchema.parse(input);
    const currentUser = await getCurrentUser();

    let studentUserId: string;
    let savedPhone: string | null = null;

    if (currentUser) {
      studentUserId = currentUser.id;

      // Strict Business Rule: Converted students or students with active course enrollments cannot book free trials
      const [convertedTrialRecord, activeEnrollmentRecord] = await Promise.all([
        db.trialRequest.findFirst({
          where: {
            studentId: currentUser.id,
            isConverted: true,
          },
        }),
        db.enrollment.findFirst({
          where: {
            studentId: currentUser.id,
            status: EnrollmentStatus.ACTIVE,
          },
        }),
      ]);

      if (convertedTrialRecord || activeEnrollmentRecord) {
        return {
          success: false,
          error:
            "You are already an enrolled Gandharva student. Complimentary free trials are strictly reserved for new prospective students. Please explore our Course Catalog to continue your musical education.",
        };
      }

      // If user is already logged in, save phone if provided and not yet set
      if (validated.studentPhone?.trim()) {
        const norm = normalizePhoneNumber(validated.studentPhone);
        if (isValidPhoneNumber(norm)) {
          savedPhone = norm;
          const userRecord = await db.user.findUnique({
            where: { id: currentUser.id },
            select: { phone: true },
          });
          if (!userRecord?.phone) {
            await db.user.update({
              where: { id: currentUser.id },
              data: { phone: norm, phoneVerified: new Date() },
            });
          }
        }
      }
    } else {
      // Require password for unauthenticated users creating a new account
      if (!validated.password || validated.password.length < 6) {
        return {
          success: false,
          error: "Password must be at least 6 characters to create your student account.",
        };
      }

      // MANDATORY: Require mobile phone number for new student account creation
      if (!validated.studentPhone || !validated.studentPhone.trim()) {
        return {
          success: false,
          error: "Mobile phone number is mandatory to book a trial lesson and create an account.",
        };
      }

      const normalizedPhone = normalizePhoneNumber(validated.studentPhone);
      if (!isValidPhoneNumber(normalizedPhone)) {
        return {
          success: false,
          error: "Please enter a valid mobile number with country code (e.g. +91 98765 43210).",
        };
      }

      // Strict check: Check if phone number or email belongs to an already converted or enrolled student
      const existingConvertedUser = await db.user.findFirst({
        where: {
          OR: [
            { phone: normalizedPhone },
            { email: validated.studentEmail.toLowerCase().trim() },
          ],
        },
        select: {
          id: true,
          trialRequestsAsStudent: {
            where: { isConverted: true },
            select: { id: true },
          },
          enrollments: {
            where: { status: EnrollmentStatus.ACTIVE },
            select: { id: true },
          },
        },
      });

      if (
        existingConvertedUser &&
        (existingConvertedUser.trialRequestsAsStudent.length > 0 ||
          existingConvertedUser.enrollments.length > 0)
      ) {
        return {
          success: false,
          error:
            "An account associated with this email or phone number is already an enrolled Gandharva student. Complimentary free trials are strictly reserved for new prospective students. Please sign in to explore courses or manage your active enrollments.",
        };
      }

      // MANDATORY: Require 6-digit OTP code for new student account creation
      if (!validated.otpCode || validated.otpCode.trim().length !== 6) {
        return {
          success: false,
          error: "Please verify your mobile number. A 6-digit OTP code is required.",
        };
      }

      // Check if phone number is already registered to another account
      const existingPhoneUser = await db.user.findUnique({
        where: { phone: normalizedPhone },
      });

      if (existingPhoneUser) {
        return {
          success: false,
          error: "An account with this mobile phone number already exists. Please sign in to book your free trial.",
        };
      }

      // Check if email already registered with a password
      const existingEmail = await db.user.findUnique({
        where: { email: validated.studentEmail.toLowerCase().trim() },
      });

      if (existingEmail && existingEmail.passwordHash) {
        return {
          success: false,
          error: "An account with this email address already exists. Please sign in to book your free trial.",
        };
      }

      // Verify and consume the OTP code
      const otpValidation = await validateAndConsumePhoneOtp(normalizedPhone, validated.otpCode.trim());
      if (!otpValidation.isValid) {
        return {
          success: false,
          error: otpValidation.error || "Mobile number verification failed. Please enter the valid 6-digit OTP code sent to your phone.",
        };
      }

      savedPhone = normalizedPhone;

      // Find or create student user with verified phone and password
      if (existingEmail) {
        // If the user already exists as guest without password, update them
        const hashed = await hashPassword(validated.password);
        await db.user.update({
          where: { id: existingEmail.id },
          data: {
            name: validated.studentName.trim(),
            passwordHash: hashed,
            phone: normalizedPhone,
            phoneVerified: new Date(),
            emailVerified: new Date(),
            timezone: validated.timezone || "UTC",
          },
        });
        studentUserId = existingEmail.id;
      } else {
        const hashed = await hashPassword(validated.password);
        const studentCustomId = await generateNextStudentId(db);
        const newUser = await db.user.create({
          data: {
            name: validated.studentName.trim(),
            email: validated.studentEmail.toLowerCase().trim(),
            phone: normalizedPhone,
            phoneVerified: new Date(),
            passwordHash: hashed,
            emailVerified: new Date(),
            role: Role.STUDENT,
            timezone: validated.timezone || "UTC",
            customId: studentCustomId,
          },
        });
        studentUserId = newUser.id;
      }
    }

    // Strict Business Rule: Enrolled/converted students cannot book free trials
    const [finalConvertedCheck, finalEnrollmentCheck] = await Promise.all([
      db.trialRequest.findFirst({
        where: {
          studentId: studentUserId,
          isConverted: true,
        },
      }),
      db.enrollment.findFirst({
        where: {
          studentId: studentUserId,
          status: EnrollmentStatus.ACTIVE,
        },
      }),
    ]);

    if (finalConvertedCheck || finalEnrollmentCheck) {
      return {
        success: false,
        error:
          "You are already an enrolled Gandharva student. Complimentary free trials are strictly reserved for new prospective students. Please explore our Course Catalog to continue your musical education.",
      };
    }

    // Check or initialize free trial status
    let trialStatus = await db.studentTrialStatus.findUnique({
      where: { studentId: studentUserId },
    });

    if (!trialStatus) {
      const settings = await db.platformSettings.findUnique({ where: { id: 1 } });
      const defaultQuota = settings?.freeTrialLessonCount ?? 2;
      trialStatus = await db.studentTrialStatus.create({
        data: {
          studentId: studentUserId,
          lessonsGranted: defaultQuota,
          lessonsUsed: 0,
          status: TrialStatus.ACTIVE,
        },
      });
    }

    // Check if free trials remaining
    if (trialStatus.lessonsUsed >= trialStatus.lessonsGranted) {
      return {
        success: false,
        error: "You have completed your complimentary free trial quota. Please enroll in a Gandharva course to continue lessons.",
      };
    }

    // Check if student already has a pending trial request
    const existingPending = await db.trialRequest.findFirst({
      where: {
        studentId: studentUserId,
        status: TrialRequestStatus.PENDING,
      },
    });

    if (existingPending) {
      return {
        success: false,
        error: "You already have a trial lesson request awaiting teacher allotment. Our academy director will assign your instructor shortly.",
      };
    }

    const requestedStartsAt = parseDateTimeToUTC(
      validated.requestedDate,
      validated.timeSlot,
      validated.timezone
    );

    const trialRequest = await db.trialRequest.create({
      data: {
        studentId: studentUserId,
        category: validated.category,
        instrument: validated.instrument,
        requestedStartsAt,
        preferredTimeSlot: validated.timeSlot,
        timezone: validated.timezone,
        ageGroup: validated.ageGroup,
        studentName: validated.studentName.trim(),
        studentEmail: validated.studentEmail.toLowerCase().trim(),
        studentPhone: savedPhone || (validated.studentPhone ? normalizePhoneNumber(validated.studentPhone) : null),
        studentNotes: validated.studentNotes?.trim() || null,
        status: TrialRequestStatus.PENDING,
      },
    });

    // Fast-info notifications for admin and student
    try {
      await notifyAdmins({
        type: NotificationType.NEW_TRIAL_REQUEST,
        title: "New Trial Request",
        body: `${validated.studentName} requested a 1:1 trial session for ${validated.instrument} (${validated.timeSlot}).`,
        link: "/admin/trials",
      });
      await createNotification({
        userId: studentUserId,
        type: NotificationType.NEW_TRIAL_REQUEST,
        title: "Trial Request Received",
        body: `Your trial request for ${validated.instrument} has been received. Our team is assigning a maestro.`,
        link: "/student/dashboard",
      });
    } catch {
      // Non-blocking notification emission
    }

    try {
      revalidatePath("/student/dashboard");
      revalidatePath("/admin/trials");
      revalidatePath("/admin");
    } catch {
      // Ignored outside Next.js request lifecycle
    }

    return {
      success: true,
      trialRequestId: trialRequest.id,
      message: "Trial lesson request submitted successfully! Academy administration is assigning your instructor.",
    };
  } catch (err) {
    console.error("Error creating trial request:", err);
    if (err instanceof z.ZodError) {
      return { success: false, error: err.issues[0]?.message || "Invalid input data." };
    }
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to submit trial request.",
    };
  }
}

/**
 * Retrieves the student's active pending trial request (if any).
 */
export async function getStudentPendingTrialRequestAction() {
  const currentUser = await getCurrentUser();
  if (!currentUser) return null;

  return db.trialRequest.findFirst({
    where: {
      studentId: currentUser.id,
      status: TrialRequestStatus.PENDING,
    },
    orderBy: { createdAt: "desc" },
  });
}
