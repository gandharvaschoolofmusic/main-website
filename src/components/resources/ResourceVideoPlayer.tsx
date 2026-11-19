"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Play, X, Loader2, ExternalLink } from "lucide-react";
import { resourcePlaybackAction } from "@/actions/resource-videos";

export function ResourceVideoPlayer({ id, title, onPlay }: { id: string; title: string; onPlay?: () => void }) {
  const [open, setOpen] = useState(false);
  return <>
    <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-1.5 rounded-xl bg-primary-subtle px-3 py-2 text-xs font-semibold text-primary hover:bg-primary/15 focus-visible:outline-2 focus-visible:outline-primary">
      <Play className="h-4 w-4" />Watch video
    </button>
    {open && <VideoDialog id={id} title={title} onPlay={onPlay} onClose={() => setOpen(false)} />}
  </>;
}

function VideoDialog({ id, title, onPlay, onClose }: { id: string; title: string; onPlay?: () => void; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const heading = useId();
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const element = video.current;
    return () => {
      element?.pause();
      element?.removeAttribute("src");
      element?.load();
    };
  }, [url, error, attempt]);
  useEffect(() => {
    const element = dialog.current!;
    element.showModal();
    return () => element.close();
  }, []);
  useEffect(() => {
    let active = true;
    void resourcePlaybackAction(id).then(result => {
      if (!active) return;
      if (result.success && result.data) setUrl(result.data.url);
      else setError(result.error || "Video unavailable. Please try again.");
    }).catch(() => { if (active) setError("Could not load the video. Check your connection and try again."); });
    return () => { active = false; };
  }, [id, attempt]);
  return <dialog ref={dialog} aria-labelledby={heading} onCancel={onClose}
    onClick={event => { if (event.target === event.currentTarget) onClose(); }}
    className="m-auto w-[calc(100%-2rem)] max-w-4xl max-h-[90dvh] overflow-auto rounded-2xl bg-bg p-0 text-heading shadow-2xl backdrop:bg-black/60">
    <div className="flex items-center justify-between gap-4 px-5 py-4">
      <div className="min-w-0"><p className="text-xs font-medium text-primary">Learning video</p><h2 id={heading} className="mt-1 font-serif text-lg font-bold break-words">{title}</h2></div>
      <button type="button" onClick={onClose} aria-label="Close video" className="shrink-0 rounded-full bg-primary-subtle p-3 text-primary hover:bg-primary/15"><X className="h-5 w-5" /></button>
    </div>
    <div className="aspect-video bg-[#161020] flex items-center justify-center text-stone-100">
      {error ? <div role="alert" className="max-w-md p-6 text-center text-sm"><p>{error}</p><button type="button" className="mt-4 rounded-xl bg-primary px-4 py-2 font-semibold text-white" onClick={() => { setError(""); setUrl(""); setAttempt(value => value + 1); }}>Try again</button></div>
        : url ? <video ref={video} key={url + attempt} src={url} controls playsInline preload="metadata" aria-label={title} onPlay={onPlay}
          onError={() => setError("This video could not play. Try again, or open the original file below. MP4 with H.264 video works on most devices.")}
          className="h-full w-full object-contain" />
        : <div role="status" className="flex items-center gap-2 text-sm"><Loader2 className="h-5 w-5 animate-spin motion-reduce:animate-none" />Loading video…</div>}
    </div>
    <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 text-xs text-body-muted"><span>Play, pause, seek, or watch in full screen.</span>
      {url && <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-lg bg-primary-subtle px-3 py-2 font-semibold text-primary">Open original<ExternalLink className="h-3.5 w-3.5" /></a>}
    </div>
  </dialog>;
}
