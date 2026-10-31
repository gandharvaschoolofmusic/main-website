"use server";

import { db } from "@/lib/db";
import { requireRole, requireUser } from "@/lib/auth-helpers";
import { Role } from "@prisma/client";
import fs from "fs";
import path from "path";
import {
  TeacherProfileSchema,
  AvailabilityRulesSchema,
  AvailabilityExceptionSchema,
  AvailabilityRuleItem,
} from "@/schemas/teacher";
import { isAppError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { revalidatePath } from "next/cache";
import { generateAvailableSlots, TeacherSlotAvailability } from "@/lib/slots";
import { auth } from "@/lib/auth";
import { isValidTimezone } from "@/lib/timezone";

export type TeacherActionResponse<T = unknown> = {
  success: boolean;
  message?: string;
  error?: string;
  fieldErrors?: Record<string, string[]>;
  data?: T;
};

/**
 * Update teacher profile details (bio, instruments, rate, etc.)
 */
export async function updateTeacherProfileAction(
  prevState: unknown,
  formData: FormData,
): Promise<TeacherActionResponse> {
  try {
    const user = await requireRole(Role.TEACHER);

    // Parse instruments and tiers from FormData (supports repeated keys or JSON)
    let expertInstruments: string[] = formData.getAll("expertInstruments").map(String);
    if (expertInstruments.length === 0 && formData.get("expertInstrumentsJson")) {
      try {
        expertInstruments = JSON.parse(String(formData.get("expertInstrumentsJson")));
      } catch {
        // Fallback
      }
    }

    let moderateInstruments: string[] = formData.getAll("moderateInstruments").map(String);
    if (moderateInstruments.length === 0 && formData.get("moderateInstrumentsJson")) {
      try {
        moderateInstruments = JSON.parse(String(formData.get("moderateInstrumentsJson")));
      } catch {
        // Fallback
      }
    }

    let instruments: string[] = formData.getAll("instruments").map(String);
    if (instruments.length === 0 && formData.get("instrumentsJson")) {
      try {
        instruments = JSON.parse(String(formData.get("instrumentsJson")));
      } catch {
        // Fallback
      }
    }

    // If instruments wasn't explicitly passed, synthesize from expert & moderate tiers
    if (instruments.length === 0) {
      instruments = Array.from(new Set([...expertInstruments, ...moderateInstruments]));
    } else if (expertInstruments.length === 0 && moderateInstruments.length === 0) {
      // Legacy fallback: if only raw instruments was passed, default to expertInstruments
      expertInstruments = [...instruments];
    }

    let languages: string[] = formData.getAll("languages").map(String);
    if (languages.length === 0 && formData.get("languagesJson")) {
      try {
        languages = JSON.parse(String(formData.get("languagesJson")));
      } catch {
        // Fallback
      }
    }

    const rawData = {
      bio: formData.get("bio"),
      instruments,
      expertInstruments,
      moderateInstruments,
      yearsTeaching: formData.get("yearsTeaching"),
      hourlyRate: formData.get("hourlyRate"),
      languages,
    };

    const parsed = TeacherProfileSchema.safeParse(rawData);
    if (!parsed.success) {
      const firstError = Object.values(parsed.error.flatten().fieldErrors)[0]?.[0];
      return {
        success: false,
        error: firstError || "Invalid profile data",
        fieldErrors: parsed.error.flatten().fieldErrors,
      };
    }

    const {
      bio,
      yearsTeaching,
      hourlyRate,
      languages: validLanguages,
      expertInstruments: validExpert,
      moderateInstruments: validModerate,
    } = parsed.data;
    const validInstruments = parsed.data.instruments;

    // Convert dollar rate into integer minor units (cents/paise)
    const rateInCents = Math.round(hourlyRate * 100);

    const rawUpi = formData.get("upiId")?.toString().trim();
    const upiId = rawUpi && rawUpi.includes("@") && rawUpi.length >= 5 ? rawUpi : undefined;

    await db.teacherProfile.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        bio,
        instruments: validInstruments,
        expertInstruments: validExpert,
        moderateInstruments: validModerate,
        yearsTeaching,
        hourlyRate: rateInCents,
        currency: "INR",
        languages: validLanguages,
        isPublished: false,
        ...(upiId ? { upiId } : {}),
      },
      update: {
        bio,
        instruments: validInstruments,
        expertInstruments: validExpert,
        moderateInstruments: validModerate,
        yearsTeaching,
        hourlyRate: rateInCents,
        languages: validLanguages,
        ...(upiId ? { upiId } : {}),
      },
    });

    logger.info({ userId: user.id }, "Teacher profile updated");
    revalidatePath("/teacher/dashboard/profile");
    revalidatePath("/teacher/onboarding");

    return {
      success: true,
      message: "Studio profile updated successfully!",
    };
  } catch (error) {
    logger.error({ error }, "Error updating teacher profile");
    if (isAppError(error)) {
      return { success: false, error: error.message };
    }
    return {
      success: false,
      error: "Failed to update profile. Please try again.",
    };
  }
}

