import { Resend } from "resend";
import nodemailer from "nodemailer";
import { logger } from "@/lib/logger";
import { formatInViewerTimezone } from "@/lib/timezone";
import { generateLessonIcs } from "@/lib/ical";
import { db } from "@/lib/db";
import { Role } from "@prisma/client";

const resendApiKey = process.env.RESEND_API_KEY;
const isResendConfigured =
  Boolean(resendApiKey) && !resendApiKey?.startsWith("re_placeholder");

const resend = isResendConfigured ? new Resend(resendApiKey) : null;
const fromEmail =
  process.env.EMAIL_FROM ||
  (process.env.SMTP_USER
    ? `Gandharva School of Music <${process.env.SMTP_USER}>`
    : "Gandharva School of Music <notifications@gandharvaschoolofmusic.com>");

const appUrl =
  process.env.NEXTAUTH_URL || process.env.APP_URL || "https://www.gandharvaschoolofmusic.com";

const firebaseApiKey =
  process.env.FIREBASE_API_KEY || process.env.NEXT_PUBLIC_FIREBASE_API_KEY;

// Hostinger & Custom SMTP Transporter
const smtpHost = process.env.SMTP_HOST || (process.env.SMTP_USER ? "smtp.hostinger.com" : undefined);
const smtpPort = Number(process.env.SMTP_PORT || 465);
const smtpSecure = process.env.SMTP_SECURE ? process.env.SMTP_SECURE === "true" : smtpPort === 465;
const smtpUser = process.env.SMTP_USER;
const smtpPass = process.env.SMTP_PASS || process.env.SMTP_PASSWORD;

let cachedSmtpTransporter: nodemailer.Transporter | null = null;

export function getSmtpTransporter(): nodemailer.Transporter | null {
  if (!smtpHost || !smtpUser || !smtpPass) {
    return null;
  }
  if (!cachedSmtpTransporter) {
    cachedSmtpTransporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpSecure,
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    });
  }
  return cachedSmtpTransporter;
}

export interface SendMailOptions {
  to: string | string[];
  subject: string;
  html: string;
  attachments?: Array<{
    filename: string;
    content: string | Buffer;
    contentType?: string;
  }>;
}

/**
 * Sends an email using either Resend (if configured) or Hostinger/custom SMTP (if configured).
 * Returns true if the message was successfully dispatched by either provider.
 */
export async function sendMail(options: SendMailOptions): Promise<boolean> {
  // 1. Try Resend if configured
  if (resend) {
    try {
      await resend.emails.send({
        from: fromEmail,
        to: options.to,
        subject: options.subject,
        html: options.html,
        attachments: options.attachments?.map((a) => ({
          filename: a.filename,
          content: typeof a.content === "string" ? Buffer.from(a.content) : a.content,
        })),
      });
      return true;
    } catch (error) {
      logger.error({ error, to: options.to }, "Failed to send email via Resend");
    }
  }

  // 2. Try SMTP (Hostinger, Google Workspace, etc.) if configured
  const smtp = getSmtpTransporter();
  if (smtp) {
    try {
      await smtp.sendMail({
        from: fromEmail,
        to: Array.isArray(options.to) ? options.to.join(", ") : options.to,
        subject: options.subject,
        html: options.html,
        attachments: options.attachments?.map((a) => ({
          filename: a.filename,
          content: a.content,
          contentType: a.contentType,
        })),
      });
      return true;
    } catch (error) {
      logger.error({ error, to: options.to }, "Failed to send email via SMTP");
    }
  }

  return false;
}

/**
 * Send an email verification link to the user.
 */
