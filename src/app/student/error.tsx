"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { unstable_rethrow } from "next/navigation";
import { AlertCircle, RefreshCw, Home, LifeBuoy } from "lucide-react";

export default function StudentPortalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // Let Next.js internal control-flow exceptions (like redirect() and notFound()) pass through
  unstable_rethrow(error);

  const [showDetails, setShowDetails] = useState(false);
  const [isReloading, setIsReloading] = useState(false);

  useEffect(() => {
    console.error("Student portal runtime interruption:", error);
  }, [error]);

  const handleReload = () => {
    setIsReloading(true);
    window.location.reload();
  };

  const errorMessage = error?.message || "An unexpected error occurred while loading this section.";

  return (
    <div className="min-h-[50vh] flex items-center justify-center p-4 sm:p-8">
      <div className="w-full max-w-lg rounded-3xl border border-surface-muted/90 bg-white p-6 sm:p-8 shadow-md shadow-primary/5 text-center space-y-6">
        {/* Soft Tonal Error Badge (No White Borders) */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-amber-500/10 text-amber-700 text-xs font-semibold">
          <AlertCircle className="w-4 h-4 text-amber-600" />
          <span>Student Portal Notice</span>
        </div>

        {/* Heading & Friendly Subtitle */}
        <div className="space-y-2">
          <h2 className="font-serif text-2xl sm:text-3xl font-bold text-heading">
            Classroom Workspace Interrupted
          </h2>
          <p className="text-xs sm:text-sm text-body leading-relaxed max-w-md mx-auto">
            We encountered a temporary interruption synchronizing your student session data.
            Your course enrollments, lesson bookings, and practice progress remain protected.
          </p>
        </div>

        {/* Technical Diagnostic Toggle */}
        <div className="text-left">
          <div className="flex justify-center">
            <button
              type="button"
              onClick={() => setShowDetails(!showDetails)}
              className="text-xs text-body hover:text-heading transition-colors underline cursor-pointer"
            >
              {showDetails ? "Hide technical diagnostic" : "Show technical diagnostic"}
            </button>
          </div>

          {showDetails && (
            <div className="mt-3 p-3.5 rounded-xl bg-bg-alt/40 border border-surface-muted text-left space-y-1">
              <div className="flex items-center justify-between text-xs text-body font-medium">
                <span className="font-semibold text-heading">Diagnostic:</span>
                {error?.digest && (
                  <span className="font-mono text-[11px] text-accent-dark">
                    Ref: {error.digest}
                  </span>
                )}
              </div>
              <p className="text-xs font-mono text-body break-words select-all leading-relaxed">
                {errorMessage}
              </p>
            </div>
          )}
        </div>

        {/* Action Controls - Borderless tactile styling */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <button
            type="button"
            onClick={handleReload}
            disabled={isReloading}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-cta hover:bg-cta-hover text-white text-xs sm:text-sm font-bold shadow-md shadow-cta/25 transition-all btn-tactile cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${isReloading ? "animate-spin" : ""}`} />
            <span>{isReloading ? "Refreshing..." : "Reload Portal"}</span>
          </button>

          <button
            type="button"
            onClick={() => reset()}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-bg-alt hover:bg-bg-alt/70 text-heading text-xs sm:text-sm font-bold transition-all btn-tactile cursor-pointer"
          >
            Try Again
          </button>

          <a
            href="/student/dashboard"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-white text-xs sm:text-sm font-bold shadow-md shadow-primary/20 transition-all btn-tactile"
          >
            <Home className="w-4 h-4" />
            <span>Overview</span>
          </a>
        </div>

        {/* Support Link */}
        <div className="pt-2 border-t border-surface-muted/60">
          <Link
            href="/student/dashboard/support"
            className="inline-flex items-center gap-1.5 text-xs text-body hover:text-heading transition-colors"
          >
            <LifeBuoy className="w-3.5 h-3.5 text-accent-dark" />
            <span>Need assistance? Contact Gandharva Student Helpdesk</span>
          </Link>
        </div>
      </div>
    </div>
  );
}

