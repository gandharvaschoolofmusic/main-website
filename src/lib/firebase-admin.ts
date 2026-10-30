import { logger } from "@/lib/logger";
import { db } from "@/lib/db";
import { normalizePhoneNumber } from "@/lib/phone";

/**
 * Validates a Firebase ID token returned from client-side phone auth confirmation
 * using Google's Identity Toolkit REST API.
 * 
 * Using direct HTTPS REST calls completely eliminates heavy server dependencies
 * like `firebase-admin` / `jwks-rsa` / `jose` which cause CommonJS/ESM require errors
 * (ERR_REQUIRE_ESM) when bundled on Vercel Serverless Functions.
 */
export async function verifyFirebasePhoneToken(
  idToken: string,
  expectedPhone: string
): Promise<{ isValid: boolean; phone?: string; error?: string }> {
  if (!idToken || !idToken.trim()) {
    return { isValid: false, error: "Missing Firebase verification token." };
  }

  const normalizedExpectedPhone = normalizePhoneNumber(expectedPhone);

  try {
    const apiKey =
      process.env.NEXT_PUBLIC_FIREBASE_API_KEY ||
      process.env.FIREBASE_API_KEY;

    if (!apiKey) {
      logger.error("[Firebase Auth] Missing NEXT_PUBLIC_FIREBASE_API_KEY for token verification");
      return {
        isValid: false,
        error: "Firebase authentication server verification is not configured.",
      };
    }

    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      }
    );

    if (res.ok) {
      const data = (await res.json()) as {
        users?: Array<{
          localId?: string;
          phoneNumber?: string;
        }>;
      };

      const user = data.users?.[0];
      const tokenPhone = user?.phoneNumber
        ? normalizePhoneNumber(user.phoneNumber)
        : null;

      if (tokenPhone && tokenPhone === normalizedExpectedPhone) {
        await markPhoneAsVerifiedInDb(normalizedExpectedPhone);
        return { isValid: true, phone: tokenPhone };
      } else if (!tokenPhone) {
        return {
          isValid: false,
          error: "Firebase account does not have a verified mobile number.",
        };
      } else {
        return {
          isValid: false,
          error: `Verified phone number (${tokenPhone}) does not match registration phone (${normalizedExpectedPhone}).`,
        };
      }
    } else {
      const errorData = await res.json().catch(() => ({}));
      logger.error({ errorData }, "[Firebase REST] Token verification failed");
      return {
        isValid: false,
        error: "Invalid or expired Firebase verification token.",
      };
    }
  } catch (error: any) {
    logger.error({ error }, "[Firebase] Unexpected error verifying phone token");
    return {
      isValid: false,
      error: error?.message || "Failed to verify phone authentication token.",
    };
  }
}

/**
 * Stores an unexpired verified phone token marker in the database so that subsequent
 * form actions (e.g. signup, trial booking, login) recognize the number as verified.
 */
export async function markPhoneAsVerifiedInDb(phone: string): Promise<void> {
  try {
    const expires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes window
    await db.phoneVerificationToken.create({
      data: {
        phone,
        code: "FIREBASE_VERIFIED",
        expires,
        used: true,
      },
    });
  } catch (e) {
    logger.warn({ e, phone }, "[Firebase] Failed to write verified token marker to database");
  }
}
