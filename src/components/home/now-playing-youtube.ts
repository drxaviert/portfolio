/**
 * Lazy YouTube IFrame Player loader for the persistent player.
 *
 * The API script is only fetched when a player control warms the store, never
 * on page load, so it stays out of LCP. The embed is created against
 * youtube-nocookie.com and lives off-screen: this is an audio player, and
 * nothing in the iframe is meant to be seen or reached by keyboard or screen
 * readers.
 */

type YTPlayerLike = {
  playVideo: () => void;
  pauseVideo: () => void;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  getPlayerState: () => number;
  destroy: () => void;
};

type YTPlayerOptions = {
  videoId: string;
  host?: string;
  playerVars?: Record<string, string | number>;
  events?: {
    onReady?: (event: { target: YTPlayerLike }) => void;
    onStateChange?: (event: { data: number; target: YTPlayerLike }) => void;
    onError?: (event: { data: number; target: YTPlayerLike }) => void;
  };
};

type YTNamespace = {
  Player: new (element: HTMLElement, options: YTPlayerOptions) => YTPlayerLike;
};

declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let apiPromise: Promise<YTNamespace> | null = null;

export function loadYouTubeApi(): Promise<YTNamespace> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("YouTube API needs a browser"));
  }

  if (window.YT?.Player) {
    return Promise.resolve(window.YT);
  }

  if (apiPromise) return apiPromise;

  apiPromise = new Promise<YTNamespace>((resolve, reject) => {
    const previous = window.onYouTubeIframeAPIReady;

    window.onYouTubeIframeAPIReady = () => {
      previous?.();

      const api = window.YT;

      if (api?.Player) {
        resolve(api);
      } else {
        apiPromise = null;
        reject(new Error("YouTube API loaded without a player"));
      }
    };

    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    script.async = true;
    script.addEventListener(
      "error",
      () => {
        // Let a later retry append a fresh script instead of reusing the
        // rejected promise forever.
        apiPromise = null;
        reject(new Error("YouTube player API failed to load"));
      },
      { once: true },
    );
    document.head.appendChild(script);
  });

  return apiPromise;
}

export type YouTubeHandle = {
  play: () => void;
  pause: () => void;
  seek: (seconds: number) => void;
  currentTime: () => number;
  duration: () => number;
  state: () => number;
  destroy: () => void;
};

export type YouTubeCallbacks = {
  onReady: (handle: YouTubeHandle, duration: number) => void;
  onStateChange: (state: number, handle: YouTubeHandle) => void;
  onError: (code: number, handle: YouTubeHandle) => void;
};

/**
 * Creates the player inside `host` (a React-owned empty wrapper, so React never
 * sees YouTube replace one of its own elements). Returns the handle on ready.
 */
export function createYouTubePlayer(
  host: HTMLElement,
  videoId: string,
  callbacks: YouTubeCallbacks,
): YouTubeHandle {
  const mount = document.createElement("div");
  host.replaceChildren(mount);

  const api = window.YT;

  if (!api?.Player) {
    throw new Error("YouTube API is not ready");
  }

  const playerRef: { current: YTPlayerLike | null } = { current: null };

  const handle: YouTubeHandle = {
    play: () => playerRef.current?.playVideo(),
    pause: () => playerRef.current?.pauseVideo(),
    seek: (seconds) => playerRef.current?.seekTo(seconds, true),
    currentTime: () => playerRef.current?.getCurrentTime() ?? 0,
    duration: () => playerRef.current?.getDuration() ?? 0,
    state: () => playerRef.current?.getPlayerState() ?? -1,
    destroy: () => {
      const player = playerRef.current;

      playerRef.current = null;
      player?.destroy();
    },
  };

  playerRef.current = new api.Player(mount, {
    videoId,
    host: "https://www.youtube-nocookie.com",
    playerVars: {
      autoplay: 0,
      controls: 0,
      disablekb: 1,
      playsinline: 1,
      modestbranding: 1,
      rel: 0,
      origin: window.location.origin,
    },
    events: {
      onReady: () => {
        callbacks.onReady(handle, handle.duration());
      },
      onStateChange: (event) => {
        callbacks.onStateChange(event.data, handle);
      },
      onError: (event) => {
        callbacks.onError(event.data, handle);
      },
    },
  });

  return handle;
}
