"use client";

import { useEffect, useRef, useState } from "react";
import { loadYoutubeApi, youtubePlaybackError, type YoutubePlayer } from "@/lib/youtube-player";

export function YoutubePlaylistPlayer({ playlistId, title }: { playlistId: string; title: string }) {
  const host = useRef<HTMLDivElement>(null);
  const player = useRef<YoutubePlayer | null>(null);
  const [videos, setVideos] = useState<string[]>([]);
  const [selected, setSelected] = useState(-1);
  const [status, setStatus] = useState("Loading course videos…");
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let timedOut = false;
    let instance: YoutubePlayer | null = null;
    let poll: ReturnType<typeof setInterval> | undefined;
    let deadline: ReturnType<typeof setTimeout> | undefined;
    const container = host.current;
    const sync = (target: YoutubePlayer) => {
      if (cancelled) return;
      const ids = target.getPlaylist?.() || [];
      if (ids.length) {
        setVideos(current => current.join(",") === ids.join(",") ? current : ids);
        setSelected(target.getPlaylistIndex());
        setStatus("");
        clearInterval(poll);
        clearTimeout(deadline);
      }
    };
    deadline = setTimeout(() => {
      timedOut = true;
      if (!cancelled) setStatus("The lecture list could not load. Try the player's playlist menu or reload the player.");
      clearInterval(poll);
    }, 25000);
    loadYoutubeApi().then(api => {
      if (cancelled || !container) return;
      const mount = document.createElement("div");
      container.replaceChildren(mount);
      instance = new api.Player(mount, {
        width: "100%", height: "100%",
        playerVars: { listType: "playlist", list: playlistId, playsinline: 1, rel: 0, origin: window.location.origin },
        events: {
          onReady: event => {
            if (cancelled) return;
            event.target.getIframe().title = `${title} — course recordings`;
            event.target.getIframe().setAttribute("referrerpolicy", "strict-origin-when-cross-origin");
            if (!timedOut) poll = setInterval(() => sync(event.target), 500);
            sync(event.target);
          },
          onStateChange: event => { sync(event.target); if (!cancelled && event.data === 1) setError(""); },
          onError: event => { if (!cancelled) { setError(youtubePlaybackError(event.data)); sync(event.target); } },
        },
      });
      player.current = instance;
    }).catch(reason => {
      if (!cancelled) { setError(reason instanceof Error ? reason.message : "YouTube could not load."); setStatus(""); }
      clearTimeout(deadline);
    });
    return () => {
      cancelled = true;
      clearInterval(poll);
      clearTimeout(deadline);
      player.current = null;
      instance?.destroy();
      container?.replaceChildren();
    };
  }, [playlistId, title, attempt]);

  return <div className="space-y-4">
    <div ref={host} className="aspect-video min-h-[200px] w-full overflow-hidden rounded-xl bg-black" />
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h3 className="font-semibold text-heading">Course lectures{videos.length > 0 ? ` (${videos.length})` : ""}</h3>
      <button type="button" onClick={() => { setVideos([]); setSelected(-1); setError(""); setStatus("Loading course videos…"); setAttempt(value => value + 1); }} className="min-h-11 rounded-lg px-3 text-sm font-medium text-primary hover:bg-primary/10">Reload player</button>
    </div>
    {status && <p role="status" className="text-sm text-body">{status}</p>}
    {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    <ol className="grid max-h-96 gap-2 overflow-y-auto sm:grid-cols-2 xl:grid-cols-3" aria-label="Choose a lecture">
      {videos.map((id, index) => <li key={`${index}-${id}`}>
        <button type="button" aria-pressed={selected === index} onClick={() => { setError(""); player.current?.playVideoAt(index); setSelected(index); }} className={`flex min-h-16 w-full items-center gap-3 rounded-lg p-3 text-left text-sm ${selected === index ? "bg-primary text-white" : "bg-primary/5 text-heading hover:bg-primary/10"}`}>
          <span className="font-semibold">{String(index + 1).padStart(2, "0")}</span>
          <span className="min-w-0"><span className="block font-medium">Lecture {index + 1}</span><span className="block text-xs opacity-75">{selected === index ? "Selected" : "Play recording"}</span></span>
        </button>
      </li>)}
    </ol>
  </div>;
}