/**
 * Save weekly recurring availability rules for the teacher.
 */
export async function saveAvailabilityRulesAction(
  rules: AvailabilityRuleItem[],
): Promise<TeacherActionResponse> {
  try {
    const user = await requireRole(Role.TEACHER);

    // Validate payload against schema
    const parsed = AvailabilityRulesSchema.safeParse(rules);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message || "Invalid availability rules",
      };
    }

    const validRules = parsed.data;

    const profile = await db.teacherProfile.findUnique({
      where: { userId: user.id },
      select: {
        id: true,
        bio: true,
        instruments: true,
        hourlyRate: true,
        isPublished: true,
        user: {
          select: {
            emailVerified: true,
          },
        },
      },
    });

    if (!profile) {
      return {
        success: false,
        error: "Teacher profile not found. Please complete profile setup first.",
      };
    }

    let isNowPublished = profile.isPublished;

    // Replace rules atomically in a transaction
    await db.$transaction(async (tx) => {
      await tx.availabilityRule.deleteMany({
        where: { teacherId: profile.id },
      });

      if (validRules.length > 0) {
        await tx.availabilityRule.createMany({
          data: validRules.map((r: AvailabilityRuleItem) => ({
            teacherId: profile.id,
            dayOfWeek: r.dayOfWeek,
            startMinute: r.startMinute,
            endMinute: r.endMinute,
          })),
        });

        // If teacher has complete profile info and saves working hours, ensure they are published
        const hasBio = !!profile.bio && profile.bio.trim().length >= 20;
        const hasInstruments = profile.instruments.length > 0;
        const hasRate = (profile.hourlyRate || 0) > 0;
        if (!profile.isPublished && hasBio && hasInstruments && hasRate) {
          // If in development/testing and email is not verified, auto-verify it to prevent blocking
          if (!profile.user.emailVerified && process.env.NODE_ENV !== "production") {
            await tx.user.update({
              where: { id: user.id },
              data: { emailVerified: new Date() },
            });
          }
          await tx.teacherProfile.update({
            where: { id: profile.id },
            data: { isPublished: true },
          });
          isNowPublished = true;
        }
      }
    });

    logger.info(
      { teacherId: profile.id, rulesCount: validRules.length },
      "Teacher availability rules updated",
    );
    revalidatePath("/teacher/availability");
    revalidatePath("/teacher/dashboard");
    revalidatePath("/teacher/onboarding");
    revalidatePath("/teachers");
    revalidatePath(`/teachers/${profile.id}`);
    revalidatePath("/student/dashboard");

    return {
      success: true,
      message: isNowPublished
        ? "Weekly availability schedule saved! Your profile is live and bookable by students."
        : "Weekly availability schedule saved! Note: Complete your bio and rate to publish your profile.",
    };
  } catch (error) {
    logger.error({ error }, "Error saving availability rules");
    if (isAppError(error)) {
      return { success: false, error: error.message };
    }
    return {
      success: false,
      error: "Failed to save availability schedule. Please try again.",
    };
  }
}

