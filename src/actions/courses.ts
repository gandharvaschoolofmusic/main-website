"use server";

import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth-helpers";
import {
  Role,
  EnrollmentStatus,
  CoursePaymentPlan,
  CourseEmiStatus,
  CourseRequestStatus,
  NotificationType,
  TrialStatus,
} from "@prisma/client";
import { revalidatePath } from "next/cache";
import { notifyAdmins, createNotification } from "@/actions/notifications";
import { logger } from "@/lib/logger";

// ─── Student: Submit Course Admission Request ────────────────────────────────

export async function submitCourseEnrollmentRequestAction(input: {
  courseId: string;
  paymentPlan: CoursePaymentPlan;
  studentNotes?: string;
  preferredSchedule?: string;
}) {
  try {
    const user = await requireRole(Role.STUDENT);

    const course = await db.course.findUnique({
      where: { id: input.courseId },
    });

    if (!course || !course.isPublished) {
      return { success: false, error: "Course not found or is no longer published." };
    }

    // Strict requirement: Only converted trial students can request course admission
    const convertedTrial = await db.trialRequest.findFirst({
      where: {
        studentId: user.id,
        isConverted: true,
      },
    });

    if (!convertedTrial) {
      return {
        success: false,
        error:
          "Course admission requests are exclusively available for students whose trial has been completed and converted by academy administration. Please book and attend your free trial session first.",
      };
    }

    // Check if student already has an active enrollment
    const existingEnrollment = await db.enrollment.findFirst({
      where: {
        studentId: user.id,
        courseId: course.id,
        status: EnrollmentStatus.ACTIVE,
      },
    });

    if (existingEnrollment) {
      return {
        success: false,
        error: "You are already actively enrolled in this course. Access it from your dashboard.",
      };
    }

    // Check if student already has a pending request
    const existingPending = await db.courseEnrollmentRequest.findFirst({
      where: {
        studentId: user.id,
        courseId: course.id,
        status: CourseRequestStatus.PENDING,
      },
    });

    if (existingPending) {
      return {
        success: false,
        error: "You already have a pending admission request for this course. Academy management will review and allot your course shortly.",
      };
    }

    // Create the course enrollment request
    const request = await db.courseEnrollmentRequest.create({
      data: {
        studentId: user.id,
        courseId: course.id,
        paymentPlan: input.paymentPlan || CoursePaymentPlan.FULL_PAYMENT,
        studentNotes: input.studentNotes?.trim() || null,
        preferredSchedule: input.preferredSchedule?.trim() || null,
        status: CourseRequestStatus.PENDING,
      },
    });

    const planLabel = "Full Course Tuition";

    // Notify Academy Administrators
    await notifyAdmins({
      type: NotificationType.NEW_COURSE_REQUEST,
      title: "New Course Admission Request",
      body: `${user.name || user.email} requested admission for "${course.title}".`,
      link: `/admin/enrollments?studentId=${user.id}`,
    });

    // Notify the Student
    await createNotification({
      userId: user.id,
      type: NotificationType.SYSTEM,
      title: "Admission Request Submitted",
      body: `Your request for "${course.title}" has been sent to academy administration. Our director will review and allot your course to your dashboard.`,
      link: "/student/dashboard/courses",
    });

    logger.info(
      { requestId: request.id, studentId: user.id, courseId: course.id, plan: input.paymentPlan },
      "Student course enrollment request submitted successfully",
    );

    revalidatePath("/student/dashboard/courses");
    revalidatePath(`/student/dashboard/courses/${course.slug}`);
    revalidatePath(`/courses/${course.slug}`);
    revalidatePath("/admin/student-courses");
    revalidatePath("/admin/enrollments");

    return { success: true, requestId: request.id };
  } catch (error: any) {
    logger.error({ error }, "Error submitting course enrollment request");
    return {
      success: false,
      error: error.message || "Failed to submit course admission request. Please try again.",
    };
  }
}

// ─── Student: Cancel Course Admission Request ────────────────────────────────

export async function cancelCourseEnrollmentRequestAction(requestId: string) {
  try {
    const user = await requireRole(Role.STUDENT);

    const request = await db.courseEnrollmentRequest.findFirst({
      where: { id: requestId, studentId: user.id },
      include: { course: true },
    });

    if (!request) {
      return { success: false, error: "Request not found." };
    }

    if (request.status !== CourseRequestStatus.PENDING) {
      return { success: false, error: "Only pending requests can be cancelled." };
    }

    await db.courseEnrollmentRequest.update({
      where: { id: requestId },
      data: { status: CourseRequestStatus.CANCELLED },
    });

    revalidatePath("/student/dashboard/courses");
    revalidatePath(`/student/dashboard/courses/${request.course.slug}`);
    revalidatePath("/admin/student-courses");
    revalidatePath("/admin/enrollments");

    return { success: true };
  } catch (error: any) {
    logger.error({ error }, "Error cancelling course request");
    return { success: false, error: error.message || "Failed to cancel request." };
  }
}

// ─── Admin: Approve Request & Allot Course to Student Dashboard ─────────────

