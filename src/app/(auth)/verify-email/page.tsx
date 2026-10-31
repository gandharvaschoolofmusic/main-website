"use client";

import { Suspense, useEffect, useRef, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { verifyEmailAction, resendVerificationEmailAction } from "@/actions/auth";
import { SplitHeading } from "@/components/ui/SplitHeading";

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || searchParams.get("oobCode");

  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{
    success: boolean;
    message?: string;
    error?: string;
    data?: { emailVerified: boolean; role?: string };
  } | null>(null);

  // Resend state
  const [resendEmail, setResendEmail] = useState("");
  const [isResending, startResendTransition] = useTransition();
  const [resendResult, setResendResult] = useState<{
    success: boolean;
    message?: string;
    error?: string;
    previewUrl?: string;
    alreadyVerified?: boolean;
  } | null>(null);

  // Ref to guarantee verification action runs only once even in React StrictMode
  const hasTriggeredRef = useRef(false);

  useEffect(() => {
    if (token && !hasTriggeredRef.current) {
      hasTriggeredRef.current = true;
      startTransition(async () => {
        const res = await verifyEmailAction(token);
        setResult(res);
      });
    }
  }, [token]);

  const handleResend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!resendEmail.trim()) return;

    startResendTransition(async () => {
      const res = await resendVerificationEmailAction(resendEmail.trim());
      setResendResult({
        success: res.success,
        message: res.message,
        error: res.error,
        previewUrl: res.previewUrl,
        alreadyVerified: res.data?.alreadyVerified,
      });
    });
  };

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-gradient-to-b from-bg via-bg-alt/25 to-bg px-4 pt-16 sm:pt-20 pb-16">
      <div className="relative w-full max-w-md space-y-6 overflow-hidden rounded-2xl border border-surface-muted/80 bg-white p-8 sm:p-10 text-center shadow-xl shadow-primary/5 backdrop-blur-sm">
        {/* Decorative Top Accent Bar */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-primary via-cta to-accent" />

        {token ? (
          <>
            {isPending ? (
              <div className="space-y-4 py-8">
                <div className="mx-auto h-12 w-12 animate-spin rounded-full border-3 border-cta border-t-transparent" />
                <SplitHeading
                  as="h2"
                  firstClause="Verifying Your"
                  accentClause="Email..."
                  align="center"
                  size="sm"
                />
                <p className="text-sm text-body">
                  Please wait while we confirm your Gandharva account.
                </p>
              </div>
            ) : result?.success ? (
              <div className="space-y-4">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-success-muted/60 text-success shadow-sm">
                  <svg
                    className="h-8 w-8"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2.5}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </div>
                <SplitHeading
                  as="h2"
                  firstClause="Email"
                  accentClause="Verified!"
                  align="center"
                  size="md"
                />
                <p className="text-sm text-body leading-relaxed">{result.message}</p>
                <div className="pt-4 space-y-3">
                  <Link
                    href="/login"
                    className="btn-tactile inline-block w-full rounded-xl bg-primary py-3 text-sm font-bold text-white shadow-md shadow-primary/20 transition-all hover:bg-primary-light"
                  >
                    Continue to Sign In
                  </Link>
                  <Link
                    href="/teachers"
                    className="btn-tactile inline-block w-full rounded-xl border border-surface-muted bg-bg-alt/40 py-2.5 text-sm font-bold text-heading hover:bg-bg-alt transition-colors"
                  >
                    Explore Music Teachers
                  </Link>
                </div>
              </div>
            ) : (
              <div className="space-y-5">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/15 text-accent-dark shadow-sm">
                  <svg
                    className="h-8 w-8"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                  </svg>
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
                      "This verification link is invalid or has expired. You can easily request a new one below."}
                  </p>
                </div>

                {/* Resend Section */}
                <div className="rounded-xl border border-surface-muted/90 bg-bg-alt/20 p-4 text-left">
                  <p className="text-xs font-bold text-heading uppercase tracking-wider mb-2">
                    Request a new verification link:
                  </p>
                  <form onSubmit={handleResend} className="space-y-3">
                    <input
                      type="email"
                      required
                      placeholder="Enter your email address"
                      value={resendEmail}
                      onChange={(e) => setResendEmail(e.target.value)}
                      className="w-full rounded-xl border border-surface-muted/90 bg-white px-3.5 py-2 text-sm text-heading placeholder-body/40 shadow-sm focus:border-cta focus:outline-none focus:ring-4 focus:ring-cta/15"
                    />
                    <button
                      type="submit"
                      disabled={isResending}
                      className="btn-tactile w-full rounded-xl bg-primary py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-primary-light disabled:opacity-50"
                    >
                      {isResending ? "Sending..." : "Send New Verification Link"}
                    </button>
                  </form>

                  {resendResult && (
                    <div
                      className={`mt-3 rounded-xl p-3.5 text-xs ${
                        resendResult.success
                          ? "bg-success-muted/50 border border-success/30 text-success"
                          : "bg-error-muted/40 border border-error/30 text-error"
                      }`}
                    >
                      <p className="font-medium">{resendResult.message || resendResult.error}</p>
                      {resendResult.alreadyVerified && (
                        <div className="mt-2.5">
                          <Link
                            href="/login"
                            className="btn-tactile inline-block rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-white hover:bg-primary-light"
                          >
                            Sign In Now
                          </Link>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="pt-2">
                  <Link
                    href="/login"
                    className="btn-tactile inline-block w-full rounded-xl border border-surface-muted bg-white py-2.5 text-sm font-bold text-heading hover:bg-bg-alt/25 transition-colors"
                  >
                    Return to Sign In
                  </Link>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="space-y-5">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-cta text-white shadow-md shadow-primary/25">
              <svg
                className="h-7 w-7"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2.2}
                  d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                />
              </svg>
            </div>
            <div>
              <SplitHeading
                as="h2"
                firstClause="Check Your"
                accentClause="Email"
                align="center"
                size="md"
              />
              <p className="mt-2 text-sm text-body leading-relaxed">
                Please click the link sent to your email address to activate your account.
                If you did not receive it, you can request a new link below.
              </p>
            </div>

            {/* Resend Section */}
            <div className="rounded-xl border border-surface-muted/90 bg-bg-alt/20 p-4 text-left">
              <p className="text-xs font-bold text-heading uppercase tracking-wider mb-2">
                Need a new verification link?
              </p>
              <form onSubmit={handleResend} className="space-y-3">
                <input
                  type="email"
                  required
                  placeholder="Enter your email address"
                  value={resendEmail}
                  onChange={(e) => setResendEmail(e.target.value)}
                  className="w-full rounded-xl border border-surface-muted/90 bg-white px-3.5 py-2 text-sm text-heading placeholder-body/40 shadow-sm focus:border-cta focus:outline-none focus:ring-4 focus:ring-cta/15"
                />
                <button
                  type="submit"
                  disabled={isResending}
                  className="btn-tactile w-full rounded-xl bg-primary py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-primary-light disabled:opacity-50"
                >
                  {isResending ? "Sending..." : "Send Verification Link"}
                </button>
              </form>

              {resendResult && (
                <div
                  className={`mt-3 rounded-xl p-3.5 text-xs ${
                    resendResult.success
                      ? "bg-success-muted/50 border border-success/30 text-success"
                      : "bg-error-muted/40 border border-error/30 text-error"
                  }`}
                >
                  <p className="font-medium">{resendResult.message || resendResult.error}</p>
                  {resendResult.alreadyVerified && (
                    <div className="mt-2.5">
                      <Link
                        href="/login"
                        className="btn-tactile inline-block rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-white hover:bg-primary-light"
                      >
                        Sign In Now
                      </Link>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="pt-2">
              <Link
                href="/login"
                className="font-bold text-sm text-cta hover:text-cta-hover transition-colors"
              >
                Back to Sign In
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[calc(100vh-4.5rem)] items-center justify-center bg-gradient-to-b from-bg via-bg-alt/25 to-bg">
          <div className="h-10 w-10 animate-spin rounded-full border-3 border-cta border-t-transparent" />
        </div>
      }
    >
      <VerifyEmailContent />
    </Suspense>
  );
}