/**
 * Add a one-off exception (blocked date or special time block).
 */
export async function addAvailabilityExceptionAction(
  prevState: unknown,
  formData: FormData,
): Promise<TeacherActionResponse> {
  try {
    const user = await requireRole(Role.TEACHER);

    const rawData = {
      date: formData.get("date"),
      isBlocked: formData.get("isBlocked") === "true",
      startMinute: formData.get("startMinute") || null,
      endMinute: formData.get("endMinute") || null,
    };

    const parsed = AvailabilityExceptionSchema.safeParse(rawData);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message || "Invalid exception data",
      };
    }

    const profile = await db.teacherProfile.findUnique({
      where: { userId: user.id },
      select: { id: true },
    });

    if (!profile) {
      return { success: false, error: "Teacher profile not found." };
    }

    const exceptionDate = new Date(`${parsed.data.date}T00:00:00Z`);

    await db.availabilityException.create({
      data: {
        teacherId: profile.id,
        date: exceptionDate,
        isBlocked: parsed.data.isBlocked,
        startMinute: parsed.data.startMinute,
        endMinute: parsed.data.endMinute,
      },
    });

    revalidatePath("/teacher/availability");
    revalidatePath("/teachers");
    revalidatePath(`/teachers/${profile.id}`);
    return {
      success: true,
      message: "Exception added successfully!",
    };
  } catch (error) {
    logger.error({ error }, "Error adding availability exception");
    return {
      success: false,
      error: "Failed to add date exception. Please try again.",
    };
  }
}

/**
 * Remove an availability exception.
 */
export async function deleteAvailabilityExceptionAction(
  exceptionId: string,
): Promise<TeacherActionResponse> {
  try {
    const user = await requireRole(Role.TEACHER);

    const profile = await db.teacherProfile.findUnique({
      where: { userId: user.id },
      select: { id: true },
    });

    if (!profile) {
      return { success: false, error: "Teacher profile not found." };
    }

    await db.availabilityException.deleteMany({
      where: {
        id: exceptionId,
        teacherId: profile.id,
      },
    });

    revalidatePath("/teacher/availability");
    revalidatePath("/teachers");
    revalidatePath(`/teachers/${profile.id}`);
    return {
      success: true,
      message: "Exception removed successfully!",
    };
  } catch (error) {
    logger.error({ error }, "Error deleting availability exception");
    return {
      success: false,
      error: "Failed to delete exception.",
    };
  }
}

/**
 * Toggle publish status with comprehensive readiness guard checks.
 */
export async function togglePublishTeacherProfileAction(): Promise<
  TeacherActionResponse<{ isPublished: boolean }>