export async function adminApproveCourseRequestAction(input: {
  requestId: string;
  teacherId?: string | null;
  sessionsRemaining?: number;
  emiStatus?: CourseEmiStatus;
  adminNotes?: string;
}) {
  try {
    await requireRole(Role.ADMIN);

    const request = await db.courseEnrollmentRequest.findUnique({
      where: { id: input.requestId },
      include: {
        student: true,
        course: true,
      },
    });

    if (!request) {
      return { success: false, error: "Course request not found." };
    }

    if (request.status !== CourseRequestStatus.PENDING) {
      return { success: false, error: "This request has already been processed." };
    }

    // Determine default EMI status based on request payment plan
    let emiStatus = input.emiStatus;
    if (!emiStatus) {
      if (request.paymentPlan === CoursePaymentPlan.FULL_PAYMENT) {
        emiStatus = CourseEmiStatus.FULLY_PAID;
      } else {
        emiStatus = CourseEmiStatus.FIRST_INSTALLMENT_PAID;
      }
    }

    const sessionsToAllot =
      input.sessionsRemaining && input.sessionsRemaining > 0
        ? input.sessionsRemaining
        : request.course.sessionCount;

    // Run transaction: create Enrollment, update Request
    const result = await db.$transaction(async (tx) => {
      // Create active enrollment in student dashboard
      const enrollment = await tx.enrollment.create({
        data: {
          studentId: request.studentId,
          courseId: request.courseId,
          teacherId: input.teacherId || null,
          sessionsRemaining: sessionsToAllot,
          paymentPlan: request.paymentPlan,
          emiStatus: emiStatus,
          adminNotes: input.adminNotes?.trim() || null,
          status: EnrollmentStatus.ACTIVE,
        },
      });

      // Mark request approved and ensure student's trial quota is closed
      const updatedRequest = await tx.courseEnrollmentRequest.update({
        where: { id: request.id },
        data: {
          status: CourseRequestStatus.APPROVED,
          allottedTeacherId: input.teacherId || null,
          enrollmentId: enrollment.id,
          adminNotes: input.adminNotes?.trim() || null,
        },
      });

      // Enrolled students cannot claim free trials; ensure quota status is sealed
      await tx.studentTrialStatus.updateMany({
        where: { studentId: request.studentId },
        data: { status: TrialStatus.EXHAUSTED },
      });

      return { enrollment, updatedRequest };
    });

    // Notify Student
    await createNotification({
      userId: request.studentId,
      type: NotificationType.COURSE_REQUEST_APPROVED,
      title: "Course Allotted to Your Dashboard!",
      body: `Your admission for "${request.course.title}" has been approved! The course is now active on your student dashboard.`,
      link: `/student/dashboard/courses/${request.course.slug}`,
    });

    // If teacher was assigned, notify teacher
    if (input.teacherId) {
      await createNotification({
        userId: input.teacherId,
        type: NotificationType.SYSTEM,
        title: "New Student Course Allotment",
        body: `You have been allotted as mentor for ${request.student.name || "a student"} in "${request.course.title}". Check your 1:1 scheduling.`,
        link: "/teacher/dashboard/schedule",
      });
    }

    logger.info(
      {
        requestId: request.id,
        enrollmentId: result.enrollment.id,
        studentId: request.studentId,
        courseId: request.courseId,
      },
      "Admin approved course request and allotted enrollment",
    );

    revalidatePath("/admin/student-courses");
    revalidatePath("/admin/enrollments");
    revalidatePath("/admin");
    revalidatePath("/student/dashboard/courses");
    revalidatePath(`/student/dashboard/courses/${request.course.slug}`);
    revalidatePath("/student/dashboard");

    return { success: true, enrollmentId: result.enrollment.id };
  } catch (error: any) {
    logger.error({ error }, "Error approving course request");
    return {
      success: false,
      error: error.message || "Failed to approve request and allot course.",
    };
  }
}

// ─── Admin: Reject Course Admission Request ─────────────────────────────────

export async function adminRejectCourseRequestAction(input: {
  requestId: string;
  reason?: string;
}) {
  try {
    await requireRole(Role.ADMIN);

    const request = await db.courseEnrollmentRequest.findUnique({
      where: { id: input.requestId },
      include: {
        student: true,
        course: true,
      },
    });

    if (!request) {
      return { success: false, error: "Course request not found." };
    }

    if (request.status !== CourseRequestStatus.PENDING) {
      return { success: false, error: "This request has already been processed." };
    }

    await db.courseEnrollmentRequest.update({
      where: { id: input.requestId },
      data: {
        status: CourseRequestStatus.REJECTED,
        adminNotes: input.reason?.trim() || null,
      },
    });

    // Notify Student
    await createNotification({
      userId: request.studentId,
      type: NotificationType.COURSE_REQUEST_REJECTED,
      title: "Course Request Update",
      body: `Your admission request for "${request.course.title}" was not approved at this time.${
        input.reason ? ` Reason: ${input.reason}` : ""
      }`,
      link: "/student/dashboard/courses",
    });

    revalidatePath("/admin/student-courses");
    revalidatePath("/admin/enrollments");
    revalidatePath("/admin");
    revalidatePath("/student/dashboard/courses");

    return { success: true };
  } catch (error: any) {
    logger.error({ error }, "Error rejecting course request");
    return { success: false, error: error.message || "Failed to reject course request." };
  }
}

