"use client";

import { useActionState, useEffect, useState, useTransition, useRef } from "react";
import Link from "next/link";
import { formatInternationalE164 } from "@/lib/phone-utils";
import { FormShell } from "@/components/auth/FormShell";
import { signupAction, sendPhoneOtpAction, verifyPhoneOtpForSignupAction } from "@/actions/auth";
import type { ConfirmationResult } from "firebase/auth";
import {
  isFirebaseConfigured,
  createRecaptchaVerifier,
  clearRecaptchaVerifier,
  sendFirebaseOtp,
  confirmFirebaseOtp,
} from "@/lib/firebase";
import { SplitHeading } from "@/components/ui/SplitHeading";
import {
  CountryCodeSelector,
  SUPPORTED_COUNTRIES,
  CountryOption,
} from "@/components/ui/CountryCodeSelector";
import {
  Smartphone,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ShieldCheck,
  ArrowRight,
  Music,
  Plus,
  X,
  Check,
  Clock,
  Award,
  Eye,
  EyeOff,
} from "lucide-react";
import { INSTRUMENTS } from "@/types";

export default function SignupPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [detectedTz, setDetectedTz] = useState("UTC");
  const [selectedRole, setSelectedRole] = useState<"STUDENT" | "TEACHER">("STUDENT");

  // Country code state
  const [selectedCountry, setSelectedCountry] = useState<CountryOption>(SUPPORTED_COUNTRIES[0]); // India (+91)

  // Teacher credentials state
  const [selectedInstruments, setSelectedInstruments] = useState<string[]>(["Piano"]);
  const [instrumentFilter, setInstrumentFilter] = useState("");
  const [experience, setExperience] = useState<number | string>(5);

  const handleToggleInstrument = (inst: string) => {
    setSelectedInstruments((prev) =>
      prev.includes(inst) ? prev.filter((i) => i !== inst) : [...prev, inst]
    );
  };

  const handleRemoveInstrument = (inst: string) => {
    setSelectedInstruments((prev) => prev.filter((i) => i !== inst));
  };

  const handleAddCustomInstrument = () => {
    const trimmed = instrumentFilter.trim();
    if (trimmed && !selectedInstruments.includes(trimmed)) {
      setSelectedInstruments((prev) => [...prev, trimmed]);
      setInstrumentFilter("");
    }
  };

  const filteredInstruments = INSTRUMENTS.filter((inst) =>
    inst.toLowerCase().includes(instrumentFilter.toLowerCase().trim())
  );

  // Phone OTP verification state
  const [rawPhoneNumber, setRawPhoneNumber] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [isPhoneVerified, setIsPhoneVerified] = useState(false);
  const [verifiedOtpCode, setVerifiedOtpCode] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);
  const [otpBanner, setOtpBanner] = useState<{ message: string } | null>(null);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [firebaseConfirmation, setFirebaseConfirmation] = useState<ConfirmationResult | null>(null);
  const [firebaseIdToken, setFirebaseIdToken] = useState<string>("");

  const [isSendingOtp, startSendOtpTransition] = useTransition();
  const [isVerifyingOtp, startVerifyOtpTransition] = useTransition();

  const otpInputRef = useRef<HTMLInputElement>(null);

  // Compute normalized full phone number
  const getFullPhoneNumber = () => {
    return formatInternationalE164(selectedCountry.dialCode, rawPhoneNumber);
  };

  useEffect(() => {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      // Detect the browser timezone after hydration so server markup stays stable.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (tz) setDetectedTz(tz);
    } catch {
      // Fallback to UTC
    }
  }, []);

  // Cooldown countdown for OTP resend
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  // Focus OTP box when sent
  useEffect(() => {
    if (otpSent && !isPhoneVerified) {
      setTimeout(() => {
        otpInputRef.current?.focus();
      }, 100);
    }
  }, [otpSent, isPhoneVerified]);

  const [state, formAction, isPending] = useActionState(signupAction, {
    success: false,
  });

  // Clean up reCAPTCHA verifier on unmount
  useEffect(() => {
    return () => {
      clearRecaptchaVerifier("signup-recaptcha-container");
    };
  }, []);

  const handleSendOtp = () => {
    setPhoneError(null);
    setOtpError(null);
    setOtpBanner(null);

    const cleanDigits = rawPhoneNumber.replace(/\D/g, "");
    if (!cleanDigits) {
      setPhoneError("Please enter your mobile phone number.");
      return;
    }
    if (cleanDigits.length < 6) {
      setPhoneError("Please enter a valid phone number.");
      return;
    }

    const fullPhone = getFullPhoneNumber();

    startSendOtpTransition(async () => {
      try {
        if (isFirebaseConfigured()) {
          const verifier = createRecaptchaVerifier("signup-recaptcha-container");
          if (!verifier) {
            setPhoneError("Failed to initialize security verification. Please refresh.");
            return;
          }

          const [dbRes, fbRes] = await Promise.all([
            sendPhoneOtpAction(fullPhone, "SIGNUP"),
            sendFirebaseOtp(fullPhone, verifier),
          ]);

          if (!dbRes.success) {
            setPhoneError(dbRes.error || "Failed to dispatch verification code.");
            return;
          }

          if (!fbRes.success || !fbRes.confirmationResult) {
            setPhoneError(fbRes.error || "Failed to dispatch SMS via Firebase.");
            return;
          }

          setFirebaseConfirmation(fbRes.confirmationResult);
        } else {
          const res = await sendPhoneOtpAction(fullPhone, "SIGNUP");
          if (!res.success) {
            setPhoneError(res.error || "Failed to dispatch verification code.");
            return;
          }
        }

        setOtpSent(true);
        setResendCooldown(30);
        setOtpBanner({
          message: `A 6-digit verification code has been dispatched to ${fullPhone}.`,
        });
      } catch (err: any) {
        setPhoneError(err?.message || "Failed to dispatch verification code.");
      }
    });
  };

  // Handle Verify OTP
  const handleVerifyOtp = (codeOverride?: string) => {
    setOtpError(null);
    const trimmedCode = (codeOverride || otpCode).trim();

    if (trimmedCode.length !== 6) {
      setOtpError("Please enter the complete 6-digit OTP code.");
      return;
    }

    const fullPhone = getFullPhoneNumber();

    startVerifyOtpTransition(async () => {
      let idTokenToPass: string | undefined = undefined;

      if (firebaseConfirmation) {
        const confirmRes = await confirmFirebaseOtp(firebaseConfirmation, trimmedCode);
        if (!confirmRes.success || !confirmRes.idToken) {
          setOtpError(confirmRes.error || "Invalid verification code.");
          setOtpCode("");
          otpInputRef.current?.focus();
          return;
        }
        idTokenToPass = confirmRes.idToken;
        setFirebaseIdToken(confirmRes.idToken);
      }

      const res = await verifyPhoneOtpForSignupAction(fullPhone, trimmedCode, idTokenToPass);
      if (!res.success) {
        setOtpError(res.error || "Invalid or expired OTP code.");
        setOtpCode("");
        otpInputRef.current?.focus();
      } else {
        setIsPhoneVerified(true);
        setVerifiedOtpCode(trimmedCode);
        setOtpBanner(null);
      }
    });
  };

  const handleChangePhone = () => {
    clearRecaptchaVerifier("signup-recaptcha-container");
    setIsPhoneVerified(false);
    setOtpSent(false);
    setOtpCode("");
    setVerifiedOtpCode("");
    setFirebaseConfirmation(null);
    setFirebaseIdToken("");
    setOtpBanner(null);
    setPhoneError(null);
    setOtpError(null);
  };

  // SUCCESS SCREEN
  if (state?.success) {
    return (
      <FormShell variant={selectedRole === "TEACHER" ? "teacher" : "student"}>
        <div className="space-y-6">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 shadow-sm border border-emerald-200">
              <CheckCircle2 className="h-8 w-8 text-emerald-600" />
            </div>

            <SplitHeading
              as="h2"
              firstClause={selectedRole === "TEACHER" ? "Application" : "Check Your"}
              accentClause={selectedRole === "TEACHER" ? "Submitted" : "Inbox"}
              align="center"
              size="md"
            />

            <p className="text-sm text-body leading-relaxed">
              {selectedRole === "TEACHER" ? (
                <>
                  Your mobile phone has been verified! A verification link was also sent to{" "}
                  <span className="font-bold text-heading">
                    {state.data?.email}
                  </span>
                  . Your faculty application is now awaiting administrative review by the Academic Board.
                  You can sign in now to set up your pedagogical bio, instrument disciplines, and weekly schedule while awaiting approval.
                </>
              ) : (
                <>
                  Your mobile number has been verified! We also sent an email verification link to{" "}
                  <span className="font-bold text-heading">
                    {state.data?.email}
                  </span>
                  . Please verify your email to activate full lesson booking and trial scheduling.
                </>
              )}
            </p>

            <div className="pt-2">
              <Link
                href="/login"
                className="btn-tactile inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-bold text-white shadow-md shadow-primary/20 transition-all hover:bg-primary-hover active:scale-[0.98] cursor-pointer"
              >
                <span>Proceed to Sign In</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
        </div>
      </FormShell>
    );
  }

  // MAIN SIGNUP FORM
  return (
    <FormShell variant={selectedRole === "TEACHER" ? "teacher" : "student"}>
      <header className="entry-form-header">
        <h1>{selectedRole === "TEACHER" ? "Become a teacher" : "Create your account"}</h1>
        <p>{selectedRole === "TEACHER" ? "Tell us about your experience and apply to teach." : "Your first step towards a lifetime of music."}</p>
      </header>
          {/* Global Error Alert */}
          {state?.error && (
            <div
              role="alert"
              className="flex items-start gap-2.5 rounded-xl border border-error/30 bg-error-muted/40 p-3.5 text-xs text-error font-medium"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-error" />
              <span>{state.error}</span>
            </div>
          )}

          <form action={formAction} className="space-y-5">
            {/* Role selector */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-heading mb-2">
                I am joining as a
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedRole("STUDENT")}
                  className="entry-role flex flex-col items-start text-left" aria-pressed={selectedRole === "STUDENT"}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`h-2.5 w-2.5 rounded-full ${
                        selectedRole === "STUDENT" ? "bg-cta" : "bg-surface-muted"
                      }`}
                    />
                    <span className="text-xs sm:text-sm font-bold text-heading">Student</span>
                  </div>
                  <span className="mt-1 text-[11px] text-body leading-snug">
                    Learn music from certified maestros
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedRole("TEACHER")}
                  className="entry-role flex flex-col items-start text-left" aria-pressed={selectedRole === "TEACHER"}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`h-2.5 w-2.5 rounded-full ${
                        selectedRole === "TEACHER" ? "bg-cta" : "bg-surface-muted"
                      }`}
                    />
                    <span className="text-xs sm:text-sm font-bold text-heading">Teacher</span>
                  </div>
                  <span className="mt-1 text-[11px] text-body leading-snug">
                    Teach, manage schedule & earn payouts
                  </span>
                </button>
              </div>
              <input type="hidden" name="role" value={selectedRole} />

            </div>

            {/* TEACHER CREDENTIALS & TEACHING PROFILE */}
            {selectedRole === "TEACHER" && (
              <div className="entry-teacher-profile space-y-4">
                <div className="flex items-center justify-between border-b border-border-subtle/70 pb-3">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Award className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <h3 className="entry-verification-title">
                        Faculty Credentials & Disciplines
                      </h3>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider bg-accent-subtle text-accent-dark border border-accent/30">
                    Required
                  </span>
                </div>

                {/* 1. Instruments Selection */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold uppercase tracking-wider text-heading flex items-center gap-1.5">
                      <Music className="w-3.5 h-3.5 text-cta" />
                      <span>Disciplines & Instruments Taught</span>
                    </label>
                    <span className="text-[11px] font-semibold text-body-muted">
                      {selectedInstruments.length} selected
                    </span>
                  </div>

                  {/* Selected Instruments Active Badges */}
                  {selectedInstruments.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5 p-2 rounded-xl bg-white border border-border-subtle shadow-xs">
                      {selectedInstruments.map((inst) => (
                        <span
                          key={inst}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-primary text-white shadow-xs"
                        >
                          <span>{inst}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveInstrument(inst)}
                            aria-label={`Remove ${inst}`}
                            className="hover:bg-primary-hover rounded p-0.5 transition-colors cursor-pointer"
                          >
                            <X className="w-3 h-3 text-white/80 hover:text-white" />
                          </button>
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2">
                      Please select at least one instrument from below or add a custom one.
                    </p>
                  )}

                  {/* Instrument Search & Custom Add */}
                  <div className="space-y-2">
                    <div className="relative flex items-center">
                      <input
                        type="text"
                        value={instrumentFilter}
                        onChange={(e) => setInstrumentFilter(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleAddCustomInstrument();
                          }
                        }}
                        placeholder="Search or add a discipline" aria-label="Search or add a discipline"
                        className="block w-full rounded-xl border border-surface-muted/90 bg-white px-3 py-2 text-xs text-heading placeholder-body/50 shadow-xs focus:border-cta focus:outline-none focus:ring-3 focus:ring-cta/15"
                      />
                      {instrumentFilter.trim() &&
                        !INSTRUMENTS.some(
                          (i) => i.toLowerCase() === instrumentFilter.trim().toLowerCase()
                        ) && (
                          <button
                            type="button"
                            onClick={handleAddCustomInstrument}
                            className="btn-tactile absolute right-1.5 top-1.5 bottom-1.5 px-2.5 rounded-lg bg-cta text-white text-[11px] font-bold flex items-center gap-1 cursor-pointer hover:bg-cta-hover active:scale-[0.98]"
                          >
                            <Plus className="w-3 h-3" />
                            <span>Add</span>
                          </button>
                        )}
                    </div>

                    {/* Quick select pills from standard catalogue */}
                    <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-2 rounded-xl bg-bg-alt/25 border border-border-subtle/80">
                      {filteredInstruments.map((inst) => {
                        const isSelected = selectedInstruments.includes(inst);
                        return (
                          <button
                            key={inst}
                            type="button"
                            onClick={() => handleToggleInstrument(inst)}
                            className={`btn-tactile inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer active:scale-[0.98] ${
                              isSelected
                                ? "bg-primary text-white font-bold shadow-xs"
                                : "bg-white border border-border-subtle text-body hover:text-heading hover:border-cta/50 hover:bg-white"
                            }`}
                          >
                            {isSelected ? (
                              <Check className="w-3 h-3 text-white" />
                            ) : (
                              <Plus className="w-3 h-3 text-body-muted" />
                            )}
                            <span>{inst}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {state?.fieldErrors?.instruments && (
                    <p className="text-xs font-medium text-error flex items-center gap-1">
                      <span>•</span>
                      {state.fieldErrors.instruments[0]}
                    </p>
                  )}
                  <input
                    type="hidden"
                    name="instruments"
                    value={JSON.stringify(selectedInstruments)}
                  />
                </div>

                {/* 2. Teaching Experience */}
                <div className="space-y-2.5 pt-3 border-t border-border-subtle/60">
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor="experience"
                      className="text-xs font-bold uppercase tracking-wider text-heading flex items-center gap-1.5"
                    >
                      <Clock className="w-3.5 h-3.5 text-primary" />
                      <span>Teaching Experience</span>
                    </label>
                    <span className="text-[11px] text-body-muted font-medium">
                      Total years teaching
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    {/* Stepper with unit */}
                    <div className="flex items-center gap-2">
                      <div className="flex items-center rounded-xl border border-border-default/90 bg-white shadow-xs overflow-hidden focus-within:border-cta focus-within:ring-2 focus-within:ring-cta/25 transition-all">
                        <button
                          type="button"
                          onClick={() =>
                            setExperience((prev) => Math.max(0, (Number(prev) || 0) - 1))
                          }
                          className="btn-tactile flex h-10 w-10 items-center justify-center bg-neutral-50/80 text-heading hover:bg-primary-subtle hover:text-primary transition-colors cursor-pointer border-r border-border-subtle text-base font-bold select-none active:scale-[0.98]"
                          aria-label="Decrease experience by 1 year"
                        >
                          −
                        </button>
                        <input
                          id="experience"
                          name="experience"
                          type="number"
                          min="0"
                          max="70"
                          required
                          value={experience}
                          onChange={(e) =>
                            setExperience(
                              e.target.value === ""
                                ? ""
                                : Math.max(0, parseInt(e.target.value) || 0)
                            )
                          }
                          placeholder="5"
                          className="w-16 bg-white py-2 text-center text-sm font-bold font-mono text-heading focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                        <button
                          type="button"
                          onClick={() => setExperience((prev) => (Number(prev) || 0) + 1)}
                          className="btn-tactile flex h-10 w-10 items-center justify-center bg-neutral-50/80 text-heading hover:bg-primary-subtle hover:text-primary transition-colors cursor-pointer border-l border-border-subtle text-base font-bold select-none active:scale-[0.98]"
                          aria-label="Increase experience by 1 year"
                        >
                          +
                        </button>
                      </div>
                      <span className="text-xs font-semibold text-body shrink-0">
                        {Number(experience) === 1 ? "year" : "years"}
                      </span>
                    </div>

                    {/* Quick preset selection pills */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {[1, 3, 5, 8, 10, 15].map((yr) => (
                        <button
                          key={yr}
                          type="button"
                          onClick={() => setExperience(yr)}
                          className={`btn-tactile px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer active:scale-[0.98] ${
                            Number(experience) === yr
                              ? "bg-primary text-white shadow-xs ring-2 ring-primary/25"
                              : "bg-white border border-border-subtle text-body hover:border-primary/50 hover:text-heading hover:bg-bg-alt/20"
                          }`}
                        >
                          {yr} {yr === 1 ? "yr" : "yrs"}
                        </button>
                      ))}
                    </div>
                  </div>

                  {state?.fieldErrors?.experience && (
                    <p className="text-xs font-medium text-error flex items-center gap-1">
                      <span>•</span>
                      {state.fieldErrors.experience[0]}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* MANDATORY PHONE OTP VERIFICATION CARD */}
            <div className="entry-verification space-y-3.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Smartphone className="w-4 h-4 text-primary" />
                  <span className="entry-verification-title">
                    Mobile Number Verification
                  </span>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider bg-accent-subtle text-accent-dark border border-accent/30">
                  Mandatory
                </span>
              </div>

              {/* Error alerts */}
              {(phoneError || otpError || state?.fieldErrors?.phone || state?.fieldErrors?.otpCode) && (
                <div
                  role="alert"
                  className="flex items-start gap-2 rounded-xl border border-error/30 bg-error-muted/40 p-2.5 text-xs text-error font-medium"
                >
                  <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-error" />
                  <span>
                    {phoneError ||
                      otpError ||
                      state?.fieldErrors?.phone?.[0] ||
                      state?.fieldErrors?.otpCode?.[0]}
                  </span>
                </div>
              )}

              {/* OTP Confirmation banner - Dev Test OTP completely removed */}
              {otpBanner && !isPhoneVerified && (
                <div className="rounded-xl border border-accent/40 bg-accent-subtle/70 p-3 space-y-1.5 text-xs">
                  <div className="flex items-center gap-1.5 text-accent-dark font-bold">
                    <CheckCircle2 className="w-3.5 h-3.5 text-accent-dark" />
                    <span>{otpBanner.message}</span>
                  </div>
                </div>
              )}

              {/* Verified state vs Input state */}
              {isPhoneVerified ? (
                <div className="flex items-center justify-between rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-xs">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <div>
                      <p className="font-bold text-emerald-950 font-mono">{getFullPhoneNumber()}</p>
                      <p className="text-[10px] text-emerald-700">Phone verified successfully via OTP</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleChangePhone}
                    className="text-xs font-semibold text-body hover:text-heading underline cursor-pointer"
                  >
                    Change
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Phone input with CountryCodeSelector + Send OTP */}
                  <div className="flex gap-2">
                    <div className="entry-phone flex-1 flex overflow-visible">
                      <CountryCodeSelector
                  showDialCodeInButton
                        selectedCountry={selectedCountry}
                        onSelect={(c) => setSelectedCountry(c)}
                        className="shrink-0"
                      />
                      <input
                        id="phone-input"
                        aria-label="Mobile phone number"
                        type="tel"
                  autoComplete="tel-national"
                        value={rawPhoneNumber}
                        onChange={(e) => setRawPhoneNumber(e.target.value)}
                        placeholder="98765 43210"
                        disabled={otpSent}
                        className="w-full bg-transparent px-3 py-2.5 text-xs sm:text-sm text-heading placeholder-body/40 focus:outline-none disabled:bg-neutral-50 disabled:opacity-80"
                      />
                    </div>
                    <button
                      type="button"
                      disabled={isSendingOtp || resendCooldown > 0 || !rawPhoneNumber.trim()}
                      onClick={handleSendOtp}
                      className="px-3.5 py-2 rounded-xl bg-primary hover:bg-primary-hover text-white text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 disabled:opacity-50 cursor-pointer shadow-xs active:scale-[0.98]"
                    >
                      {isSendingOtp ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
                      ) : resendCooldown > 0 ? (
                        <span>Resend ({resendCooldown}s)</span>
                      ) : (
                        <span>{otpSent ? "Resend OTP" : "Send OTP"}</span>
                      )}
                    </button>
                  </div>

                  {/* 6-Digit OTP verification block */}
                  {otpSent && (
                    <div className="p-3 rounded-xl bg-white border border-border-default/80 space-y-2.5 animate-fade-in">
                      <div className="flex items-center justify-between">
                        <label
                          htmlFor="otp-code-input"
                          className="block text-[11px] font-bold uppercase tracking-wider text-heading"
                        >
                          Enter 6-Digit OTP Code
                        </label>
                        <span className="text-[11px] text-body-muted">Sent via SMS</span>
                      </div>
                      <div className="flex gap-2">
                        <input
                          ref={otpInputRef}
                          id="otp-code-input"
                          type="text"
                          autoComplete="one-time-code"
                          inputMode="numeric"
                          maxLength={6}
                          value={otpCode}
                          onChange={(e) => {
                            const val = e.target.value.replace(/\D/g, "");
                            setOtpCode(val);
                            if (val.length === 6) {
                              handleVerifyOtp(val);
                            }
                          }}
                          placeholder="••••••"
                          className="block w-full rounded-xl border border-surface-muted/90 bg-white px-3 py-2 text-center text-base tracking-[0.3em] font-mono text-heading placeholder:tracking-normal placeholder:font-sans placeholder-body/40 shadow-xs focus:border-cta focus:outline-none focus:ring-3 focus:ring-cta/15"
                        />
                        <button
                          type="button"
                          disabled={isVerifyingOtp || otpCode.trim().length !== 6}
                          onClick={() => handleVerifyOtp()}
                          className="px-4 py-2 rounded-xl bg-cta hover:bg-cta-hover text-white text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 disabled:opacity-50 cursor-pointer shadow-xs active:scale-[0.98]"
                        >
                          {isVerifyingOtp ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
                          ) : (
                            <>
                              <ShieldCheck className="w-3.5 h-3.5 text-accent" />
                              <span>Verify Code</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Hidden fields bound to form */}
              <input type="hidden" name="phone" value={getFullPhoneNumber()} />
              <input type="hidden" name="otpCode" value={verifiedOtpCode || otpCode} />
              <input type="hidden" name="firebaseIdToken" value={firebaseIdToken} />
            </div>

            {/* Full Name */}
            <div>
              <label
                htmlFor="name"
                className="block text-xs font-bold uppercase tracking-wider text-heading mb-1.5"
              >
                Full name
              </label>
              <input
                id="name"
                name="name"
                type="text"
                autoComplete="name"
                required
                placeholder="Your full name"
                className="block w-full rounded-xl border border-surface-muted/90 bg-white px-3.5 py-2.5 text-sm text-heading placeholder-body/40 shadow-xs transition-all focus:border-cta focus:outline-none focus:ring-4 focus:ring-cta/15"
              />
              {state?.fieldErrors?.name && (
                <p className="mt-1.5 text-xs font-medium text-error flex items-center gap-1">
                  <span>•</span>
                  {state.fieldErrors.name[0]}
                </p>
              )}
            </div>

            {/* Email */}
            <div>
              <label
                htmlFor="email"
                className="block text-xs font-bold uppercase tracking-wider text-heading mb-1.5"
              >
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                placeholder="you@example.com"
                className="block w-full rounded-xl border border-surface-muted/90 bg-white px-3.5 py-2.5 text-sm text-heading placeholder-body/40 shadow-xs transition-all focus:border-cta focus:outline-none focus:ring-4 focus:ring-cta/15"
              />
              {state?.fieldErrors?.email && (
                <p className="mt-1.5 text-xs font-medium text-error flex items-center gap-1">
                  <span>•</span>
                  {state.fieldErrors.email[0]}
                </p>
              )}
            </div>

            {/* Password */}
            <div>
              <label
                htmlFor="password"
                className="block text-xs font-bold uppercase tracking-wider text-heading mb-1.5"
              >
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  placeholder="Create a strong password" aria-describedby="password-help"
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
              <p id="password-help" className="mt-2 text-xs text-body">Use at least 8 characters, with uppercase, lowercase, and a number.</p>
              {state?.fieldErrors?.password && (
                <p className="mt-1.5 text-xs font-medium text-error flex items-center gap-1">
                  <span>•</span>
                  {state.fieldErrors.password[0]}
                </p>
              )}
            </div>

            {/* Timezone */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label
                  htmlFor="timezone"
                  className="block text-xs font-bold uppercase tracking-wider text-heading"
                >
                  Your Timezone
                </label>
                <span className="text-[11px] text-body-muted">Auto-detected</span>
              </div>
              <input
                id="timezone"
                name="timezone"
                type="text"
                value={detectedTz}
                onChange={(e) => setDetectedTz(e.target.value)}
                required
                className="block w-full rounded-xl border border-surface-muted/90 bg-white px-3.5 py-2.5 text-sm font-mono text-heading placeholder-body/40 shadow-xs transition-all focus:border-cta focus:outline-none focus:ring-4 focus:ring-cta/15"
              />
            </div>

            {/* Create Account Button */}
            {!isPhoneVerified && otpCode.trim().length !== 6 && <p className="text-xs text-body">Verify your phone number above to continue.</p>}
            <div className="space-y-2 pt-1">
              <button
                type="submit"
                disabled={isPending || (!isPhoneVerified && otpCode.trim().length !== 6)}
                className={`btn-tactile flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold text-white shadow-md transition-all cursor-pointer active:scale-[0.98] ${
                  isPhoneVerified || otpCode.trim().length === 6
                    ? "bg-primary hover:bg-primary-hover shadow-primary/20"
                    : "bg-neutral-400 cursor-not-allowed opacity-75"
                }`}
              >
                {isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin text-white" />
                    <span>Creating your account...</span>
                  </>
                ) : isPhoneVerified || otpCode.trim().length === 6 ? (
                  <>
                    <span>
                      {selectedRole === "TEACHER"
                        ? "Submit Faculty Application"
                        : "Create Account"}
                    </span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                ) : (
                  <span>{selectedRole === "TEACHER" ? "Submit application" : "Create account"}</span>
                )}
              </button>
            </div>
          </form>

          <p className="entry-form-footer">
            Already have an account?{" "}
            <Link
              href="/login"
              className="font-bold text-cta hover:text-cta-hover transition-colors"
            >
              Sign in
            </Link>
          </p>
    </FormShell>
  );
}