> {
  try {
    const user = await requireRole(Role.TEACHER);

    const dbUser = await db.user.findUnique({
      where: { id: user.id },
      include: {
        teacherProfile: {
          include: {
            availabilityRules: true,
          },
        },
      },
    });

    if (!dbUser || !dbUser.teacherProfile) {
      return {
        success: false,
        error: "Teacher profile not found. Please complete profile setup first.",
      };
    }

    const profile = dbUser.teacherProfile;

    // If currently unpublished, perform validation guards before publishing
    if (!profile.isPublished) {
      // 0. Admin approval check
      if (profile.approvalStatus === "REJECTED") {
        return {
          success: false,
          error: `Your faculty profile was not approved by administration${profile.rejectionReason ? `: "${profile.rejectionReason}"` : ""}. Please update your qualifications or contact administrative support.`,
        };
      }
      if (profile.approvalStatus === "PENDING") {
        return {
          success: false,
          error:
            "Your faculty profile is currently pending administrative review. You will be able to publish once school administration approves your faculty profile.",
        };
      }

      // 1. Email verification check
      if (!dbUser.emailVerified) {
        return {
          success: false,
          error:
            "Email verification required. Please verify your email address before publishing your profile.",
        };
      }

      // 2. Bio check
      if (!profile.bio || profile.bio.trim().length < 20) {
        return {
          success: false,
          error:
            "Please write a bio describing your musical background (minimum 20 characters).",
        };
      }

      // 3. Instruments check
      if (!profile.instruments || profile.instruments.length === 0) {
        return {
          success: false,
          error: "Please select at least one instrument you teach.",
        };
      }

      // 4. Rate check
      if (!profile.hourlyRate || profile.hourlyRate <= 0) {
        return {
          success: false,
          error: "Please set your lesson hourly rate.",
        };
      }

      // 5. Availability check
      if (!profile.availabilityRules || profile.availabilityRules.length === 0) {
        return {
          success: false,
          error:
            "Please set up your weekly availability schedule so students can book lessons with you.",
        };
      }

      // All checks passed -> Publish!
      const updated = await db.teacherProfile.update({
        where: { id: profile.id },
        data: { isPublished: true },
      });

      logger.info({ teacherId: profile.id }, "Teacher profile published");
      revalidatePath("/teacher/dashboard");
      revalidatePath("/teacher/onboarding");
      revalidatePath("/teachers");
      revalidatePath(`/teachers/${profile.id}`);
      revalidatePath("/student/dashboard");

      return {
        success: true,
        data: { isPublished: true },
        message:
          "🎉 Your profile is now published and discoverable by students!",
      };
    } else {
      // Unpublish
      await db.teacherProfile.update({
        where: { id: profile.id },
        data: { isPublished: false },
      });

      logger.info({ teacherId: profile.id }, "Teacher profile unpublished");
      revalidatePath("/teacher/dashboard");
      revalidatePath("/teacher/onboarding");
      revalidatePath("/teachers");
      revalidatePath(`/teachers/${profile.id}`);
      revalidatePath("/student/dashboard");

      return {
        success: true,
        data: { isPublished: false },
        message: "Your profile has been unpublished and is hidden from search.",
      };
    }
  } catch (error) {
    logger.error({ error }, "Error toggling publish status");
    if (isAppError(error)) {
      return { success: false, error: error.message };
    }
    return {
      success: false,
      error: "Unable to update publish status. Please try again.",
    };
  }
}

/**
 * Fetch availability slots dynamically projected into any requested viewer timezone.
 */
export async function getTeacherAvailabilityAction(
  teacherProfileId: string,
  viewerTimezone: string,
): Promise<{
  success: boolean;
  availability?: TeacherSlotAvailability | null;
  error?: string;
}> {
  try {
    const tz = isValidTimezone(viewerTimezone) ? viewerTimezone.trim() : "UTC";
    const availability = await generateAvailableSlots(teacherProfileId, tz);
    return { success: true, availability };
  } catch (error) {
    logger.error(
      { error, teacherProfileId, viewerTimezone },
      "Error fetching availability for timezone",
    );
    return {
      success: false,
      error: "Unable to load schedule for this timezone.",
    };
  }
}

/**
 * Update authenticated user's timezone in profile.
 */
export async function updateUserTimezoneAction(
  timezone: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!isValidTimezone(timezone)) {
      return { success: false, error: "Invalid timezone identifier." };
    }

    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Not authenticated." };
    }

    await db.user.update({
      where: { id: session.user.id },
      data: { timezone: timezone.trim() },
    });

    revalidatePath("/teachers");
    return { success: true };
  } catch (error) {
    logger.error({ error, timezone }, "Error updating user timezone");
    return { success: false, error: "Failed to update profile timezone." };
  }
}

/**
 * Update teacher's UPI payout ID.
 */
