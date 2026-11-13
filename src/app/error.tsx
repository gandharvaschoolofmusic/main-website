"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { unstable_rethrow } from "next/navigation";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // 1. Let Next.js internal control-flow exceptions (like redirect() and notFound()) pass through
  unstable_rethrow(error);

  const [showDetails, setShowDetails] = useState(false);
  const [isReloading, setIsReloading] = useState(false);

  useEffect(() => {
    // 2. Log unexpected errors to console
    console.error("Runtime application error caught by boundary:", error);

    // 3. Auto-recover from chunk load / version mismatch / RSC cache errors that happen after deployments
    const isRecoverableError =
      error?.name === "ChunkLoadError" ||
      error?.message?.includes("Loading chunk") ||
      error?.message?.includes("Failed to fetch dynamically imported module") ||
      error?.message?.includes("Importing a module script failed") ||
      error?.message?.includes("unexpected response was received from the server") ||
      error?.message?.includes("An unexpected response was received from the server") ||
      error?.message?.includes("Minified React error #441") ||
      error?.message?.includes("Minified React error #418") ||
      error?.message?.includes("Minified React error #423") ||
      error?.message?.includes("Minified React error #425") ||
      (error?.message?.includes("441") && error?.digest);

    if (isRecoverableError) {
      try {
        const reloadKey = "gandharva_auto_recovery_" + (error?.digest || "generic");
        const hasAttempted = sessionStorage.getItem(reloadKey);
        if (!hasAttempted) {
          sessionStorage.setItem(reloadKey, "true");
          window.location.reload();
          return;
        }
      } catch {
        // SessionStorage unavailable
      }
    }
  }, [error]);

  const handleReload = () => {
    setIsReloading(true);
    try {
      // Clear all recovery flags on manual reload
      Object.keys(sessionStorage).forEach((key) => {
        if (key.startsWith("gandharva_auto_recovery_")) {
          sessionStorage.removeItem(key);
        }
      });
    } catch {}
    window.location.reload();
  };

  const errorMessage = error?.message || "An unexpected rendering interruption occurred.";

  return (
    <div className="relative min-h-[calc(100vh-4rem)] flex items-center justify-center p-4 sm:p-6 overflow-hidden">
      {/* Background ambience */}
      <div
        className="absolute inset-0 pointer-events-none opacity-15"
        style={{
          background:
            "radial-gradient(ellipse 60% 50% at 50% 40%, #ef4444 0%, rgba(20, 20, 20, 0) 70%)",
        }}
      />

      <div className="relative z-10 max-w-lg w-full text-center">
        {/* Error Badge */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full border border-red-500/30 bg-red-500/10 text-red-300 text-xs font-semibold tracking-wide mb-5">
          <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
          <span>Application Notice</span>
        </div>

        {/* Heading */}
        <h1 className="font-serif text-2xl sm:text-4xl font-normal text-text-primary tracking-tight mb-3">
          A Moment of Discordance
        </h1>

        <p className="text-text-secondary text-sm sm:text-base mb-6 leading-relaxed">
          An unexpected interruption occurred while rendering this page.
          Your data and room connections remain safe.
        </p>

        {/* Technical details toggle (subtle and non-intrusive) */}
        <div className="mb-6 text-left">
          <div className="flex justify-center">
            <button
              type="button"
              onClick={() => setShowDetails(!showDetails)}
              className="text-xs text-text-muted hover:text-text-secondary transition-colors underline cursor-pointer"
            >
              {showDetails ? "Hide technical diagnostic" : "Show technical diagnostic"}
            </button>
          </div>

          {showDetails && (
            <div className="mt-3 p-3.5 rounded-xl bg-surface-2 border border-border text-left">
              <div className="flex items-center justify-between text-xs text-text-secondary font-medium mb-1.5">
                <span className="font-semibold">Reason:</span>
                {error?.digest && (
                  <span className="font-mono text-[11px] text-accent">
                    Digest: {error.digest}
                  </span>
                )}
              </div>
              <p className="text-xs font-mono text-text-secondary break-words leading-relaxed select-all">
                {errorMessage}
              </p>
              {error?.stack && (
                <pre className="mt-2 text-[10px] sm:text-[11px] font-mono text-text-muted overflow-x-auto p-2 rounded bg-black/40 max-h-36 whitespace-pre-wrap">
                  {error.stack}
                </pre>
              )}
            </div>
          )}
        </div>

        {/* Actions - Soft tonal styling adhering to UI guidelines */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            type="button"
            onClick={handleReload}
            disabled={isReloading}
            className="w-full sm:w-auto px-6 py-2.5 rounded-lg bg-[#FF7703] hover:bg-[#e66c02] text-white font-medium text-sm transition-all shadow-md hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
          >
            {isReloading ? "Reloading..." : "Reload Page"}
          </button>
          <button
            type="button"
            onClick={() => reset()}
            className="w-full sm:w-auto px-5 py-2.5 rounded-lg bg-surface-2 hover:bg-surface-3 text-text-primary font-medium text-sm transition-all cursor-pointer"
          >
            Try Again
          </button>
          <a
            href="/dashboard"
            className="w-full sm:w-auto px-5 py-2.5 rounded-lg bg-primary hover:bg-primary-hover text-white font-medium text-sm transition-all text-center"
          >
            Go to Dashboard
          </a>
        </div>
      </div>
    </div>
  );
}
