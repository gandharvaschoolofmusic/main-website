"use server";

import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth-helpers";
import { hashPassword, verifyPassword } from "@/lib/password";
import { revalidatePath } from "next/cache";
import { logger } from "@/lib/logger";
import crypto from "crypto";
import { sendEmailUpdateVerificationEmail } from "@/lib/email";

import fs from "fs";
import path from "path";

export type UpdateProfileInput = {
  name: string;
  timezone: string;
  country?: string | null;
  age?: number | null;
  gender?: string | null;
  guardianName?: string | null;
  guardianPhone?: string | null;
  address?: string | null;
};

export async function updateProfileAction(input: UpdateProfileInput) {
  try {
    const user = await requireUser();

    if (!input.name?.trim()) {
      return { success: false, error: "Name is required." };
    }

    await db.user.update({
      where: { id: user.id },
      data: {
        name: input.name.trim(),
        timezone: input.timezone || user.timezone || "UTC",
        country: input.country !== undefined ? (input.country?.trim() || null) : undefined,
        age:
          input.age !== undefined
            ? input.age !== null && !isNaN(Number(input.age))
              ? Number(input.age)
              : null
            : undefined,
        gender: input.gender !== undefined ? (input.gender?.trim() || null) : undefined,
        guardianName: input.guardianName !== undefined ? (input.guardianName?.trim() || null) : undefined,
        guardianPhone: input.guardianPhone !== undefined ? (input.guardianPhone?.trim() || null) : undefined,
        address: input.address !== undefined ? (input.address?.trim() || null) : undefined,
      },
    });

    if (user.role === "TEACHER") {
      revalidatePath("/teacher/dashboard/profile");
      revalidatePath("/teacher/dashboard");
    } else {
      revalidatePath("/student/dashboard/profile");
      revalidatePath("/student/dashboard");
    }

    return { success: true };
  } catch (error) {
    logger.error({ error }, "Failed to update profile");
    return { success: false, error: "Failed to update profile." };
  }
}

export async function uploadAvatarAction(formData: FormData): Promise<{
  success: boolean;
  error?: string;
  image?: string;
}> {
  try {
    const user = await requireUser();
    const file = formData.get("file") as File | null;

    if (!file) {
      return { success: false, error: "No image file provided." };
    }

    const allowedMimeTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/gif",
    ];

    if (!allowedMimeTypes.includes(file.type.toLowerCase())) {
      return {
        success: false,
        error: "Invalid file type. Only JPEG, PNG, WEBP, and GIF images are allowed.",
      };
    }

    // 5MB limit
    if (file.size > 5 * 1024 * 1024) {
      return {
        success: false,
        error: "File size exceeds 5MB limit. Please upload a smaller image.",
      };
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const safeExt = ["jpeg", "jpg", "png", "webp", "gif"].includes(ext) ? ext : "jpg";
    const fileName = `avatar-${user.id}-${Date.now()}.${safeExt}`;

    const avatarsDir = path.join(process.cwd(), "public", "uploads", "avatars");
    if (!fs.existsSync(avatarsDir)) {
      fs.mkdirSync(avatarsDir, { recursive: true });
    }

    // Remove old avatar file if stored locally
    const dbUser = await db.user.findUnique({
      where: { id: user.id },
      select: { image: true },
    });

    if (dbUser?.image && dbUser.image.startsWith("/uploads/avatars/")) {
      const oldPath = path.join(process.cwd(), "public", dbUser.image);
      if (fs.existsSync(oldPath)) {
        try {
          fs.unlinkSync(oldPath);
        } catch {
          // Ignore removal error
        }
      }
    }

    const targetPath = path.join(avatarsDir, fileName);
    fs.writeFileSync(targetPath, buffer);

    const publicUrl = `/uploads/avatars/${fileName}`;

    await db.user.update({
      where: { id: user.id },
      data: { image: publicUrl },
    });

    logger.info({ userId: user.id, image: publicUrl }, "User avatar updated");

    revalidatePath("/student/dashboard/profile");
    revalidatePath("/student/dashboard");
    revalidatePath("/teacher/dashboard/profile");
    revalidatePath("/teacher/dashboard");
    revalidatePath("/teachers");
    revalidatePath("/");

    return { success: true, image: publicUrl };
  } catch (error) {
    logger.error({ error }, "Failed to upload avatar");
    return { success: false, error: "Failed to upload profile picture." };
  }
}

export async function removeAvatarAction(): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const user = await requireUser();

    const dbUser = await db.user.findUnique({
      where: { id: user.id },
      select: { image: true },
    });

    if (dbUser?.image && dbUser.image.startsWith("/uploads/avatars/")) {
      const oldPath = path.join(process.cwd(), "public", dbUser.image);
      if (fs.existsSync(oldPath)) {
        try {
          fs.unlinkSync(oldPath);
        } catch {
          // Ignore removal error
        }
      }
    }

    await db.user.update({
      where: { id: user.id },
      data: { image: null },
    });

    logger.info({ userId: user.id }, "User avatar removed");

    revalidatePath("/student/dashboard/profile");
    revalidatePath("/student/dashboard");
    revalidatePath("/teacher/dashboard/profile");
    revalidatePath("/teacher/dashboard");
    revalidatePath("/teachers");
    revalidatePath("/");

    return { success: true };
  } catch (error) {
    logger.error({ error }, "Failed to remove avatar");
    return { success: false, error: "Failed to remove profile picture." };
  }
}

export type ChangePasswordInput = {
  currentPassword: string;
  newPassword: string;
};