export async function updateTeacherPaymentDetailsAction(data: {
  upiId: string;
  teacherUserId?: string;
}): Promise<TeacherActionResponse> {
  try {
    const user = await requireUser();
    if (user.role !== Role.TEACHER && user.role !== Role.ADMIN) {
      return {
        success: false,
        error: "Access restricted to faculty instructors and administrators.",
      };
    }

    const targetUserId =
      user.role === Role.ADMIN && data.teacherUserId
        ? data.teacherUserId
        : user.id;

    const trimmedUpi = data.upiId.trim();

    if (!trimmedUpi) {
      return { success: false, error: "UPI ID cannot be empty." };
    }
    if (!trimmedUpi.includes("@") || trimmedUpi.length < 5) {
      return {
        success: false,
        error:
          "Please enter a valid UPI ID (e.g. username@okhdfcbank, 9876543210@upi, or name@paytm).",
      };
    }

    const existingProfile = await db.teacherProfile.findUnique({
      where: { userId: targetUserId },
    });

    if (existingProfile) {
      await db.teacherProfile.update({
        where: { userId: targetUserId },
        data: {
          upiId: trimmedUpi,
        },
      });
    } else {
      await db.teacherProfile.create({
        data: {
          userId: targetUserId,
          bio: "Faculty instructor at Gandharva School of Music.",
          instruments: ["Piano"],
          expertInstruments: ["Piano"],
          moderateInstruments: [],
          languages: ["English"],
          yearsTeaching: 5,
          hourlyRate: 5000,
          currency: "INR",
          payoutPerSession: 50000,
          upiId: trimmedUpi,
          isPublished: false,
        },
      });
    }

    logger.info(
      { userId: targetUserId, upiId: trimmedUpi },
      "Teacher UPI payout details updated",
    );
    revalidatePath("/teacher/dashboard/profile");
    revalidatePath("/teacher/dashboard/earnings");
    revalidatePath("/admin/users");

    return {
      success: true,
      message: "UPI payout ID saved successfully!",
    };
  } catch (error) {
    logger.error({ error }, "Error updating teacher payment details");
    const errMsg =
      error instanceof Error
        ? error.message
        : "Failed to update payment details.";
    return { success: false, error: errMsg };
  }
}

/**
 * Upload and save teacher's payment QR code image.
 */
