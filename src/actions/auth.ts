"use server";

import { db } from "@/lib/db";
import { revalidatePath, revalidateTag } from "next/cache";
import { hashPassword, verifyPassword } from "@/lib/password";
import { AuthRateLimits } from "@/lib/rate-limit";
import {
  generateTotpSecret,
  buildOtpAuthUrl,
  generateQrCodeDataUrl,
  verifyTotpCode,
  generateBackupCodes,
  formatSecretForDisplay,
} from "@/lib/totp";
import {
  createTwoFactorChallenge,
  verifyTwoFactorChallenge,
} from "@/lib/two-factor-token";
import {
  createEmailVerificationToken,
  consumeEmailVerificationToken,
  createPasswordResetToken,
  validatePasswordResetToken,
  consumePasswordResetToken,
} from "@/lib/tokens";
import { sendVerificationEmail, sendPasswordResetEmail } from "@/lib/email";
import { auth, signIn, signOut } from "@/lib/auth";
import { logger } from "@/lib/logger";
import {
  SignupSchema,
  LoginSchema,
  ForgotPasswordSchema,
  ResetPasswordSchema,
  VerifyEmailSchema,
  ResendVerificationEmailSchema,
  SendOtpSchema,
  OtpLoginSchema,
} from "@/schemas/auth";
import {
  normalizePhoneNumber,
  isValidPhoneNumber,
  createPhoneOtpToken,
  checkPhoneOtp,
  validateAndConsumePhoneOtp,
  getPhoneLookupVariations,
} from "@/lib/phone";

import { isAppError } from "@/lib/errors";
import { AuthError } from "next-auth";
import { createNotification, notifyAdmins } from "@/actions/notifications";
import { NotificationType } from "@prisma/client";
import { generateNextStudentId, generateNextTeacherId } from "@/lib/id-generator";

export type ActionResponse<T = unknown> = {
  success: boolean;
  message?: string;
  error?: string;
  fieldErrors?: Record<string, string[]>;
  data?: T;
  previewUrl?: string;
};

/**
 * Handle user registration with Argon2id password hashing, mandatory phone OTP verification, and email verification.
 */
