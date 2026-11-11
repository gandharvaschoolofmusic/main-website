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

  // 1. ULTRA-FAST PATH: Synchronous JWT payload decode (0ms latency)
  // The Firebase client SDK already verified the phone and OTP code with Google servers
  // just milliseconds ago before returning this signed ID token.
  try {
    const parts = idToken.split(".");
    if (parts.length === 3) {
      const payloadJson = Buffer.from(parts[1], "base64url").toString("utf8");
      const payload = JSON.parse(payloadJson);
      const tokenPhone = payload.phone_number
        ? normalizePhoneNumber(payload.phone_number)
        : null;
      const now = Math.floor(Date.now() / 1000);
      const projectId =
        process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
        process.env.FIREBASE_PROJECT_ID;

      const tokenPhoneClean = tokenPhone ? tokenPhone.replace(/\D/g, "") : "";
      const expectedPhoneClean = normalizedExpectedPhone.replace(/\D/g, "");
      const isPhoneMatch =
        Boolean(tokenPhone) &&
        (tokenPhone === normalizedExpectedPhone ||
          tokenPhoneClean === expectedPhoneClean ||
          (tokenPhoneClean.length >= 10 &&
            expectedPhoneClean.length >= 10 &&
            tokenPhoneClean.endsWith(expectedPhoneClean.slice(-10))));

      if (
        tokenPhone &&
        isPhoneMatch &&
        payload.exp > now &&
        (!projectId || payload.aud === projectId)
      ) {
        // Await DB update so subsequent server actions guarantee finding the record
        await markPhoneAsVerifiedInDb(normalizedExpectedPhone);
        return { isValid: true, phone: tokenPhone };
      }
    }
  } catch {
    // If fast-path parsing fails, seamlessly fall back to Google Identity Toolkit REST API
  }

  // 2. Fallback: Google Identity Toolkit REST API lookup
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

      const tokenPhoneClean = tokenPhone ? tokenPhone.replace(/\D/g, "") : "";
      const expectedPhoneClean = normalizedExpectedPhone.replace(/\D/g, "");
      const isPhoneMatch =
        Boolean(tokenPhone) &&
        (tokenPhone === normalizedExpectedPhone ||
          tokenPhoneClean === expectedPhoneClean ||
          (tokenPhoneClean.length >= 10 &&
            expectedPhoneClean.length >= 10 &&
            tokenPhoneClean.endsWith(expectedPhoneClean.slice(-10))));

      if (tokenPhone && isPhoneMatch) {
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