export async function changePasswordAction(input: ChangePasswordInput) {
  try {
    const user = await requireUser();

    if (!input.currentPassword || !input.newPassword) {
      return { success: false, error: "All password fields are required." };
    }

    if (input.newPassword.length < 8) {
      return { success: false, error: "New password must be at least 8 characters long." };
    }

    const dbUser = await db.user.findUnique({
      where: { id: user.id },
      select: { passwordHash: true },
    });

    if (!dbUser || !dbUser.passwordHash) {
      return { success: false, error: "Cannot change password for social login accounts." };
    }

    const isValid = await verifyPassword(dbUser.passwordHash, input.currentPassword);
    if (!isValid) {
      return { success: false, error: "Incorrect current password." };
    }

    const newHash = await hashPassword(input.newPassword);
    await db.user.update({
      where: { id: user.id },
      data: { passwordHash: newHash },
    });

    return { success: true };
  } catch (error) {
    logger.error({ error }, "Failed to change password");
    return { success: false, error: "Failed to change password." };
  }
}

export async function requestEmailUpdateAction({
  newEmail,
}: {
  newEmail: string;
}): Promise<{
  success: boolean;
  message?: string;
  error?: string;
  devCode?: string;
}> {
  try {
    const user = await requireUser();

    const normalizedEmail = (newEmail || "").trim().toLowerCase();

    // Basic format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!normalizedEmail || !emailRegex.test(normalizedEmail)) {
      return { success: false, error: "Please enter a valid email address." };
    }

    if (user.email && normalizedEmail === user.email.toLowerCase()) {
      return {
        success: false,
        error: "The new email address must be different from your current email.",
      };
    }

    // Check if new email is already used by another account
    const existing = await db.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true },
    });

    if (existing && existing.id !== user.id) {
      return {
        success: false,
        error: "This email address is already in use by another account.",
      };
    }

    // Generate 6-digit numeric OTP code
    const otpCode = crypto.randomInt(100000, 999999).toString();
    const tokenSecret = crypto.randomBytes(16).toString("hex");
    const tokenPayload = `${normalizedEmail}:::${otpCode}:::${tokenSecret}`;
    const expires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes TTL
    const identifier = `email-update:${user.id}`;

    // Clean up any existing tokens for this user
    await db.verificationToken.deleteMany({
      where: { identifier },
    });

    // Create token
    await db.verificationToken.create({
      data: {
        identifier,
        token: tokenPayload,
        expires,
      },
    });

    // Send verification email
    await sendEmailUpdateVerificationEmail({
      email: normalizedEmail,
      otpCode,
      userName: user.name || "Instructor",
    });

    logger.info(
      { userId: user.id, newEmail: normalizedEmail },
      "Email update OTP dispatched",
    );

    return {
      success: true,
      message: `A 6-digit verification code has been dispatched to ${normalizedEmail}.`,
      devCode: process.env.NODE_ENV === "development" ? otpCode : undefined,
    };
  } catch (error) {
    logger.error({ error }, "Failed to request email update");
    return {
      success: false,
      error: "Unable to process email update request. Please try again.",
    };
  }
}

export async function verifyEmailUpdateAction({
  newEmail,
  otpCode,
}: {
  newEmail: string;
  otpCode: string;
}): Promise<{
  success: boolean;
  email?: string;
  message?: string;
  error?: string;
}> {
  try {
    const user = await requireUser();

    const normalizedEmail = (newEmail || "").trim().toLowerCase();
    const cleanedCode = (otpCode || "").trim().replace(/\D/g, "");

    if (!cleanedCode || cleanedCode.length !== 6) {
      return {
        success: false,
        error: "Please enter a valid 6-digit verification code.",
      };
    }

    const identifier = `email-update:${user.id}`;
    const record = await db.verificationToken.findFirst({
      where: { identifier },
    });

    if (!record) {
      return {
        success: false,
        error: "No active verification request found. Please request a new code.",
      };
    }

    if (record.expires < new Date()) {
      await db.verificationToken.deleteMany({ where: { identifier } });
      return {
        success: false,
        error: "The verification code has expired. Please request a new code.",
      };
    }

    const [pendingEmail, storedOtp] = record.token.split(":::");

    if (pendingEmail !== normalizedEmail) {
      return {
        success: false,
        error: "Email address does not match the verification request.",
      };
    }

    if (storedOtp !== cleanedCode) {
      return {
        success: false,
        error: "Invalid verification code. Please check your email and try again.",
      };
    }

    // Final safety check: ensure email wasn't registered by someone else in the interim
    const conflict = await db.user.findFirst({
      where: {
        email: normalizedEmail,
        NOT: { id: user.id },
      },
      select: { id: true },
    });

    if (conflict) {
      return {
        success: false,
        error: "This email address was recently taken by another account.",
      };
    }

    // Atomically update user's email
    await db.user.update({
      where: { id: user.id },
      data: {
        email: normalizedEmail,
        emailVerified: new Date(),
      },
    });

    // Delete the used token
    await db.verificationToken.deleteMany({ where: { identifier } });

    logger.info(
      { userId: user.id, oldEmail: user.email, newEmail: normalizedEmail },
      "User email address verified and updated successfully",
    );

    if (user.role === "TEACHER") {
      revalidatePath("/teacher/dashboard/profile");
      revalidatePath("/teacher/dashboard");
    } else {
      revalidatePath("/student/dashboard/profile");
      revalidatePath("/student/dashboard");
    }

    return {
      success: true,
      email: normalizedEmail,
      message: "Your email address has been updated successfully!",
    };
  } catch (error) {
    logger.error({ error }, "Failed to verify email update");
    return {
      success: false,
      error: "Unable to complete email update. Please try again.",
    };
  }
}
