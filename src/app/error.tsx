"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [showDetails, setShowDetails] = useState(false);
  const [isReloading, setIsReloading] = useState(false);

  useEffect(() => {
    // 1. Log unexpected errors to console
    console.error("Runtime application error caught by boundary:", error);

    // 2. Auto-recover from chunk load / version mismatch errors that happen after deployments
    const isChunkOrFetchError =
      error?.name === "ChunkLoadError" ||
      error?.message?.includes("Loading chunk") ||
      error?.message?.includes("Failed to fetch dynamically imported module") ||
      error?.message?.includes("Importing a module script failed");

    if (isChunkOrFetchError) {
      try {
        const reloadKey = "gandharva_chunk_reload";
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
      sessionStorage.removeItem("gandharva_chunk_reload");
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
          <span>Application Error</span>
        </div>

        {/* Heading */}
        <h1 className="font-serif text-2xl sm:text-4xl font-normal text-text-primary tracking-tight mb-3">
          A Moment of Discordance
        </h1>

        <p className="text-text-secondary text-sm sm:text-base mb-5 leading-relaxed">
          An unexpected interruption occurred while rendering this page.
          Your data and room connections remain safe.
        </p>

        {/* Diagnostic Error Message Box (Visible so issues can be diagnosed immediately) */}
        <div className="mb-6 p-3 sm:p-4 rounded-xl bg-red-950/20 border border-red-500/20 text-left">
          <div className="flex items-center justify-between text-xs text-red-300 font-medium mb-1.5">
            <span className="font-semibold">Reason:</span>
            {error?.digest && (
              <span className="font-mono text-[11px] text-red-400/80">
                Digest: {error.digest}
              </span>
            )}
          </div>
          <p className="text-xs sm:text-sm font-mono text-red-200/90 break-words leading-relaxed select-all">
            {errorMessage}
          </p>

          {/* Toggle Stack / Details */}
          {error?.stack && (
            <div className="mt-2.5 pt-2 border-t border-red-500/15">
              <button
                type="button"
                onClick={() => setShowDetails(!showDetails)}
                className="text-[11px] text-red-300/80 hover:text-red-200 underline cursor-pointer"
              >
                {showDetails ? "Hide technical stack" : "Show technical stack"}
              </button>
              {showDetails && (
                <pre className="mt-2 text-[10px] sm:text-[11px] font-mono text-red-300/70 overflow-x-auto p-2 rounded bg-black/30 max-h-40 whitespace-pre-wrap">
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
          <Link
            href="/"
            className="w-full sm:w-auto px-5 py-2.5 rounded-lg bg-primary hover:bg-primary-hover text-white font-medium text-sm transition-all text-center"
          >
            Go to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
