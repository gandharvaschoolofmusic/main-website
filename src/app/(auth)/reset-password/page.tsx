"use client";

import { Suspense, useActionState, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Eye, EyeOff } from "lucide-react";
import { resetPasswordAction } from "@/actions/auth";
import { SplitHeading } from "@/components/ui/SplitHeading";


function ResetPasswordContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || searchParams.get("oobCode") || "";

  const [state, formAction, isPending] = useActionState(resetPasswordAction, {
    success: false,
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  return (
    <div className="relative min-h-[100dvh] w-full flex items-center justify-center lg:justify-end pt-24 sm:pt-28 pb-14 px-4 sm:px-8 lg:px-14 xl:px-20 max-w-[1560px] mx-auto">
      {/* Background Stage Image */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <Image
          src="/auth-bg.png"
          alt="Gandharva School of Music"
          fill
          priority
          sizes="100vw"
          className="object-cover object-[20%_18%] sm:object-[22%_20%] lg:object-[16%_22%]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-black/60 lg:bg-gradient-to-r lg:from-black/15 lg:via-black/45 lg:to-black/85" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(168,85,247,0.18),transparent_70%)]" />
      </div>

      <div className="relative z-10 w-full max-w-md lg:max-w-[460px]">
        <div className="relative space-y-6 overflow-hidden rounded-3xl border border-white/80 bg-white/95 p-8 sm:p-10 shadow-[0_24px_60px_-15px_rgba(0,0,0,0.5)] backdrop-blur-xl">
            {/* Decorative Top Accent Bar */}
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-primary via-cta to-accent" />

        <div className="space-y-3 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-cta text-white shadow-md shadow-primary/25">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-7 w-7"
            >
              <path d="M9 18V5l12-2v13" />
              <circle cx="6" cy="18" r="3" fill="white" />
              <circle cx="18" cy="16" r="3" fill="white" />
            </svg>
          </div>
          <SplitHeading
            as="h1"
            firstClause="Choose New"
            accentClause="Password"
            align="center"
            size="md"
          />
          <p className="text-xs sm:text-sm text-body">
            Enter a strong new password for your Gandharva account
          </p>
        </div>

        {state?.error && (
          <div
            role="alert"
            className="flex items-start gap-2.5 rounded-xl border border-error/30 bg-error-muted/40 p-3.5 text-sm text-error"
          >
            <svg
              className="mt-0.5 h-5 w-5 flex-shrink-0 text-error"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <span>{state.error}</span>
          </div>
        )}

        {state?.success ? (
          <div className="space-y-4 text-center">
            <div className="rounded-xl border border-success/30 bg-success-muted/50 p-4 text-sm text-success font-medium">
              {state.message}
            </div>

            <Link
              href="/login"
              className="btn-tactile inline-block w-full rounded-xl bg-primary py-3 text-sm font-bold text-white shadow-md shadow-primary/20 transition-all hover:bg-primary-light"
            >
              Sign In with New Password
            </Link>
          </div>
        ) : !token ? (
          <div className="space-y-4 text-center">
            <p className="text-sm text-body">
              Missing password reset token. Please request a new reset link.
            </p>
            <Link
              href="/forgot-password"
              className="btn-tactile inline-block w-full rounded-xl bg-primary py-3 text-sm font-bold text-white shadow-md shadow-primary/20 transition-all hover:bg-primary-light"
            >
              Request Reset Link
            </Link>
          </div>
        ) : (
          <form action={formAction} className="space-y-5">
            <input type="hidden" name="token" value={token} />

            <div>
              <label
                htmlFor="password"
                className="block text-xs font-bold uppercase tracking-wider text-heading mb-1.5"
              >
                New Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  placeholder="At least 8 chars, uppercase, lowercase & number"
                  className="block w-full rounded-xl border border-surface-muted/90 bg-white px-3.5 py-2.5 pr-11 text-sm text-heading placeholder-body/40 shadow-sm transition-all focus:border-cta focus:outline-none focus:ring-4 focus:ring-cta/15"
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
              {state?.fieldErrors?.password && (
                <p className="mt-1.5 text-xs font-medium text-error flex items-center gap-1">
                  <span>•</span>
                  {state.fieldErrors.password[0]}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="confirmPassword"
                className="block text-xs font-bold uppercase tracking-wider text-heading mb-1.5"
              >
                Confirm New Password
              </label>
              <div className="relative">
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  placeholder="Repeat new password"
                  className="block w-full rounded-xl border border-surface-muted/90 bg-white px-3.5 py-2.5 pr-11 text-sm text-heading placeholder-body/40 shadow-sm transition-all focus:border-cta focus:outline-none focus:ring-4 focus:ring-cta/15"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((prev) => !prev)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-body/50 hover:text-heading hover:bg-surface-subtle transition-all active:scale-95 cursor-pointer"
                  aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                  title={showConfirmPassword ? "Hide password" : "Show password"}
                >
                  {showConfirmPassword ? (
                    <EyeOff className="w-4 h-4 text-heading/70" />
                  ) : (
                    <Eye className="w-4 h-4 text-body/60" />
                  )}
                </button>
              </div>
              {state?.fieldErrors?.confirmPassword && (
                <p className="mt-1.5 text-xs font-medium text-error flex items-center gap-1">
                  <span>•</span>
                  {state.fieldErrors.confirmPassword[0]}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={isPending}
              className="btn-tactile flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-bold text-white shadow-md shadow-primary/20 transition-all hover:bg-primary-light disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isPending ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  <span>Updating password...</span>
                </>
              ) : (
                "Update Password"
              )}
            </button>
          </form>
        )}
          </div>
        </div>
      </div>
    );
  }

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[calc(100vh-4.5rem)] items-center justify-center bg-gradient-to-b from-bg via-bg-alt/25 to-bg">
          <div className="h-10 w-10 animate-spin rounded-full border-3 border-cta border-t-transparent" />
        </div>
      }
    >
      <ResetPasswordContent />
    </Suspense>
  );
}

