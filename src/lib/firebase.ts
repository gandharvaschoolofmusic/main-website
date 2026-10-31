"use client";

import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import {
  getAuth,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  type Auth,
  type ConfirmationResult,
} from "firebase/auth";

export const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "",
};

export const isFirebaseConfigured = (): boolean => {
  return Boolean(
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY &&
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
  );
};

let firebaseApp: FirebaseApp | null = null;
let firebaseAuth: Auth | null = null;

export function getFirebaseAuth(): Auth | null {
  if (typeof window === "undefined") return null;

  if (!isFirebaseConfigured()) {
    return null;
  }

  if (!firebaseApp) {
    firebaseApp = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
  }

  if (!firebaseAuth && firebaseApp) {
    firebaseAuth = getAuth(firebaseApp);
  }

  return firebaseAuth;
}

export function createRecaptchaVerifier(
  containerId: string,
  onExpired?: () => void
): RecaptchaVerifier | null {
  const auth = getFirebaseAuth();
  if (!auth) return null;

  try {
    if (typeof window !== "undefined") {
      let el = document.getElementById(containerId);
      if (!el && typeof document !== "undefined") {
        el = document.createElement("div");
        el.id = containerId;
        el.className = "hidden";
        el.style.display = "none";
        el.setAttribute("aria-hidden", "true");
        document.body.appendChild(el);
      }

      // 1. If an existing verifier exists and is attached to this container, reuse it safely
      const existing = (window as any).recaptchaVerifier as RecaptchaVerifier | undefined;
      if (existing && el && (window as any).recaptchaContainerId === containerId) {
        return existing;
      }

      // 2. Clear any previous verifier instance
      if (existing) {
        try {
          existing.clear();
        } catch {
          // ignore
        }
        (window as any).recaptchaVerifier = null;
      }

      // Empty inner content without replacing or detaching React's DOM node
      if (el) {
        el.innerHTML = "";
      }
    }

    const verifier = new RecaptchaVerifier(auth, containerId, {
      size: "invisible",
      callback: () => {
        // Invisible reCAPTCHA successfully solved
      },
      "expired-callback": () => {
        if (onExpired) onExpired();
      },
    });

    // Pre-warm the reCAPTCHA widget in background so verify() during SMS dispatch is instantaneous
    verifier.render().catch(() => {});

    if (typeof window !== "undefined") {
      (window as any).recaptchaVerifier = verifier;
      (window as any).recaptchaContainerId = containerId;
    }

    return verifier;
  } catch (error) {
    console.error("[Firebase] Error initializing RecaptchaVerifier:", error);
    return null;
  }
}

export async function sendFirebaseOtp(
  phoneNumber: string,
  verifier: RecaptchaVerifier
): Promise<{ success: boolean; confirmationResult?: ConfirmationResult; error?: string }> {
  const auth = getFirebaseAuth();
  if (!auth) {
    return {
      success: false,
      error: "Firebase Authentication is not configured.",
    };
  }

  try {
    const confirmationResult = await signInWithPhoneNumber(auth, phoneNumber, verifier);
    return {
      success: true,
      confirmationResult,
    };
  } catch (error: any) {
    console.error("[Firebase] Error in signInWithPhoneNumber:", error);

    // On failure, clear verifier to allow a clean retry on the next click
    try {
      verifier.clear();
    } catch {}
    if (typeof window !== "undefined") {
      (window as any).recaptchaVerifier = null;
      (window as any).recaptchaContainerId = null;
    }

    let msg = error?.message || "Failed to dispatch verification SMS via Firebase.";
    if (error?.code === "auth/invalid-phone-number") {
      msg = "The mobile phone number format is invalid. Please include your country code.";
    } else if (error?.code === "auth/quota-exceeded") {
      msg = "SMS quota exceeded for today. Please try again later or contact support.";
    } else if (error?.code === "auth/too-many-requests") {
      msg = "Too many attempts. Please wait a moment before requesting another code.";
    } else if (error?.code === "auth/billing-not-enabled") {
      msg = "Firebase SMS billing is not enabled. Please upgrade to the Blaze plan in Firebase Console, or add this phone under 'Phone numbers for testing'.";
    } else if (error?.code === "auth/captcha-check-failed") {
      msg = "reCAPTCHA verification failed. Please refresh and try again.";
    }

    return {
      success: false,
      error: msg,
    };
  }
}

export async function confirmFirebaseOtp(
  confirmationResult: ConfirmationResult,
  verificationCode: string
): Promise<{ success: boolean; idToken?: string; error?: string }> {
  try {
    const userCredential = await confirmationResult.confirm(verificationCode);
    const idToken = await userCredential.user.getIdToken();
    return {
      success: true,
      idToken,
    };
  } catch (error: any) {
    console.error("[Firebase] Error confirming verification code:", error);
    let msg = error?.message || "Invalid verification code. Please check and try again.";
    if (error?.code === "auth/invalid-verification-code") {
      msg = "Invalid verification code. Please check the 6-digit code sent to your phone.";
    } else if (error?.code === "auth/code-expired") {
      msg = "Verification code has expired. Please request a new code.";
    }
    return {
      success: false,
      error: msg,
    };
  }
}
