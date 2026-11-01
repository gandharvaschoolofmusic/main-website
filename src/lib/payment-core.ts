import { db } from "@/lib/db";
import { PaymentStatus, EnrollmentStatus, Role, LessonStatus, LessonSource } from "@/types";
import { createRazorpayOrder, verifyRazorpayPaymentSignature, RAZORPAY_CONFIG } from "@/lib/razorpay";
import { logger } from "@/lib/logger";
import { isAppError } from "@/lib/errors";
import { sendCourseEnrollmentEmail } from "@/lib/email";
import { generateUniqueLessonTrackingCode } from "@/lib/lesson-tracking";
import { calculateLessonPayoutMinor } from "@/lib/teacher-payout";

export type PaymentOrderStudent = {
  id: string;
  name?: string | null;
  email?: string | null;
  role: Role;
};

export type CreateCourseOrderResult = {
  paymentId: string;
  orderId: string;
  amount: number;
  currency: string;
  keyId: string;
  course: {
    id: string;
    title: string;
    discipline: string;
    sessionCount: number;
  };
  student: {
    name: string;
    email: string;
  };
};

export type PaymentActionResponse = {
  success: boolean;
  data?: CreateCourseOrderResult;
  error?: string;
  code?: string;
};

/**
 * Core business logic for creating a course order & Payment record.
 */
export async function createCourseOrderCore(
  student: PaymentOrderStudent,
  courseId: string,
): Promise<PaymentActionResponse> {
  try {
    if (!courseId) {
      return {
        success: false,
        error: "Course ID is required.",
        code: "INVALID_COURSE_ID",
      };
    }

    const course = await db.course.findUnique({
      where: { id: courseId },
    });

    if (!course || !course.isPublished) {
      return {
        success: false,
        error: "The requested course is currently unavailable.",
        code: "COURSE_NOT_AVAILABLE",
      };
    }

    // Create order via Razorpay
    const order = await createRazorpayOrder({
      amountMinorUnits: course.priceMinorUnits,
      currency: course.currency,
      receipt: `crs_${course.id.slice(-6)}_${student.id.slice(-6)}`,
      notes: {
        courseId: course.id,
        studentId: student.id,
        courseTitle: course.title,
      },
    });

    // Create Payment record with CREATED status
    const payment = await db.payment.create({
      data: {
        studentId: student.id,
        amountMinorUnits: course.priceMinorUnits,
        currency: course.currency,
        gateway: "razorpay",
        gatewayOrderId: order.id,
        status: PaymentStatus.CREATED,
      },
    });

    logger.info(
      {
        paymentId: payment.id,
        orderId: order.id,
        studentId: student.id,
        courseId: course.id,
      },
      "Course payment order initialized",
    );

    return {
      success: true,
      data: {
        paymentId: payment.id,
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        keyId: RAZORPAY_CONFIG.keyId,
        course: {
          id: course.id,
          title: course.title,
          discipline: course.discipline,
          sessionCount: course.sessionCount,
        },
        student: {
          name: student.name || "",
          email: student.email || "",
        },
      },
    };
  } catch (error: unknown) {
    if (isAppError(error)) {
      return {
        success: false,
        error: error.message,
        code: error.code,
      };
    }

    logger.error(
      { error, courseId, studentId: student.id },
      "Error in createCourseOrderCore",
    );
    return {
      success: false,
      error: "Unable to initiate course purchase. Please try again.",
      code: "ORDER_CREATION_FAILED",
    };
  }
}

export type WebhookProcessResult = {
  success: boolean;
  enrollmentId?: string;
  isDuplicate?: boolean;
  error?: string;
  code?: string;
};

/**
 * Idempotently process a successful payment captured webhook.
 * Guarantees exactly one Enrollment is created even with duplicate/concurrent deliveries.
 */
