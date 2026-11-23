/**
 * Lazy YouTube IFrame Player loader for the now-playing card.
 *
 * The API script is only fetched when the card is first hovered, focused or
 * tapped (see now-playing-card.tsx), never on page load, so it stays out of LCP. The
 * embed itself is created against youtube-nocookie.com and lives off-screen:
 * the card is an audio player, and nothing in the iframe is meant to be seen or
 * reached by keyboard or screen readers.
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
  PlayerState: {
    UNSTARTED: number;
    ENDED: number;
    PLAYING: number;
    PAUSED: number;
    BUFFERING: number;
    CUED: number;
  };
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

export type YouTubeState = {
  unstarted: number;
  ended: number;
  playing: number;
  paused: number;
  buffering: number;
  cued: number;
};

export type YouTubeCallbacks = {
  onReady: (
    handle: YouTubeHandle,
    state: YouTubeState,
    duration: number,
  ) => void;
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

  const requirePlayer = () => {
    const player = playerRef.current;

    if (!player) throw new Error("YouTube player is not ready");

    return player;
  };

  const handle: YouTubeHandle = {
    play: () => requirePlayer().playVideo(),
    pause: () => requirePlayer().pauseVideo(),
    seek: (seconds) => requirePlayer().seekTo(seconds, true),
    currentTime: () => requirePlayer().getCurrentTime() ?? 0,
    duration: () => requirePlayer().getDuration() ?? 0,
    state: () => requirePlayer().getPlayerState() ?? -1,
    destroy: () => requirePlayer().destroy(),
  };

  const state: YouTubeState = {
    unstarted: api.PlayerState.UNSTARTED,
    ended: api.PlayerState.ENDED,
    playing: api.PlayerState.PLAYING,
    paused: api.PlayerState.PAUSED,
    buffering: api.PlayerState.BUFFERING,
    cued: api.PlayerState.CUED,
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
        callbacks.onReady(handle, state, handle.duration());
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
