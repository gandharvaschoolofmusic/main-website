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

/**
 * Ensures a dedicated DOM element exists on document.body for invisible reCAPTCHA.
 * Creating and managing this element outside of React's component tree guarantees
 * that React reconciliation will NEVER fail with "NotFoundError: Failed to execute 'removeChild'".
 */
export function getOrCreateRecaptchaContainer(containerId: string): HTMLElement {
  let el = document.getElementById(containerId);
  if (!el) {
    el = document.createElement("div");
    el.id = containerId;
    el.className = "hidden";
    el.style.display = "none";
    el.setAttribute("aria-hidden", "true");
    document.body.appendChild(el);
  }
  return el;
}

/**
 * Safely clears an active reCAPTCHA verifier and cleans widget elements without
 * mutating or detaching any React-managed parent nodes.
 */
export function clearRecaptchaVerifier(containerId?: string): void {
  if (typeof window === "undefined") return;

  const existing = (window as any).recaptchaVerifier as RecaptchaVerifier | undefined;
  if (existing) {
    try {
      existing.clear();
    } catch {
      // ignore
    }
    (window as any).recaptchaVerifier = null;
    (window as any).recaptchaContainerId = null;
    (window as any).recaptchaWidgetId = undefined;
  }

  if (containerId) {
    try {
      const el = document.getElementById(containerId);
      if (el) {
        // Clear inner HTML (removes any iframes injected by Google grecaptcha)
        // without detaching the container node from its parent
        el.innerHTML = "";
      }
    } catch {}
  }
}

export function createRecaptchaVerifier(
  containerId: string,
  onExpired?: () => void
): RecaptchaVerifier | null {
  const auth = getFirebaseAuth();
  if (!auth || typeof window === "undefined") return null;

  try {
    // 1. If an existing verifier is attached to this container, reuse it safely
    const existing = (window as any).recaptchaVerifier as RecaptchaVerifier | undefined;
    if (existing && (window as any).recaptchaContainerId === containerId) {
      try {
        const widgetId = (existing as any)._widgetId ?? (window as any).recaptchaWidgetId;
        if (typeof widgetId === "number" && (window as any).grecaptcha?.reset) {
          (window as any).grecaptcha.reset(widgetId);
        }
        return existing;
      } catch {
        // Reset failed, clear and create fresh
        try {
          existing.clear();
        } catch {}
        (window as any).recaptchaVerifier = null;
      }
    }

    // 2. Clear any stale verifier and ensure clean container
    clearRecaptchaVerifier(containerId);
    const container = getOrCreateRecaptchaContainer(containerId);

    // 3. Instantiate fresh RecaptchaVerifier
    const verifier = new RecaptchaVerifier(auth, container, {
      size: "invisible",
      callback: () => {
        // Invisible reCAPTCHA successfully solved
      },
      "expired-callback": () => {
        if (onExpired) onExpired();
      },
    });

    (window as any).recaptchaVerifier = verifier;
    (window as any).recaptchaContainerId = containerId;

    return verifier;
  } catch (error: any) {
    console.error("[Firebase] Error initializing RecaptchaVerifier:", error);
    try {
      clearRecaptchaVerifier(containerId);
    } catch {}
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
    // Reset the reCAPTCHA widget token so user gets a fresh challenge token
    try {
      const widgetId = (verifier as any)._widgetId ?? (window as any).recaptchaWidgetId;
      if (typeof widgetId === "number" && (window as any).grecaptcha?.reset) {
        (window as any).grecaptcha.reset(widgetId);
      }
    } catch {}

    const confirmationResult = await signInWithPhoneNumber(auth, phoneNumber, verifier);
    return {
      success: true,
      confirmationResult,
    };
  } catch (error: any) {
    console.error("[Firebase] Error in signInWithPhoneNumber:", error);

    // Reset the reCAPTCHA widget token so user can retry immediately without re-rendering
    try {
      const widgetId = (verifier as any)._widgetId ?? (window as any).recaptchaWidgetId;
      if (typeof widgetId === "number" && (window as any).grecaptcha?.reset) {
        (window as any).grecaptcha.reset(widgetId);
      }
    } catch {}

    const isAlreadyRendered =
      error?.message?.includes("already been rendered") ||
      String(error).includes("already been rendered");

    if (isAlreadyRendered) {
      clearRecaptchaVerifier();
    }

    let msg = error?.message || "Failed to dispatch verification SMS via Firebase.";
    if (error?.code === "auth/invalid-phone-number") {
      msg = "Invalid mobile number format. Please ensure the country code is selected and digits are correct.";
    } else if (error?.code === "auth/quota-exceeded") {
      msg = "SMS quota exceeded for today. Please try again later or contact support.";
    } else if (error?.code === "auth/too-many-requests") {
      msg = "Too many attempts. Please wait a moment before requesting another code.";
    } else if (error?.code === "auth/billing-not-enabled") {
      msg = "Firebase SMS billing is not enabled. Please upgrade to the Blaze plan in Firebase Console, or add this phone under 'Phone numbers for testing'.";
    } else if (
      error?.code === "auth/blocked-at-project-level" ||
      error?.code === "auth/phone-number-not-allowed" ||
      error?.message?.includes("blocked-at-project-level")
    ) {
      msg = "SMS to this country is restricted by your Firebase project's SMS Region Policy. Enable this country in Firebase Console > Authentication > Settings > SMS region policy, or add it to 'Phone numbers for testing'.";
    } else if (error?.code === "auth/captcha-check-failed") {
      msg = "Security verification check failed. Please refresh and try again.";
    } else if (isAlreadyRendered) {
      msg = "Security verification refreshed. Please click 'Send OTP' again to receive your code.";
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