// ─── Admin: Manually Allot Course Directly to Student Dashboard ─────────────

export async function adminDirectAllotCourseAction(input: {
  studentId: string;
  courseId: string;
  teacherId?: string | null;
  sessionsCount?: number;
  paymentPlan?: CoursePaymentPlan;
  emiStatus?: CourseEmiStatus;
  adminNotes?: string;
}) {
  try {
    await requireRole(Role.ADMIN);

    const [student, course] = await Promise.all([
      db.user.findUnique({ where: { id: input.studentId } }),
      db.course.findUnique({ where: { id: input.courseId } }),
    ]);

    if (!student) {
      return { success: false, error: "Student not found." };
    }
    if (!course) {
      return { success: false, error: "Course not found." };
    }

    const sessions =
      input.sessionsCount && input.sessionsCount > 0
        ? input.sessionsCount
        : course.sessionCount;

    const paymentPlan = input.paymentPlan || CoursePaymentPlan.FULL_PAYMENT;
    const emiStatus =
      input.emiStatus ||
      (paymentPlan === CoursePaymentPlan.FULL_PAYMENT
        ? CourseEmiStatus.FULLY_PAID
        : CourseEmiStatus.FIRST_INSTALLMENT_PAID);

    const enrollment = await db.enrollment.create({
      data: {
        studentId: student.id,
        courseId: course.id,
        teacherId: input.teacherId || null,
        sessionsRemaining: sessions,
        paymentPlan: paymentPlan,
        emiStatus: emiStatus,
        adminNotes: input.adminNotes?.trim() || null,
        status: EnrollmentStatus.ACTIVE,
      },
    });

    // Notify Student
    await createNotification({
      userId: student.id,
      type: NotificationType.COURSE_REQUEST_APPROVED,
      title: "New Course Allotted to Your Dashboard",
      body: `You have been enrolled in "${course.title}". Check your student dashboard to begin your lessons!`,
      link: `/student/dashboard/courses/${course.slug}`,
    });

    // If teacher assigned, notify teacher
    if (input.teacherId) {
      await createNotification({
        userId: input.teacherId,
        type: NotificationType.SYSTEM,
        title: "New Student Course Allotment",
        body: `You have been assigned as faculty mentor for ${student.name || "a student"} in "${course.title}".`,
        link: "/teacher/dashboard/schedule",
      });
    }

    logger.info(
      { enrollmentId: enrollment.id, studentId: student.id, courseId: course.id },
      "Admin manually allotted course to student",
    );

    revalidatePath("/admin/student-courses");
    revalidatePath("/admin/enrollments");
    revalidatePath("/admin");
    revalidatePath("/student/dashboard/courses");
    revalidatePath(`/student/dashboard/courses/${course.slug}`);
    revalidatePath("/student/dashboard");

    return { success: true, enrollmentId: enrollment.id };
  } catch (error: any) {
    logger.error({ error }, "Error directly allotting course");
    return { success: false, error: error.message || "Failed to allot course to student." };
  }
}

// ─── Admin: Update Existing Student Course Enrollment ────────────────────────

export async function adminUpdateStudentCourseAction(input: {
  enrollmentId: string;
  teacherId?: string | null;
  sessionsRemaining?: number;
  status?: EnrollmentStatus;
  paymentPlan?: CoursePaymentPlan;
  emiStatus?: CourseEmiStatus;
  adminNotes?: string;
}) {
  try {
    await requireRole(Role.ADMIN);

    const enrollment = await db.enrollment.findUnique({
      where: { id: input.enrollmentId },
      include: { course: true, student: true },
    });

    if (!enrollment) {
      return { success: false, error: "Enrollment not found." };
    }

    const updated = await db.enrollment.update({
      where: { id: input.enrollmentId },
      data: {
        ...(input.teacherId !== undefined ? { teacherId: input.teacherId } : {}),
        ...(input.sessionsRemaining !== undefined
          ? { sessionsRemaining: Math.max(0, input.sessionsRemaining) }
          : {}),
        ...(input.status ? { status: input.status } : {}),
        ...(input.paymentPlan ? { paymentPlan: input.paymentPlan } : {}),
        ...(input.emiStatus ? { emiStatus: input.emiStatus } : {}),
        ...(input.adminNotes !== undefined ? { adminNotes: input.adminNotes } : {}),
      },
    });

    logger.info(
      { enrollmentId: input.enrollmentId, changes: input },
      "Admin updated student course enrollment",
    );

    revalidatePath("/admin/student-courses");
    revalidatePath("/admin/enrollments");
    revalidatePath("/admin");
    revalidatePath("/student/dashboard/courses");
    revalidatePath(`/student/dashboard/courses/${enrollment.course.slug}`);

    return { success: true, enrollment: updated };
  } catch (error: any) {
    logger.error({ error }, "Error updating student course enrollment");
    return { success: false, error: error.message || "Failed to update enrollment." };
  }
}