export async function sendVerificationEmail(
  email: string,
  token: string,
): Promise<{ success: boolean; previewUrl?: string }> {
  const cleanAppUrl = (
    process.env.NEXTAUTH_URL || process.env.APP_URL || "https://www.gandharvaschoolofmusic.com"
  ).replace(/\/+$/, "");
  const verifyUrl = `${cleanAppUrl}/verify-email?token=${encodeURIComponent(token.trim())}`;

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px 24px; color: #1c1917; background-color: #ffffff; border-radius: 16px; border: 1px solid #f0e6d6;">
      <div style="text-align: center; margin-bottom: 24px;">
        <h1 style="color: #3C096C; font-size: 24px; font-weight: 800; margin: 0 0 6px 0;">Gandharva School of Music</h1>
        <p style="color: #78716c; font-size: 14px; margin: 0;">Account Verification</p>
      </div>
      <p style="font-size: 15px; line-height: 1.6; color: #374151;">
        Hello,
      </p>
      <p style="font-size: 15px; line-height: 1.6; color: #374151;">
        Welcome to Gandharva School of Music! Please click the button below to verify your email address and activate your account:
      </p>
      <div style="text-align: center; margin: 32px 0;">
        <a href="${verifyUrl}" style="background-color: #3C096C; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 10px; font-weight: 700; font-size: 16px; display: inline-block; box-shadow: 0 4px 12px rgba(60, 9, 108, 0.25);">
          Verify Email Address
        </a>
      </div>
      <p style="color: #78716c; font-size: 13px; line-height: 1.5;">
        Or copy and paste this verification link directly into your browser:<br/>
        <a href="${verifyUrl}" style="color: #FF7803; word-break: break-all;">${verifyUrl}</a>
      </p>
      <hr style="border: none; border-top: 1px solid #f3f4f6; margin: 28px 0;" />
      <p style="color: #9ca3af; font-size: 12px; margin: 0; line-height: 1.5; text-align: center;">
        This single-use link expires in 24 hours. If you did not create an account on Gandharva School of Music, you can safely ignore this email.
      </p>
    </div>
  `;

  // 1. Send via Resend or Hostinger SMTP
  const sent = await sendMail({
    to: email,
    subject: "Verify your email for Gandharva School of Music",
    html,
  });

  if (sent) {
    logger.info({ email }, "Verification email dispatched successfully");
    return { success: true };
  }

  // 2. Dispatch via Firebase Identity Toolkit if configured
  if (firebaseApiKey) {
    try {
      const res = await fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${firebaseApiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            requestType: "EMAIL_SIGNIN",
            email,
            continueUrl: verifyUrl,
            canHandleCodeInApp: true,
          }),
        }
      );

      if (res.ok) {
        logger.info({ email }, "[Firebase] Verification email dispatched successfully via Google");
        return { success: true };
      } else {
        const errorData = await res.json().catch(() => ({}));
        logger.warn({ errorData, email }, "[Firebase] Failed to dispatch email via Firebase REST API");
      }
    } catch (fbErr) {
      logger.error({ fbErr, email }, "[Firebase] Unexpected error dispatching verification email");
    }
  }

  // 3. Fallback for local development only
  if (process.env.NODE_ENV === "development") {
    logger.info(
      { email, verifyUrl },
      "✉️ [DEV EMAIL] Email Verification link generated",
    );
    return { success: true, previewUrl: verifyUrl };
  }

  return { success: true };
}

/**
 * Send a 6-digit verification code to confirm an email address update.
 */
export async function sendEmailUpdateVerificationEmail({
  email,
  otpCode,
  userName,
}: {
  email: string;
  otpCode: string;
  userName?: string;
}): Promise<{ success: boolean }> {
  const brandName = "Gandharva School of Music";
  const subject = `Your ${brandName} email verification code: ${otpCode}`;

  const emailUpdateHtml = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; color: #1c1917; background-color: #ffffff; border-radius: 16px; border: 1px solid #f0e6d6;">
      <div style="text-align: center; margin-bottom: 24px;">
        <h1 style="color: #3C096C; font-size: 22px; font-weight: 800; margin: 0 0 6px 0;">Gandharva School of Music</h1>
        <p style="color: #78716c; font-size: 13px; margin: 0;">Faculty Account Security</p>
      </div>
      
      <p style="font-size: 14px; line-height: 1.6; color: #374151;">
        Hello ${userName || "Instructor"},
      </p>
      <p style="font-size: 14px; line-height: 1.6; color: #374151;">
        You requested to update the email address associated with your Gandharva School of Music profile to this address. Use the verification code below to confirm and complete this change:
      </p>
      
      <div style="text-align: center; margin: 28px 0;">
        <div style="display: inline-block; background-color: #fbf6ee; border: 2px dashed #FF7803; border-radius: 12px; padding: 14px 28px;">
          <span style="font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #3C096C; font-family: monospace;">
            ${otpCode}
          </span>
        </div>
        <p style="font-size: 12px; color: #b45309; margin-top: 10px; font-weight: 600;">
          ⏱️ Valid for 15 minutes
        </p>
      </div>

      <p style="font-size: 12px; color: #6b7280; line-height: 1.5;">
        If you did not request this email change, please ignore this message. Your account remains secure and your current email will not be changed.
      </p>
      
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
      <p style="font-size: 11px; color: #9ca3af; text-align: center; margin: 0;">
        Gandharva School of Music &bull; Faculty Portal Security
      </p>
    </div>
  `;

  const updateSent = await sendMail({
    to: email,
    subject,
    html: emailUpdateHtml,
  });

  if (updateSent) {
    return { success: true };
  }

  // Fallback for development or when Resend key is not configured
  logger.info(
    { email, otpCode },
    `✉️ [EMAIL UPDATE OTP] Dispatched 6-digit verification code to ${email}: ${otpCode}`,
  );

  return { success: true };
}

