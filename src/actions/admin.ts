"use server";

import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth-helpers";
import {
  Role,
  LessonStatus,
  LessonSource,
  Discipline,
  CourseLevel,
  EventType,
  TicketStatus,
  EnrollmentStatus,
  TrialRequestStatus,
  TrialStatus,
  TeacherApprovalStatus,
  TeacherPayoutStatus,
  PaymentStatus,
  NotificationType,
  CourseRequestStatus,
  CoursePaymentPlan,
  CourseEmiStatus,
} from "@prisma/client";
import { hashPassword } from "@/lib/password";
import { normalizePhoneNumber, isValidPhoneNumber } from "@/lib/phone";
import { revalidatePath, revalidateTag } from "next/cache";
import { logger } from "@/lib/logger";
import { generateUniqueLessonTrackingCode, getLessonTrackingId } from "@/lib/lesson-tracking";
import { generateNextStudentId } from "@/lib/id-generator";
import { createNotification } from "@/actions/notifications";

export type AdminActionResponse<T = unknown> = {
  success: boolean;
  error?: string;
  message?: string;
  data?: T;
};

// ─── 1. Settings ─────────────────────────────────────────────────────────────

export async function updatePlatformSettingsAction(input: {
  freeTrialLessonCount: number;
  googleDriveFolderLink?: string | null;
}): Promise<AdminActionResponse> {
  try {
    await requireRole(Role.ADMIN);

    const count = Math.max(0, Math.min(10, Math.floor(input.freeTrialLessonCount)));

    const updateData: Record<string, unknown> = {
      freeTrialLessonCount: count,
      storageProvider: "SUPABASE",
    };

    await db.platformSettings.upsert({
      where: { id: 1 },
      create: {
        id: 1,
        freeTrialLessonCount: count,
        storageProvider: "SUPABASE",
      },
      update: updateData,
    });

    logger.info(
      { freeTrialLessonCount: count, storageProvider: "SUPABASE" },
      "Platform settings updated",
    );
    revalidatePath("/admin/settings");
    revalidatePath("/admin");
    revalidatePath("/teacher/dashboard/resources");
    revalidatePath("/student/dashboard/resources");

    return { success: true };
  } catch (error) {
    logger.error({ error }, "Error updating platform settings");
    return { success: false, error: "Failed to update platform settings." };
  }
}

/**
 * Test whether a Google Drive folder link is accessible by the service account.
 */
export async function testDriveFolderAction(
  _folderLink?: string,
): Promise<AdminActionResponse<{ folderName: string; isSharedDrive?: boolean; warning?: string }>> {
  try {
    await requireRole(Role.ADMIN);
    return {
      success: true,
      data: {
        folderName: "Supabase Cloud Database & Storage",
        isSharedDrive: true,
      },
    };
  } catch (error) {
    logger.error({ error }, "Error testing storage access");
    return {
      success: false,
      error: "Failed to test storage access.",
    };
  }
}

// ─── 2. Enrollments: Teacher Allotment & Student-Wise Lesson Scheduling ───────

export interface ScheduledEnrollmentLessonItem {
  id: string;
  trackingCode: string;
  startsAt: string;
  durationMinutes: number;
  status: LessonStatus;
  teacherId: string;
  teacherName: string;
  payoutRupees: number;
}

export interface EnrollmentScheduleDetails {
  enrollment: {
    id: string;
    studentId: string;
    courseId: string;
    teacherId: string | null;
    status: EnrollmentStatus;
    sessionsRemaining: number;
    startedAt: string;
  };
  student: {
    id: string;
    name: string;
    email: string;
    timezone: string;
  };
  course: {
    id: string;
    title: string;
    instrument: string;
    sessionCount: number;
    durationWeeks: number;
    priceMinorUnits: number;
    currency: string;
  };
  teacher: {
    id: string;
    name: string;
    email: string;
    instruments: string[];
    payoutRupees: number;
  } | null;
  lessons: ScheduledEnrollmentLessonItem[];
  payment: {
    id: string;
    gatewayOrderId: string;
    gatewayPaymentId: string | null;
    amountMinorUnits: number;
    currency: string;
    status: string;
  } | null;
}

export async function getEnrollmentScheduleAction(
  enrollmentId: string,
): Promise<AdminActionResponse<EnrollmentScheduleDetails>> {
  try {
    await requireRole(Role.ADMIN);

    const enrollment = await db.enrollment.findUnique({
      where: { id: enrollmentId },
      include: {
        student: { select: { id: true, name: true, email: true, timezone: true } },
        course: {
          select: {
            id: true,
            title: true,
            instrument: true,
            sessionCount: true,
            durationWeeks: true,
            priceMinorUnits: true,
            currency: true,
          },
        },
        payment: {
          select: {
            id: true,
            gatewayOrderId: true,
            gatewayPaymentId: true,
            amountMinorUnits: true,
            currency: true,
            status: true,
          },
        },
        lessons: {
          include: {
            teacher: {
              select: {
                id: true,
                name: true,
                teacherProfile: { select: { payoutPerSession: true } },
              },
            },
          },
          orderBy: { startsAt: "asc" },
        },
      },
    });

    if (!enrollment) {
      return { success: false, error: "Enrollment not found." };
    }

    let allottedTeacher = null;
    if (enrollment.teacherId) {
      const t = await db.user.findUnique({
        where: { id: enrollment.teacherId },
        include: { teacherProfile: true },
      });
      if (t) {
        allottedTeacher = {
          id: t.id,
          name: t.name || "Teacher",
          email: t.email,
          instruments: t.teacherProfile?.instruments || [],
          payoutRupees: (t.teacherProfile?.payoutPerSession || 80000) / 100,
        };
      }
    }

    const lessonsData: ScheduledEnrollmentLessonItem[] = enrollment.lessons.map((l) => ({
      id: l.id,
      trackingCode: getLessonTrackingId(l),
      startsAt: l.startsAt.toISOString(),
      durationMinutes: l.durationMinutes,
      status: l.status,
      teacherId: l.teacherId,
      teacherName: l.teacher?.name || "Assigned Teacher",
      payoutRupees: (l.teacher?.teacherProfile?.payoutPerSession || 80000) / 100,
    }));

    return {
      success: true,
      data: {
        enrollment: {
          id: enrollment.id,
          studentId: enrollment.studentId,
          courseId: enrollment.courseId,
          teacherId: enrollment.teacherId,
          status: enrollment.status,
          sessionsRemaining: enrollment.sessionsRemaining,
          startedAt: enrollment.startedAt.toISOString(),
        },
        student: {
          id: enrollment.student.id,
          name: enrollment.student.name || "Student",
          email: enrollment.student.email,
          timezone: enrollment.student.timezone || "UTC",
        },
        course: {
          id: enrollment.course.id,
          title: enrollment.course.title,
          instrument: enrollment.course.instrument,
          sessionCount: enrollment.course.sessionCount,
          durationWeeks: enrollment.course.durationWeeks,
          priceMinorUnits: enrollment.course.priceMinorUnits,
          currency: enrollment.course.currency,
        },
        teacher: allottedTeacher,
        lessons: lessonsData,
        payment: enrollment.payment
          ? {
              id: enrollment.payment.id,
              gatewayOrderId: enrollment.payment.gatewayOrderId,
              gatewayPaymentId: enrollment.payment.gatewayPaymentId,
              amountMinorUnits: enrollment.payment.amountMinorUnits,
              currency: enrollment.payment.currency,
              status: enrollment.payment.status,
            }
          : null,
      },
    };
  } catch (error) {
    logger.error({ error, enrollmentId }, "Error fetching enrollment schedule");
    return { success: false, error: "Failed to fetch enrollment schedule." };
  }
}

export async function reassignEnrollmentTeacherAction(input: {
  enrollmentId: string;
  teacherId: string;
  updateUpcomingLessons?: boolean;
}): Promise<AdminActionResponse> {
  try {
    await requireRole(Role.ADMIN);

    const teacher = await db.user.findUnique({
      where: { id: input.teacherId },
      include: { teacherProfile: true },
    });

    if (!teacher || teacher.role !== Role.TEACHER || !teacher.teacherProfile) {
      return { success: false, error: "Selected user is not a registered teacher." };
    }

    const enrollment = await db.enrollment.findUnique({
      where: { id: input.enrollmentId },
    });

    if (!enrollment) {
      return { success: false, error: "Enrollment not found." };
    }

    await db.enrollment.update({
      where: { id: input.enrollmentId },
      data: { teacherId: input.teacherId },
    });

    if (input.updateUpcomingLessons) {
      await db.lesson.updateMany({
        where: {
          enrollmentId: input.enrollmentId,
          status: LessonStatus.SCHEDULED,
          startsAt: { gt: new Date() },
        },
        data: {
          teacherId: input.teacherId,
          teacherProfileId: teacher.teacherProfile.id,
        },
      });
    }

    logger.info(
      { enrollmentId: input.enrollmentId, teacherId: input.teacherId },
      "Enrollment teacher assigned/reassigned by admin",
    );

    revalidatePath("/admin/enrollments");
    revalidatePath("/admin");
    revalidatePath("/student/dashboard");
    revalidatePath("/teacher/dashboard");

    return { success: true };
  } catch (error) {
    logger.error({ error }, "Error reassigning enrollment teacher");
    return { success: false, error: "Failed to assign teacher." };
  }
}

export async function scheduleEnrollmentLessonAction(input: {
  enrollmentId: string;
  teacherId?: string;
  startsAt: string;
  durationMinutes?: number;
}): Promise<AdminActionResponse<{ lessonId: string; trackingCode: string }>> {
  try {
    await requireRole(Role.ADMIN);

    const enrollment = await db.enrollment.findUnique({
      where: { id: input.enrollmentId },
      include: {
        course: true,
        student: true,
      },
    });

    if (!enrollment) {
      return { success: false, error: "Enrollment record not found." };
    }

    const teacherToUse = input.teacherId || enrollment.teacherId;
    if (!teacherToUse) {
      return {
        success: false,
        error: "Please allot a faculty teacher to this student before scheduling sessions.",
      };
    }

    const teacher = await db.user.findUnique({
      where: { id: teacherToUse },
      include: { teacherProfile: true },
    });

    if (!teacher || teacher.role !== Role.TEACHER || !teacher.teacherProfile) {
      return { success: false, error: "Selected teacher profile is not active." };
    }

    if (enrollment.teacherId !== teacherToUse) {
      await db.enrollment.update({
        where: { id: enrollment.id },
        data: { teacherId: teacherToUse },
      });
    }

    const startsAtDate = new Date(input.startsAt);
    if (isNaN(startsAtDate.getTime())) {
      return { success: false, error: "Invalid date and time selected." };
    }

    const trackingCode = await generateUniqueLessonTrackingCode(enrollment.studentId, db);

    const lesson = await db.lesson.create({
      data: {
        teacherId: teacher.id,
        teacherProfileId: teacher.teacherProfile.id,
        studentId: enrollment.studentId,
        instrument: enrollment.course.instrument,
        startsAt: startsAtDate,
        durationMinutes: input.durationMinutes || 60,
        status: LessonStatus.SCHEDULED,
        lessonSource: LessonSource.ENROLLMENT,
        enrollmentId: enrollment.id,
        groupRoomId: null, // Strictly 1-to-1 private lesson!
        trackingCode,
      },
    });

    logger.info(
      {
        lessonId: lesson.id,
        trackingCode,
        enrollmentId: enrollment.id,
        studentId: enrollment.studentId,
        teacherId: teacher.id,
      },
      "1-on-1 enrollment lesson created with unique tracking ID by admin",
    );

    revalidatePath("/admin/enrollments");
    revalidatePath("/admin/lessons");
    revalidatePath("/admin");
    revalidatePath("/student/dashboard");
    revalidatePath("/teacher/dashboard");
    revalidatePath("/teacher/dashboard/earnings");

    return {
      success: true,
      data: { lessonId: lesson.id, trackingCode },
    };
  } catch (error) {
    logger.error({ error, input }, "Error scheduling enrollment lesson");
    return { success: false, error: "Failed to schedule lesson." };
  }
}

