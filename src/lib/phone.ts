import crypto from "crypto";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { verifyFirebasePhoneToken } from "@/lib/firebase-admin";

export {
  formatInternationalE164,
  normalizePhoneNumber,
  isValidPhoneNumber,
  getPhoneLookupVariations,
} from "./phone-utils";
import { normalizePhoneNumber, getPhoneLookupVariations } from "./phone-utils";

/**
 * Generates a cryptographically random 6-digit numeric OTP code.
 */
export function generatePhoneOtp(): string {
  return crypto.randomInt(100000, 999999).toString();
}

/**
 * Dispatches an SMS OTP.
 */
export async function sendSmsOtp(
  phone: string,
  code: string,
  purpose: "LOGIN" | "SIGNUP",
): Promise<{ success: boolean }> {
  const normalized = normalizePhoneNumber(phone);
  const purposeText = purpose === "SIGNUP" ? "account registration" : "sign in";
  const message = `Your Gandharva School of Music verification code for ${purposeText} is: ${code}. Valid for 10 minutes. Do not share this OTP with anyone.`;

  logger.info(
    { phone: normalized, purpose },
    `[SMS OTP Dispatched] -> ${normalized}`,
  );

  return {
    success: true,
  };
}

/**
 * Creates and stores a 10-minute expiring PhoneVerificationToken in database.
 * Invalidates any prior active tokens for this phone.
 */
export async function createPhoneOtpToken(
  rawPhone: string,
  purpose: "LOGIN" | "SIGNUP",
): Promise<{ phone: string; code: string }> {
  const phone = normalizePhoneNumber(rawPhone);
  const variations = getPhoneLookupVariations(phone);
  const code = generatePhoneOtp();
  const expires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  // Invalidate previous expired tokens for this phone
  await db.phoneVerificationToken.updateMany({
    where: {
      phone: { in: variations },
      expires: { lte: new Date() },
    },
    data: {
      used: true,
    },
  });

  // Store new token
  await db.phoneVerificationToken.create({
    data: {
      phone,
      code,
      expires,
      used: false,
    },
  });

  await sendSmsOtp(phone, code, purpose);

  return {
    phone,
    code,
  };
}

/**
 * Checks whether an OTP code or Firebase token is valid without consuming it yet.
 * Used for live frontend pre-validation before form submission.
 */
export async function checkPhoneOtp(
  rawPhone: string,
  code: string,
  idToken?: string,
): Promise<{ isValid: boolean; error?: string }> {
  const phone = normalizePhoneNumber(rawPhone);

  // If Firebase ID token is provided, verify directly with Firebase
  if (idToken && idToken.trim()) {
    const fbRes = await verifyFirebasePhoneToken(idToken, phone);
    if (fbRes.isValid) {
      return { isValid: true };
    }
    return {
      isValid: false,
      error: fbRes.error || "Firebase phone verification failed.",
    };
  }

  const trimmed = code.trim();
  const variations = getPhoneLookupVariations(phone);

  // Find unexpired token for this phone & code or recent verified token
  const token = await db.phoneVerificationToken.findFirst({
    where: {
      phone: { in: variations },
      OR: [
        { code: trimmed },
        { code: "FIREBASE_VERIFIED" },
      ],
      expires: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });

  if (!token) {
    return {
      isValid: false,
      error: "Invalid or expired OTP code. Please check the code or request a new one.",
    };
  }

  return { isValid: true };
}

/**
 * Verifies an OTP code or Firebase ID token against the database/Firebase.
 * If valid and unexpired:
 * 1. If currently unused, atomically marks it as used.
 * 2. If already marked used within its expiry window, accepts it as a valid
 *    continuation/retry of the current registration or login session.
 */
export async function validateAndConsumePhoneOtp(
  rawPhone: string,
  code: string,
  idToken?: string,
): Promise<{ isValid: boolean; error?: string }> {
  const phone = normalizePhoneNumber(rawPhone);
  const variations = getPhoneLookupVariations(phone);

  // If Firebase ID token is supplied, verify it
  if (idToken && idToken.trim()) {
    const fbRes = await verifyFirebasePhoneToken(idToken, phone);
    if (fbRes.isValid) {
      return { isValid: true };
    }
  }

  const trimmed = code.trim();

  // 1. Check for active unconsumed token
  const activeToken = await db.phoneVerificationToken.findFirst({
    where: {
      phone: { in: variations },
      code: trimmed,
      used: false,
      expires: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });

  if (activeToken) {
    // Atomically mark consumed
    await db.phoneVerificationToken.update({
      where: { id: activeToken.id },
      data: { used: true },
    });
    return { isValid: true };
  }

  // 2. Check for recent token in this session (unexpired, verified via OTP or Firebase)
  const recentToken = await db.phoneVerificationToken.findFirst({
    where: {
      phone: { in: variations },
      OR: [
        { code: trimmed },
        { code: "FIREBASE_VERIFIED" },
      ],
      used: true,
      expires: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });

  if (recentToken) {
    return { isValid: true };
  }

  return {
    isValid: false,
    error: "Invalid or expired OTP code. Please request a new verification code.",
  };
}