export async function sendPasswordResetEmail(
  email: string,
  token: string,
): Promise<{ success: boolean; previewUrl?: string }> {
  const resetUrl = `${appUrl}/reset-password?token=${encodeURIComponent(token)}`;

  const resetHtml = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px 24px; color: #1c1917; background-color: #ffffff; border-radius: 16px; border: 1px solid #f0e6d6;">
      <div style="text-align: center; margin-bottom: 24px;">
        <h1 style="color: #3C096C; font-size: 24px; font-weight: 800; margin: 0 0 6px 0;">Gandharva School of Music</h1>
        <p style="color: #78716c; font-size: 14px; margin: 0;">Password Reset Request</p>
      </div>
      <p style="font-size: 15px; line-height: 1.6; color: #374151;">
        Hello,
      </p>
      <p style="font-size: 15px; line-height: 1.6; color: #374151;">
        We received a request to reset your password for Gandharva School of Music. Click the button below to choose a new password:
      </p>
      <div style="text-align: center; margin: 32px 0;">
        <a href="${resetUrl}" style="background-color: #3C096C; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 10px; font-weight: 700; font-size: 16px; display: inline-block; box-shadow: 0 4px 12px rgba(60, 9, 108, 0.25);">
          Reset Password
        </a>
      </div>
      <p style="color: #78716c; font-size: 13px; line-height: 1.5;">
        Or copy and paste this link into your browser:<br/>
        <a href="${resetUrl}" style="color: #FF7803; word-break: break-all;">${resetUrl}</a>
      </p>
      <hr style="border: none; border-top: 1px solid #f3f4f6; margin: 28px 0;" />
      <p style="color: #9ca3af; font-size: 12px; margin: 0; line-height: 1.5; text-align: center;">
        This single-use link expires in 30 minutes. If you did not request a password reset, please ignore this email.
      </p>
    </div>
  `;

  // 1. Send via Resend or Hostinger SMTP
  const resetSent = await sendMail({
    to: email,
    subject: "Reset your Gandharva School of Music password",
    html: resetHtml,
  });

  if (resetSent) {
    logger.info({ email }, "Password reset email dispatched successfully");
    return { success: true };
  }

  // 2. Dispatch via Firebase Identity Toolkit if configured
  if (firebaseApiKey) {
    try {
      const res = await fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${firebaseApiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            requestType: "PASSWORD_RESET",
            email,
          }),
        }
      );

      if (res.ok) {
        logger.info({ email }, "[Firebase] Password reset email dispatched successfully via Google");
        return { success: true };
      } else {
        const errorData = await res.json().catch(() => ({}));
        logger.warn({ errorData, email }, "[Firebase] Failed to dispatch password reset via Firebase REST API");
      }
    } catch (fbErr) {
      logger.error({ fbErr, email }, "[Firebase] Unexpected error dispatching password reset email");
    }
  }

  // 3. Fallback for local development only
  if (process.env.NODE_ENV === "development") {
    logger.info(
      { email, resetUrl },
      "✉️ [DEV EMAIL] Password Reset link generated (30m expiry)",
    );
    return { success: true, previewUrl: resetUrl };
  }

  return { success: true };
}

export interface BookingConfirmationParams {
  lessonId: string;
  instrument: string;
  startsAt: Date;
  durationMinutes: number;
  teacher: {
    name: string;
    email: string;
    timezone: string;
  };
  student: {
    name: string;
    email: string;
    timezone: string;
  };
}

/**
 * Send lesson booking confirmation emails with .ics calendar attachments to both
 * student and teacher, rendering the lesson time in each recipient's own timezone.
 */
export async function sendBookingConfirmationEmails(
  params: BookingConfirmationParams,
): Promise<{ success: boolean }> {
  const {
    lessonId,
    instrument,
    startsAt,
    durationMinutes,
    teacher,
    student,
  } = params;

  const roomUrl = `${appUrl}/lesson/${lessonId}`;

  // Time formatted in student's timezone with visible abbreviation
  const studentFormattedTime = formatInViewerTimezone(
    startsAt,
    student.timezone,
    "EEEE, MMMM d, yyyy 'at' h:mm a zzz",
  );

  // Time formatted in teacher's timezone with visible abbreviation
  const teacherFormattedTime = formatInViewerTimezone(
    startsAt,
    teacher.timezone,
    "EEEE, MMMM d, yyyy 'at' h:mm a zzz",
  );

  // Generate RFC 5545 .ics calendar event
  const icsContent = generateLessonIcs({
    lessonId,
    instrument,
    startsAt,
    durationMinutes,
    teacherName: teacher.name,
    studentName: student.name,
  });

  const icsBase64 = Buffer.from(icsContent).toString("base64");

  try {
    const studentHtml = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 28px 24px; color: #1c1917; background-color: #ffffff; border-radius: 16px; border: 1px solid #f0e6d6;">
        <div style="text-align: center; margin-bottom: 20px;">
          <h1 style="color: #3C096C; font-size: 24px; font-weight: 800; margin: 0 0 6px 0;">Gandharva School of Music</h1>
          <p style="color: #FF7803; font-size: 15px; font-weight: 700; margin: 0;">Lesson Confirmed!</p>
        </div>
        <p style="font-size: 15px; color: #374151;">Your 1-to-1 music lesson with <strong>${teacher.name}</strong> is confirmed.</p>
        <div style="background-color: #fdfbf7; border: 1px solid #fed7aa; border-radius: 12px; padding: 16px; margin: 20px 0;">
          <p style="margin: 6px 0; font-size: 14px;"><strong>Instrument:</strong> ${instrument}</p>
          <p style="margin: 6px 0; font-size: 14px;"><strong>When:</strong> ${studentFormattedTime}</p>
          <p style="margin: 6px 0; font-size: 14px;"><strong>Duration:</strong> ${durationMinutes} minutes</p>
          <p style="margin: 6px 0; font-size: 14px;"><strong>Teacher:</strong> ${teacher.name}</p>
        </div>
        <div style="text-align: center; margin: 28px 0;">
          <a href="${roomUrl}" style="background-color: #3C096C; color: white; padding: 13px 26px; text-decoration: none; border-radius: 10px; font-weight: 700; font-size: 15px; display: inline-block;">
            Go to Lesson Room
          </a>
        </div>
        <p style="color: #78716c; font-size: 13px; text-align: center;">The lesson room opens 10 minutes before the start time. A calendar invite (.ics) has been attached to this email.</p>
      </div>
    `;

    const teacherHtml = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 28px 24px; color: #1c1917; background-color: #ffffff; border-radius: 16px; border: 1px solid #f0e6d6;">
        <div style="text-align: center; margin-bottom: 20px;">
          <h1 style="color: #3C096C; font-size: 24px; font-weight: 800; margin: 0 0 6px 0;">Gandharva School of Music</h1>
          <p style="color: #FF7803; font-size: 15px; font-weight: 700; margin: 0;">New Lesson Booked!</p>
        </div>
        <p style="font-size: 15px; color: #374151;"><strong>${student.name}</strong> has booked a lesson with your studio.</p>
        <div style="background-color: #fdfbf7; border: 1px solid #fed7aa; border-radius: 12px; padding: 16px; margin: 20px 0;">
          <p style="margin: 6px 0; font-size: 14px;"><strong>Instrument:</strong> ${instrument}</p>
          <p style="margin: 6px 0; font-size: 14px;"><strong>When:</strong> ${teacherFormattedTime}</p>
          <p style="margin: 6px 0; font-size: 14px;"><strong>Duration:</strong> ${durationMinutes} minutes</p>
          <p style="margin: 6px 0; font-size: 14px;"><strong>Student:</strong> ${student.name}</p>
        </div>
        <div style="text-align: center; margin: 28px 0;">
          <a href="${roomUrl}" style="background-color: #3C096C; color: white; padding: 13px 26px; text-decoration: none; border-radius: 10px; font-weight: 700; font-size: 15px; display: inline-block;">
            Go to Studio Room
          </a>
        </div>
        <p style="color: #78716c; font-size: 13px; text-align: center;">The lesson room opens 10 minutes before the start time. A calendar invite (.ics) has been attached to this email.</p>
      </div>
    `;

    const sentStudent = await sendMail({
      to: student.email,
      subject: `Lesson Confirmed: ${instrument} with ${teacher.name}`,
      attachments: [{ filename: "lesson.ics", content: icsBase64 }],
      html: studentHtml,
    });

    const sentTeacher = await sendMail({
      to: teacher.email,
      subject: `New Lesson Booked: ${instrument} with ${student.name}`,
      attachments: [{ filename: "lesson.ics", content: icsBase64 }],
      html: teacherHtml,
    });

    if (sentStudent || sentTeacher) {
      return { success: true };
    }

    // Dev fallback if neither Resend nor SMTP is configured
    logger.info(
      {
        lessonId,
        studentEmail: student.email,
        studentTime: studentFormattedTime,
        teacherEmail: teacher.email,
        teacherTime: teacherFormattedTime,
        roomUrl,
      },
      "✉️ [DEV EMAIL] Booking confirmation emails dispatched to student & teacher with .ics",
    );
    return { success: true };
  } catch (error) {
    logger.error(
      { error, lessonId },
      "Failed to dispatch booking confirmation emails",
    );
    return { success: false };
  }
}

export interface LessonCancellationEmailParams {
  lessonId: string;
  instrument: string;
  startsAt: Date;
  cancelledByName: string;
  cancelledByRole: "TEACHER" | "STUDENT";
  recipient: {
    name: string;
    email: string;
    timezone: string;
  };
  reason?: string;
}

/**
 * Dispatch lesson cancellation email to the other party with date/time
 * formatted in their local timezone.
 */
export async function sendLessonCancellationEmail(
  params: LessonCancellationEmailParams,
): Promise<{ success: boolean }> {
  const {
    lessonId,
    instrument,
    startsAt,
    cancelledByName,
    cancelledByRole,
    recipient,
    reason,
  } = params;

  const formattedTime = formatInViewerTimezone(
    startsAt,
    recipient.timezone,
    "EEEE, MMMM d, yyyy 'at' h:mm a zzz",
  );

  const browseUrl = `${appUrl}/teachers`;

  try {
    const cancellationHtml = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 28px 24px; color: #1c1917; background-color: #ffffff; border-radius: 16px; border: 1px solid #f0e6d6;">
        <div style="text-align: center; margin-bottom: 20px;">
          <h1 style="color: #3C096C; font-size: 24px; font-weight: 800; margin: 0 0 6px 0;">Gandharva School of Music</h1>
          <p style="color: #ea580c; font-size: 15px; font-weight: 700; margin: 0;">Lesson Cancelled</p>
        </div>
        <p style="font-size: 15px; color: #374151;">Your upcoming ${instrument} lesson has been cancelled by <strong>${cancelledByName}</strong>.</p>
        <div style="background-color: #fdfbf7; border: 1px solid #fed7aa; border-radius: 12px; padding: 16px; margin: 20px 0;">
          <p style="margin: 6px 0; font-size: 14px;"><strong>Instrument:</strong> ${instrument}</p>
          <p style="margin: 6px 0; font-size: 14px;"><strong>Original Time:</strong> ${formattedTime}</p>
          <p style="margin: 6px 0; font-size: 14px;"><strong>Cancelled By:</strong> ${cancelledByName} (${cancelledByRole.toLowerCase()})</p>
          ${reason ? `<p style="margin: 6px 0; font-size: 14px;"><strong>Reason:</strong> ${reason}</p>` : ""}
        </div>
        <p style="color: #57534e; font-size: 14px; margin: 20px 0; line-height: 1.5;">
          ${
            cancelledByRole === "TEACHER"
              ? "We apologize for the inconvenience. You can browse other available slots or instructors anytime."
              : "The slot has been restored to your open studio availability."
          }
        </p>
        <div style="text-align: center; margin: 24px 0;">
          <a href="${browseUrl}" style="background-color: #3C096C; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
            Browse Teachers
          </a>
        </div>
      </div>
    `;

    const sent = await sendMail({
      to: recipient.email,
      subject: `Lesson Cancelled: ${instrument} with ${cancelledByName}`,
      html: cancellationHtml,
    });

    if (sent) {
      return { success: true };
    }

    logger.info(
      {
        lessonId,
        recipientEmail: recipient.email,
        recipientTime: formattedTime,
        cancelledByName,
        cancelledByRole,
        reason,
      },
      "✉️ [DEV EMAIL] Lesson cancellation email dispatched",
    );
    return { success: true };
  } catch (error) {
    logger.error(
      { error, lessonId, recipientEmail: recipient.email },
      "Failed to send lesson cancellation email",
    );
    return { success: false };
  }
}