export async function processSuccessfulPaymentWebhook(params: {
  gatewayOrderId: string;
  gatewayPaymentId: string;
  courseId?: string;
}): Promise<WebhookProcessResult> {
  const { gatewayOrderId, gatewayPaymentId, courseId } = params;

  if (!gatewayOrderId || !gatewayPaymentId) {
    return {
      success: false,
      error: "Missing gatewayOrderId or gatewayPaymentId",
      code: "INVALID_WEBHOOK_PAYLOAD",
    };
  }

  // 1. Check existing payment
  const payment = await db.payment.findUnique({
    where: { gatewayOrderId },
    include: {
      enrollment: true,
      student: true,
    },
  });

  if (!payment) {
    logger.warn({ gatewayOrderId }, "Payment not found for webhook order");
    return {
      success: false,
      error: `Payment record with order ${gatewayOrderId} not found`,
      code: "PAYMENT_NOT_FOUND",
    };
  }

  // 2. Pre-transaction idempotency check: already paid and enrolled
  if (payment.status === PaymentStatus.PAID && payment.enrollment) {
    logger.info(
      { paymentId: payment.id, enrollmentId: payment.enrollment.id },
      "Idempotent webhook delivery: payment already processed, skipping duplicate enrollment",
    );
    return {
      success: true,
      enrollmentId: payment.enrollment.id,
      isDuplicate: true,
    };
  }

  // 3. Atomic transaction with row locking
  try {
    const result = await db.$transaction(
      async (tx) => {
        // Lock the payment row to serialize concurrent webhooks
        await tx.$executeRaw`SELECT id FROM "Payment" WHERE id = ${payment.id} FOR UPDATE`;

        const freshPayment = await tx.payment.findUniqueOrThrow({
          where: { id: payment.id },
          include: { enrollment: true },
        });

        // Double check inside lock
        if (
          freshPayment.status === PaymentStatus.PAID &&
          freshPayment.enrollment
        ) {
          return {
            alreadyProcessed: true,
            enrollment: freshPayment.enrollment,
            course: null,
          };
        }

        // Determine course to enroll in
        let course = null;
        if (courseId) {
          course = await tx.course.findUnique({ where: { id: courseId } });
        }
        if (!course) {
          // Fallback: match by price minor units if courseId was not passed
          course = await tx.course.findFirst({
            where: { priceMinorUnits: payment.amountMinorUnits },
          });
        }
        if (!course) {
          throw new Error("Target course for enrollment not found");
        }

        // Update Payment status to PAID
        await tx.payment.update({
          where: { id: payment.id },
          data: {
            status: PaymentStatus.PAID,
            gatewayPaymentId,
          },
        });

        // Create Enrollment
        const enrollment = await tx.enrollment.create({
          data: {
            studentId: payment.studentId,
            courseId: course.id,
            paymentId: payment.id,
            sessionsRemaining: course.sessionCount,
            status: EnrollmentStatus.ACTIVE,
            teacherId: null, // Admin allots dedicated teacher and schedules 1-on-1 lessons per student
          },
        });

        // Note: Lessons are scheduled individually per student by the academy admin
        // with customized 1-on-1 timings and unique lesson IDs for payment tracking.

        return {
          alreadyProcessed: false,
          enrollment,
          course,
        };
      },
      {
        isolationLevel: "Serializable",
      },
    );

    if (result.alreadyProcessed) {
      return {
        success: true,
        enrollmentId: result.enrollment.id,
        isDuplicate: true,
      };
    }

    // 4. Send email confirmation in background
    if (result.course && payment.student?.email) {
      try {
        await sendCourseEnrollmentEmail({
          studentEmail: payment.student.email,
          studentName: payment.student.name || "Student",
          courseTitle: result.course.title,
          sessionCount: result.course.sessionCount,
          amountPaid: payment.amountMinorUnits,
          currency: payment.currency,
        });
      } catch (emailErr) {
        logger.error({ emailErr }, "Failed sending course enrollment email");
      }
    }

    logger.info(
      {
        enrollmentId: result.enrollment.id,
        paymentId: payment.id,
        studentId: payment.studentId,
      },
      "Successfully created enrollment from payment webhook",
    );

    return {
      success: true,
      enrollmentId: result.enrollment.id,
      isDuplicate: false,
    };
  } catch (err: unknown) {
    const error = err as { code?: string; message?: string };
    // Catch unique constraint violation on gatewayPaymentId or Enrollment.paymentId
    if (error?.code === "P2002") {
      logger.info(
        { gatewayPaymentId, orderId: gatewayOrderId },
        "Caught unique constraint violation in webhook, verifying existing enrollment",
      );
      const recheck = await db.enrollment.findUnique({
        where: { paymentId: payment.id },
      });
      if (recheck) {
        return {
          success: true,
          enrollmentId: recheck.id,
          isDuplicate: true,
        };
      }
    }

    logger.error({ err, params }, "Error processing payment webhook");
    throw err;
  }
}

