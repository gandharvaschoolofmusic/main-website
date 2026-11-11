"use client";

import { useEffect } from "react";
import Link from "next/link";
import { ShieldAlert, RefreshCw, LayoutDashboard, LogOut } from "lucide-react";
import { signOutAction } from "@/actions/auth";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Admin portal runtime error:", error);
  }, [error]);

  return (
    <div className="relative min-h-[60vh] flex items-center justify-center p-6">
      <div className="relative z-10 max-w-lg w-full text-center bg-white rounded-3xl border border-border-default p-8 shadow-xl space-y-6">
        {/* Error Badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-amber-500/30 bg-amber-50 text-amber-800 text-xs font-semibold tracking-wide">
          <ShieldAlert className="w-3.5 h-3.5 text-accent" />
          <span>Administrative Portal Notice</span>
        </div>

        {/* Heading */}
        <div className="space-y-2">
          <h2 className="font-serif text-2xl sm:text-3xl font-bold text-heading tracking-tight">
            Session or Data Sync Interrupted
          </h2>
          <p className="text-body text-xs sm:text-sm leading-relaxed max-w-md mx-auto">
            The administrative workspace encountered an unexpected interruption while synchronizing operational data. Your credentials and platform configurations remain protected.
          </p>
        </div>

        {error.digest && (
          <div className="p-3 rounded-xl bg-bg-alt/60 border border-border-default/60 text-left space-y-1.5 select-all">
            <div className="text-body/70 text-xs font-mono">
              Reference Digest: <span className="font-bold text-heading">{error.digest}</span>
            </div>
            <p className="text-[11px] text-body-muted leading-relaxed">
              If database credentials or environment variables were updated recently, please ensure special characters in the password (e.g. <code className="font-mono bg-neutral-200/60 px-1 py-0.5 rounded text-heading">$</code>) are encoded as <code className="font-mono bg-neutral-200/60 px-1 py-0.5 rounded text-heading">%24</code>, and allow 1-2 minutes for the database pooler cache to synchronize.
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <button
            type="button"
            onClick={() => {
              reset();
              window.location.href = window.location.pathname + "?refresh=" + Date.now();
            }}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-primary hover:bg-primary-dark text-white font-bold text-xs transition-all shadow-xs active:scale-[0.98] cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Retry Connection</span>
          </button>

          <Link
            href="/dashboard"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl border border-border-default hover:bg-bg-alt/40 text-heading font-semibold text-xs transition-all active:scale-[0.98]"
          >
            <LayoutDashboard className="w-3.5 h-3.5 text-primary" />
            <span>Go to Dashboard</span>
          </Link>

          <form action={signOutAction} className="w-full sm:w-auto">
            <button
              type="submit"
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-body hover:text-heading text-xs font-semibold transition-all hover:bg-neutral-100 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Re-login</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