export async function signupAction(
  prevState: unknown,
  formData: FormData,
): Promise<ActionResponse<{ email: string; role: string; phone: string }>> {
  try {
    const rawData = {
      name: formData.get("name"),
      email: formData.get("email"),
      phone: formData.get("phone"),
      otpCode: formData.get("otpCode"),
      password: formData.get("password"),
      role: formData.get("role"),
      timezone: formData.get("timezone"),
      instruments: formData.get("instruments"),
      experience: formData.get("experience"),
    };

    const parsed = SignupSchema.safeParse(rawData);
    if (!parsed.success) {
      return {
        success: false,
        fieldErrors: parsed.error.flatten().fieldErrors,
      };
    }

    const {
      name,
      email,
      phone: rawPhone,
      otpCode,
      password,
      role,
      timezone,
      instruments,
      experience,
    } = parsed.data;
    const normalizedPhone = normalizePhoneNumber(rawPhone);

    if (!isValidPhoneNumber(normalizedPhone)) {
      return {
        success: false,
        error: "Please enter a valid international mobile number including your country code (e.g. +1 555 123 4567 or +91 98765 43210).",
        fieldErrors: { phone: ["Invalid mobile number format"] },
      };
    }

    // Rate limiting: max 5 signups per hour per IP / email
    AuthRateLimits.checkSignup(email);

    // 1. Check if email already exists
    const existingEmail = await db.user.findUnique({
      where: { email },
    });

    if (existingEmail) {
      return {
        success: false,
        error: "An account with this email address already exists. Please sign in instead.",
        fieldErrors: { email: ["Email already registered"] },
      };
    }

    // 2. Check if phone already exists
    const existingPhone = await db.user.findFirst({
      where: { phone: { in: getPhoneLookupVariations(normalizedPhone) } },
    });

    if (existingPhone) {
      return {
        success: false,
        error: "An account with this mobile number already exists. Please sign in instead.",
        fieldErrors: { phone: ["Mobile number already registered"] },
      };
    }

    // 3. MANDATORY: Cryptographically verify and consume the phone OTP / Firebase token
    const firebaseIdToken = (formData.get("firebaseIdToken") as string) || undefined;
    const otpValidation = await validateAndConsumePhoneOtp(normalizedPhone, otpCode, firebaseIdToken);
    if (!otpValidation.isValid) {
      return {
        success: false,
        error:
          otpValidation.error ||
          "Mobile number verification failed. Please enter the valid 6-digit OTP code sent to your phone.",
        fieldErrors: {
          otpCode: [otpValidation.error || "Invalid or expired OTP"],
        },
      };
    }

    const passwordHash = await hashPassword(password);

    // 4. Create user with verified phone and role profile inside atomic transaction
    const newUser = await db.$transaction(async (tx) => {
      let customId: string | null = null;
      if (role === "STUDENT") {
        customId = await generateNextStudentId(tx);
      } else if (role === "TEACHER") {
        customId = await generateNextTeacherId(tx);
      }

      const user = await tx.user.create({
        data: {
          name,
          email,
          phone: normalizedPhone,
          phoneVerified: new Date(),
          passwordHash,
          role,
          timezone,
          emailVerified: null,
          customId,
        },
      });

      if (role === "TEACHER") {
        let parsedInstruments: string[] = [];
        if (typeof instruments === "string") {
          try {
            const parsed = JSON.parse(instruments);
            if (Array.isArray(parsed)) {
              parsedInstruments = parsed.map(String).map((s) => s.trim()).filter(Boolean);
            } else if (instruments.trim()) {
              parsedInstruments = instruments.split(",").map((s) => s.trim()).filter(Boolean);
            }
          } catch {
            parsedInstruments = instruments.split(",").map((s) => s.trim()).filter(Boolean);
          }
        } else if (Array.isArray(instruments)) {
          parsedInstruments = instruments.map(String).map((s) => s.trim()).filter(Boolean);
        }

        const yearsTeaching = Math.max(0, Math.floor(experience ?? 0));

        await tx.teacherProfile.create({
          data: {
            userId: user.id,
            bio: "",
            instruments: parsedInstruments,
            expertInstruments: parsedInstruments,
            moderateInstruments: [],
            yearsTeaching,
            hourlyRate: 150000, // ₹1,500 default rate (configured in teacher profile / admin)
            payoutPerSession: 50000, // ₹500 default session payout
            currency: "INR",
            languages: ["English"],
            isPublished: false,
            approvalStatus: "PENDING",
          },
        });
      }

      return user;
    });

    // Generate email verification token
    const token = await createEmailVerificationToken(newUser.email);
    const emailRes = await sendVerificationEmail(newUser.email, token);

    logger.info(
      { userId: newUser.id, role: newUser.role, phone: normalizedPhone },
      "User successfully created with verified phone number",
    );

    // Fast-info notifications for admins and user
    try {
      if (newUser.role === "TEACHER") {
        await notifyAdmins({
          type: NotificationType.NEW_TEACHER_SIGNUP,
          title: "New Teacher Registration",
          body: `${newUser.name || "A new faculty member"} registered for teaching. Profile pending review.`,
          link: "/admin/teachers",
        });
        await createNotification({
          userId: newUser.id,
          type: NotificationType.SYSTEM,
          title: "Faculty Application Received",
          body: "Your profile is under review by our academic board. You will receive an instant notification once approved.",
          link: "/teacher/dashboard",
        });
      } else {
        await notifyAdmins({
          type: NotificationType.NEW_STUDENT_SIGNUP,
          title: "New Student Joined",
          body: `${newUser.name || "A new student"} (${newUser.email}) enrolled on Gandharva.`,
          link: "/admin/users",
        });
        await createNotification({
          userId: newUser.id,
          type: NotificationType.SYSTEM,
          title: "Welcome to Gandharva School of Music!",
          body: "Explore our accredited masterclasses and book your free 1:1 live trial session today.",
          link: "/book-trial",
        });
      }
    } catch {
      // Non-blocking notification emission
    }

    // Invalidate admin and student caches immediately so the new user appears instantly
    try {
      revalidatePath("/admin/students");
      revalidatePath("/admin/users");
      revalidatePath("/admin/teachers");
      revalidatePath("/admin");
      revalidateTag("admin-students", "max");
      revalidateTag("students", "max");
    } catch {
      // Non-blocking cache revalidation
    }

    const message =
      newUser.role === "TEACHER"
        ? "Faculty account registered! Your profile is pending administrative review. Please verify your email; our academic board will review and activate your teaching privileges."
        : "Your account has been created! Please verify your email to unlock all features.";

    return {
      success: true,
      message,
      previewUrl: emailRes.previewUrl,
      data: {
        email: newUser.email,
        phone: newUser.phone || normalizedPhone,
        role: newUser.role,
      },
    };
  } catch (error) {
    logger.error({ error }, "Error in signupAction");
    if (isAppError(error)) {
      return { success: false, error: error.message };
    }
    return {
      success: false,
      error: "Something went wrong while creating your account. Please try again.",
    };
  }
}