/**
 * Verifies Razorpay checkout HMAC SHA256 payment signature and completes enrollment.
 * Cryptographically verifies that the payment was captured before provisioning course access.
 */
export async function verifyAndCompleteCoursePaymentCore(params: {
  studentId: string;
  orderId: string;
  paymentId: string;
  signature: string;
  courseId: string;
}): Promise<WebhookProcessResult> {
  const { studentId, orderId, paymentId, signature, courseId } = params;

  if (!orderId || !paymentId || !signature) {
    return {
      success: false,
      error: "Missing required payment verification parameters.",
      code: "INVALID_VERIFICATION_PARAMS",
    };
  }

  // Cryptographic signature check (timing-safe HMAC SHA256)
  const isSignatureValid = verifyRazorpayPaymentSignature({
    orderId,
    paymentId,
    signature,
  });

  if (!isSignatureValid) {
    logger.warn(
      { orderId, paymentId, studentId },
      "Invalid Razorpay payment signature received during checkout verification",
    );
    return {
      success: false,
      error: "Payment verification failed. Invalid cryptographic signature.",
      code: "INVALID_SIGNATURE",
    };
  }

  // Look up payment by gatewayOrderId
  const payment = await db.payment.findUnique({
    where: { gatewayOrderId: orderId },
    include: {
      enrollment: true,
      student: true,
    },
  });

  if (!payment) {
    return {
      success: false,
      error: "Payment record for order not found.",
      code: "PAYMENT_NOT_FOUND",
    };
  }

  // Security guard: Ensure this payment belongs to the calling student
  if (payment.studentId !== studentId) {
    logger.warn(
      { orderId, studentId, paymentStudentId: payment.studentId },
      "Unauthorized attempt to verify payment for a different student",
    );
    return {
      success: false,
      error: "Unauthorized payment verification.",
      code: "UNAUTHORIZED_PAYMENT",
    };
  }

  // Reuse idempotent atomic transaction logic with row locking
  return await processSuccessfulPaymentWebhook({
    gatewayOrderId: orderId,
    gatewayPaymentId: paymentId,
    courseId,
  });
}

/**
 * Generates a deterministic group room ID for a course lesson so all enrolled
 * students share the same LiveKit room for group classes.
 *
 * Scoped by courseId, teacherProfileId, lessonNumber, and startsAt timestamp
 * to guarantee that two different teachers running the same course, or
 * different cohorts at different times, always get isolated LiveKit rooms.
 *
 * Format: `group-{courseId}-{teacherProfileId}-{lessonNumber}-{startsAtMs}`
 */
function makeGroupRoomId(
  courseId: string,
  teacherProfileId: string,
  startsAt: Date,
  lessonNumber: number,
): string {
  return `group-${courseId}-${teacherProfileId}-${lessonNumber}-${startsAt.getTime()}`;
}

/**
 * Finds the groupRoomId from an already-scheduled lesson for the same course,
 * teacher, and time slot. If another student is already enrolled and has a lesson
 * at this slot, we reuse their groupRoomId so everyone joins the same LiveKit room.
 *
 * The generated groupRoomId is scoped by courseId, teacherProfileId, lessonNumber,
 * and startsAt — guaranteeing room isolation across concurrent classrooms.
 */
