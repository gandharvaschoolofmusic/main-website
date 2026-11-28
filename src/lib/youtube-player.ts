export interface YoutubePlayer {
  getPlaylist(): string[];
  getPlaylistIndex(): number;
  playVideoAt(index: number): void;
  getIframe(): HTMLIFrameElement;
  destroy(): void;
}

type PlayerEvent = { target: YoutubePlayer; data?: number };
export interface YoutubeApi {
  Player: new (element: HTMLElement, options: {
    width: string;
    height: string;
    playerVars: Record<string, string | number>;
    events: { onReady(event: PlayerEvent): void; onStateChange(event: PlayerEvent): void; onError(event: PlayerEvent): void };
  }) => YoutubePlayer;
}

let pending: Promise<YoutubeApi> | null = null;

/** Share one API download across course switches; allow retry after a failed load. */
export function loadYoutubeApi(): Promise<YoutubeApi> {
  const scope = window as Window & { YT?: YoutubeApi; onYouTubeIframeAPIReady?: () => void };
  if (scope.YT?.Player) return Promise.resolve(scope.YT);
  if (pending) return pending;
  pending = new Promise<YoutubeApi>((resolve, reject) => {
    const script = document.createElement("script");
    const previous = scope.onYouTubeIframeAPIReady;
    const cleanup = () => {
      clearTimeout(timeout);
      if (scope.onYouTubeIframeAPIReady === ready) scope.onYouTubeIframeAPIReady = previous;
    };
    const fail = () => { cleanup(); script.remove(); reject(new Error("YouTube could not load. Check your connection and try again.")); };
    const ready = () => {
      cleanup();
      if (scope.YT?.Player) resolve(scope.YT);
      else reject(new Error("YouTube is unavailable. Please try again."));
      previous?.();
    };
    const timeout = setTimeout(fail, 20000);
    scope.onYouTubeIframeAPIReady = ready;
    script.src = "https://www.youtube.com/iframe_api";
    script.async = true;
    script.onerror = fail;
    document.head.appendChild(script);
  }).catch(error => { pending = null; throw error; });
  return pending;
}

export function youtubePlaybackError(code?: number): string {
  if (code === 100) return "This video is unavailable or private. Ask the school to check the recording.";
  if (code === 101 || code === 150) return "Embedding is disabled for this video. Ask the school to enable embedding in YouTube Studio.";
  return "This video could not play. Try another lecture or reload the player.";
}
