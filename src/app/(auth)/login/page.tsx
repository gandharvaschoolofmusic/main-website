"use client";

import { useActionState, useState, useTransition, useEffect, useRef } from "react";
import Link from "next/link";
import { FormShell } from "@/components/auth/FormShell";
import { loginAction, sendPhoneOtpAction, verifyOtpAndLoginAction } from "@/actions/auth";
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
} from "lucide-react";

export default function LoginPage() {
  const [loginMode, setLoginMode] = useState<"PASSWORD" | "OTP">("PASSWORD");

  // Password state
  const [showPassword, setShowPassword] = useState(false);
  const [pwdState, pwdFormAction, isPwdPending] = useActionState(loginAction, {
    success: false,
  });

  // OTP state
  const [selectedCountry, setSelectedCountry] = useState<CountryOption>(SUPPORTED_COUNTRIES[0]); // India (+91)
  const [otpPhone, setOtpPhone] = useState("");
  const [otpDigits, setOtpDigits] = useState<string[]>(["", "", "", "", "", ""]);
  const [otpSent, setOtpSent] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [otpBanner, setOtpBanner] = useState<{ message: string; previewCode?: string } | null>(null);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [isSendingOtp, startSendOtpTransition] = useTransition();

  const digitRefs = useRef<(HTMLInputElement | null)[]>([]);

  // OTP form submission
  const [otpLoginState, otpLoginFormAction, isOtpLoginPending] = useActionState(
    verifyOtpAndLoginAction,
    { success: false },
  );

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

  // Calculate formatted full number for API & display
  const getFullPhoneNumber = () => {
    const rawInput = otpPhone.trim();
    if (rawInput.startsWith("+")) {
      return rawInput;
    }
    const cleanDigits = rawInput.replace(/\D/g, "");
    return `${selectedCountry.dialCode}${cleanDigits}`;
  };

  const handleDigitChange = (index: number, val: string) => {
    const digit = val.replace(/\D/g, "").slice(-1);
    const nextDigits = [...otpDigits];
    nextDigits[index] = digit;
    setOtpDigits(nextDigits);

    if (digit && index < 5) {
      digitRefs.current[index + 1]?.focus();
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
    }
  };

  const handleSendOtp = () => {
    setOtpError(null);
    setOtpBanner(null);

    const cleanDigits = otpPhone.replace(/\D/g, "");
    if (!cleanDigits) {
      setOtpError("Please enter your mobile phone number.");
      return;
    }

    if (cleanDigits.length < 6) {
      setOtpError("Please enter a valid phone number.");
      return;
    }

    const fullNumber = getFullPhoneNumber();

    startSendOtpTransition(async () => {
      const res = await sendPhoneOtpAction(fullNumber, "LOGIN");
      if (!res.success) {
        setOtpError(res.error || "Failed to dispatch verification code.");
      } else {
        setOtpSent(true);
        setResendCooldown(30);
        setOtpBanner({
          message: res.message || "OTP code sent to your phone.",
          previewCode: res.data?.previewCode,
        });
      }
    });
  };

  const handleAutoFillCode = (code: string) => {
    const digits = code.replace(/\D/g, "").slice(0, 6).split("");
    const nextDigits = ["", "", "", "", "", ""];
    digits.forEach((d, i) => {
      nextDigits[i] = d;
    });
    setOtpDigits(nextDigits);
    digitRefs.current[5]?.focus();
  };

  return (
    <FormShell>
      <header className="entry-form-header">
        <h1>Welcome back</h1>
        <p>Sign in to continue your music journey.</p>
      </header>
        {/* Mode Toggle Switch */}
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

        {/* ─── TAB 1: PASSWORD LOGIN ────────────────────────────────────── */}
        {loginMode === "PASSWORD" && (
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

            <form action={pwdFormAction} className="space-y-4">
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
                className="entry-primary w-full"
              >
                {isSendingOtp ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-amber-950" />
                    <span>Sending OTP code...</span>
                  </>
                ) : (
                  <span>Get OTP</span>
                )}
              </button>
            )}

            {/* State B: After OTP is sent -> Opens DOWNWARD inline matching the user's screenshot */}
            {otpSent && (
              <div className="space-y-4 pt-1 animate-fade-in">
                {/* Dev mode OTP preview banner */}
                {otpBanner && (
                  <div className="rounded-xl border border-accent/40 bg-accent-subtle/50 p-2.5 space-y-1 text-xs">
                    <div className="flex items-center gap-1.5 text-accent-dark font-bold text-[11px]">
                      <CheckCircle2 className="w-3.5 h-3.5 text-accent-dark" />
                      <span>{otpBanner.message}</span>
                    </div>
                    {otpBanner.previewCode && (
                      <div className="flex items-center justify-between pt-1 border-t border-accent/20">
                        <span className="text-[10px] text-body">
                          [Dev Test Code]: <strong className="font-mono text-heading">{otpBanner.previewCode}</strong>
                        </span>
                        <button
                          type="button"
                          onClick={() => handleAutoFillCode(otpBanner.previewCode!)}
                          className="px-2 py-0.5 rounded-md bg-white border border-accent/40 text-[10px] font-bold text-accent-dark hover:bg-neutral-50 transition-colors cursor-pointer"
                        >
                          Auto-fill
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Verification Form */}
                <form action={otpLoginFormAction} className="space-y-4">
                  <input type="hidden" name="phone" value={getFullPhoneNumber()} />
                  <input type="hidden" name="code" value={otpDigits.join("")} />

                  <div>
                    {/* Header Label: OTP */}
                    <label className="block text-sm font-bold text-heading mb-2">
                      OTP
                    </label>

                    {/* 6 Individual Digit Input Boxes (Matching screenshot) */}
                    <div
                      className="entry-otp-digits"
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
                          onChange={(e) => handleDigitChange(index, e.target.value)}
                          onKeyDown={(e) => handleDigitKeyDown(index, e)}
                          onPaste={handlePaste}
                          className="otp-digit-input h-12 sm:h-14 w-full rounded-lg sm:rounded-xl border border-gray-300 bg-white text-center text-xl sm:text-2xl font-mono font-bold text-heading shadow-xs transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
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
                    disabled={isOtpLoginPending || otpDigits.join("").length !== 6}
                    className="entry-primary w-full"
                  >
                    {isOtpLoginPending ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin text-[#1E1A4D]" />
                        <span>Logging in...</span>
                      </>
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