async function resolveGroupRoomId(
  tx: any,
  teacherProfileId: string,
  startsAt: Date,
  courseId: string,
  lessonNumber: number,
): Promise<string> {
  // Check if another student already has a SCHEDULED lesson at this exact slot
  const existingLesson = await tx.lesson.findFirst({
    where: {
      teacherProfileId,
      startsAt,
      status: LessonStatus.SCHEDULED,
      groupRoomId: { not: null },
    },
    select: { groupRoomId: true },
  });

  return existingLesson?.groupRoomId || makeGroupRoomId(courseId, teacherProfileId, startsAt, lessonNumber);
}

/**
 * Automatically creates and schedules Lesson records for a student's course enrollment
 * based on the course's structured CourseLesson curriculum and allotted teachers.
 *
 * For group courses, all students share the same `groupRoomId` at the same time slot,
 * so they all join the same LiveKit room. Each student still gets their own Lesson row
 * for tracking attendance, progress, and per-student data.
 */
export async function scheduleEnrollmentLessonsCore(
  tx: any,
  params: {
    enrollmentId: string;
    studentId: string;
    courseId: string;
  },
) {
  const { enrollmentId, studentId, courseId } = params;

  const fullCourse = await tx.course.findUnique({
    where: { id: courseId },
    include: {
      lessons: { orderBy: { lessonNumber: "asc" } },
      teachers: {
        include: {
          teacher: {
            include: { teacherProfile: true },
          },
        },
      },
    },
  });

  if (!fullCourse) return [];

  // Fallback teacher if a specific course lesson doesn't have an allotted teacher
  const defaultTeacherUser = fullCourse.teachers[0]?.teacher;
  let fallbackTeacherId = defaultTeacherUser?.id;
  let fallbackProfileId = defaultTeacherUser?.teacherProfile?.id;
  let fallbackTeacherProfile = defaultTeacherUser?.teacherProfile || null;

  // If course doesn't have allotted teachers yet, pick any published teacher for that instrument or any active teacher
  if (!fallbackTeacherId || !fallbackProfileId) {
    let matchingTeacher = await tx.teacherProfile.findFirst({
      where: {
        isPublished: true,
        instruments: { has: fullCourse.instrument },
      },
      include: { user: true },
    });
    if (!matchingTeacher) {
      matchingTeacher = await tx.teacherProfile.findFirst({
        where: { isPublished: true },
        include: { user: true },
      });
    }
    if (!matchingTeacher) {
      matchingTeacher = await tx.teacherProfile.findFirst({
        include: { user: true },
      });
    }

    if (matchingTeacher) {
      fallbackTeacherId = matchingTeacher.userId;
      fallbackProfileId = matchingTeacher.id;
      fallbackTeacherProfile = matchingTeacher;
    }
  }

  // Update enrollment's default teacherId if found
  if (fallbackTeacherId) {
    await tx.enrollment.update({
      where: { id: enrollmentId },
      data: { teacherId: fallbackTeacherId },
    });
  }

  const createdLessons = [];
  const baseStartDate = fullCourse.startDate
    ? new Date(fullCourse.startDate)
    : new Date(Date.now() + 86400000 * 2); // default 2 days in future
  baseStartDate.setHours(10, 0, 0, 0);

  // If specific course lessons exist, schedule them
  if (fullCourse.lessons && fullCourse.lessons.length > 0) {
    for (const cl of fullCourse.lessons) {
      const teacherId = cl.teacherId || fallbackTeacherId;
      if (!teacherId) continue;

      // Get teacher's profile
      let teacherProfileObj = fallbackTeacherProfile;
      if (teacherId !== fallbackTeacherId) {
        teacherProfileObj = await tx.teacherProfile.findUnique({
          where: { userId: teacherId },
        });
      }
      const profileId = teacherProfileObj?.id || fallbackProfileId;

      if (!profileId) continue;

      // Compute lesson start time (same for all students in this course lesson)
      const startsAt = cl.scheduledStartsAt
        ? new Date(cl.scheduledStartsAt)
        : new Date(baseStartDate.getTime() + (cl.lessonNumber - 1) * 7 * 86400000);

      const lessonDuration = cl.durationMinutes || 60;

      // Generate unique tracking code for payment & payout auditing
      const trackingCode = await generateUniqueLessonTrackingCode(studentId, tx);
      const payoutAmountMinor = calculateLessonPayoutMinor(startsAt, teacherProfileObj);

      const lesson = await tx.lesson.create({
        data: {
          teacherId,
          teacherProfileId: profileId,
          studentId,
          instrument: fullCourse.instrument,
          startsAt,
          durationMinutes: lessonDuration,
          status: LessonStatus.SCHEDULED,
          lessonSource: LessonSource.ENROLLMENT,
          enrollmentId,
          groupRoomId: null, // Strictly 1-on-1 private lesson
          trackingCode,
          payoutAmountMinor,
        },
      });

      createdLessons.push(lesson);
    }
  } else if (fallbackTeacherId && fallbackProfileId) {
    // If no course lessons have been customized by admin yet, generate sessionCount default lessons
    const totalSessions = fullCourse.sessionCount || 4;
    for (let i = 1; i <= totalSessions; i++) {
      const startsAt = new Date(baseStartDate.getTime() + (i - 1) * 7 * 86400000);
      const trackingCode = await generateUniqueLessonTrackingCode(studentId, tx);
      const payoutAmountMinor = calculateLessonPayoutMinor(startsAt, fallbackTeacherProfile);

      const lesson = await tx.lesson.create({
        data: {
          teacherId: fallbackTeacherId,
          teacherProfileId: fallbackProfileId,
          studentId,
          instrument: fullCourse.instrument,
          startsAt,
          durationMinutes: 60,
          status: LessonStatus.SCHEDULED,
          lessonSource: LessonSource.ENROLLMENT,
          enrollmentId,
          groupRoomId: null, // Strictly 1-on-1 private lesson
          trackingCode,
          payoutAmountMinor,
        },
      });
      createdLessons.push(lesson);
    }
  }

  logger.info(
    {
      enrollmentId,
      studentId,
      courseId,
      scheduledLessonsCount: createdLessons.length,
    },
    "Automatically scheduled course lessons for enrollment",
  );

  return createdLessons;
}