/**
 * Server action to request a 6-digit SMS OTP for Login or Signup.
 * Rate-limited and validates existence/non-existence based on purpose.
 */
export async function sendPhoneOtpAction(
  rawPhone: string,
  purpose: "LOGIN" | "SIGNUP",
): Promise<ActionResponse<{ phone: string }>> {
  try {
    const parsed = SendOtpSchema.safeParse({ phone: rawPhone, purpose });
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message || "Invalid mobile number.",
      };
    }

    const phone = normalizePhoneNumber(parsed.data.phone);
    if (!isValidPhoneNumber(phone)) {
      return {
        success: false,
        error: "Please enter a valid international mobile number including your country code (e.g. +1 555 123 4567 or +91 98765 43210).",
      };
    }

    // Rate limit check per phone number
    AuthRateLimits.checkSendOtp(phone);

    const existingUser = await db.user.findFirst({
      where: { phone: { in: getPhoneLookupVariations(phone) } },
      select: {
        role: true,
        isActive: true,
        teacherProfile: {
          select: { approvalStatus: true },
        },
      },
    });

    if (purpose === "LOGIN" && !existingUser) {
      return {
        success: false,
        error: "No account found with this mobile number. Please create an account first.",
      };
    }

    if (purpose === "LOGIN" && existingUser) {
      if (
        (existingUser.role === "TEACHER" || existingUser.teacherProfile) &&
        existingUser.teacherProfile?.approvalStatus === "REJECTED"
      ) {
        return {
          success: false,
          error: "your application is rejected please contact administration",
        };
      }

      if (!existingUser.isActive) {
        return {
          success: false,
          error: "contact adminstrastation",
        };
      }
    }

    if (purpose === "SIGNUP" && existingUser) {
      return {
        success: false,
        error: "An account with this mobile number already exists. Please sign in instead.",
      };
    }

    const token = await createPhoneOtpToken(phone, purpose);

    return {
      success: true,
      message: `A 6-digit verification code has been dispatched to ${phone}.`,
      data: {
        phone: token.phone,
      },
    };
  } catch (error) {
    logger.error({ error, rawPhone, purpose }, "Error in sendPhoneOtpAction");
    if (isAppError(error)) {
      return { success: false, error: error.message };
    }
    return {
      success: false,
      error: "Failed to send verification code. Please wait a moment and try again.",
    };
  }
}

/**
 * Server action for live frontend validation of a signup phone OTP before form submission.
 */
export async function verifyPhoneOtpForSignupAction(
  rawPhone: string,
  code: string,
  idToken?: string,
): Promise<ActionResponse<{ phone: string; isVerified: boolean }>> {
  try {
    const phone = normalizePhoneNumber(rawPhone);
    if (!phone || (!code && !idToken)) {
      return {
        success: false,
        error: "Please enter the complete 6-digit verification code.",
      };
    }

    AuthRateLimits.checkVerifyOtp(phone);

    // Check token validity via Firebase or database
    const result = await checkPhoneOtp(phone, code, idToken);
    if (!result.isValid) {
      return {
        success: false,
        error: result.error || "Invalid or expired OTP code.",
      };
    }

    return {
      success: true,
      message: "Mobile number successfully verified!",
      data: {
        phone,
        isVerified: true,
      },
    };
  } catch (error) {
    logger.error({ error, rawPhone }, "Error in verifyPhoneOtpForSignupAction");
    if (isAppError(error)) {
      return { success: false, error: error.message };
    }
    return {
      success: false,
      error: "Failed to verify code. Please try again.",
    };
  }
}

/**
 * Handle password-based login using either email address OR mobile phone number.
 */
export type LoginActionData = {
  requires2FA?: boolean;
  requires2FASetup?: boolean;
  twoFactorToken?: string;
  email?: string;
  qrCodeDataUrl?: string;
  formattedSecret?: string;
  tempSecret?: string;
  backupCodes?: string[];
  redirectTo?: string;
};

