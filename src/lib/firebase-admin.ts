import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { logger } from "@/lib/logger";
import { db } from "@/lib/db";
import { normalizePhoneNumber } from "@/lib/phone";

let isInitialized = false;

function getAdminApp() {
  if (isInitialized || getApps().length > 0) {
    return getApps()[0];
  }

  try {
    const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    const projectId =
      process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

    if (serviceAccountKey) {
      try {
        const parsedKey = JSON.parse(serviceAccountKey);
        const app = initializeApp({
          credential: cert(parsedKey),
          projectId: parsedKey.project_id || projectId,
        });
        isInitialized = true;
        return app;
      } catch (err) {
        logger.error({ err }, "[Firebase Admin] Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY JSON");
      }
    }

    if (projectId) {
      const app = initializeApp({ projectId });
      isInitialized = true;
      return app;
    }
  } catch (err) {
    logger.error({ err }, "[Firebase Admin] Error initializing Firebase Admin");
  }

  return null;
}

/**
 * Validates a Firebase ID token returned from client-side phone auth confirmation.
 * Verifies that the authenticated phone number matches the expected phone number.
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
    // 1. Try Firebase Admin SDK verification if configured
    const adminApp = getAdminApp();
    if (adminApp) {
      try {
        const auth = getAuth(adminApp);
        const decodedToken = await auth.verifyIdToken(idToken);
        const tokenPhone = decodedToken.phone_number
          ? normalizePhoneNumber(decodedToken.phone_number)
          : null;

        if (tokenPhone && tokenPhone === normalizedExpectedPhone) {
          await markPhoneAsVerifiedInDb(normalizedExpectedPhone);
          return { isValid: true, phone: tokenPhone };
        } else if (!tokenPhone) {
          return { isValid: false, error: "Firebase token does not contain a verified mobile number." };
        } else {
          return {
            isValid: false,
            error: `Verified phone number (${tokenPhone}) does not match registration phone (${normalizedExpectedPhone}).`,
          };
        }
      } catch (adminErr) {
        logger.warn(
          { adminErr },
          "[Firebase Admin] Admin verifyIdToken failed, attempting REST API lookup"
        );
      }
    }

    // 2. Fallback: Google Identity Toolkit REST API lookup using Web API Key
    const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
    if (apiKey) {
      const res = await fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ idToken }),
        }
      );

      if (res.ok) {
        const data = await res.json();
        const user = data.users?.[0];
        const tokenPhone = user?.phoneNumber
          ? normalizePhoneNumber(user.phoneNumber)
          : null;

        if (tokenPhone && tokenPhone === normalizedExpectedPhone) {
          await markPhoneAsVerifiedInDb(normalizedExpectedPhone);
          return { isValid: true, phone: tokenPhone };
        } else if (!tokenPhone) {
          return { isValid: false, error: "Firebase account does not have a verified mobile number." };
        } else {
          return {
            isValid: false,
            error: `Verified phone number (${tokenPhone}) does not match input phone (${normalizedExpectedPhone}).`,
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
    }

    return {
      isValid: false,
      error: "Firebase authentication server verification is not configured.",
    };
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

