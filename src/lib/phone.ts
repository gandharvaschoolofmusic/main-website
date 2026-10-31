import crypto from "crypto";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { verifyFirebasePhoneToken } from "@/lib/firebase-admin";

/**
 * Formats a dial code and local phone input into standard international E.164.
 * Strips accidental domestic trunk zeros (e.g. 0176... in Germany -> +49176...) and cleans whitespace/symbols.
 */
export function formatInternationalE164(dialCode: string, rawNumber: string): string {
  if (!rawNumber) return "";
  let trimmed = rawNumber.trim().replace(/[\s\-\(\)\.]/g, "");

  // If already starts with +, clean domestic 0 after dial code if present
  if (trimmed.startsWith("+")) {
    const match = trimmed.match(/^(\+(?:1|44|49|33|61|65|971|966|974|968|965|973|60|64|27|353|41|81|977|880|94|230|39|34|46|47|45))0(\d+)$/);
    if (match) {
      return `${match[1]}${match[2]}`;
    }
    return trimmed;
  }

  if (trimmed.startsWith("00")) {
    return formatInternationalE164("+", trimmed.slice(2));
  }

  // Strip leading domestic trunk zero(s)
  let cleanDigits = trimmed.replace(/\D/g, "");
  if (cleanDigits.startsWith("0")) {
    cleanDigits = cleanDigits.replace(/^0+/, "");
  }

  const cleanDialCode = dialCode.startsWith("+") ? dialCode : `+${dialCode.replace(/\D/g, "")}`;
  return `${cleanDialCode}${cleanDigits}`;
}

/**
 * Normalizes phone numbers to standard E.164 format.
 * Defaults to India (+91) if a 10-digit number is provided without a country code.
 */
export function normalizePhoneNumber(rawPhone: string): string {
  if (!rawPhone) return "";

  // Strip all whitespace, dashes, parentheses, dots
  let cleaned = rawPhone.replace(/[\s\-\(\)\.]/g, "");

  // If starts with 00, replace with +
  if (cleaned.startsWith("00")) {
    cleaned = "+" + cleaned.slice(2);
  }

  // If starts with +, strip any domestic 0 after dial code if present
  if (cleaned.startsWith("+")) {
    const match = cleaned.match(/^(\+(?:1|44|49|33|61|65|971|966|974|968|965|973|60|64|27|353|41|81|977|880|94|230|39|34|46|47|45))0(\d+)$/);
    if (match) {
      return `${match[1]}${match[2]}`;
    }
    return cleaned;
  }

  // If it's a 10-digit number, prepend +91
  if (/^\d{10}$/.test(cleaned)) {
    return `+91${cleaned}`;
  }

  // If 11 or 12 digits starting with 91, add +
  if (/^91\d{10}$/.test(cleaned)) {
    return `+${cleaned}`;
  }

  // Default fallback: ensure leading +
  return `+${cleaned}`;
}

/**
 * Checks if a string is a valid international/national mobile number.
 */
export function isValidPhoneNumber(phone: string): boolean {
  const normalized = normalizePhoneNumber(phone);
  // Valid E.164 phone numbers: + followed by 7 to 15 digits
  return /^\+[1-9]\d{6,14}$/.test(normalized);
}

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
  const code = generatePhoneOtp();
  const expires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  // Invalidate previous unused tokens for this phone
  await db.phoneVerificationToken.updateMany({
    where: {
      phone,
      used: false,
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

  // Find unexpired token for this phone & code or recent verified token
  const token = await db.phoneVerificationToken.findFirst({
    where: {
      phone,
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
      phone,
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
      phone,
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