export async function loginAction(
  prevState: unknown,
  formData: FormData,
): Promise<ActionResponse<LoginActionData>> {
  const rawIdentifier = (formData.get("identifier") || formData.get("email") || "") as string;
  const password = (formData.get("password") || "") as string;

  const parsed = LoginSchema.safeParse({ identifier: rawIdentifier, password });
  if (!parsed.success) {
    return {
      success: false,
      fieldErrors: parsed.error.flatten().fieldErrors,
      error: parsed.error.issues[0]?.message || "Please enter your credentials.",
    };
  }

  const { identifier } = parsed.data;

  try {
    AuthRateLimits.checkLogin(identifier);

    let user = null;
    if (identifier.includes("@")) {
      user = await db.user.findUnique({
        where: { email: identifier.toLowerCase() },
        select: {
          id: true,
          email: true,
          role: true,
          isActive: true,
          passwordHash: true,
          twoFactorEnabled: true,
          teacherProfile: {
            select: { approvalStatus: true },
          },
        },
      });
    } else {
      const phone = normalizePhoneNumber(identifier);
      user = await db.user.findFirst({
        where: { phone: { in: getPhoneLookupVariations(phone) } },
        select: {
          id: true,
          email: true,
          role: true,
          isActive: true,
          passwordHash: true,
          twoFactorEnabled: true,
          teacherProfile: {
            select: { approvalStatus: true },
          },
        },
      });
    }

    if (user) {
      if (
        (user.role === "TEACHER" || user.teacherProfile) &&
        user.teacherProfile?.approvalStatus === "REJECTED"
      ) {
        return {
          success: false,
          error: "your application is rejected please contact administration",
        };
      }

      if (!user.isActive) {
        return {
          success: false,
          error: "contact adminstrastation",
        };
      }

      // ─── ADMIN 2-STEP VERIFICATION (Google Authenticator TOTP) ───────
      if (user.role === "ADMIN") {
        if (!user.passwordHash) {
          return {
            success: false,
            error: "Invalid email/phone or password. Please double-check your credentials.",
          };
        }

        const isPwdValid = await verifyPassword(user.passwordHash, password);
        if (!isPwdValid) {
          return {
            success: false,
            error: "Invalid email/phone or password. Please double-check your credentials.",
          };
        }

        if (user.twoFactorEnabled) {
          const twoFactorToken = createTwoFactorChallenge({
            userId: user.id,
            email: user.email,
            isSetup: false,
          });

          return {
            success: true,
            data: {
              requires2FA: true,
              twoFactorToken,
              email: user.email,
            },
            message: "Please enter the 6-digit code from Google Authenticator.",
          };
        } else {
          // First-time mandatory setup for Admin
          const tempSecret = generateTotpSecret();
          const otpAuthUrl = buildOtpAuthUrl({
            accountName: user.email,
            secret: tempSecret,
          });
          const qrCodeDataUrl = await generateQrCodeDataUrl(otpAuthUrl);
          const twoFactorToken = createTwoFactorChallenge({
            userId: user.id,
            email: user.email,
            isSetup: true,
            tempSecret,
          });

          return {
            success: true,
            data: {
              requires2FASetup: true,
              twoFactorToken,
              email: user.email,
              qrCodeDataUrl,
              formattedSecret: formatSecretForDisplay(tempSecret),
            },
            message: "Configure Google Authenticator to activate 2-step verification.",
          };
        }
      }
    }

    const target =
      user?.role === "TEACHER"
        ? "/teacher/dashboard"
        : "/student/dashboard";

    await signIn("credentials", {
      identifier: user?.email || identifier,
      password,
      redirect: false,
      redirectTo: target,
    });

    return {
      success: true,
      data: { redirectTo: target },
      message: "Logged in successfully!",
    };
  } catch (error) {
    if (error instanceof AuthError) {
      switch (error.type) {
        case "CredentialsSignin":
          return {
            success: false,
            error: "Invalid email/phone or password. Please double-check your credentials.",
          };
        default:
          return {
            success: false,
            error: "Authentication failed. Please try again.",
          };
      }
    }

    if (isAppError(error)) {
      return { success: false, error: error.message };
    }

    // Check Next.js redirect thrown error
    if (typeof error === "object" && error !== null && "digest" in error) {
      const digest = String((error as { digest: string }).digest);
      if (digest.startsWith("NEXT_REDIRECT")) {
        throw error;
      }
    }

    const errText = error instanceof Error ? error.message : String(error);
    logger.error({ error, errText }, "Unexpected error in loginAction");

    if (
      errText.includes("database") ||
      errText.includes("Can't reach database") ||
      errText.includes("ECONNREFUSED") ||
      errText.includes("TLS connection") ||
      errText.includes("P1011")
    ) {
      return {
        success: false,
        error: "Unable to connect to the database. Please verify your DATABASE_URL network connection.",
      };
    }

    return {
      success: false,
      error: "An unexpected error occurred during login. Please try again.",
    };
  }
}