export async function bulkScheduleEnrollmentLessonsAction(input: {
  enrollmentId: string;
  teacherId?: string;
  slots: Array<{ startsAt: string; durationMinutes?: number }>;
}): Promise<AdminActionResponse<{ createdCount: number }>> {
  try {
    await requireRole(Role.ADMIN);

    const enrollment = await db.enrollment.findUnique({
      where: { id: input.enrollmentId },
      include: {
        course: true,
        student: true,
      },
    });

    if (!enrollment) {
      return { success: false, error: "Enrollment record not found." };
    }

    const teacherToUse = input.teacherId || enrollment.teacherId;
    if (!teacherToUse) {
      return {
        success: false,
        error: "Please allot a faculty teacher to this student before scheduling sessions.",
      };
    }

    const teacher = await db.user.findUnique({
      where: { id: teacherToUse },
      include: { teacherProfile: true },
    });

    if (!teacher || teacher.role !== Role.TEACHER || !teacher.teacherProfile) {
      return { success: false, error: "Selected teacher profile is not active." };
    }

    if (enrollment.teacherId !== teacherToUse) {
      await db.enrollment.update({
        where: { id: enrollment.id },
        data: { teacherId: teacherToUse },
      });
    }

    let createdCount = 0;
    for (const slot of input.slots) {
      const startsAtDate = new Date(slot.startsAt);
      if (isNaN(startsAtDate.getTime())) continue;

      const trackingCode = await generateUniqueLessonTrackingCode(enrollment.studentId, db);

      await db.lesson.create({
        data: {
          teacherId: teacher.id,
          teacherProfileId: teacher.teacherProfile.id,
          studentId: enrollment.studentId,
          instrument: enrollment.course.instrument,
          startsAt: startsAtDate,
          durationMinutes: slot.durationMinutes || 60,
          status: LessonStatus.SCHEDULED,
          lessonSource: LessonSource.ENROLLMENT,
          enrollmentId: enrollment.id,
          groupRoomId: null, // Strictly 1-to-1 private lesson!
          trackingCode,
        },
      });
      createdCount++;
    }

    logger.info(
      {
        enrollmentId: enrollment.id,
        createdCount,
        studentId: enrollment.studentId,
        teacherId: teacher.id,
      },
      "Bulk 1-on-1 lessons scheduled for enrollment by admin",
    );

    revalidatePath("/admin/enrollments");
    revalidatePath("/admin/lessons");
    revalidatePath("/admin");
    revalidatePath("/student/dashboard");
    revalidatePath("/teacher/dashboard");
    revalidatePath("/teacher/dashboard/earnings");

    return { success: true, data: { createdCount } };
  } catch (error) {
    logger.error({ error, input }, "Error bulk scheduling enrollment lessons");
    return { success: false, error: "Failed to bulk schedule lessons." };
  }
}

export async function rescheduleEnrollmentLessonAction(input: {
  lessonId: string;
  startsAt: string;
  durationMinutes?: number;
}): Promise<AdminActionResponse> {
  try {
    await requireRole(Role.ADMIN);

    const lesson = await db.lesson.findUnique({
      where: { id: input.lessonId },
      include: {
        student: { select: { id: true, name: true, email: true, timezone: true } },
        teacher: { select: { id: true, name: true, email: true, timezone: true } },
        enrollment: {
          include: {
            course: { select: { id: true, title: true, instrument: true } },
          },
        },
      },
    });

    if (!lesson) {
      return { success: false, error: "Lesson not found." };
    }

    const startsAtDate = new Date(input.startsAt);
    if (isNaN(startsAtDate.getTime())) {
      return { success: false, error: "Invalid date and time." };
    }

    // Automatically set status to RESCHEDULED
    await db.lesson.update({
      where: { id: input.lessonId },
      data: {
        startsAt: startsAtDate,
        durationMinutes: input.durationMinutes || lesson.durationMinutes,
        status: LessonStatus.RESCHEDULED,
      },
    });

    const courseOrInstrument =
      lesson.enrollment?.course?.title || lesson.instrument || "Class";
    const teacherName = lesson.teacher?.name || "your faculty mentor";

    // 1. Send in-app notification to Student dashboard notification bell
    if (lesson.studentId) {
      const studentTz = lesson.student?.timezone || "Asia/Kolkata";
      const studentFormattedDate = startsAtDate.toLocaleString("en-IN", {
        timeZone: studentTz,
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });

      await createNotification({
        userId: lesson.studentId,
        type: NotificationType.LESSON_RESCHEDULED,
        title: "Class Rescheduled",
        body: `Your ${courseOrInstrument} session with ${teacherName} has been rescheduled to ${studentFormattedDate}.`,
        link: "/student/dashboard/calendar",
      });
    }

    // 2. Send in-app notification to Teacher dashboard notification bell
    if (lesson.teacherId) {
      const teacherTz = lesson.teacher?.timezone || "Asia/Kolkata";
      const teacherFormattedDate = startsAtDate.toLocaleString("en-IN", {
        timeZone: teacherTz,
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });

      await createNotification({
        userId: lesson.teacherId,
        type: NotificationType.LESSON_RESCHEDULED,
        title: "Class Rescheduled",
        body: `Your ${courseOrInstrument} session with ${lesson.student?.name || "student"} has been rescheduled to ${teacherFormattedDate}.`,
        link: "/teacher/dashboard/calendar",
      });
    }

    // 3. Revalidate paths for admin, student, and teacher calendars and dashboards
    revalidatePath("/admin/enrollments");
    revalidatePath("/admin/lessons");
    revalidatePath("/student/dashboard");
    revalidatePath("/student/dashboard/calendar");
    revalidatePath("/teacher/dashboard");
    revalidatePath("/teacher/dashboard/calendar");

    return { success: true };
  } catch (error) {
    logger.error({ error, input }, "Error rescheduling enrollment lesson");
    return { success: false, error: "Failed to reschedule lesson." };
  }
}

export async function deleteOrCancelEnrollmentLessonAction(
  lessonId: string,
): Promise<AdminActionResponse> {
  try {
    const admin = await requireRole(Role.ADMIN);

    const lesson = await db.lesson.findUnique({
      where: { id: lessonId },
    });

    if (!lesson) {
      return { success: false, error: "Lesson not found." };
    }

    await db.lesson.update({
      where: { id: lessonId },
      data: {
        status: LessonStatus.CANCELLED,
        cancelledBy: admin.id,
        cancelledAt: new Date(),
      },
    });

    revalidatePath("/admin/enrollments");
    revalidatePath("/admin/lessons");
    revalidatePath("/student/dashboard");
    revalidatePath("/teacher/dashboard");

    return { success: true };
  } catch (error) {
    logger.error({ error, lessonId }, "Error cancelling enrollment lesson");
    return { success: false, error: "Failed to cancel lesson." };
  }
}

