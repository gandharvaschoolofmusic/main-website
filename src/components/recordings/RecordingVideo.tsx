"use client";

import { useEffect, useState } from "react";
import { Film, RefreshCw } from "lucide-react";

export function RecordingVideo({ source, title }: { source: string; title: string }) {
  const [attempt, setAttempt] = useState(0);
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      const endpoint = new URL(source, window.location.origin);
      endpoint.searchParams.set("resolve", "1");
      try {
        const response = await fetch(endpoint, { signal: controller.signal, cache: "no-store" });
        if (!response.ok) {
          throw new Error(response.status === 404 ? "The video file could not be found in storage." :
            response.status === 401 ? "Sign in again to watch this recording." : "Storage could not be reached. Try again in a moment.");
        }
        const result = await response.json();
        if (!controller.signal.aborted) setUrl(result.url);
      } catch (cause) {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Could not load this recording.");
      }
    }
    void load();
    return () => controller.abort();
  }, [source, attempt]);
  return <div className="relative grid aspect-video w-full place-items-center bg-[#171221] text-stone-100">
    {error ? <div role="alert" className="max-w-md px-5 py-3 text-center">
      <Film className="mx-auto mb-2 size-6 text-purple-300" aria-hidden="true"/>
      <p className="font-semibold">Recording unavailable</p>
      <p className="mt-1 text-sm text-stone-300">{error}</p>
      <button type="button" onClick={() => { setError(""); setUrl(""); setAttempt(value => value + 1); }}
        className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-full bg-white/10 px-4 text-sm font-medium hover:bg-white/20">
        <RefreshCw size={15}/> Try again
      </button>
    </div> : url ? <video aria-label={title} src={url} controls autoPlay playsInline preload="metadata"
      className="absolute inset-0 h-full w-full object-contain"
      onError={event => setError(event.currentTarget.error?.code === 4
        ? "This file is missing or its format cannot be played in this browser."
        : "Playback was interrupted. Try loading the recording again.")}/>
      : <p role="status" className="text-sm text-stone-300">Loading recording…</p>}
  </div>;
}