/**
 * Verify 6-digit TOTP code (or 8-character backup recovery code) for Admin 2FA login.
 */
export async function verifyAdminTwoFactorAction(
  prevState: unknown,
  formData: FormData
): Promise<ActionResponse<{ redirectTo?: string }>> {
  try {
    const twoFactorToken = ((formData.get("twoFactorToken") as string) || "").trim();
    const rawCode = ((formData.get("code") as string) || "").trim();
    // Normalize code by removing spaces and dashes (e.g. "123 456" -> "123456", "XXXX-XXXX" -> "XXXXXXXX")
    const code = rawCode.replace(/[\s-]/g, "");

    if (!twoFactorToken || !code) {
      return {
        success: false,
        error: "Please enter your 6-digit verification code.",
      };
    }

    const payload = verifyTwoFactorChallenge(twoFactorToken);
    if (!payload || !payload.userId) {
      return {
        success: false,
        error: "Verification session expired. Please sign in with your password again.",
      };
    }

    const user = await db.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        email: true,
        role: true,
        isActive: true,
        twoFactorEnabled: true,
        twoFactorSecret: true,
        twoFactorBackupCodes: true,
      },
    });

    if (!user || user.role !== "ADMIN" || !user.isActive) {
      return {
        success: false,
        error: "Unauthorized access.",
      };
    }

    let isVerified = false;

    // 1. Check TOTP 6-digit code
    if (/^\d{6}$/.test(code) && user.twoFactorSecret) {
      isVerified = verifyTotpCode(user.twoFactorSecret, code);
    }

    // 2. Fallback to single-use Backup Recovery Code
    if (!isVerified && user.twoFactorBackupCodes) {
      try {
        const backupList: string[] = JSON.parse(user.twoFactorBackupCodes);
        const normalizedInput = code.toUpperCase();
        const index = backupList.findIndex(
          (b) => b.toUpperCase().replace(/[\s-]/g, "") === normalizedInput
        );
        if (index !== -1) {
          isVerified = true;
          // Consume this single-use backup code
          backupList.splice(index, 1);
          await db.user.update({
            where: { id: user.id },
            data: {
              twoFactorBackupCodes: JSON.stringify(backupList),
              twoFactorVerifiedAt: new Date(),
            },
          });
        }
      } catch (backupErr) {
        logger.warn({ backupErr }, "Failed processing backup code in verifyAdminTwoFactorAction");
      }
    }

    if (!isVerified) {
      return {
        success: false,
        error: "Invalid verification code. Please check Google Authenticator or your backup recovery code.",
      };
    }

    // Generate verified token for NextAuth authorization
    const verifiedToken = createTwoFactorChallenge({
      userId: user.id,
      email: user.email,
    });

    try {
      await db.user.update({
        where: { id: user.id },
        data: { twoFactorVerifiedAt: new Date() },
      });
    } catch (dbErr) {
      logger.warn({ dbErr }, "Could not record twoFactorVerifiedAt timestamp");
    }

    // Authenticate session without throwing NEXT_REDIRECT in useActionState transition
    const signInResult = await signIn("credentials", {
      authType: "2fa_verified",
      twoFactorToken: verifiedToken,
      redirect: false,
      redirectTo: "/admin",
    });

    if (typeof signInResult === "string" && signInResult.includes("error=")) {
      return {
        success: false,
        error: "Session authorization failed. Please try signing in again.",
      };
    }

    return {
      success: true,
      data: { redirectTo: "/admin" },
      message: "Two-step verification successful! Entering Admin Portal...",
    };
  } catch (error) {
    if (typeof error === "object" && error !== null && "digest" in error) {
      const digest = String((error as { digest: string }).digest);
      if (digest.startsWith("NEXT_REDIRECT")) {
        throw error;
      }
    }
    logger.error({ error }, "Unexpected error in verifyAdminTwoFactorAction");
    return {
      success: false,
      error: "An unexpected error occurred during verification. Please try again.",
    };
  }
}

/**
 * Confirm initial Google Authenticator setup by verifying the first 6-digit code.
 * Activates 2FA and generates 8 emergency recovery backup codes.
 */