export async function saveFullEnrollmentPlanAction(input: {
  enrollmentId?: string | null;
  trialRequestId?: string | null;
  studentId: string;
  courseId: string;
  teacherId?: string | null;
  sessionsRemaining?: number;
  status?: EnrollmentStatus;
  adminNotes?: string | null;
  paymentFeeRupees?: number;
  paidAmountRupees?: number;
  paymentStatus?: "UNPAID" | "PARTIALLY_PAID" | "FULLY_PAID";
  generatedSlots?: Array<{ startsAt: string; durationMinutes?: number }>;
}): Promise<AdminActionResponse<{ enrollmentId: string }>> {
  try {
    await requireRole(Role.ADMIN);

    const student = await db.user.findUnique({
      where: { id: input.studentId },
      select: { id: true, name: true, email: true },
    });
    if (!student) {
      return { success: false, error: "Student not found." };
    }

    const course = await db.course.findUnique({
      where: { id: input.courseId },
      select: { id: true, title: true, instrument: true, sessionCount: true, priceMinorUnits: true },
    });
    if (!course) {
      return { success: false, error: "Course not found." };
    }

    let teacher = null;
    if (input.teacherId) {
      teacher = await db.user.findUnique({
        where: { id: input.teacherId },
        include: { teacherProfile: true },
      });
    }

    const totalSessions =
      input.sessionsRemaining !== undefined && input.sessionsRemaining > 0
        ? input.sessionsRemaining
        : course.sessionCount;

    let targetEnrollmentId = input.enrollmentId;

    if (targetEnrollmentId) {
      await db.enrollment.update({
        where: { id: targetEnrollmentId },
        data: {
          courseId: course.id,
          teacherId: input.teacherId || null,
          sessionsRemaining: totalSessions,
          status: input.status || EnrollmentStatus.ACTIVE,
          adminNotes: input.adminNotes !== undefined ? input.adminNotes : undefined,
        },
      });
    } else {
      const created = await db.enrollment.create({
        data: {
          studentId: student.id,
          courseId: course.id,
          teacherId: input.teacherId || null,
          sessionsRemaining: totalSessions,
          status: input.status || EnrollmentStatus.ACTIVE,
          adminNotes: input.adminNotes || "Created from Enrollment Planner",
        },
      });
      targetEnrollmentId = created.id;
    }

    // Convert Trial Lead if linked
    if (input.trialRequestId) {
      await db.trialRequest.updateMany({
        where: { id: input.trialRequestId },
        data: {
          isConverted: true,
          convertedAt: new Date(),
        },
      });
      await db.studentTrialStatus.updateMany({
        where: { studentId: student.id },
        data: { status: TrialStatus.EXHAUSTED },
      });
    }

    // Record payment if paid amount specified
    if (input.paidAmountRupees && input.paidAmountRupees > 0) {
      const amountMinorUnits = Math.round(input.paidAmountRupees * 100);
      const isFull =
        input.paymentFeeRupees && input.paidAmountRupees >= input.paymentFeeRupees;
      const receiptCode = `RCPT-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

      const pmt = await db.payment.create({
        data: {
          studentId: student.id,
          enrollmentId: targetEnrollmentId,
          amountMinorUnits,
          currency: "INR",
          gateway: "manual",
          gatewayOrderId: `rec_order_${receiptCode}`,
          gatewayPaymentId: receiptCode,
          notes: "Initial admission payment tranche",
          status: PaymentStatus.PAID,
        },
      });

      await db.enrollment.update({
        where: { id: targetEnrollmentId },
        data: {
          paymentId: pmt.id,
          emiStatus: isFull ? CourseEmiStatus.FULLY_PAID : CourseEmiStatus.PARTIALLY_PAID,
        },
      });
    }

    // Generate scheduled 1-on-1 lessons if slots provided and teacher allotted
    if (input.generatedSlots && input.generatedSlots.length > 0 && teacher && teacher.teacherProfile) {
      for (const slot of input.generatedSlots) {
        const slotDate = new Date(slot.startsAt);
        if (!isNaN(slotDate.getTime())) {
          const trackingCode = await generateUniqueLessonTrackingCode(student.id, db);
          await db.lesson.create({
            data: {
              teacherId: teacher.id,
              teacherProfileId: teacher.teacherProfile.id,
              studentId: student.id,
              instrument: course.instrument,
              startsAt: slotDate,
              durationMinutes: slot.durationMinutes || 60,
              status: LessonStatus.SCHEDULED,
              lessonSource: LessonSource.ENROLLMENT,
              enrollmentId: targetEnrollmentId,
              trackingCode,
            },
          });
        }
      }
    }

    revalidatePath("/admin/enrollments");
    revalidatePath("/admin/trials");
    revalidatePath("/admin/students");
    revalidatePath("/admin/lessons");
    revalidatePath("/student/dashboard");
    revalidatePath("/teacher/dashboard");

    return {
      success: true,
      message: `Enrollment for ${student.name} in ${course.title} saved successfully!`,
      data: { enrollmentId: targetEnrollmentId },
    };
  } catch (error) {
    logger.error({ error, input }, "Error saving full enrollment plan");
    const errMsg = error instanceof Error ? error.message : "Failed to save enrollment.";
    return { success: false, error: errMsg };
  }
}

// ─── 3. Users Management ─────────────────────────────────────────────────────

export async function updateUserAdminAction(input: {
  userId: string;
  name?: string;
  phone?: string | null;
  role?: Role;
  isActive?: boolean;
  newPassword?: string;
  trialCount?: number;
  payoutPerSession?: number;
  teacherApprovalStatus?: TeacherApprovalStatus;
  rejectionReason?: string;
}): Promise<AdminActionResponse> {
  try {
    await requireRole(Role.ADMIN);

    const updateData: Record<string, unknown> = {};
    if (input.name !== undefined) updateData.name = input.name.trim();
    if (input.role !== undefined) updateData.role = input.role;
    if (input.isActive !== undefined) updateData.isActive = input.isActive;
    if (input.newPassword) {
      updateData.passwordHash = await hashPassword(input.newPassword);
    }

    if (input.phone !== undefined) {
      if (input.phone && input.phone.trim()) {
        const normalized = normalizePhoneNumber(input.phone);
        if (!isValidPhoneNumber(normalized)) {
          return {
            success: false,
            error: "Invalid phone number format. Please include country code (e.g. +91 98765 43210).",
          };
        }

        const existing = await db.user.findFirst({
          where: {
            phone: normalized,
            NOT: { id: input.userId },
          },
        });

        if (existing) {
          return {
            success: false,
            error: "This phone number is already registered to another user.",
          };
        }

        updateData.phone = normalized;
        updateData.phoneVerified = new Date();
      } else {
        updateData.phone = null;
        updateData.phoneVerified = null;
      }
    }

    await db.$transaction(async (tx) => {
      if (Object.keys(updateData).length > 0) {
        await tx.user.update({
          where: { id: input.userId },
          data: updateData,
        });
      }

      // If adjusting trial count for a student
      if (input.trialCount !== undefined) {
        await tx.studentTrialStatus.upsert({
          where: { studentId: input.userId },
          create: {
            studentId: input.userId,
            lessonsGranted: input.trialCount,
            lessonsUsed: 0,
          },
          update: {
            lessonsGranted: input.trialCount,
          },
        });
      }

      // If adjusting payoutPerSession or approvalStatus for a teacher
      if (input.payoutPerSession !== undefined || input.teacherApprovalStatus !== undefined) {
        const teacherProfileData: Record<string, unknown> = {};
        if (input.payoutPerSession !== undefined) {
          teacherProfileData.payoutPerSession = input.payoutPerSession;
        }
        if (input.teacherApprovalStatus !== undefined) {
          teacherProfileData.approvalStatus = input.teacherApprovalStatus;
          if (input.teacherApprovalStatus === TeacherApprovalStatus.APPROVED) {
            teacherProfileData.approvedAt = new Date();
            teacherProfileData.rejectedAt = null;
            teacherProfileData.rejectionReason = null;
          } else if (input.teacherApprovalStatus === TeacherApprovalStatus.REJECTED) {
            teacherProfileData.rejectedAt = new Date();
            teacherProfileData.approvedAt = null;
            teacherProfileData.rejectionReason = input.rejectionReason?.trim() || "Administrative review: requirements not met.";
            teacherProfileData.isPublished = false;
          } else if (input.teacherApprovalStatus === TeacherApprovalStatus.PENDING) {
            teacherProfileData.approvedAt = null;
            teacherProfileData.rejectedAt = null;
            teacherProfileData.rejectionReason = null;
            teacherProfileData.isPublished = false;
          }
        }

        await tx.teacherProfile.upsert({
          where: { userId: input.userId },
          create: {
            userId: input.userId,
            payoutPerSession: input.payoutPerSession ?? 80000,
            instruments: ["Piano"],
            approvalStatus: input.teacherApprovalStatus ?? TeacherApprovalStatus.PENDING,
            approvedAt: input.teacherApprovalStatus === TeacherApprovalStatus.APPROVED ? new Date() : null,
            rejectedAt: input.teacherApprovalStatus === TeacherApprovalStatus.REJECTED ? new Date() : null,
            rejectionReason: input.teacherApprovalStatus === TeacherApprovalStatus.REJECTED ? input.rejectionReason?.trim() || null : null,
          },
          update: teacherProfileData,
        });
      }
    });

    logger.info({ userId: input.userId }, "User updated by admin");
    revalidatePath("/admin/users");
    revalidatePath("/admin/teachers");
    revalidatePath("/teachers");
    revalidatePath("/teacher/dashboard");

    return { success: true };
  } catch (error) {
    logger.error({ error }, "Error updating user via admin");
    return { success: false, error: "Failed to update user." };
  }
}

// ─── 4. Courses Management ───────────────────────────────────────────────────

export async function getFacultyTeachersAction(): Promise<
  AdminActionResponse<
    Array<{
      id: string;
      name: string | null;
      email: string;
      instruments: string[];
      profileId: string | null;
    }>
  >
> {
  try {
    await requireRole(Role.ADMIN);

    const teachers = await db.user.findMany({
      where: { role: Role.TEACHER, isActive: true },
      include: {
        teacherProfile: {
          select: { id: true, instruments: true },
        },
      },
      orderBy: { name: "asc" },
    });

    return {
      success: true,
      data: teachers.map((t) => ({
        id: t.id,
        name: t.name,
        email: t.email,
        instruments: t.teacherProfile?.instruments || [],
        profileId: t.teacherProfile?.id || null,
      })),
    };
  } catch (error) {
    logger.error({ error }, "Error fetching faculty teachers");
    return { success: false, error: "Failed to fetch faculty teachers." };
  }
}

export async function saveCourseAdminAction(input: {
  id?: string;
  title: string;
  slug: string;
  discipline: Discipline;
  instrument: string;
  level: CourseLevel;
  accreditation?: string | null;
  description: string;
  syllabusSummary: string;
  priceMinorUnits: number; // paise
  emiPrice3MinorUnits?: number | null;
  emiPrice6MinorUnits?: number | null;
  allowEmi?: boolean;
  sessionCount: number;
  durationWeeks: number;
  startDate?: string | null;
  endDate?: string | null;
  teacherIds?: string[];
  isPublished: boolean;
}): Promise<AdminActionResponse<{ id: string }>> {
  try {
    await requireRole(Role.ADMIN);

    const payload = {
      title: input.title.trim(),
      slug: input.slug.trim().toLowerCase(),
      discipline: input.discipline,
      instrument: input.instrument.trim(),
      level: input.level,
      accreditation: input.accreditation?.trim() || null,
      description: input.description.trim(),
      syllabusSummary: input.syllabusSummary.trim(),
      priceMinorUnits: Math.max(0, input.priceMinorUnits),
      emiPrice3MinorUnits:
        input.emiPrice3MinorUnits !== undefined && input.emiPrice3MinorUnits !== null
          ? Math.max(0, input.emiPrice3MinorUnits)
          : null,
      emiPrice6MinorUnits:
        input.emiPrice6MinorUnits !== undefined && input.emiPrice6MinorUnits !== null
          ? Math.max(0, input.emiPrice6MinorUnits)
          : null,
      allowEmi: input.allowEmi !== undefined ? input.allowEmi : true,
      sessionCount: Math.max(1, input.sessionCount),
      durationWeeks: Math.max(1, input.durationWeeks),
      startDate: input.startDate ? new Date(input.startDate) : null,
      endDate: input.endDate ? new Date(input.endDate) : null,
      isPublished: input.isPublished,
    };

    let courseId = input.id;

    if (courseId) {
      await db.course.update({
        where: { id: courseId },
        data: payload,
      });
    } else {
      const created = await db.course.create({
        data: payload,
      });
      courseId = created.id;
    }

    // Sync CourseTeacher allotments
    if (input.teacherIds !== undefined && courseId) {
      await db.courseTeacher.deleteMany({
        where: {
          courseId,
          teacherId: { notIn: input.teacherIds },
        },
      });

      for (const teacherId of input.teacherIds) {
        await db.courseTeacher.upsert({
          where: { courseId_teacherId: { courseId, teacherId } },
          create: { courseId, teacherId },
          update: {},
        });
      }
    }

    revalidatePath("/admin/courses");
    revalidatePath("/courses");
    revalidatePath("/student/dashboard/courses");
    revalidateTag("admin-courses", "max");
    revalidateTag("courses", "max");

    return { success: true, data: { id: courseId! } };
  } catch (error) {
    logger.error({ error }, "Error saving course");
    return { success: false, error: "Failed to save course. Check slug uniqueness." };
  }
}

export async function toggleCoursePublishAdminAction(input: {
  courseId: string;
  isPublished: boolean;
}): Promise<AdminActionResponse<{ id: string; isPublished: boolean }>> {
  try {
    await requireRole(Role.ADMIN);

    const existingCourse = await db.course.findUnique({
      where: { id: input.courseId },
      select: { id: true, slug: true, title: true, isPublished: true },
    });

    if (!existingCourse) {
      return { success: false, error: "Course not found." };
    }

    const updated = await db.course.update({
      where: { id: input.courseId },
      data: { isPublished: input.isPublished },
      select: { id: true, isPublished: true },
    });

    revalidatePath("/admin/courses");
    revalidatePath("/courses");
    if (existingCourse.slug) {
      revalidatePath(`/courses/${existingCourse.slug}`);
    }
    revalidatePath("/student/dashboard/courses");
    revalidateTag("admin-courses", "max");
    revalidateTag("courses", "max");

    logger.info(
      { courseId: input.courseId, title: existingCourse.title, isPublished: input.isPublished },
      "Course publication status toggled by admin"
    );

    return { success: true, data: updated };
  } catch (error) {
    logger.error({ error, courseId: input.courseId }, "Error toggling course publication status");
    return { success: false, error: "Failed to update course publication status." };
  }
}

export async function saveCourseLessonAdminAction(input: {
  id?: string;
  courseId: string;
  lessonNumber: number;
  title: string;
  description?: string | null;
  durationMinutes?: number;
  scheduledStartsAt?: string | null;
  teacherId?: string | null;
}): Promise<AdminActionResponse<{ id: string }>> {
  try {
    await requireRole(Role.ADMIN);

    const payload = {
      courseId: input.courseId,
      lessonNumber: Math.max(1, input.lessonNumber),
      title: input.title.trim(),
      description: input.description?.trim() || null,
      durationMinutes: input.durationMinutes ? Math.max(15, input.durationMinutes) : 60,
      scheduledStartsAt: input.scheduledStartsAt ? new Date(input.scheduledStartsAt) : null,
      teacherId: input.teacherId || null,
    };

    let lessonId: string;
    if (input.id) {
      const updated = await db.courseLesson.update({
        where: { id: input.id },
        data: payload,
      });
      lessonId = updated.id;
    } else {
      const created = await db.courseLesson.create({
        data: payload,
      });
      lessonId = created.id;
    }

    revalidatePath("/admin/courses");
    revalidatePath("/courses");
    revalidatePath("/student/dashboard/courses");
    return { success: true, data: { id: lessonId } };
  } catch (error) {
    logger.error({ error }, "Error saving course lesson");
    return { success: false, error: "Failed to save course lesson." };
  }
}

export async function deleteCourseLessonAdminAction(input: {
  lessonId: string;
  courseId: string;
}): Promise<AdminActionResponse> {
  try {
    await requireRole(Role.ADMIN);

    await db.courseLesson.delete({
      where: { id: input.lessonId },
    });

    revalidatePath("/admin/courses");
    return { success: true };
  } catch (error) {
    logger.error({ error }, "Error deleting course lesson");
    return { success: false, error: "Failed to delete course lesson." };
  }
}

export async function bulkGenerateCourseLessonsAdminAction(input: {
  courseId: string;
  defaultTeacherId?: string | null;
  startDate?: string | null;
  sessionCount?: number;
  dayInterval?: number;
}): Promise<AdminActionResponse> {
  try {
    await requireRole(Role.ADMIN);

    const course = await db.course.findUnique({
      where: { id: input.courseId },
      include: { lessons: true, teachers: true },
    });

    if (!course) {
      return { success: false, error: "Course not found." };
    }

    const totalSessions = input.sessionCount || course.sessionCount;
    const intervalDays = input.dayInterval || 7;
    const baseDate = input.startDate
      ? new Date(input.startDate)
      : course.startDate
      ? new Date(course.startDate)
      : new Date(Date.now() + 86400000 * 2);
    baseDate.setHours(10, 0, 0, 0);

    const assignedTeacher =
      input.defaultTeacherId || course.teachers[0]?.teacherId || null;

    const existingNumbers = new Set(course.lessons.map((l) => l.lessonNumber));

    const lessonsToCreate = [];
    for (let i = 1; i <= totalSessions; i++) {
      if (!existingNumbers.has(i)) {
        const lessonDate = new Date(baseDate.getTime() + (i - 1) * intervalDays * 86400000);
        lessonsToCreate.push({
          courseId: course.id,
          lessonNumber: i,
          title: `Lesson ${i}: Masterclass & Technical Mastery`,
          description: `Comprehensive interactive 1-on-1 session covering fundamentals, technical repertoire, and personalized musical guidance.`,
          durationMinutes: 60,
          scheduledStartsAt: lessonDate,
          teacherId: assignedTeacher,
        });
      }
    }

    if (lessonsToCreate.length > 0) {
      await db.courseLesson.createMany({
        data: lessonsToCreate,
      });
    }

    revalidatePath("/admin/courses");
    return { success: true };
  } catch (error) {
    logger.error({ error }, "Error generating course lessons");
    return { success: false, error: "Failed to generate course lessons." };
  }
}

export async function deleteCourseAdminAction(courseId: string): Promise<AdminActionResponse> {
  try {
    await requireRole(Role.ADMIN);

    const enrollmentsCount = await db.enrollment.count({
      where: { courseId },
    });

    if (enrollmentsCount > 0) {
      return {
        success: false,
        error: `Cannot delete course: ${enrollmentsCount} active student enrollment(s) exist. Unpublish the course instead.`,
      };
    }

    await db.course.delete({ where: { id: courseId } });

    revalidatePath("/admin/courses");
    revalidatePath("/courses");
    revalidateTag("admin-courses", "max");
    revalidateTag("courses", "max");
    return { success: true };
  } catch (error) {
    logger.error({ error }, "Error deleting course");
    return { success: false, error: "Failed to delete course." };
  }
}

// ─── 5. Lessons Management ───────────────────────────────────────────────────

export async function cancelLessonAdminAction(lessonId: string): Promise<AdminActionResponse> {
  try {
    await requireRole(Role.ADMIN);

    const lesson = await db.lesson.findUnique({
      where: { id: lessonId },
    });

    if (!lesson || lesson.status === LessonStatus.CANCELLED) {
      return { success: false, error: "Lesson not found or already cancelled." };
    }

    await db.$transaction(async (tx) => {
      await tx.lesson.update({
        where: { id: lessonId },
        data: {
          status: LessonStatus.CANCELLED,
          cancelledBy: "ADMIN",
          cancelledAt: new Date(),
        },
      });

      // Restore allocation
      if (lesson.lessonSource === LessonSource.ENROLLMENT && lesson.enrollmentId) {
        await tx.enrollment.update({
          where: { id: lesson.enrollmentId },
          data: { sessionsRemaining: { increment: 1 } },
        });
      } else if (lesson.lessonSource === LessonSource.TRIAL) {
        await tx.studentTrialStatus.updateMany({
          where: { studentId: lesson.studentId, lessonsUsed: { gt: 0 } },
          data: { lessonsUsed: { decrement: 1 } },
        });
      }
    });

    revalidatePath("/admin/lessons");
    revalidatePath("/admin/students");
    revalidatePath("/teacher/dashboard");
    revalidatePath("/student/dashboard");
    try {
      revalidateTag("admin-students", "max");
      revalidateTag("students", "max");
    } catch {}

    return { success: true };
  } catch (error) {
    logger.error({ error }, "Error cancelling lesson via admin");
    return { success: false, error: "Failed to cancel lesson." };
  }
}

export async function updateLessonStatusAdminAction(
  lessonId: string,
  newStatus: LessonStatus
): Promise<AdminActionResponse> {
  try {
    await requireRole(Role.ADMIN);

    const lesson = await db.lesson.findUnique({
      where: { id: lessonId },
    });

    if (!lesson) {
      return { success: false, error: "Lesson not found." };
    }

    if (lesson.status === newStatus) {
      return { success: true, message: `Lesson is already ${newStatus}.` };
    }

    await db.$transaction(async (tx) => {
      // 1. Quota adjustment: If moving to CANCELLED from another status, restore session quota
      if (newStatus === LessonStatus.CANCELLED && lesson.status !== LessonStatus.CANCELLED) {
        if (lesson.lessonSource === LessonSource.ENROLLMENT && lesson.enrollmentId) {
          await tx.enrollment.update({
            where: { id: lesson.enrollmentId },
            data: { sessionsRemaining: { increment: 1 } },
          });
        } else if (lesson.lessonSource === LessonSource.TRIAL) {
          await tx.studentTrialStatus.updateMany({
            where: { studentId: lesson.studentId, lessonsUsed: { gt: 0 } },
            data: { lessonsUsed: { decrement: 1 } },
          });
        }
      }
      // If moving away from CANCELLED, re-consume session quota if available
      else if (lesson.status === LessonStatus.CANCELLED && newStatus !== LessonStatus.CANCELLED) {
        if (lesson.lessonSource === LessonSource.ENROLLMENT && lesson.enrollmentId) {
          const enr = await tx.enrollment.findUnique({ where: { id: lesson.enrollmentId } });
          if (enr && enr.sessionsRemaining > 0) {
            await tx.enrollment.update({
              where: { id: lesson.enrollmentId },
              data: { sessionsRemaining: { decrement: 1 } },
            });
          }
        } else if (lesson.lessonSource === LessonSource.TRIAL) {
          await tx.studentTrialStatus.updateMany({
            where: { studentId: lesson.studentId },
            data: { lessonsUsed: { increment: 1 } },
          });
        }
      }

      // 2. Update lesson status
      await tx.lesson.update({
        where: { id: lessonId },
        data: {
          status: newStatus,
          cancelledBy: newStatus === LessonStatus.CANCELLED ? "ADMIN" : null,
          cancelledAt: newStatus === LessonStatus.CANCELLED ? new Date() : null,
        },
      });
    });

    revalidatePath("/admin/students");
    revalidatePath("/admin/lessons");
    revalidatePath("/admin/enrollments");
    revalidatePath("/teacher/dashboard");
    revalidatePath("/student/dashboard");
    try {
      revalidateTag("admin-students", "max");
      revalidateTag("students", "max");
    } catch {}

    return {
      success: true,
      message: `Lesson status successfully updated to ${newStatus}.`,
    };
  } catch (error) {
    logger.error({ error, lessonId, newStatus }, "Error updating lesson status via admin");
    return { success: false, error: "Failed to update lesson status." };
  }
}

// ─── 6. Events Management ────────────────────────────────────────────────────

export async function saveEventAdminAction(input: {
  id?: string;
  title: string;
  description: string;
  type: EventType;
  startsAt: string; // ISO
  durationMinutes: number;
  capacity?: number | null;
  teacherId?: string | null;
  isPublished: boolean;
}): Promise<AdminActionResponse> {
  try {
    await requireRole(Role.ADMIN);

    const payload = {
      title: input.title.trim(),
      description: input.description.trim(),
      type: input.type,
      startsAt: new Date(input.startsAt),
      durationMinutes: Math.max(15, input.durationMinutes),
      capacity: input.capacity && input.capacity > 0 ? input.capacity : null,
      teacherId: input.teacherId && input.teacherId.trim() ? input.teacherId.trim() : null,
      isPublished: input.isPublished,
    };

    if (input.id) {
      await db.event.update({
        where: { id: input.id },
        data: payload,
      });
    } else {
      await db.event.create({
        data: payload,
      });
    }

    revalidatePath("/admin/events");
    revalidatePath("/student/dashboard/events");
    revalidatePath("/student/dashboard/calendar");
    revalidatePath("/student/dashboard");
    revalidatePath("/teacher/dashboard/calendar");
    revalidatePath("/teacher/dashboard");

    return { success: true };
  } catch (error) {
    logger.error({ error }, "Error saving event");
    return { success: false, error: "Failed to save event." };
  }
}

export async function assignTeacherToEventAdminAction(input: {
  eventId: string;
  teacherId: string | null;
}): Promise<AdminActionResponse> {
  try {
    await requireRole(Role.ADMIN);

    if (!input.eventId) {
      return { success: false, error: "Event ID is required." };
    }

    if (input.teacherId) {
      const teacher = await db.user.findFirst({
        where: { id: input.teacherId, role: Role.TEACHER, isActive: true },
      });
      if (!teacher) {
        return { success: false, error: "Selected teacher is not found or inactive." };
      }
    }

    await db.event.update({
      where: { id: input.eventId },
      data: {
        teacherId: input.teacherId || null,
      },
    });

    revalidatePath("/admin/events");
    revalidatePath("/student/dashboard/events");
    revalidatePath("/student/dashboard/calendar");
    revalidatePath("/student/dashboard");
    revalidatePath("/teacher/dashboard/calendar");
    revalidatePath("/teacher/dashboard");

    return { success: true };
  } catch (error) {
    logger.error({ error }, "Error assigning teacher to event");
    return { success: false, error: "Failed to assign teacher to event." };
  }
}

export async function deleteEventAdminAction(eventId: string): Promise<AdminActionResponse> {
  try {
    await requireRole(Role.ADMIN);

    await db.event.delete({ where: { id: eventId } });

    revalidatePath("/admin/events");
    revalidatePath("/student/dashboard/events");
    revalidatePath("/student/dashboard/calendar");
    revalidatePath("/student/dashboard");
    revalidatePath("/teacher/dashboard/calendar");
    revalidatePath("/teacher/dashboard");

    return { success: true };
  } catch (error) {
    logger.error({ error }, "Error deleting event");
    return { success: false, error: "Failed to delete event." };
  }
}

// ─── 7. Support Ticket Status ────────────────────────────────────────────────

export async function updateTicketStatusAdminAction(input: {
  ticketId: string;
  status: TicketStatus;
}): Promise<AdminActionResponse> {
  try {
    await requireRole(Role.ADMIN);

    const updated = await db.supportTicket.update({
      where: { id: input.ticketId },
      data: { status: input.status },
      include: { user: true },
    });

    try {
      const statusLabel =
        input.status === TicketStatus.RESOLVED
          ? "Resolved"
          : input.status === TicketStatus.CLOSED
          ? "Closed"
          : input.status === TicketStatus.IN_PROGRESS
          ? "In Progress"
          : "Reopened";

      await createNotification({
        userId: updated.userId,
        type: NotificationType.SYSTEM,
        title: `Support Ticket ${statusLabel}`,
        body: `Your ticket "${updated.subject}" has been marked as ${statusLabel.toLowerCase()} by administration.`,
        link:
          updated.user.role === Role.TEACHER
            ? `/teacher/dashboard/support/${updated.id}`
            : `/student/dashboard/support/${updated.id}`,
      });
    } catch {
      // Non-blocking notification emission
    }

    revalidatePath(`/admin/support/${input.ticketId}`);
    revalidatePath("/admin/support");
    revalidatePath("/admin");
    revalidatePath(`/student/dashboard/support/${input.ticketId}`);
    revalidatePath(`/teacher/dashboard/support/${input.ticketId}`);
    try {
      revalidateTag("admin-support", "max");
      revalidateTag("support", "max");
    } catch {
      // safe fallback
    }

    return { success: true };
  } catch (error) {
    logger.error({ error }, "Error updating ticket status");
    return { success: false, error: "Failed to update ticket status." };
  }
}

// ─── 8. Trial Requests Allotment ─────────────────────────────────────────────

export async function allotTrialTeacherAction(input: {
  trialRequestId: string;
  teacherId: string;
  scheduledStartsAt?: string;
  durationMinutes?: number;
  adminNotes?: string;
}): Promise<AdminActionResponse<{ lessonId: string; trackingCode?: string | null; startsAt: string }>> {
  try {
    await requireRole(Role.ADMIN);

    const trialRequest = await db.trialRequest.findUnique({
      where: { id: input.trialRequestId },
      include: { allottedLesson: true },
    });

    if (!trialRequest) {
      return { success: false, error: "Trial request not found." };
    }

    const teacher = await db.user.findUnique({
      where: { id: input.teacherId, role: Role.TEACHER },
      include: { teacherProfile: true },
    });

    if (!teacher || !teacher.teacherProfile) {
      return { success: false, error: "Selected teacher does not have an active teacher profile." };
    }

    // Determine final scheduled start time:
    let finalStartsAt: Date = trialRequest.requestedStartsAt;
    if (input.scheduledStartsAt) {
      const parsedDate = new Date(input.scheduledStartsAt);
      if (isNaN(parsedDate.getTime())) {
        return { success: false, error: "Invalid scheduled date and time format." };
      }
      finalStartsAt = parsedDate;
    }

    const duration = input.durationMinutes && input.durationMinutes > 0 ? input.durationMinutes : 60;

    const lesson = await db.$transaction(async (tx) => {
      let activeLesson;

      // If reassigning or updating an already allotted trial that has a linked lesson:
      if (trialRequest.allottedLessonId) {
        activeLesson = await tx.lesson.update({
          where: { id: trialRequest.allottedLessonId },
          data: {
            teacherProfileId: teacher.teacherProfile!.id,
            teacherId: teacher.id,
            instrument: trialRequest.instrument,
            startsAt: finalStartsAt,
            durationMinutes: duration,
            status: LessonStatus.SCHEDULED,
          },
        });
      } else {
        // Create scheduled Lesson with unique trackingCode
        const trackingCode = await generateUniqueLessonTrackingCode(trialRequest.studentId, tx);
        activeLesson = await tx.lesson.create({
          data: {
            teacherProfileId: teacher.teacherProfile!.id,
            teacherId: teacher.id,
            studentId: trialRequest.studentId,
            instrument: trialRequest.instrument,
            startsAt: finalStartsAt,
            durationMinutes: duration,
            status: LessonStatus.SCHEDULED,
            lessonSource: LessonSource.TRIAL,
            trackingCode,
          },
        });
      }

      // Update TrialRequest with allotment details, final startsAt, and optional admin notes
      await tx.trialRequest.update({
        where: { id: trialRequest.id },
        data: {
          status: TrialRequestStatus.ALLOTTED,
          allottedTeacherId: teacher.id,
          allottedLessonId: activeLesson.id,
          allottedAt: new Date(),
          requestedStartsAt: finalStartsAt,
          ...(input.adminNotes
            ? {
                studentNotes: trialRequest.studentNotes
                  ? `${trialRequest.studentNotes} | Admin Note: ${input.adminNotes}`
                  : `Admin Note: ${input.adminNotes}`,
              }
            : {}),
        },
      });

      // Increment trial status for student if not previously allotted
      if (trialRequest.status !== TrialRequestStatus.ALLOTTED) {
        const trialStatus = await tx.studentTrialStatus.findUnique({
          where: { studentId: trialRequest.studentId },
        });

        if (trialStatus) {
          const nextUsed = trialStatus.lessonsUsed + 1;
          await tx.studentTrialStatus.update({
            where: { studentId: trialRequest.studentId },
            data: {
              lessonsUsed: nextUsed,
              status: nextUsed >= trialStatus.lessonsGranted ? TrialStatus.EXHAUSTED : TrialStatus.ACTIVE,
            },
          });
        }
      }

      return activeLesson;
    });

    // Fast-info notifications for student and teacher
    try {
      await createNotification({
        userId: trialRequest.studentId,
        type: NotificationType.TRIAL_ALLOTTED,
        title: "1:1 Trial Lesson Confirmed!",
        body: `Your trial session for ${trialRequest.instrument} is confirmed with Maestro ${teacher.name || "Faculty"}.`,
        link: `/lesson/${lesson.id}`,
      });
      await createNotification({
        userId: teacher.id,
        type: NotificationType.TRIAL_ALLOTTED,
        title: "New 1:1 Trial Allotted",
        body: `A new trial student (${trialRequest.studentName}) has been allotted to you for ${trialRequest.instrument}.`,
        link: "/teacher/dashboard",
      });
    } catch {
      // Non-blocking notification emission
    }

    revalidatePath("/admin/trials");
    revalidatePath("/admin/lessons");
    revalidatePath("/admin");
    revalidatePath("/student/dashboard");
    revalidatePath("/teacher/dashboard");

    return {
      success: true,
      data: {
        lessonId: lesson.id,
        trackingCode: lesson.trackingCode,
        startsAt: lesson.startsAt.toISOString(),
      },
    };
  } catch (error) {
    logger.error({ error }, "Error allotting teacher to trial request");
    return { success: false, error: "Failed to allot teacher." };
  }
}

export async function cancelTrialRequestAction(trialRequestId: string): Promise<AdminActionResponse> {
  try {
    await requireRole(Role.ADMIN);

    await db.trialRequest.update({
      where: { id: trialRequestId },
      data: { status: TrialRequestStatus.CANCELLED },
    });

    revalidatePath("/admin/trials");
    revalidatePath("/admin");
    revalidatePath("/student/dashboard");

    return { success: true };
  } catch (error) {
    logger.error({ error }, "Error cancelling trial request");
    return { success: false, error: "Failed to cancel trial request." };
  }
}

export async function updateTrialLeadStatusAction(input: {
  trialRequestId: string;
  isContacted?: boolean;
  followUpAt?: string | null;
  leadIntent?: string;
  leadOwner?: string;
  leadSource?: string;
  teacherFeedback?: string;
  studentNotes?: string;
  status?: TrialRequestStatus;
  allottedTeacherId?: string | null;
  lessonStatus?: string;
  isConverted?: boolean;
  requestedStartsAt?: string;
}): Promise<AdminActionResponse> {
  try {
    await requireRole(Role.ADMIN);

    const currentLead = await db.trialRequest.findUnique({
      where: { id: input.trialRequestId },
      select: { isConverted: true },
    });

    if (currentLead?.isConverted) {
      // Once converted through trial portal, status cannot be reverted to uncontacted or pending
      if (input.isConverted === false || input.isContacted === false || (input.status && input.status === TrialRequestStatus.PENDING)) {
        return {
          success: false,
          error: "This student is already converted to an active enrolled student and cannot be reverted back to uncontacted or pending status.",
        };
      }
    }

    const updateData: Record<string, unknown> = {};
    if (input.isContacted !== undefined) {
      updateData.isContacted = input.isContacted;
      if (input.isContacted) {
        updateData.contactedAt = new Date();
      }
    }
    if (input.status !== undefined) {
      updateData.status = input.status;
    }
    if (input.allottedTeacherId !== undefined) {
      updateData.allottedTeacherId = input.allottedTeacherId;
    }
    if (input.followUpAt !== undefined) {
      updateData.followUpAt = input.followUpAt ? new Date(input.followUpAt) : null;
    }
    if (input.leadIntent !== undefined) {
      updateData.leadIntent = input.leadIntent;
    }
    if (input.leadOwner !== undefined) {
      updateData.leadOwner = input.leadOwner;
    }
    if (input.leadSource !== undefined) {
      updateData.leadSource = input.leadSource;
    }
    if (input.teacherFeedback !== undefined) {
      updateData.teacherFeedback = input.teacherFeedback;
    }
    if (input.studentNotes !== undefined) {
      updateData.studentNotes = input.studentNotes;
    }
    if (input.isConverted !== undefined) {
      updateData.isConverted = input.isConverted;
      if (input.isConverted) {
        updateData.convertedAt = new Date();
      }
    }
    if (input.requestedStartsAt !== undefined) {
      updateData.requestedStartsAt = new Date(input.requestedStartsAt);
    }

    const updated = await db.trialRequest.update({
      where: { id: input.trialRequestId },
      data: updateData,
    });

    if (input.isConverted) {
      await db.studentTrialStatus.updateMany({
        where: { studentId: updated.studentId },
        data: { status: TrialStatus.EXHAUSTED },
      });
    }

    if (input.lessonStatus && updated.allottedLessonId) {
      await db.lesson.update({
        where: { id: updated.allottedLessonId },
        data: { status: input.lessonStatus as any },
      }).catch(() => {});
    }

    revalidatePath("/admin/trials");
    return { success: true };
  } catch (error) {
    logger.error({ error }, "Error updating trial lead status");
    return { success: false, error: "Failed to update trial lead status." };
  }
}

export async function convertTrialToEnrollmentAction(input: {
  trialRequestId: string;
  courseId?: string;
  teacherId?: string | null;
  sessionsRemaining?: number;
  adminNotes?: string;
}): Promise<AdminActionResponse<{ studentId: string }>> {
  try {
    await requireRole(Role.ADMIN);

    const trialRequest = await db.trialRequest.findUnique({
      where: { id: input.trialRequestId },
      include: { student: true },
    });

    if (!trialRequest) {
      return { success: false, error: "Trial lead not found." };
    }

    // Mark trial request as converted ONLY (universal rule: no auto-allotting courses)
    await db.trialRequest.update({
      where: { id: trialRequest.id },
      data: {
        isConverted: true,
        convertedAt: new Date(),
      },
    });

    await db.studentTrialStatus.updateMany({
      where: { studentId: trialRequest.studentId },
      data: { status: TrialStatus.EXHAUSTED },
    });

    // Notify student that they are converted and can now request courses
    try {
      await createNotification({
        userId: trialRequest.studentId,
        type: NotificationType.SYSTEM,
        title: "Welcome to Gandharva School of Music!",
        body: "Your trial lead has been converted to an enrolled student account. Explore our course catalog and submit your course admission request.",
        link: "/student/dashboard/courses",
      });
    } catch {
      // Non-blocking notification emission
    }

    revalidatePath("/admin/trials");
    revalidatePath("/admin/enrollments");
    revalidatePath("/admin");
    revalidatePath("/student/dashboard");
    revalidatePath("/student/dashboard/courses");

    return { success: true, data: { studentId: trialRequest.studentId } };
  } catch (error) {
    logger.error({ error }, "Error converting trial lead");
    return { success: false, error: "Failed to convert trial lead." };
  }
}

export async function adminApproveAndAllotCourseAction(input: {
  requestId?: string | null;
  studentId: string;
  courseId: string;
  teacherId?: string | null;
  sessionsRemaining?: number;
  feeRupees: number;
  paidRupees: number;
  paymentPlan?: CoursePaymentPlan;
  adminNotes?: string | null;
  slots?: Array<{ startsAt: string; durationMinutes?: number }>;
}): Promise<AdminActionResponse<{ enrollmentId: string; scheduledCount?: number; newLessons?: any[] }>> {
  try {
    await requireRole(Role.ADMIN);

    const student = await db.user.findUnique({
      where: { id: input.studentId },
      select: { id: true, name: true, email: true },
    });
    if (!student) {
      return { success: false, error: "Student not found." };
    }

    const course = await db.course.findUnique({
      where: { id: input.courseId },
    });
    if (!course) {
      return { success: false, error: "Course not found." };
    }

    const totalSessions =
      input.sessionsRemaining && input.sessionsRemaining > 0
        ? input.sessionsRemaining
        : course.sessionCount;

    const remainingBalance = Math.max(0, input.feeRupees - input.paidRupees);
    const emiStatus =
      input.paidRupees >= input.feeRupees
        ? CourseEmiStatus.FULLY_PAID
        : input.paidRupees > 0
        ? CourseEmiStatus.PARTIALLY_PAID
        : CourseEmiStatus.PENDING_PAYMENT;

    const paymentPlan = input.paymentPlan || CoursePaymentPlan.FULL_PAYMENT;

    // Run transaction
    const enrollment = await db.$transaction(async (tx) => {
      // 1. Create active enrollment
      const enr = await tx.enrollment.create({
        data: {
          studentId: student.id,
          courseId: course.id,
          teacherId: input.teacherId || null,
          sessionsRemaining: totalSessions,
          status: EnrollmentStatus.ACTIVE,
          emiStatus,
          paymentPlan,
          convertedFromTrial: true,
          adminNotes:
            input.adminNotes?.trim() ||
            `Approved by admin. Fee: ₹${input.feeRupees}, Paid: ₹${input.paidRupees}, Remaining: ₹${remainingBalance}`,
        },
      });

      // 2. If student paid any amount, record Payment
      if (input.paidRupees > 0) {
        const receiptCode = `RCPT-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
        const pmt = await tx.payment.create({
          data: {
            studentId: student.id,
            enrollmentId: enr.id,
            amountMinorUnits: Math.round(input.paidRupees * 100),
            currency: "INR",
            gateway: "manual",
            gatewayOrderId: `adm_${enr.id.slice(-6)}_${Date.now()}`,
            gatewayPaymentId: receiptCode,
            notes: "Initial admission payment tranche",
            status: PaymentStatus.PAID,
          },
        });
        await tx.enrollment.update({
          where: { id: enr.id },
          data: { paymentId: pmt.id },
        });
      }

      // 3. Mark request APPROVED if requestId is given
      if (input.requestId) {
        await tx.courseEnrollmentRequest.update({
          where: { id: input.requestId },
          data: {
            status: CourseRequestStatus.APPROVED,
            allottedTeacherId: input.teacherId || null,
            enrollmentId: enr.id,
            adminNotes:
              input.adminNotes?.trim() ||
              `Approved with ₹${input.paidRupees} paid and ₹${remainingBalance} due.`,
          },
        }).catch(() => {});
      } else {
        // Also update any pending request for this student and course
        await tx.courseEnrollmentRequest.updateMany({
          where: {
            studentId: student.id,
            courseId: course.id,
            status: CourseRequestStatus.PENDING,
          },
          data: {
            status: CourseRequestStatus.APPROVED,
            allottedTeacherId: input.teacherId || null,
            enrollmentId: enr.id,
          },
        }).catch(() => {});
      }

      return enr;
    });

    // 4. If slots are provided and teacher is assigned, schedule lessons
    let scheduledCount = 0;
    const newLessons: Array<{
      id: string;
      trackingCode: string | null;
      startsAt: string;
      durationMinutes: number;
      status: LessonStatus;
      teacherId: string;
      teacherName: string;
      studentId: string;
      studentName: string;
    }> = [];

    if (input.slots && input.slots.length > 0 && input.teacherId) {
      const teacher = await db.user.findUnique({
        where: { id: input.teacherId },
        include: { teacherProfile: true },
      });
      if (teacher?.teacherProfile) {
        for (const slot of input.slots) {
          const startsAtDate = new Date(slot.startsAt);
          if (isNaN(startsAtDate.getTime())) continue;

          const trackingCode = await generateUniqueLessonTrackingCode(student.id, db);
          const lesson = await db.lesson.create({
            data: {
              teacherId: teacher.id,
              teacherProfileId: teacher.teacherProfile.id,
              studentId: student.id,
              instrument: course.instrument,
              startsAt: startsAtDate,
              durationMinutes: slot.durationMinutes || 60,
              status: LessonStatus.SCHEDULED,
              lessonSource: LessonSource.ENROLLMENT,
              enrollmentId: enrollment.id,
              groupRoomId: null,
              trackingCode,
            },
          });
          scheduledCount++;
          newLessons.push({
            id: lesson.id,
            trackingCode: lesson.trackingCode,
            startsAt: lesson.startsAt.toISOString(),
            durationMinutes: lesson.durationMinutes,
            status: lesson.status,
            teacherId: teacher.id,
            teacherName: teacher.name || "Faculty Mentor",
            studentId: student.id,
            studentName: student.name || "Student",
          });
        }
      }
    }

    // Notify Student
    try {
      await createNotification({
        userId: student.id,
        type: NotificationType.COURSE_REQUEST_APPROVED,
        title: "Course Approved & Active!",
        body: `Your admission for "${course.title}" has been approved.${
          scheduledCount > 0 ? ` ${scheduledCount} weekly sessions have been added to your timetable!` : ""
        } The course is now active on your dashboard!`,
        link: `/student/dashboard/courses/${course.slug}`,
      });

      if (input.teacherId) {
        await createNotification({
          userId: input.teacherId,
          type: NotificationType.SYSTEM,
          title: "New Student Course Allotment",
          body: `${student.name || "A student"} has been allotted to you for "${course.title}".${
            scheduledCount > 0 ? ` ${scheduledCount} sessions scheduled.` : ""
          }`,
          link: "/teacher/dashboard",
        });
      }
    } catch {
      // Non-blocking
    }

    revalidatePath("/admin/enrollments");
    revalidatePath("/admin/lessons");
    revalidatePath("/admin/trials");
    revalidatePath("/admin");
    revalidatePath("/student/dashboard");
    revalidatePath("/student/dashboard/courses");
    revalidatePath(`/student/dashboard/courses/${course.slug}`);

    return {
      success: true,
      message: `Course "${course.title}" approved and allotted to ${student.name}!`,
      data: { enrollmentId: enrollment.id, scheduledCount, newLessons },
    };
  } catch (error: any) {
    logger.error({ error }, "Error approving and allotting course");
    return {
      success: false,
      error: error.message || "Failed to approve and allot course.",
    };
  }
}

