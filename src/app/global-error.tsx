"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Critical root layout error:", error);

    const isChunkOrFetchError =
      error?.name === "ChunkLoadError" ||
      error?.message?.includes("Loading chunk") ||
      error?.message?.includes("Failed to fetch dynamically imported module");

    if (isChunkOrFetchError) {
      try {
        const reloadKey = "gandharva_global_chunk_reload";
        if (!sessionStorage.getItem(reloadKey)) {
          sessionStorage.setItem(reloadKey, "true");
          window.location.reload();
        }
      } catch {}
    }
  }, [error]);

  return (
    <html lang="en">
      <body className="min-h-screen bg-neutral-950 text-neutral-100 flex items-center justify-center p-6 antialiased font-sans">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="inline-block px-3 py-1 rounded-full border border-red-500/30 bg-red-500/10 text-red-400 text-xs uppercase tracking-widest font-semibold">
            System Alert
          </div>

          <h1 className="text-3xl font-serif text-white tracking-tight">
            Gandharva Platform Interrupted
          </h1>

          <p className="text-neutral-400 text-sm leading-relaxed">
            A critical error occurred while loading the application shell.
            Please refresh the application or click below to retry.
          </p>

          {error?.message && (
            <div className="p-3 rounded-lg bg-red-950/40 border border-red-500/20 text-xs font-mono text-red-300 text-left overflow-x-auto">
              {error.message}
            </div>
          )}

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => {
                try {
                  sessionStorage.removeItem("gandharva_global_chunk_reload");
                } catch {}
                window.location.reload();
              }}
              className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-[#9506ee] hover:bg-[#8200da] text-white font-medium text-sm transition-all shadow-lg cursor-pointer"
            >
              Reload Platform
            </button>
            <button
              type="button"
              onClick={() => reset()}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-medium text-sm transition-all cursor-pointer"
            >
              Try Again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