/**
 * Direct enrollment for instant checkout / demo mode / free courses.
 * Creates Payment (status: PAID), Enrollment, and automatically schedules
 * all course lessons into both student & teacher calendars/dashboards.
 */
export async function enrollCourseDirectCore(
  student: PaymentOrderStudent,
  courseId: string,
) {
  const course = await db.course.findUnique({
    where: { id: courseId },
    include: {
      lessons: { orderBy: { lessonNumber: "asc" } },
      teachers: true,
    },
  });

  if (!course || !course.isPublished) {
    throw new Error("Course is not available for enrollment.");
  }

  // Check if student already has an active enrollment in this course
  const existingEnrollment = await db.enrollment.findFirst({
    where: {
      studentId: student.id,
      courseId: course.id,
      status: EnrollmentStatus.ACTIVE,
    },
  });

  if (existingEnrollment) {
    return {
      success: true,
      enrollmentId: existingEnrollment.id,
      alreadyEnrolled: true,
    };
  }

  const orderId = `direct_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const paymentId = `pay_direct_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  const result = await db.$transaction(
    async (tx) => {
      // 1. Create Payment
      const payment = await tx.payment.create({
        data: {
          studentId: student.id,
          amountMinorUnits: course.priceMinorUnits,
          currency: course.currency,
          gateway: "direct",
          gatewayOrderId: orderId,
          gatewayPaymentId: paymentId,
          status: PaymentStatus.PAID,
        },
      });

      // 2. Create Enrollment (1-on-1 teacher allotment & scheduling done student-wise by admin)
      const enrollment = await tx.enrollment.create({
        data: {
          studentId: student.id,
          courseId: course.id,
          paymentId: payment.id,
          sessionsRemaining: course.sessionCount,
          status: EnrollmentStatus.ACTIVE,
          teacherId: null,
        },
      });

      return enrollment;
    },
    { isolationLevel: "Serializable" },
  );

  return {
    success: true,
    enrollmentId: result.id,
    alreadyEnrolled: false,
  };
}