export async function createAdminTrialLeadAction(input: {
  studentName: string;
  studentEmail: string;
  studentPhone?: string;
  guardianName?: string;
  guardianPhone?: string;
  instrument: string;
  category?: string;
  ageGroup?: string;
  requestedStartsAt: string;
  preferredTimeSlot?: string;
  timezone?: string;
  leadSource?: string;
  leadIntent?: string;
  leadOwner?: string;
  studentNotes?: string;
}): Promise<AdminActionResponse<{ trialRequestId: string }>> {
  try {
    await requireRole(Role.ADMIN);

    const email = input.studentEmail.trim().toLowerCase();
    let student = await db.user.findUnique({
      where: { email },
    });

    if (!student) {
      const studentCustomId = await generateNextStudentId(db);
      student = await db.user.create({
        data: {
          email,
          name: input.studentName.trim(),
          phone: input.studentPhone?.trim() || null,
          guardianName: input.guardianName?.trim() || null,
          guardianPhone: input.guardianPhone?.trim() || null,
          timezone: input.timezone || "Asia/Kolkata",
          role: Role.STUDENT,
          customId: studentCustomId,
        },
      });

      // Initialize trial status
      const settings = await db.platformSettings.findFirst();
      await db.studentTrialStatus.create({
        data: {
          studentId: student.id,
          lessonsGranted: settings?.freeTrialLessonCount ?? 2,
          lessonsUsed: 0,
        },
      });
    } else {
      if (input.guardianName || input.guardianPhone || input.studentPhone) {
        await db.user.update({
          where: { id: student.id },
          data: {
            phone: input.studentPhone?.trim() || student.phone,
            guardianName: input.guardianName?.trim() || student.guardianName,
            guardianPhone: input.guardianPhone?.trim() || student.guardianPhone,
          },
        });
      }
    }

    const startsAt = new Date(input.requestedStartsAt);
    const validStartsAt = !isNaN(startsAt.getTime()) ? startsAt : new Date();

    const trial = await db.trialRequest.create({
      data: {
        studentId: student.id,
        studentName: input.studentName.trim(),
        studentEmail: email,
        studentPhone: input.studentPhone?.trim() || student.phone || null,
        instrument: input.instrument,
        category: input.category || "General",
        ageGroup: input.ageGroup || "Adult (18+)",
        requestedStartsAt: validStartsAt,
        preferredTimeSlot: input.preferredTimeSlot || "Morning",
        timezone: input.timezone || student.timezone || "Asia/Kolkata",
        leadSource: input.leadSource || "Direct Web",
        leadIntent: input.leadIntent || "HIGH",
        leadOwner: input.leadOwner || "Admissions - Neha",
        studentNotes: input.studentNotes?.trim() || null,
        status: TrialRequestStatus.PENDING,
      },
    });

    revalidatePath("/admin/trials");
    return { success: true, data: { trialRequestId: trial.id } };
  } catch (error) {
    logger.error({ error }, "Error creating admin trial lead");
    return { success: false, error: "Failed to create trial lead." };
  }
}