/**
 * Send course enrollment confirmation email to student upon payment capture.
 */
export async function sendCourseEnrollmentEmail({
  studentEmail,
  studentName,
  courseTitle,
  sessionCount,
  amountPaid,
  currency,
}: {
  studentEmail: string;
  studentName: string;
  courseTitle: string;
  sessionCount: number;
  amountPaid: number;
  currency: string;
}): Promise<{ success: boolean }> {
  const dashboardUrl = `${appUrl}/student/dashboard`;

  try {
    const enrollmentHtml = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 28px 24px; color: #1c1917; background-color: #ffffff; border-radius: 16px; border: 1px solid #f0e6d6;">
        <div style="text-align: center; margin-bottom: 20px;">
          <h1 style="color: #3C096C; font-size: 24px; font-weight: 800; margin: 0 0 6px 0;">Gandharva School of Music</h1>
          <p style="color: #FF7803; font-size: 15px; font-weight: 700; margin: 0;">Enrollment Confirmed!</p>
        </div>
        <p style="font-size: 15px; color: #374151;">Dear ${studentName},</p>
        <p style="font-size: 15px; color: #374151;">Thank you for your enrollment in <strong>${courseTitle}</strong> at Gandharva School of Music.</p>
        <div style="background-color: #fdfbf7; border: 1px solid #fed7aa; border-radius: 12px; padding: 16px; margin: 20px 0;">
          <p style="margin: 6px 0; font-size: 14px;"><strong>Course:</strong> ${courseTitle}</p>
          <p style="margin: 6px 0; font-size: 14px;"><strong>Sessions Included:</strong> ${sessionCount}</p>
          <p style="margin: 6px 0; font-size: 14px;"><strong>Amount Paid:</strong> ${(amountPaid / 100).toFixed(2)} ${currency}</p>
        </div>
        <p style="color: #57534e; font-size: 14px; margin: 20px 0; line-height: 1.5;">
          Our academy administration will review your enrollment and assign your dedicated mentor. You can view your progress and schedule your sessions from your dashboard.
        </p>
        <div style="text-align: center; margin: 28px 0;">
          <a href="${dashboardUrl}" style="background-color: #3C096C; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
            Go to Student Dashboard
          </a>
        </div>
      </div>
    `;

    const sent = await sendMail({
      to: studentEmail,
      subject: `Enrollment Confirmed: ${courseTitle}`,
      html: enrollmentHtml,
    });

    if (sent) {
      return { success: true };
    }

    logger.info(
      { studentEmail, courseTitle, sessionCount, amountPaid, currency },
      "✉️ [DEV EMAIL] Course enrollment confirmation email dispatched to student",
    );
    return { success: true };
  } catch (error) {
    logger.error(
      { error, studentEmail, courseTitle },
      "Failed to send course enrollment email via Resend",
    );
    return { success: false };
  }
}

/**
 * Send celebratory certificate email to student when course is completed.
 */
export async function sendCertificateEmail({
  studentEmail,
  studentName,
  courseTitle,
  certificateNumber,
  pdfUrl,
}: {
  studentEmail: string;
  studentName: string;
  courseTitle: string;
  certificateNumber: string;
  pdfUrl: string;
}): Promise<{ success: boolean }> {
  const fullPdfUrl = `${appUrl}${pdfUrl}`;
  const certPageUrl = `${appUrl}/student/dashboard/certificates`;

  try {
    const certHtml = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 28px 24px; color: #1c1917; background-color: #ffffff; border-radius: 16px; border: 1px solid #f0e6d6;">
        <div style="text-align: center; margin-bottom: 20px;">
          <h1 style="color: #3C096C; font-size: 24px; font-weight: 800; margin: 0 0 6px 0;">Gandharva School of Music</h1>
          <p style="color: #FF7803; font-size: 16px; font-weight: 700; margin: 0;">Congratulations, ${studentName}! 🎓</p>
        </div>
        <p style="font-size: 15px; color: #374151;">You have successfully completed all sessions and coursework for <strong>${courseTitle}</strong>.</p>
        <div style="background-color: #fdfbf7; border: 2px solid #FF7803; border-radius: 12px; padding: 20px; margin: 20px 0; text-align: center;">
          <p style="font-size: 13px; color: #57534e; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 8px 0; font-weight: 600;">Official Credential Issued</p>
          <h2 style="color: #3C096C; margin: 0 0 8px 0; font-size: 20px;">${courseTitle}</h2>
          <p style="margin: 4px 0; font-family: monospace; font-size: 13px; color: #12072b;">Credential ID: <strong>${certificateNumber}</strong></p>
        </div>
        <p style="color: #57534e; font-size: 14px; margin: 20px 0; line-height: 1.5;">
          Your certificate is verified and available for download. You may present this credential to music examination boards or add it to your portfolio.
        </p>
        <div style="margin: 28px 0; text-align: center;">
          <a href="${fullPdfUrl}" target="_blank" style="background-color: #FF7803; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block; margin-right: 12px;">
            Download Certificate (PDF)
          </a>
          <a href="${certPageUrl}" style="background-color: #3C096C; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
            View My Certificates
          </a>
        </div>
      </div>
    `;

    const sent = await sendMail({
      to: studentEmail,
      subject: `Congratulations! Your Certificate for ${courseTitle} is Ready 🎓`,
      html: certHtml,
    });

    if (sent) {
      return { success: true };
    }

    logger.info(
      { studentEmail, courseTitle, certificateNumber, fullPdfUrl },
      "✉️ [DEV EMAIL] Certificate issuance email dispatched to student",
    );
    return { success: true };
  } catch (error) {
    logger.error(
      { error, studentEmail, certificateNumber },
      "Failed to send certificate email via Resend",
    );
    return { success: false };
  }
}