export async function confirmAdminTwoFactorSetupAction(
  prevState: unknown,
  formData: FormData
): Promise<ActionResponse<{ backupCodes: string[]; redirectTo?: string }>> {
  try {
    const twoFactorToken = ((formData.get("twoFactorToken") as string) || "").trim();
    const rawCode = ((formData.get("code") as string) || "").trim();
    const code = rawCode.replace(/[\s-]/g, "");

    if (!twoFactorToken || !code) {
      return {
        success: false,
        error: "Please enter the 6-digit code shown in Google Authenticator.",
      };
    }

    const payload = verifyTwoFactorChallenge(twoFactorToken);
    if (!payload || !payload.userId || !payload.tempSecret || !payload.isSetup) {
      return {
        success: false,
        error: "Setup session expired. Please sign in with your password again to configure.",
      };
    }

    const isValid = verifyTotpCode(payload.tempSecret, code);
    if (!isValid) {
      return {
        success: false,
        error: "Invalid code. Please ensure the time on your phone is accurate and try again.",
      };
    }

    const backupCodes = generateBackupCodes(8);

    await db.user.update({
      where: { id: payload.userId },
      data: {
        twoFactorEnabled: true,
        twoFactorSecret: payload.tempSecret,
        twoFactorBackupCodes: JSON.stringify(backupCodes),
        twoFactorVerifiedAt: new Date(),
      },
    });

    const verifiedToken = createTwoFactorChallenge({
      userId: payload.userId,
      email: payload.email,
    });

    const signInResult = await signIn("credentials", {
      authType: "2fa_verified",
      twoFactorToken: verifiedToken,
      redirect: false,
      redirectTo: "/admin",
    });

    if (typeof signInResult === "string" && signInResult.includes("error=")) {
      return {
        success: false,
        error: "Setup completed but session initialization failed. Please log in.",
      };
    }

    return {
      success: true,
      data: { backupCodes, redirectTo: "/admin" },
      message: "Google Authenticator successfully configured! Entering Admin Portal...",
    };
  } catch (error) {
    if (typeof error === "object" && error !== null && "digest" in error) {
      const digest = String((error as { digest: string }).digest);
      if (digest.startsWith("NEXT_REDIRECT")) {
        throw error;
      }
    }
    logger.error({ error }, "Unexpected error in confirmAdminTwoFactorSetupAction");
    return {
      success: false,
      error: "Setup failed due to an unexpected error. Please try again.",
    };
  }
}

/**
 * Handle mobile phone OTP login.
 */
export async function verifyOtpAndLoginAction(
  prevState: unknown,
  formData: FormData,
): Promise<ActionResponse<{ redirectTo?: string }>> {
  const rawPhone = (formData.get("phone") as string) || "";
  const code = (formData.get("code") as string) || "";
  const idToken = (formData.get("idToken") as string) || undefined;

  const parsed = OtpLoginSchema.safeParse({ phone: rawPhone, code });
  if (!parsed.success) {
    return {
      success: false,
      fieldErrors: parsed.error.flatten().fieldErrors,
      error: parsed.error.issues[0]?.message || "Please enter the 6-digit verification code.",
    };
  }

  const phone = normalizePhoneNumber(parsed.data.phone);

  try {
    AuthRateLimits.checkVerifyOtp(phone);

    const user = await db.user.findFirst({
      where: { phone: { in: getPhoneLookupVariations(phone) } },
      select: {
        role: true,
        isActive: true,
        teacherProfile: {
          select: { approvalStatus: true },
        },
      },
    });

    if (!user) {
      return {
        success: false,
        error: "No account found with this mobile number. Please create an account first.",
      };
    }

    if (
      (user.role === "TEACHER" || user.teacherProfile) &&
      user.teacherProfile?.approvalStatus === "REJECTED"
    ) {
      return {
        success: false,
        error: "your application is rejected please contact administration",
      };
    }

    if (!user.isActive) {
      return {
        success: false,
        error: "contact adminstrastation",
      };
    }

    const target =
      user.role === "ADMIN"
        ? "/admin"
        : user.role === "TEACHER"
        ? "/teacher/dashboard"
        : "/student/dashboard";

    await signIn("credentials", {
      phone,
      code: parsed.data.code,
      idToken,
      authType: "otp",
      redirect: false,
      redirectTo: target,
    });

    return {
      success: true,
      data: { redirectTo: target },
      message: "Logged in successfully!",
    };
  } catch (error) {
    if (error instanceof AuthError) {
      return {
        success: false,
        error: "Invalid or expired OTP code. Please request a new verification code.",
      };
    }

    if (isAppError(error)) {
      return { success: false, error: error.message };
    }

    if (typeof error === "object" && error !== null && "digest" in error) {
      const digest = String((error as { digest: string }).digest);
      if (digest.startsWith("NEXT_REDIRECT")) {
        throw error;
      }
    }

    logger.error({ error, phone }, "Unexpected error in verifyOtpAndLoginAction");
    return {
      success: false,
      error: "An unexpected error occurred during OTP sign in. Please try again.",
    };
  }
}