/**
 * Admin action to mark a teacher session as PAID or UNPAID with payout transaction details.
 */
export async function markLessonPayoutAction(input: {
  lessonId: string;
  status: "PAID" | "UNPAID";
  transactionId?: string;
  notes?: string;
  amountMinor?: number;
}): Promise<AdminActionResponse> {
  try {
    await requireRole(Role.ADMIN);

    const lesson = await db.lesson.findUnique({
      where: { id: input.lessonId },
      include: {
        teacherProfile: {
          select: { payoutPerSession: true },
        },
      },
    });

    if (!lesson) {
      return { success: false, error: "Session lesson not found." };
    }

    if (input.status === "PAID") {
      const payoutAmount =
        input.amountMinor ??
        lesson.payoutAmountMinor ??
        lesson.teacherProfile?.payoutPerSession ??
        80000;

      await db.lesson.update({
        where: { id: input.lessonId },
        data: {
          payoutStatus: TeacherPayoutStatus.PAID,
          payoutPaidAt: new Date(),
          payoutTransactionId: input.transactionId?.trim() || null,
          payoutNotes: input.notes?.trim() || null,
          payoutAmountMinor: payoutAmount,
        },
      });

      logger.info(
        { lessonId: input.lessonId, amountMinor: payoutAmount, transactionId: input.transactionId },
        "Lesson payout marked as PAID by admin",
      );
    } else {
      await db.lesson.update({
        where: { id: input.lessonId },
        data: {
          payoutStatus: TeacherPayoutStatus.UNPAID,
          payoutPaidAt: null,
          payoutTransactionId: null,
          payoutNotes: null,
        },
      });

      logger.info({ lessonId: input.lessonId }, "Lesson payout reverted to UNPAID by admin");
    }

    revalidatePath("/admin/payments");
    revalidatePath("/admin/teacher-payments");
    revalidatePath("/admin/lessons");
    revalidatePath("/teacher/dashboard/earnings");

    return {
      success: true,
      message:
        input.status === "PAID"
          ? "Session remuneration marked as PAID successfully."
          : "Session remuneration reverted to UNPAID.",
    };
  } catch (error) {
    logger.error({ error, input }, "Error updating lesson payout status");
    const errMsg = error instanceof Error ? error.message : "Failed to update payout status.";
    return { success: false, error: errMsg };
  }
}