/**
 * Send an email notification to all platform administrators when a support ticket is raised.
 */
export async function sendSupportTicketAdminEmail({
  ticketId,
  ticketSubject,
  ticketCategory,
  userName,
  userEmail,
  userRole,
  userCustomId,
  message,
}: {
  ticketId: string;
  ticketSubject: string;
  ticketCategory?: string;
  userName: string;
  userEmail: string;
  userRole: string;
  userCustomId?: string | null;
  message: string;
}): Promise<{ success: boolean }> {
  const ticketUrl = `${appUrl}/admin/support/${ticketId}`;

  try {
    const admins = await db.user.findMany({
      where: { role: Role.ADMIN },
      select: { email: true },
    });

    const adminEmails = admins.map((a) => a.email).filter(Boolean);

    if (adminEmails.length === 0) {
      return { success: true };
    }

    const ticketHtml = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #1c1917; background-color: #ffffff; border: 1px solid #e7e5e4; border-radius: 12px;">
        <div style="border-bottom: 2px solid #3C096C; padding-bottom: 12px; margin-bottom: 20px;">
          <span style="font-size: 11px; text-transform: uppercase; letter-spacing: 1.5px; font-weight: bold; color: #3C096C;">Gandharva Support Desk</span>
          <h1 style="color: #12072B; font-size: 20px; margin: 6px 0 0 0;">New Support Ticket Raised</h1>
        </div>
        
        <div style="background-color: #f8f7fc; border-left: 4px solid #3C096C; border-radius: 6px; padding: 14px 18px; margin-bottom: 20px;">
          <p style="margin: 0 0 6px 0; font-size: 13px; color: #57534e;"><strong>From:</strong> ${userName} (${userEmail})</p>
          <p style="margin: 0 0 6px 0; font-size: 13px; color: #57534e;"><strong>User ID:</strong> <span style="font-family: monospace; font-weight: bold; color: #3C096C;">${userCustomId || "N/A"}</span> &middot; Role: <strong style="text-transform: capitalize;">${userRole.toLowerCase()}</strong></p>
          ${ticketCategory ? `<p style="margin: 0 0 6px 0; font-size: 13px; color: #57534e;"><strong>Category:</strong> ${ticketCategory}</p>` : ""}
          <p style="margin: 0; font-size: 14px; color: #12072B;"><strong>Subject:</strong> ${ticketSubject}</p>
        </div>

        <div style="background-color: #ffffff; border: 1px solid #e7e5e4; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
          <p style="margin: 0 0 8px 0; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; color: #78716c; font-weight: bold;">Ticket Message:</p>
          <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #292524; white-space: pre-wrap;">${message}</p>
        </div>

        <div style="text-align: center; margin: 28px 0 16px 0;">
          <a href="${ticketUrl}" style="background-color: #3C096C; color: #ffffff; padding: 12px 28px; text-decoration: none; border-radius: 10px; font-weight: bold; font-size: 14px; display: inline-block;">
            View &amp; Reply in Admin Desk &rarr;
          </a>
        </div>

        <div style="border-top: 1px solid #f5f5f4; padding-top: 16px; margin-top: 24px; text-align: center; color: #a8a29e; font-size: 11px;">
          Gandharva School of Music Administration &middot; Automated Alert
        </div>
      </div>
    `;

    const sent = await sendMail({
      to: adminEmails,
      subject: `🚨 [Support Ticket #${ticketId.slice(-6)}] ${ticketSubject} — ${userName} (${userCustomId || userRole})`,
      html: ticketHtml,
    });

    if (sent) {
      return { success: true };
    }

    logger.info(
      { adminEmails, ticketId, ticketSubject, userName, ticketUrl },
      "✉️ [DEV EMAIL] Admin Support Ticket notification simulated"
    );
    return { success: true };
  } catch (error) {
    logger.error({ error, ticketId }, "Failed to send support ticket email to admins via Resend");
    return { success: false };
  }
}



