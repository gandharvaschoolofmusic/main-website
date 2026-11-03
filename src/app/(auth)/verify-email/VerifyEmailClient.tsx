"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { verifyEmailAction, resendVerificationEmailAction } from "@/actions/auth";
import { SplitHeading } from "@/components/ui/SplitHeading";
import { CheckCircle2, AlertCircle, Mail, ArrowRight, Loader2 } from "lucide-react";

export type CurrentUserSummary = {
  id: string;
  name?: string | null;
  email?: string | null;
  role: string;
  emailVerified?: Date | null;
} | null;

export function VerifyEmailClient({
  currentUser,
  initialToken,
  initialResult,
}: {
  currentUser: CurrentUserSummary;
  initialToken?: string | null;
  initialResult?: {
    success: boolean;
    message?: string;
    error?: string;
    data?: { emailVerified: boolean; role?: string };
  } | null;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawToken =
    searchParams.get("token") ||
    searchParams.get("oobCode") ||
    searchParams.get("code") ||
    initialToken;
  const token = rawToken?.trim() || null;

  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{
    success: boolean;
    message?: string;
    error?: string;
    data?: { emailVerified: boolean; role?: string };
  } | null>(initialResult ?? null);

  // Resend state
  const [resendEmail, setResendEmail] = useState(currentUser?.email || "");
  const [isResending, startResendTransition] = useTransition();
  const [resendResult, setResendResult] = useState<{
    success: boolean;
    message?: string;
    error?: string;
    previewUrl?: string;
    alreadyVerified?: boolean;
  } | null>(null);

  // Ref to guarantee verification action runs only once even in React StrictMode.
  // If already verified on the server via initialResult, no need to trigger again!
  const hasTriggeredRef = useRef(Boolean(initialResult));

  useEffect(() => {
    if (token && !hasTriggeredRef.current) {
      hasTriggeredRef.current = true;
      startTransition(async () => {
        const res = await verifyEmailAction(token);
        setResult(res);
        if (res.success) {
          router.refresh();
        }
      });
    }
  }, [token, router]);

  const handleResend = (e: React.FormEvent) => {
    e.preventDefault();
    const emailToUse = resendEmail.trim() || currentUser?.email || "";
    if (!emailToUse) return;

    startResendTransition(async () => {
      const res = await resendVerificationEmailAction(emailToUse);
      setResendResult({
        success: res.success,
        message: res.message,
        error: res.error,
        previewUrl: res.previewUrl,
        alreadyVerified: res.data?.alreadyVerified,
      });
      if (res.success) {
        router.refresh();
      }
    });
  };

  const getDashboardUrl = (role?: string) => {
    const userRole = role || currentUser?.role;
    if (userRole === "ADMIN") return "/admin";
    if (userRole === "TEACHER") return "/teacher/dashboard";
    return "/student/dashboard";
  };

  const isAlreadyVerified = Boolean(
    currentUser?.emailVerified || result?.data?.emailVerified || resendResult?.alreadyVerified
  );

  return (
    <div className="flex min-h-[calc(100dvh-4rem)] items-center justify-center bg-gradient-to-b from-bg via-bg-alt/25 to-bg px-4 py-12 sm:py-16">
      <div className="relative w-full max-w-md space-y-6 overflow-hidden rounded-3xl bg-white p-7 sm:p-9 text-center shadow-2xl shadow-primary/10">
        {/* Subtle decorative top bar */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-primary via-cta to-accent" />

        {/* ── Case 1: Verification with Token in URL ── */}
        {token ? (
          <>
            {isPending || result === null ? (
              <div className="space-y-4 py-8">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-cta/10 text-cta">
                  <Loader2 className="h-7 w-7 animate-spin" />
                </div>
                <SplitHeading
                  as="h2"
                  firstClause="Verifying Your"
                  accentClause="Email..."
                  align="center"
                  size="sm"
                />
                <p className="text-sm text-body">
                  Please wait a moment while we confirm your Gandharva account.
                </p>
              </div>
            ) : result.success ? (
              <div className="space-y-5">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-success-muted text-success shadow-sm">
                  <CheckCircle2 className="h-8 w-8" />
                </div>
                <div>
                  <SplitHeading
                    as="h2"
                    firstClause="Email"
                    accentClause="Verified!"
                    align="center"
                    size="md"
                  />
                  <p className="mt-2 text-sm text-body leading-relaxed">
                    {result.message ||
                      "Your email address has been verified successfully! You are ready to book and learn."}
                  </p>
                </div>

                <div className="pt-2">
                  {currentUser ? (
                    <Link
                      href={getDashboardUrl(result.data?.role)}
                      className="btn-tactile flex items-center justify-center gap-2 w-full rounded-2xl bg-primary py-3.5 text-sm font-semibold text-white shadow-md shadow-primary/20 hover:bg-primary-hover active:scale-[0.98] transition-all"
                    >
                      <span>Go to Dashboard</span>
                      <ArrowRight className="w-4 h-4" />
                    </Link>
                  ) : (
                    <Link
                      href="/login"
                      className="btn-tactile flex items-center justify-center gap-2 w-full rounded-2xl bg-primary py-3.5 text-sm font-semibold text-white shadow-md shadow-primary/20 hover:bg-primary-hover active:scale-[0.98] transition-all"
                    >
                      <span>Continue to Sign In</span>
                      <ArrowRight className="w-4 h-4" />
                    </Link>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-5">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/15 text-accent-dark shadow-sm">
                  <AlertCircle className="h-8 w-8" />
                </div>
                <div>
                  <SplitHeading
                    as="h2"
                    firstClause="Verification Link"
                    accentClause="Expired"
                    align="center"
                    size="md"
                  />
                  <p className="mt-2 text-sm text-body leading-relaxed">
                    {result?.error ||
                      "This verification link is invalid or has already expired. You can easily request a new link below."}
                  </p>
                </div>

                {/* Resend Section */}
                <div className="rounded-2xl bg-bg-alt/30 p-4 text-left space-y-3">
                  <p className="text-xs font-bold text-heading uppercase tracking-wider">
                    Request a new verification link:
                  </p>
                  <form onSubmit={handleResend} className="space-y-3">
                    <input
                      type="email"
                      required
                      placeholder="Enter your email address"
                      value={resendEmail}
                      onChange={(e) => setResendEmail(e.target.value)}
                      className="w-full rounded-xl bg-white px-3.5 py-2.5 text-sm text-heading placeholder-body/40 shadow-xs focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                    <button
                      type="submit"
                      disabled={isResending}
                      className="btn-tactile w-full rounded-xl bg-primary py-2.5 text-xs font-semibold text-white shadow-xs transition hover:bg-primary-hover active:scale-[0.98] disabled:opacity-50 cursor-pointer"
                    >
                      {isResending ? "Sending..." : "Send New Verification Link"}
                    </button>
                  </form>

                  {resendResult && (
                    <div
                      className={`rounded-xl p-3 text-xs ${
                        resendResult.success
                          ? "bg-success-muted text-success"
                          : "bg-error-muted text-error"
                      }`}
                    >
                      <p className="font-medium">{resendResult.message || resendResult.error}</p>
                    </div>
                  )}
                </div>

                <div className="pt-1">
                  <Link
                    href={currentUser ? getDashboardUrl() : "/login"}
                    className="text-xs font-semibold text-body-muted hover:text-heading transition-colors"
                  >
                    {currentUser ? "Back to Dashboard" : "Return to Sign In"}
                  </Link>
                </div>
              </div>
            )}
          </>
        ) : isAlreadyVerified ? (
          /* ── Case 2: No token, but user is already verified ── */
          <div className="space-y-5">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-success-muted text-success shadow-sm">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <div>
              <SplitHeading
                as="h2"
                firstClause="Email Already"
                accentClause="Verified"
                align="center"
                size="md"
              />
              <p className="mt-2 text-sm text-body leading-relaxed">
                Your email address ({currentUser?.email || "associated with this account"}) is verified and fully active.
              </p>
            </div>
            <div className="pt-2">
              <Link
                href={getDashboardUrl()}
                className="btn-tactile flex items-center justify-center gap-2 w-full rounded-2xl bg-primary py-3.5 text-sm font-semibold text-white shadow-md shadow-primary/20 hover:bg-primary-hover active:scale-[0.98] transition-all"
              >
                <span>Go to Dashboard</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        ) : (
          /* ── Case 3: No token and unverified ── */
          <div className="space-y-5">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-cta text-white shadow-md shadow-primary/20">
              <Mail className="h-7 w-7" />
            </div>
            <div>
              <SplitHeading
                as="h2"
                firstClause="Verify Your"
                accentClause="Email"
                align="center"
                size="md"
              />
              <p className="mt-2 text-sm text-body leading-relaxed">
                {currentUser?.email ? (
                  <>
                    We sent a verification link to <span className="font-semibold text-heading">{currentUser.email}</span>. Click the link in your email to unlock all features.
                  </>
                ) : (
                  "Please click the verification link sent to your email to activate your account."
                )}
              </p>
            </div>

            {/* Resend Section */}
            <div className="rounded-2xl bg-bg-alt/30 p-4 text-left space-y-3">
              <p className="text-xs font-bold text-heading uppercase tracking-wider">
                Need a new verification link?
              </p>
              <form onSubmit={handleResend} className="space-y-3">
                <input
                  type="email"
                  required
                  placeholder="Enter your email address"
                  value={resendEmail}
                  onChange={(e) => setResendEmail(e.target.value)}
                  className="w-full rounded-xl bg-white px-3.5 py-2.5 text-sm text-heading placeholder-body/40 shadow-xs focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
                <button
                  type="submit"
                  disabled={isResending}
                  className="btn-tactile w-full rounded-xl bg-primary py-2.5 text-xs font-semibold text-white shadow-xs transition hover:bg-primary-hover active:scale-[0.98] disabled:opacity-50 cursor-pointer"
                >
                  {isResending ? "Sending..." : "Send Verification Link"}
                </button>
              </form>

              {resendResult && (
                <div
                  className={`rounded-xl p-3 text-xs ${
                    resendResult.success
                      ? "bg-success-muted text-success"
                      : "bg-error-muted text-error"
                  }`}
                >
                  <p className="font-medium">{resendResult.message || resendResult.error}</p>
                </div>
              )}
            </div>

            <div className="pt-1">
              <Link
                href={currentUser ? getDashboardUrl() : "/login"}
                className="text-xs font-semibold text-body-muted hover:text-heading transition-colors"
              >
                {currentUser ? "Back to Dashboard" : "Back to Sign In"}
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