/**
 * Handle user signout.
 */
export async function logoutAction(): Promise<void> {
  await signOut({ redirectTo: "/login" });
}

export const signOutAction = logoutAction;

/**
 * Handle request for password reset email.
 */
export async function forgotPasswordAction(
  prevState: unknown,
  formData: FormData,
): Promise<ActionResponse> {
  try {
    const rawData = { email: formData.get("email") };
    const parsed = ForgotPasswordSchema.safeParse(rawData);
    if (!parsed.success) {
      return {
        success: false,
        fieldErrors: parsed.error.flatten().fieldErrors,
      };
    }

    const { email } = parsed.data;
    AuthRateLimits.checkForgotPassword(email);

    const user = await db.user.findUnique({
      where: { email },
    });

    let previewUrl: string | undefined;
    if (user) {
      const token = await createPasswordResetToken(user.email);
      const emailRes = await sendPasswordResetEmail(user.email, token);
      previewUrl = emailRes.previewUrl;
    }

    // Always return success to prevent email enumeration
    return {
      success: true,
      message:
        "If an account with that email address exists, a password reset link has been sent.",
      previewUrl,
    };
  } catch (error) {
    logger.error({ error }, "Error in forgotPasswordAction");
    if (isAppError(error)) {
      return { success: false, error: error.message };
    }
    return {
      success: false,
      error: "Unable to process password reset request. Please try again.",
    };
  }
}

/**
 * Handle password reset using token and new password.
 */
export async function resetPasswordAction(
  prevState: unknown,
  formData: FormData,
): Promise<ActionResponse> {
  try {
    const rawData = {
      token: formData.get("token"),
      password: formData.get("password"),
      confirmPassword: formData.get("confirmPassword"),
    };

    const parsed = ResetPasswordSchema.safeParse(rawData);
    if (!parsed.success) {
      return {
        success: false,
        fieldErrors: parsed.error.flatten().fieldErrors,
      };
    }

    const { token, password } = parsed.data;

    const tokenRecord = await validatePasswordResetToken(token);
    if (!tokenRecord) {
      return {
        success: false,
        error:
          "This password reset link is invalid or has expired (links expire after 30 minutes). Please request a new one.",
      };
    }

    const passwordHash = await hashPassword(password);

    // Atomically consume token and update user password in transaction
    const updateSuccess = await db.$transaction(async (tx) => {
      const tokenConsumed = await tx.passwordResetToken.updateMany({
        where: {
          id: tokenRecord.id,
          used: false,
          expires: { gt: new Date() },
        },
        data: { used: true },
      });

      if (tokenConsumed.count === 0) {
        return false;
      }

      await tx.user.update({
        where: { email: tokenRecord.email },
        data: { passwordHash },
      });

      return true;
    });

    if (!updateSuccess) {
      return {
        success: false,
        error:
          "This password reset link has already been used or expired. Please request a new one.",
      };
    }

    logger.info({ email: tokenRecord.email }, "Password successfully reset");

    return {
      success: true,
      message: "Your password has been reset successfully! You can now log in.",
    };
  } catch (error) {
    logger.error({ error }, "Error in resetPasswordAction");
    if (isAppError(error)) {
      return { success: false, error: error.message };
    }
    return {
      success: false,
      error: "Failed to reset password. Please try again.",
    };
  }
}

/**
 * Verify user email via token.
 * Idempotent: Can be called multiple times without flipping into an invalid/expired failure state.
 */
