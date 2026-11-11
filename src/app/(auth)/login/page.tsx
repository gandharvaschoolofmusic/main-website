"use client";

import { useActionState, useState, useTransition, useEffect, useRef, startTransition } from "react";
import Link from "next/link";
import { formatInternationalE164 } from "@/lib/phone-utils";
import { FormShell } from "@/components/auth/FormShell";
import {
  loginAction,
  sendPhoneOtpAction,
  verifyOtpAndLoginAction,
  verifyAdminTwoFactorAction,
  confirmAdminTwoFactorSetupAction,
} from "@/actions/auth";
import type { ConfirmationResult } from "firebase/auth";
import {
  isFirebaseConfigured,
  createRecaptchaVerifier,
  clearRecaptchaVerifier,
  sendFirebaseOtp,
  confirmFirebaseOtp,
} from "@/lib/firebase";
import {
  CountryCodeSelector,
  SUPPORTED_COUNTRIES,
  CountryOption,
} from "@/components/ui/CountryCodeSelector";
import {
  KeyRound,
  Smartphone,
  Loader2,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  Eye,
  EyeOff,
  ShieldCheck,
  QrCode,
  Copy,
  Check,
  ArrowLeft,
} from "lucide-react";

export default function LoginPage() {
  const [loginMode, setLoginMode] = useState<"PASSWORD" | "OTP">("PASSWORD");

  // Password state
  const [showPassword, setShowPassword] = useState(false);
  const [pwdState, pwdFormAction, isPwdPending] = useActionState(loginAction, {
    success: false,
  });

  // 2FA verification state (Admin Google Authenticator)
  const [twoFactorState, twoFactorFormAction, isTwoFactorPending] = useActionState(
    verifyAdminTwoFactorAction,
    { success: false }
  );

  // 2FA setup state (Admin first-time configuration)
  const [setupState, setupFormAction, isSetupPending] = useActionState(
    confirmAdminTwoFactorSetupAction,
    { success: false }
  );

  const [useBackupCode, setUseBackupCode] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  const [resetToPassword, setResetToPassword] = useState(false);

  // Redirect on successful Admin 2FA verification (hard navigation guarantees session cookies are committed)
  useEffect(() => {
    if (twoFactorState?.success) {
      const target = (twoFactorState as any)?.data?.redirectTo || "/admin";
      window.location.href = target;
    }
  }, [twoFactorState]);

  // Redirect on successful Admin 2FA first-time setup
  useEffect(() => {
    if (setupState?.success) {
      const target = (setupState as any)?.data?.redirectTo || "/admin";
      window.location.href = target;
    }
  }, [setupState]);

  // OTP state
  const [selectedCountry, setSelectedCountry] = useState<CountryOption>(SUPPORTED_COUNTRIES[0]); // India (+91)
  const [otpPhone, setOtpPhone] = useState("");
  const [otpDigits, setOtpDigits] = useState<string[]>(["", "", "", "", "", ""]);
  const [otpSent, setOtpSent] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [otpBanner, setOtpBanner] = useState<{ message: string } | null>(null);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isShaking, setIsShaking] = useState(false);
  const [firebaseConfirmation, setFirebaseConfirmation] = useState<ConfirmationResult | null>(null);
  const [isVerifyingFirebase, setIsVerifyingFirebase] = useState(false);

  const digitRefs = useRef<(HTMLInputElement | null)[]>([]);
  const isSubmittingRef = useRef(false);

  // OTP form submission
  const [otpLoginState, otpLoginFormAction, isOtpLoginPending] = useActionState(
    verifyOtpAndLoginAction,
    { success: false },
  );

  // Automatically clear OTP inputs and shake when an error occurs
  useEffect(() => {
    if (otpLoginState?.error) {
      setIsVerifyingFirebase(false);
      setOtpDigits(["", "", "", "", "", ""]);
      setIsShaking(true);
      const timer = setTimeout(() => setIsShaking(false), 500);
      digitRefs.current[0]?.focus();
      return () => clearTimeout(timer);
    }
  }, [otpLoginState?.error]);

  // Resend countdown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const interval = setInterval(() => {
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [resendCooldown]);

  // Autofocus first OTP box when OTP section opens downward
  useEffect(() => {
    if (otpSent) {
      setTimeout(() => {
        digitRefs.current[0]?.focus();
      }, 100);
    }
  }, [otpSent]);

  // Clean up reCAPTCHA verifier on unmount
  useEffect(() => {
    return () => {
      clearRecaptchaVerifier("login-recaptcha-container");
    };
  }, []);

  // Calculate formatted full number for API & display
  const getFullPhoneNumber = () => {
    return formatInternationalE164(selectedCountry.dialCode, otpPhone);
  };

  const handleDigitChange = (index: number, val: string) => {
    const digit = val.replace(/\D/g, "").slice(-1);
    const nextDigits = [...otpDigits];
    nextDigits[index] = digit;
    setOtpDigits(nextDigits);

    if (digit && index < 5) {
      digitRefs.current[index + 1]?.focus();
    } else if (digit && index === 5) {
      const fullCode = nextDigits.join("");
      if (fullCode.length === 6) {
        digitRefs.current[5]?.blur();
        setTimeout(() => {
          handleOtpFormSubmit();
        }, 50);
      }
    }
  };

  const handleDigitKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      if (!otpDigits[index] && index > 0) {
        e.preventDefault();
        const nextDigits = [...otpDigits];
        nextDigits[index - 1] = "";
        setOtpDigits(nextDigits);
        digitRefs.current[index - 1]?.focus();
      } else {
        const nextDigits = [...otpDigits];
        nextDigits[index] = "";
        setOtpDigits(nextDigits);
      }
    } else if (e.key === "ArrowLeft" && index > 0) {
      e.preventDefault();
      digitRefs.current[index - 1]?.focus();
    } else if (e.key === "ArrowRight" && index < 5) {
      e.preventDefault();
      digitRefs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pasted) {
      const nextDigits = ["", "", "", "", "", ""];
      for (let i = 0; i < 6; i++) {
        nextDigits[i] = pasted[i] || "";
      }
      setOtpDigits(nextDigits);
      const focusIdx = Math.min(pasted.length, 5);
      digitRefs.current[focusIdx]?.focus();
      if (pasted.length === 6) {
        digitRefs.current[5]?.blur();
        setTimeout(() => {
          handleOtpFormSubmit();
        }, 50);
      }
    }
  };

  const handleSendOtp = async () => {
    if (isSendingOtp) return;
    setOtpError(null);
    setOtpBanner(null);

    const cleanDigits = otpPhone.replace(/\D/g, "");
    if (!cleanDigits) {
      setOtpError("Please enter your mobile phone number.");
      return;
    }

    const isIndianLike = selectedCountry.dialCode === "+91";
    const minDigits = isIndianLike ? 10 : 6;
    if (cleanDigits.length < minDigits) {
      setOtpError(
        isIndianLike
          ? "Please enter a valid 10-digit Indian mobile number."
          : `Please enter a valid phone number for ${selectedCountry.name}.`
      );
      return;
    }
    if (cleanDigits.length > 15) {
      setOtpError("Phone number is too long. Please check and try again.");
      return;
    }

    const fullNumber = getFullPhoneNumber();
    setIsSendingOtp(true);

    try {
      if (isFirebaseConfigured()) {
        const verifier = createRecaptchaVerifier("login-recaptcha-container");
        if (!verifier) {
          setOtpError("Failed to initialize security verification. Please refresh.");
          setIsSendingOtp(false);
          return;
        }

        // Run user database pre-check and Firebase SMS dispatch concurrently
        const [dbRes, fbRes] = await Promise.all([
          sendPhoneOtpAction(fullNumber, "LOGIN"),
          sendFirebaseOtp(fullNumber, verifier),
        ]);

        if (!dbRes.success) {
          setOtpError(dbRes.error || "Failed to dispatch verification code.");
          setIsSendingOtp(false);
          return;
        }

        if (!fbRes.success || !fbRes.confirmationResult) {
          setOtpError(fbRes.error || "Failed to dispatch SMS via Firebase.");
          setIsSendingOtp(false);
          return;
        }

        setFirebaseConfirmation(fbRes.confirmationResult);
      } else {
        const res = await sendPhoneOtpAction(fullNumber, "LOGIN");
        if (!res.success) {
          setOtpError(res.error || "Failed to dispatch verification code.");
          setIsSendingOtp(false);
          return;
        }
      }

      setOtpSent(true);
      setResendCooldown(30);
      setOtpBanner({
        message: `A 6-digit verification code has been dispatched to ${fullNumber}.`,
      });
    } catch (err: any) {
      setOtpError(err?.message || "Failed to dispatch verification code.");
    } finally {
      setIsSendingOtp(false);
    }
  };

  const handleOtpFormSubmit = async (e?: React.FormEvent<HTMLFormElement>) => {
    if (e) e.preventDefault();
    if (isSubmittingRef.current || isVerifyingFirebase || isOtpLoginPending) return;

    setOtpError(null);
    const code = otpDigits.join("");
    if (code.length !== 6) {
      setOtpError("Please enter the complete 6-digit verification code.");
      return;
    }

    isSubmittingRef.current = true;
    setIsVerifyingFirebase(true);

    try {
      let idToken: string | undefined = undefined;

      if (firebaseConfirmation) {
        const confirmRes = await confirmFirebaseOtp(firebaseConfirmation, code);
        if (!confirmRes.success || !confirmRes.idToken) {
          setIsVerifyingFirebase(false);
          isSubmittingRef.current = false;
          setOtpError(confirmRes.error || "Invalid verification code. Please check the 6-digit code sent to your phone.");
          setOtpDigits(["", "", "", "", "", ""]);
          setIsShaking(true);
          setTimeout(() => setIsShaking(false), 500);
          digitRefs.current[0]?.focus();
          return;
        }
        idToken = confirmRes.idToken;
      }

      const formData = new FormData();
      formData.append("phone", getFullPhoneNumber());
      formData.append("code", code);
      if (idToken) {
        formData.append("idToken", idToken);
      }

      startTransition(async () => {
        try {
          await otpLoginFormAction(formData);
        } finally {
          setIsVerifyingFirebase(false);
          isSubmittingRef.current = false;
        }
      });
    } catch (err: any) {
      setIsVerifyingFirebase(false);
      isSubmittingRef.current = false;
      setOtpError(err?.message || "Verification failed. Please try again.");
      setOtpDigits(["", "", "", "", "", ""]);
      setIsShaking(true);
      setTimeout(() => setIsShaking(false), 500);
      digitRefs.current[0]?.focus();
    }
  };

  const is2FAActive = Boolean(
    (pwdState?.data?.requires2FA || pwdState?.data?.requires2FASetup) && !resetToPassword
  );

  return (
    <FormShell>
      <header className="entry-form-header">
        <h1>
          {is2FAActive
            ? pwdState?.data?.requires2FASetup
              ? "Setup 2-Step Verification"
              : "Two-Step Verification"
            : "Welcome back"}
        </h1>
        <p>
          {is2FAActive
            ? pwdState?.data?.requires2FASetup
              ? "Scan the QR code to secure your administrator account."
              : "Enter your 6-digit Google Authenticator verification code."
            : "Sign in to continue your music journey."}
        </p>
      </header>

      {/* Mode Toggle Switch (Hidden during 2FA) */}
      {!is2FAActive && (
        <div className="entry-segmented" role="group" aria-label="Sign-in method">
          <button
            type="button"
            onClick={() => {
              setLoginMode("PASSWORD");
              setOtpError(null);
            }}
            aria-pressed={loginMode === "PASSWORD"}
          >
            <KeyRound className="w-3.5 h-3.5 text-primary" />
            <span>Password</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setLoginMode("OTP");
              setOtpError(null);
            }}
            aria-pressed={loginMode === "OTP"}
          >
            <Smartphone className="w-3.5 h-3.5 text-cta" />
            <span>Phone OTP</span>
          </button>
        </div>
      )}

      {/* ─── 2FA VERIFICATION (GOOGLE AUTHENTICATOR) ────────────────── */}
      {pwdState?.data?.requires2FA && !resetToPassword && (
        <div className="space-y-5 animate-fade-in">
          {twoFactorState?.error && (
            <div
              role="alert"
              className="flex items-start gap-2.5 rounded-xl border border-error/30 bg-error-muted/40 p-3.5 text-xs text-error font-medium animate-fade-in"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-error" />
              <span>{twoFactorState.error}</span>
            </div>
          )}

          {twoFactorState?.success && (
            <div
              role="status"
              className="flex items-center justify-center gap-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 text-xs text-emerald-800 font-medium animate-fade-in"
            >
              <Loader2 className="h-4 w-4 animate-spin text-emerald-600" />
              <span>{twoFactorState.message || "Two-step verification successful! Entering Admin Portal..."}</span>
            </div>
          )}

          <div className="rounded-2xl border border-border-default/80 bg-surface-subtle/50 p-4 text-center space-y-2">
            <div className="mx-auto w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-heading font-serif">Admin Two-Step Verification</h3>
              <p className="text-xs text-body mt-0.5">
                Enter the {useBackupCode ? "8-character emergency backup code" : "6-digit code from Google Authenticator"} for:
              </p>
              <span className="inline-block mt-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-primary/10 text-primary">
                {pwdState.data.email}
              </span>
            </div>
          </div>

          <form action={twoFactorFormAction} className="space-y-4">
            <input type="hidden" name="twoFactorToken" value={pwdState.data.twoFactorToken} />

            {!useBackupCode ? (
              <div>
                <label
                  htmlFor="totp-code"
                  className="block text-xs font-bold uppercase tracking-wider text-heading text-center mb-2"
                >
                  6-Digit Authenticator Code
                </label>
                <input
                  id="totp-code"
                  name="code"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={12}
                  required
                  autoFocus
                  disabled={isTwoFactorPending || twoFactorState?.success}
                  placeholder="000000"
                  className="block w-full rounded-xl border border-surface-muted/90 bg-white py-3 text-center text-2xl font-bold tracking-[0.4em] font-mono text-heading shadow-xs transition-all focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/15 disabled:opacity-60"
                />
                <p className="text-[11px] text-body-muted text-center mt-1.5">
                  Open Google Authenticator on your phone to get your current 6-digit code.
                </p>
              </div>
            ) : (
              <div>
                <label
                  htmlFor="backup-code"
                  className="block text-xs font-bold uppercase tracking-wider text-heading text-center mb-2"
                >
                  Emergency Backup Recovery Code
                </label>
                <input
                  id="backup-code"
                  name="code"
                  type="text"
                  autoComplete="off"
                  maxLength={16}
                  required
                  autoFocus
                  disabled={isTwoFactorPending || twoFactorState?.success}
                  placeholder="XXXX-XXXX"
                  className="block w-full rounded-xl border border-surface-muted/90 bg-white py-3 text-center text-lg font-bold tracking-widest font-mono uppercase text-heading shadow-xs transition-all focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/15 disabled:opacity-60"
                />
                <p className="text-[11px] text-body-muted text-center mt-1.5">
                  Enter one of your 8-character single-use emergency backup codes.
                </p>
              </div>
            )}

            <button
              type="submit"
              disabled={isTwoFactorPending || twoFactorState?.success}
              className="btn-tactile flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-bold text-white shadow-md shadow-primary/20 transition-all hover:bg-primary-hover active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
            >
              {isTwoFactorPending || twoFactorState?.success ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin text-white" />
                  <span>{twoFactorState?.success ? "Entering Admin Portal..." : "Verifying Code..."}</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>Verify &amp; Enter Admin Portal</span>
                </>
              )}
            </button>

            <div className="flex items-center justify-between text-xs pt-1">
              <button
                type="button"
                onClick={() => setUseBackupCode(!useBackupCode)}
                disabled={isTwoFactorPending || twoFactorState?.success}
                className="font-semibold text-cta hover:text-cta-hover transition-colors cursor-pointer disabled:opacity-50"
              >
                {useBackupCode ? "Use Authenticator app code" : "Lost phone? Use backup recovery code"}
              </button>

              <button
                type="button"
                onClick={() => setResetToPassword(true)}
                disabled={isTwoFactorPending || twoFactorState?.success}
                className="font-medium text-body-muted hover:text-heading transition-colors cursor-pointer disabled:opacity-50"
              >
                &larr; Back to login
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ─── 2FA SETUP (FIRST-TIME GOOGLE AUTHENTICATOR SETUP) ──────── */}
      {pwdState?.data?.requires2FASetup && !resetToPassword && (
        <div className="space-y-5 animate-fade-in">
          {setupState?.error && (
            <div
              role="alert"
              className="flex items-start gap-2.5 rounded-xl border border-error/30 bg-error-muted/40 p-3.5 text-xs text-error font-medium animate-fade-in"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-error" />
              <span>{setupState.error}</span>
            </div>
          )}

          {setupState?.success && (
            <div
              role="status"
              className="flex items-center justify-center gap-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 text-xs text-emerald-800 font-medium animate-fade-in"
            >
              <Loader2 className="h-4 w-4 animate-spin text-emerald-600" />
              <span>{setupState.message || "Google Authenticator configured! Entering Admin Portal..."}</span>
            </div>
          )}

          <div className="rounded-2xl border border-border-default/80 bg-surface-subtle/50 p-4 text-center space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-accent-dark">
              Security Activation Required
            </span>
            <h3 className="text-base font-bold text-heading font-serif">
              Link Google Authenticator
            </h3>
            <p className="text-xs text-body leading-relaxed">
              Scan this QR code with <strong>Google Authenticator</strong> (or Microsoft Authenticator / 1Password) on your mobile device.
            </p>
          </div>

          {/* QR Code Card */}
          <div className="p-4 bg-white rounded-2xl border border-border-default flex flex-col items-center justify-center shadow-xs">
            {pwdState.data.qrCodeDataUrl ? (
              <img
                src={pwdState.data.qrCodeDataUrl}
                alt="Google Authenticator QR Code"
                width={180}
                height={180}
                className="rounded-xl border border-border-subtle shadow-2xs"
              />
            ) : (
              <div className="w-[180px] h-[180px] bg-slate-100 rounded-xl flex items-center justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            )}

            <div className="mt-3 w-full">
              <p className="text-[11px] text-body-muted text-center font-medium mb-1">
                Or enter this setup key manually:
              </p>
              <div className="flex items-center justify-between p-2 rounded-xl bg-surface-subtle border border-border-subtle font-mono text-xs text-heading">
                <span className="tracking-widest font-bold select-all text-[11px]">
                  {pwdState.data.formattedSecret}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    if (pwdState.data?.formattedSecret) {
                      navigator.clipboard.writeText(pwdState.data.formattedSecret.replace(/\s/g, ""));
                      setCopiedKey(true);
                      setTimeout(() => setCopiedKey(false), 2000);
                    }
                  }}
                  className="p-1.5 rounded-lg hover:bg-white text-body hover:text-heading transition-colors cursor-pointer"
                  title="Copy secret key"
                >
                  {copiedKey ? (
                    <Check className="w-3.5 h-3.5 text-success" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Setup Confirmation Form */}
          <form action={setupFormAction} className="space-y-4">
            <input type="hidden" name="twoFactorToken" value={pwdState.data.twoFactorToken} />

            <div>
              <label
                htmlFor="setup-code"
                className="block text-xs font-bold uppercase tracking-wider text-heading text-center mb-1.5"
              >
                Enter 6-Digit Code Shown in App
              </label>
              <input
                id="setup-code"
                name="code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={12}
                required
                autoFocus
                disabled={isSetupPending || setupState?.success}
                placeholder="000000"
                className="block w-full rounded-xl border border-surface-muted/90 bg-white py-3 text-center text-2xl font-bold tracking-[0.4em] font-mono text-heading shadow-xs transition-all focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/15 disabled:opacity-60"
              />
              <p className="text-[11px] text-body-muted text-center mt-1">
                Verify the code to link your authenticator app and enter the admin portal.
              </p>
            </div>

            <button
              type="submit"
              disabled={isSetupPending || setupState?.success}
              className="btn-tactile flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-bold text-white shadow-md shadow-primary/20 transition-all hover:bg-primary-hover active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
            >
              {isSetupPending || setupState?.success ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin text-white" />
                  <span>{setupState?.success ? "Entering Admin Portal..." : "Activating &amp; Entering..."}</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>Activate 2FA &amp; Sign In</span>
                </>
              )}
            </button>

            <div className="text-center pt-1">
              <button
                type="button"
                onClick={() => setResetToPassword(true)}
                disabled={isSetupPending || setupState?.success}
                className="text-xs font-medium text-body-muted hover:text-heading transition-colors cursor-pointer disabled:opacity-50"
              >
                &larr; Cancel and return to login
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ─── TAB 1: PASSWORD LOGIN (Standard) ────────────────────────── */}
      {loginMode === "PASSWORD" && !is2FAActive && (
        <div className="space-y-5">
            {pwdState?.error && (
              <div
                role="alert"
                className="flex items-start gap-2.5 rounded-xl border border-error/30 bg-error-muted/40 p-3.5 text-xs text-error font-medium animate-fade-in"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-error" />
                <span>{pwdState.error}</span>
              </div>
            )}

            <form action={pwdFormAction} onSubmit={() => setResetToPassword(false)} className="space-y-4">
              <div>
                <label
                  htmlFor="identifier"
                  className="block text-xs font-bold uppercase tracking-wider text-heading mb-1.5"
                >
                  Email or Mobile Phone
                </label>
                <input
                  id="identifier"
                  name="identifier"
                  type="text"
                  autoComplete="username"
                  required
                  placeholder="Email address or phone number"
                  className="block w-full rounded-xl border border-surface-muted/90 bg-white px-3.5 py-2.5 text-sm text-heading placeholder-body/40 shadow-xs transition-all focus:border-cta focus:outline-none focus:ring-4 focus:ring-cta/15"
                />
                {pwdState?.fieldErrors?.identifier && (
                  <p className="mt-1.5 text-xs font-medium text-error flex items-center gap-1">
                    <span>•</span>
                    {pwdState.fieldErrors.identifier[0]}
                  </p>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label
                    htmlFor="password"
                    className="block text-xs font-bold uppercase tracking-wider text-heading"
                  >
                    Password
                  </label>
                  <Link
                    href="/forgot-password"
                    className="text-xs font-semibold text-cta hover:text-cta-hover transition-colors"
                  >
                    Forgot password?
                  </Link>
                </div>
                <div className="relative">
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    required
                    placeholder="••••••••"
                    className="block w-full rounded-xl border border-surface-muted/90 bg-white px-3.5 py-2.5 pr-11 text-sm text-heading placeholder-body/40 shadow-xs transition-all focus:border-cta focus:outline-none focus:ring-4 focus:ring-cta/15"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-body/50 hover:text-heading hover:bg-surface-subtle transition-all active:scale-95 cursor-pointer"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    title={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4 text-heading/70" />
                    ) : (
                      <Eye className="w-4 h-4 text-body/60" />
                    )}
                  </button>
                </div>
                {pwdState?.fieldErrors?.password && (
                  <p className="mt-1.5 text-xs font-medium text-error flex items-center gap-1">
                    <span>•</span>
                    {pwdState.fieldErrors.password[0]}
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={isPwdPending}
                className="btn-tactile flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-bold text-white shadow-md shadow-primary/20 transition-all hover:bg-primary-hover active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
              >
                {isPwdPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin text-white" />
                    <span>Signing in...</span>
                  </>
                ) : (
                  <>
                    <span>Sign in</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          </div>
        )}

        {/* ─── TAB 2: OTP LOGIN ─────────────────────────────────────────── */}
        {loginMode === "OTP" && (
          <div className="space-y-4 animate-fade-in">
            {/* Global Error Alerts */}
            {otpError && (
              <div
                role="alert"
                className="flex items-start gap-2.5 rounded-xl border border-error/30 bg-error-muted/40 p-3.5 text-xs text-error font-medium animate-fade-in"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-error" />
                <span>{otpError}</span>
              </div>
            )}

            {otpLoginState?.error && (
              <div
                role="alert"
                className="flex items-start gap-2.5 rounded-xl border border-error/30 bg-error-muted/40 p-3.5 text-xs text-error font-medium animate-fade-in"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-error" />
                <span>{otpLoginState.error}</span>
              </div>
            )}

            {/* Mobile Phone Number Input Container */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label
                  htmlFor="phone"
                  className="block text-xs font-bold uppercase tracking-wider text-heading"
                >
                  Mobile Phone Number
                </label>
                {otpSent && (
                  <button
                    type="button"
                    onClick={() => {
                      setOtpSent(false);
                      setOtpDigits(["", "", "", "", "", ""]);
                      setOtpError(null);
                    }}
                    className="text-[11px] font-semibold text-blue-600 hover:underline cursor-pointer"
                  >
                    Change number
                  </button>
                )}
              </div>

              {/* Country Code Selector + Phone Input Container (Matching Attached Screenshot) */}
              <div className="entry-phone flex items-center rounded-xl border border-surface-muted/90 bg-white shadow-xs transition-all focus-within:border-cta focus-within:ring-4 focus-within:ring-cta/15">
                <CountryCodeSelector
                  showDialCodeInButton
                  selectedCountry={selectedCountry}
                  onSelect={(country) => {
                    setSelectedCountry(country);
                    setOtpError(null);
                  }}
                />
                <div className="h-6 w-px bg-border-default/80 shrink-0" />
                <input
                  id="phone"
                  name="phone"
                  type="tel"
                  autoComplete="tel-national"
                  inputMode="tel"
                  value={otpPhone}
                  onChange={(e) => {
                    setOtpPhone(e.target.value);
                    setOtpError(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !otpSent) {
                      e.preventDefault();
                      handleSendOtp();
                    }
                  }}
                  placeholder="Enter a phone number"
                  required
                  className="block flex-1 border-0 bg-transparent px-3.5 py-2.5 text-sm text-heading placeholder-body/40 focus:outline-none focus:ring-0"
                />
              </div>
              <p className="mt-1 text-[11px] text-body-muted">
                Includes country code: <strong className="font-mono text-heading">{selectedCountry.dialCode}</strong> ({selectedCountry.name})
              </p>
            </div>

            {/* State A: Before OTP is sent -> "Get OTP" Button */}
            {!otpSent && (
              <button
                type="button"
                disabled={isSendingOtp || !otpPhone.trim()}
                onClick={handleSendOtp}
                className="entry-primary w-full relative overflow-hidden transition-all duration-200"
              >
                {isSendingOtp ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    <span>Sending OTP code...</span>
                  </span>
                ) : (
                  <span>Get OTP</span>
                )}
              </button>
            )}

            {/* State B: After OTP is sent -> Opens DOWNWARD inline matching the user's screenshot */}
            {otpSent && (
              <div className="space-y-4 pt-1 animate-fade-in">
                {/* OTP confirmation banner - Dev Test Code completely removed */}
                {otpBanner && (
                  <div className="rounded-xl border border-accent/40 bg-accent-subtle/50 p-2.5 space-y-1 text-xs">
                    <div className="flex items-center gap-1.5 text-accent-dark font-bold text-[11px]">
                      <CheckCircle2 className="w-3.5 h-3.5 text-accent-dark" />
                      <span>{otpBanner.message}</span>
                    </div>
                  </div>
                )}

                {/* Verification Form */}
                <form action={otpLoginFormAction} onSubmit={handleOtpFormSubmit} className="space-y-4">
                  <input type="hidden" name="phone" value={getFullPhoneNumber()} />
                  <input type="hidden" name="code" value={otpDigits.join("")} />

                  <div>
                    {/* Header Label: OTP */}
                    <label className="block text-sm font-bold text-heading mb-2">
                      OTP
                    </label>

                    {/* 6 Individual Digit Input Boxes (Matching screenshot) */}
                    <div
                      className={`entry-otp-digits transition-all duration-200 ${isShaking ? "animate-shake ring-2 ring-error/50 rounded-xl" : ""}`}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(6, minmax(0, 1fr))",
                        gap: "8px",
                        width: "100%",
                      }}
                    >
                      {otpDigits.map((digit, index) => (
                        <input
                          key={index}
                          aria-label={`Verification code digit ${index + 1}`}
                          ref={(el) => {
                            digitRefs.current[index] = el;
                          }}
                          type="text"
                          autoComplete="one-time-code"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          maxLength={1}
                          value={digit}
                          disabled={isVerifyingFirebase || isOtpLoginPending}
                          onChange={(e) => handleDigitChange(index, e.target.value)}
                          onKeyDown={(e) => handleDigitKeyDown(index, e)}
                          onPaste={handlePaste}
                          className="otp-digit-input h-12 sm:h-14 w-full rounded-lg sm:rounded-xl border border-gray-300 bg-white text-center text-xl sm:text-2xl font-mono font-bold text-heading shadow-xs transition-all focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none disabled:bg-gray-100 disabled:opacity-75"
                          style={{
                            height: "52px",
                            textAlign: "center",
                          }}
                        />
                      ))}
                    </div>

                    {otpLoginState?.fieldErrors?.code && (
                      <p className="mt-1.5 text-xs font-medium text-error">
                        {otpLoginState.fieldErrors.code[0]}
                      </p>
                    )}
                  </div>

                  {/* Did not receive OTP? Resend OTP (27s) */}
                  <div className="flex items-center gap-1.5 text-xs sm:text-sm">
                    <span className="font-semibold text-heading">
                      Did not receive OTP?
                    </span>
                    {resendCooldown > 0 ? (
                      <span className="text-body-muted flex items-center gap-1">
                        <span className="text-blue-500 font-medium">Resend OTP</span>
                        <span className="text-body-muted font-normal">
                          ({resendCooldown}s)
                        </span>
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={handleSendOtp}
                        disabled={isSendingOtp}
                        className="text-blue-600 font-semibold hover:underline cursor-pointer transition-colors"
                      >
                        {isSendingOtp ? "Sending..." : "Resend OTP"}
                      </button>
                    )}
                  </div>

                  {/* Golden / Amber "Login" Button matching user's reference image */}
                  <button
                    type="submit"
                    disabled={isOtpLoginPending || isVerifyingFirebase || otpDigits.join("").length !== 6}
                    className="entry-primary w-full transition-all duration-200"
                  >
                    {isOtpLoginPending || isVerifyingFirebase ? (
                      <span className="flex items-center justify-center gap-2">
                        <Loader2 className="w-5 h-5 animate-spin text-white" />
                        <span>Verifying &amp; Logging in...</span>
                      </span>
                    ) : (
                      <span>Login</span>
                    )}
                  </button>
                </form>
              </div>
            )}
          </div>
        )}

        {/* Footer link */}
        <p className="entry-form-footer">
          Don&apos;t have an account yet?{" "}
          <Link
            href="/signup"
            className="font-bold text-cta hover:text-cta-hover transition-colors"
          >
            Create an account
          </Link>
        </p>
    </FormShell>
  );
}