export async function uploadTeacherPaymentQrAction(
  formData: FormData,
): Promise<{ success: boolean; error?: string; paymentQrCodeUrl?: string }> {
  try {
    const user = await requireUser();
    if (user.role !== Role.TEACHER && user.role !== Role.ADMIN) {
      return {
        success: false,
        error: "Access restricted to faculty instructors and administrators.",
      };
    }

    const teacherUserIdParam = formData.get("teacherUserId")?.toString();
    const targetUserId =
      user.role === Role.ADMIN && teacherUserIdParam
        ? teacherUserIdParam
        : user.id;

    const file = formData.get("file") as File | null;

    if (!file) {
      return { success: false, error: "No image file provided." };
    }

    const allowedMimeTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/gif",
      "image/svg+xml",
    ];

    if (!allowedMimeTypes.includes(file.type.toLowerCase())) {
      return {
        success: false,
        error:
          "Invalid file type. Only JPEG, PNG, WEBP, and GIF images are allowed for payment QR codes.",
      };
    }

    // 5MB limit
    if (file.size > 5 * 1024 * 1024) {
      return {
        success: false,
        error: "File size exceeds 5MB limit. Please upload a smaller QR image.",
      };
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const ext = file.name.split(".").pop()?.toLowerCase() || "png";
    const safeExt = ["jpeg", "jpg", "png", "webp", "gif", "svg"].includes(ext)
      ? ext
      : "png";
    const fileName = `qr-${targetUserId}-${Date.now()}.${safeExt}`;

    const qrDir = path.join(process.cwd(), "public", "uploads", "payment-qr");
    if (!fs.existsSync(qrDir)) {
      fs.mkdirSync(qrDir, { recursive: true });
    }

    // Remove old QR code file if stored locally
    const currentProfile = await db.teacherProfile.findUnique({
      where: { userId: targetUserId },
    });

    if (
      currentProfile?.paymentQrCodeUrl &&
      currentProfile.paymentQrCodeUrl.startsWith("/uploads/payment-qr/")
    ) {
      const oldPath = path.join(
        process.cwd(),
        "public",
        currentProfile.paymentQrCodeUrl,
      );
      if (fs.existsSync(oldPath)) {
        try {
          fs.unlinkSync(oldPath);
        } catch (e) {
          logger.warn({ error: e }, "Failed to delete old QR file");
        }
      }
    }

    const relativeUrl = `/uploads/payment-qr/${fileName}`;
    const filePath = path.join(qrDir, fileName);
    fs.writeFileSync(filePath, buffer);

    if (currentProfile) {
      await db.teacherProfile.update({
        where: { userId: targetUserId },
        data: {
          paymentQrCodeUrl: relativeUrl,
        },
      });
    } else {
      await db.teacherProfile.create({
        data: {
          userId: targetUserId,
          bio: "Faculty instructor at Gandharva School of Music.",
          instruments: ["Piano"],
          expertInstruments: ["Piano"],
          moderateInstruments: [],
          languages: ["English"],
          yearsTeaching: 5,
          hourlyRate: 5000,
          currency: "INR",
          payoutPerSession: 50000,
          paymentQrCodeUrl: relativeUrl,
          isPublished: false,
        },
      });
    }

    logger.info(
      { userId: targetUserId, paymentQrCodeUrl: relativeUrl },
      "Teacher payment QR uploaded",
    );
    revalidatePath("/teacher/dashboard/profile");
    revalidatePath("/teacher/dashboard/earnings");
    revalidatePath("/admin/users");

    return {
      success: true,
      paymentQrCodeUrl: relativeUrl,
    };
  } catch (error) {
    logger.error({ error }, "Error uploading teacher payment QR code");
    const errMsg =
      error instanceof Error
        ? error.message
        : "Failed to upload payment QR code.";
    return { success: false, error: errMsg };
  }
}

/**
 * Remove teacher's payment QR code.
 */
export async function removeTeacherPaymentQrAction(
  teacherUserId?: string,
): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const user = await requireUser();
    if (user.role !== Role.TEACHER && user.role !== Role.ADMIN) {
      return {
        success: false,
        error: "Access restricted to faculty instructors and administrators.",
      };
    }

    const targetUserId =
      user.role === Role.ADMIN && teacherUserId ? teacherUserId : user.id;

    const currentProfile = await db.teacherProfile.findUnique({
      where: { userId: targetUserId },
      select: { paymentQrCodeUrl: true },
    });

    if (
      currentProfile?.paymentQrCodeUrl &&
      currentProfile.paymentQrCodeUrl.startsWith("/uploads/payment-qr/")
    ) {
      const oldPath = path.join(
        process.cwd(),
        "public",
        currentProfile.paymentQrCodeUrl,
      );
      if (fs.existsSync(oldPath)) {
        try {
          fs.unlinkSync(oldPath);
        } catch (e) {
          logger.warn({ error: e }, "Failed to delete QR file");
        }
      }
    }

    if (currentProfile) {
      await db.teacherProfile.update({
        where: { userId: targetUserId },
        data: {
          paymentQrCodeUrl: null,
        },
      });
    }

    revalidatePath("/teacher/dashboard/profile");
    revalidatePath("/teacher/dashboard/earnings");
    revalidatePath("/admin/users");

    return { success: true };
  } catch (error) {
    logger.error({ error }, "Error removing teacher payment QR code");
    const errMsg =
      error instanceof Error ? error.message : "Failed to remove QR code.";
    return { success: false, error: errMsg };
  }
}