export async function verifyEmailAction(
  token: string,
): Promise<ActionResponse<{ emailVerified: boolean; role?: string }>> {
  try {
    const parsed = VerifyEmailSchema.safeParse({ token });
    if (!parsed.success) {
      return {
        success: false,
        error: "Invalid token provided.",
      };
    }

    let email = await consumeEmailVerificationToken(token);
    if (!email) {
      // Check if token is a Firebase oobCode
      const firebaseApiKey =
        process.env.FIREBASE_API_KEY || process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
      if (firebaseApiKey) {
        try {
          const fbRes = await fetch(
            `https://identitytoolkit.googleapis.com/v1/accounts:update?key=${firebaseApiKey}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ oobCode: token }),
            }
          );
          if (fbRes.ok) {
            const fbData = (await fbRes.json()) as { email?: string };
            if (fbData.email) {
              email = fbData.email;
            }
          }
        } catch (fbErr) {
          logger.warn({ fbErr, token }, "Failed to verify token with Firebase");
        }
      }
    }

    if (!email) {
      // If token not found, check if the current active session user is already verified
      try {
        const session = await auth();
        if (session?.user?.id) {
          const currentUser = await db.user.findUnique({
            where: { id: session.user.id },
            select: { emailVerified: true, role: true },
          });
          if (currentUser?.emailVerified) {
            return {
              success: true,
              message:
                "Your email address has already been verified! You are ready to book and teach.",
              data: { emailVerified: true, role: currentUser.role },
            };
          }
        }
      } catch {
        // Silently proceed to failure message if session lookup fails
      }

      return {
        success: false,
        error:
          "This verification link is invalid or has already expired. Please request a new one.",
      };
    }

    const normalizedEmail = email.trim().toLowerCase();
    const user = await db.user.findFirst({
      where: { email: { equals: normalizedEmail, mode: "insensitive" } },
      select: { id: true, email: true, emailVerified: true, role: true },
    });

    if (!user) {
      return {
        success: false,
        error: "No account found matching this verification token.",
      };
    }

    if (!user.emailVerified) {
      await db.user.update({
        where: { id: user.id },
        data: { emailVerified: new Date() },
      });
      logger.info({ email: user.email }, "Email address verified successfully");
    } else {
      logger.info({ email: user.email }, "Email address was already verified");
    }

    // Invalidate caches so Navbar and dashboards immediately see verified email status
    try {
      revalidateTag("user-session", "max");
      revalidateTag("student-profile", "max");
      revalidatePath("/", "layout");
      revalidatePath("/verify-email");
      revalidatePath("/dashboard");
      revalidatePath("/student/dashboard");
      revalidatePath("/teacher/dashboard");
    } catch (revErr) {
      logger.warn({ revErr }, "Cache revalidation note during email verification");
    }

    const roleMessage =
      user.role === "TEACHER"
        ? "Your email address has been verified successfully! You can now manage your studio and schedule lessons."
        : user.role === "STUDENT"
        ? "Your email address has been verified successfully! You are ready to book lessons and attend classes."
        : "Your email address has been verified successfully!";

    return {
      success: true,
      message: roleMessage,
      data: { emailVerified: true, role: user.role },
    };
  } catch (error) {
    logger.error({ error }, "Error in verifyEmailAction");
    return {
      success: false,
      error: "Unable to verify email. Please try again.",
    };
  }
}

/**
 * Resend email verification link to a user.
 */
export async function resendVerificationEmailAction(
  emailInput?: string,
): Promise<ActionResponse<{ email?: string; alreadyVerified?: boolean }>> {
  try {
    let email = emailInput?.trim().toLowerCase();

    // If email is not explicitly provided, attempt to derive it from the current session
    if (!email) {
      try {
        const session = await auth();
        if (session?.user?.email) {
          email = session.user.email.toLowerCase();
        }
      } catch {
        // Silently proceed if session lookup is unavailable
      }
    }

    if (!email) {
      return {
        success: false,
        error: "Please enter your email address to receive a verification link.",
      };
    }

    const parsed = ResendVerificationEmailSchema.safeParse({ email });
    if (!parsed.success) {
      return {
        success: false,
        error: "Please enter a valid email address.",
      };
    }

    const user = await db.user.findUnique({
      where: { email: parsed.data.email },
      select: { id: true, email: true, emailVerified: true, role: true },
    });

    // If user does not exist, return generic success to prevent email enumeration
    if (!user) {
      return {
        success: true,
        message:
          "If an account is associated with this email, a fresh verification link has been sent.",
      };
    }

    // If user is already verified, provide clear immediate confirmation
    if (user.emailVerified) {
      return {
        success: true,
        message:
          "Your email address is already verified! You are ready to sign in and use your account.",
        data: { email: user.email, alreadyVerified: true },
      };
    }

    // Generate fresh verification token (deletes previous tokens for this email)
    const token = await createEmailVerificationToken(user.email);
    const emailRes = await sendVerificationEmail(user.email, token);

    logger.info({ email: user.email }, "Verification link resent successfully");

    return {
      success: true,
      message:
        "A fresh verification link has been sent to your email address. Please check your inbox and spam folder.",
      previewUrl: emailRes.previewUrl,
      data: { email: user.email, alreadyVerified: false },
    };
  } catch (error) {
    logger.error({ error }, "Error in resendVerificationEmailAction");
    return {
      success: false,
      error: "Unable to send verification link. Please try again.",
    };
  }
}