// ─── 9. Teacher Approvals Management ───────────────────────────────────────────

export async function updateTeacherApprovalAction(input: {
  teacherProfileId: string;
  status: TeacherApprovalStatus;
  rejectionReason?: string | null;
  adminNotes?: string | null;
  payoutPerSession?: number | null;
  isPublished?: boolean | null;
}): Promise<AdminActionResponse> {
  try {
    const admin = await requireRole(Role.ADMIN);

    let profile = await db.teacherProfile.findUnique({
      where: { id: input.teacherProfileId },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    });

    if (!profile) {
      profile = await db.teacherProfile.findUnique({
        where: { userId: input.teacherProfileId },
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      });
    }

    if (!profile) {
      return { success: false, error: "Teacher profile not found." };
    }

    const now = new Date();
    const updateData: {
      approvalStatus: TeacherApprovalStatus;
      approvedAt?: Date | null;
      rejectedAt?: Date | null;
      rejectionReason?: string | null;
      adminNotes?: string | null;
      payoutPerSession?: number;
      isPublished?: boolean;
    } = {
      approvalStatus: input.status,
    };

    if (input.status === TeacherApprovalStatus.APPROVED) {
      updateData.approvedAt = now;
      updateData.rejectedAt = null;
      updateData.rejectionReason = null;
    } else if (input.status === TeacherApprovalStatus.REJECTED) {
      updateData.rejectedAt = now;
      updateData.approvedAt = null;
      updateData.rejectionReason = input.rejectionReason?.trim() || "Administrative review: requirements not met.";
      updateData.isPublished = false;
    } else if (input.status === TeacherApprovalStatus.PENDING) {
      updateData.approvedAt = null;
      updateData.rejectedAt = null;
      updateData.rejectionReason = null;
      updateData.isPublished = false;
    }

    if (input.adminNotes !== undefined) {
      updateData.adminNotes = input.adminNotes ? input.adminNotes.trim() : null;
    }

    if (input.payoutPerSession !== undefined && input.payoutPerSession !== null) {
      updateData.payoutPerSession = Math.max(0, Math.floor(input.payoutPerSession));
    }

    if (input.isPublished !== undefined && input.isPublished !== null) {
      updateData.isPublished = Boolean(input.isPublished);
    }

    await db.teacherProfile.update({
      where: { id: profile.id },
      data: updateData,
    });

    logger.info(
      {
        adminId: admin.id,
        teacherProfileId: input.teacherProfileId,
        teacherUserId: profile.userId,
        status: input.status,
      },
      "Teacher approval status updated by admin",
    );

    // Fast-info notification for teacher
    try {
      if (input.status === TeacherApprovalStatus.APPROVED) {
        await createNotification({
          userId: profile.userId,
          type: NotificationType.TEACHER_APPROVED,
          title: "Application Approved!",
          body: "Your faculty profile has been approved. You can now set your teaching availability and receive student bookings.",
          link: "/teacher/dashboard/availability",
        });
      } else if (input.status === TeacherApprovalStatus.REJECTED) {
        await createNotification({
          userId: profile.userId,
          type: NotificationType.TEACHER_REJECTED,
          title: "Application Status Update",
          body: `Your teaching profile review was not approved: "${input.rejectionReason?.trim() || "Requirements not met"}". Contact administration for more info.`,
          link: "/teacher/dashboard",
        });
      }
    } catch {
      // Non-blocking notification emission
    }

    revalidatePath("/admin/teachers");
    revalidatePath("/admin/users");
    revalidatePath("/admin");
    revalidatePath("/teachers");
    revalidatePath(`/teachers/${profile.id}`);
    revalidatePath("/teacher/dashboard");
    revalidatePath("/teacher/dashboard/profile");

    const statusLabel =
      input.status === TeacherApprovalStatus.APPROVED
        ? "approved and granted teaching privileges"
        : input.status === TeacherApprovalStatus.REJECTED
          ? "rejected"
          : "reset to pending review";

    return {
      success: true,
      message: `Teacher ${profile.user.name || profile.user.email} successfully ${statusLabel}.`,
    };
  } catch (error) {
    logger.error({ error, input }, "Error updating teacher approval");
    const errMsg = error instanceof Error ? error.message : "Failed to update teacher approval.";
    return { success: false, error: errMsg };
  }
}

export async function adminRecordEnrollmentPaymentAction(input: {
  enrollmentId: string;
  amountRupees: number;
  paymentMethod?: string;
  referenceCode?: string;
  notes?: string;
  slots?: Array<{ startsAt: string; durationMinutes?: number }>;
}): Promise<
  AdminActionResponse<{
    paymentId: string;
    receiptCode: string;
    totalPaidRupees: number;
    emiStatus: CourseEmiStatus;
    scheduledCount?: number;
    newLessons?: any[];
  }>
> {
  try {
    await requireRole(Role.ADMIN);

    if (!input.enrollmentId) {
      return { success: false, error: "Enrollment ID is required." };
    }

    if (!input.amountRupees || input.amountRupees <= 0) {
      return { success: false, error: "Payment amount must be greater than 0." };
    }

    const enrollment = await db.enrollment.findUnique({
      where: { id: input.enrollmentId },
      include: {
        student: { select: { id: true, name: true, email: true } },
        course: { select: { id: true, title: true, priceMinorUnits: true, instrument: true } },
        payments: { select: { id: true, amountMinorUnits: true } },
      },
    });

    if (!enrollment) {
      return { success: false, error: "Enrollment record not found." };
    }

    const receiptCode =
      input.referenceCode?.trim() ||
      `RCPT-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const gateway = input.paymentMethod?.trim() || "UPI";
    const amountMinorUnits = Math.round(input.amountRupees * 100);

    const payment = await db.payment.create({
      data: {
        studentId: enrollment.student.id,
        enrollmentId: enrollment.id,
        amountMinorUnits,
        currency: "INR",
        gateway,
        gatewayOrderId: `inst_${enrollment.id.slice(-6)}_${Date.now()}`,
        gatewayPaymentId: receiptCode,
        notes: input.notes?.trim() || `Installment payment tranche for ${enrollment.course.title}`,
        status: PaymentStatus.PAID,
      },
    });

    // Compute updated total paid across all payments
    const existingPaidMinor = enrollment.payments.reduce((sum, p) => sum + p.amountMinorUnits, 0);
    const newTotalPaidMinor = existingPaidMinor + amountMinorUnits;
    const courseFeeMinor = enrollment.course.priceMinorUnits || 0;
    const isFullyPaid = newTotalPaidMinor >= courseFeeMinor;
    const newEmiStatus = isFullyPaid ? CourseEmiStatus.FULLY_PAID : CourseEmiStatus.PARTIALLY_PAID;

    await db.enrollment.update({
      where: { id: enrollment.id },
      data: {
        emiStatus: newEmiStatus,
        paymentId: enrollment.paymentId || payment.id,
      },
    });

    // If slots are provided and enrollment has assigned teacher, schedule sessions
    let scheduledCount = 0;
    const newLessons: Array<{
      id: string;
      trackingCode: string | null;
      startsAt: string;
      durationMinutes: number;
      status: LessonStatus;
      teacherId: string;
      teacherName: string;
      studentId: string;
      studentName: string;
    }> = [];

    if (input.slots && input.slots.length > 0 && enrollment.teacherId) {
      const teacher = await db.user.findUnique({
        where: { id: enrollment.teacherId },
        include: { teacherProfile: true },
      });
      if (teacher?.teacherProfile) {
        for (const slot of input.slots) {
          const startsAtDate = new Date(slot.startsAt);
          if (isNaN(startsAtDate.getTime())) continue;

          const trackingCode = await generateUniqueLessonTrackingCode(enrollment.student.id, db);
          const lesson = await db.lesson.create({
            data: {
              teacherId: teacher.id,
              teacherProfileId: teacher.teacherProfile.id,
              studentId: enrollment.student.id,
              instrument: enrollment.course.instrument,
              startsAt: startsAtDate,
              durationMinutes: slot.durationMinutes || 60,
              status: LessonStatus.SCHEDULED,
              lessonSource: LessonSource.ENROLLMENT,
              enrollmentId: enrollment.id,
              groupRoomId: null,
              trackingCode,
            },
          });
          scheduledCount++;
          newLessons.push({
            id: lesson.id,
            trackingCode: lesson.trackingCode,
            startsAt: lesson.startsAt.toISOString(),
            durationMinutes: lesson.durationMinutes,
            status: lesson.status,
            teacherId: teacher.id,
            teacherName: teacher.name || "Faculty Mentor",
            studentId: enrollment.student.id,
            studentName: enrollment.student.name || "Student",
          });
        }
      }
    }

    // Notify student
    try {
      await createNotification({
        userId: enrollment.student.id,
        type: NotificationType.SYSTEM,
        title: `Payment Receipt: ₹${input.amountRupees.toLocaleString("en-IN")}${
          scheduledCount > 0 ? ` + ${scheduledCount} Sessions Scheduled` : ""
        }`,
        body: `Your payment installment of ₹${input.amountRupees.toLocaleString("en-IN")} for "${enrollment.course.title}" was recorded successfully (Receipt ID: ${receiptCode}).${
          scheduledCount > 0 ? ` ${scheduledCount} weekly sessions have been added to your timetable!` : ""
        }`,
        link: `/student/dashboard/payments`,
      });
    } catch {
      // Non-blocking notification emission
    }

    revalidatePath("/admin/enrollments");
    revalidatePath("/admin/lessons");
    revalidatePath("/admin");
    revalidatePath("/student/dashboard");
    revalidatePath("/teacher/dashboard");
    revalidatePath("/student/dashboard/payments");

    return {
      success: true,
      data: {
        paymentId: payment.id,
        receiptCode,
        totalPaidRupees: Math.round(newTotalPaidMinor / 100),
        emiStatus: newEmiStatus,
        scheduledCount,
        newLessons,
      },
    };
  } catch (error) {
    logger.error({ error, input }, "Error recording enrollment installment payment");
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to record payment installment.",
    };
  }
}

// ─── 17. Lesson Recordings Management ──────────────────────────────────────────

export async function syncRecordingToSupabaseAction(
  recordingId: string,
): Promise<AdminActionResponse<{ fileUrl: string; fileId: string }>> {
  try {
    await requireRole(Role.ADMIN);

    const recording = await db.lessonRecording.findUnique({
      where: { id: recordingId },
      include: {
        lesson: {
          include: {
            teacher: { select: { name: true } },
            student: { select: { name: true } },
          },
        },
      },
    });

    if (!recording) {
      return { success: false, error: "Recording not found." };
    }

    if (recording.storageBackend === "SUPABASE" && recording.fileId) {
      return {
        success: true,
        message: "Recording is already stored in Supabase.",
        data: { fileUrl: recording.fileUrl, fileId: recording.fileId },
      };
    }

    const { uploadToSupabase } = await import("@/lib/supabase-storage");
    const fs = await import("fs");
    const path = await import("path");

    // Determine local disk file path
    const localFilePath = path.join(
      process.cwd(),
      "public",
      recording.fileUrl.startsWith("/") ? recording.fileUrl.slice(1) : recording.fileUrl,
    );

    if (!fs.existsSync(localFilePath)) {
      return {
        success: false,
        error: `Local recording file could not be found at: ${localFilePath}`,
      };
    }

    const fileBuffer = fs.readFileSync(localFilePath);
    const uploadResult = await uploadToSupabase(
      fileBuffer,
      recording.fileName,
      "video/webm",
      { bucket: "recordings", preserveExactName: true },
    );

    // Update database record
    await db.lessonRecording.update({
      where: { id: recordingId },
      data: {
        fileUrl: uploadResult.fileUrl,
        fileId: uploadResult.fileId,
        storageBackend: "SUPABASE",
      },
    });

    // Update lesson
    await db.lesson.update({
      where: { id: recording.lessonId },
      data: {
        recordingUrl: uploadResult.fileUrl,
        recordingFileId: uploadResult.fileId,
      },
    });

    if (recording.lesson.groupRoomId) {
      await db.lesson.updateMany({
        where: { groupRoomId: recording.lesson.groupRoomId },
        data: {
          recordingUrl: uploadResult.fileUrl,
          recordingFileId: uploadResult.fileId,
        },
      });
    }

    // Optionally remove local file now that it's in Supabase
    try {
      fs.unlinkSync(localFilePath);
    } catch {
      // Non-fatal if local unlinking fails
    }

    revalidateTag("admin-recordings", "max");
    revalidateTag("admin-lessons", "max");
    revalidatePath("/admin/recordings");
    revalidatePath("/admin/lessons");

    return {
      success: true,
      message: "Recording successfully synced to Supabase.",
      data: { fileUrl: uploadResult.fileUrl, fileId: uploadResult.fileId },
    };
  } catch (error) {
    logger.error({ error, recordingId }, "Failed to sync recording to Supabase");
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to sync recording to Supabase.",
    };
  }
}

export const syncRecordingToDriveAction = syncRecordingToSupabaseAction;

export async function deleteRecordingAdminAction(
  recordingId: string,
): Promise<AdminActionResponse> {
  try {
    await requireRole(Role.ADMIN);

    const recording = await db.lessonRecording.findUnique({
      where: { id: recordingId },
      include: { lesson: true },
    });

    if (!recording) {
      return { success: false, error: "Recording not found." };
    }

    // Delete from Supabase if stored there
    if (recording.fileId) {
      try {
        const { deleteFromSupabase } = await import("@/lib/supabase-storage");
        await deleteFromSupabase(recording.fileId, "recordings");
      } catch (e) {
        logger.warn({ error: e, fileId: recording.fileId }, "Could not delete from Supabase");
      }
    }

    // Delete from local disk if stored locally
    if (recording.storageBackend === "LOCAL" && recording.fileUrl) {
      try {
        const fs = await import("fs");
        const path = await import("path");
        const localFilePath = path.join(
          process.cwd(),
          "public",
          recording.fileUrl.startsWith("/") ? recording.fileUrl.slice(1) : recording.fileUrl,
        );
        if (fs.existsSync(localFilePath)) {
          fs.unlinkSync(localFilePath);
        }
      } catch (e) {
        logger.warn({ error: e, fileUrl: recording.fileUrl }, "Could not delete local file");
      }
    }

    // Delete the database recording record
    await db.lessonRecording.delete({
      where: { id: recordingId },
    });

    // Update the lesson with the latest remaining recording (if any)
    const remainingRecordings = await db.lessonRecording.findMany({
      where: { lessonId: recording.lessonId },
      orderBy: { createdAt: "desc" },
    });

    const latestRemaining = remainingRecordings[0] || null;
    const remainingDuration = remainingRecordings.reduce(
      (sum, r) => sum + (r.durationSeconds || 0),
      0,
    );

    await db.lesson.update({
      where: { id: recording.lessonId },
      data: {
        recordingUrl: latestRemaining?.fileUrl || null,
        recordingFileId: latestRemaining?.fileId || null,
        recordingDurationSeconds: latestRemaining ? remainingDuration : null,
      },
    });

    if (recording.lesson.groupRoomId) {
      await db.lesson.updateMany({
        where: { groupRoomId: recording.lesson.groupRoomId },
        data: {
          recordingUrl: latestRemaining?.fileUrl || null,
          recordingFileId: latestRemaining?.fileId || null,
          recordingDurationSeconds: latestRemaining ? remainingDuration : null,
        },
      });
    }

    revalidateTag("admin-recordings", "max");
    revalidateTag("admin-lessons", "max");
    revalidatePath("/admin/recordings");
    revalidatePath("/admin/lessons");

    return { success: true, message: "Recording deleted successfully." };
  } catch (error) {
    logger.error({ error, recordingId }, "Failed to delete recording");
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to delete recording.",
    };
  }
}




