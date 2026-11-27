import {
  NOW_PLAYING_TRACK,
  audioUrlFor,
} from "@/components/home/now-playing-track";
import {
  createYouTubePlayer,
  loadYouTubeApi,
} from "@/components/home/now-playing-youtube";
import type { YouTubeHandle } from "@/components/home/now-playing-youtube";
import { createAudioPlayer } from "./audio-backend";
import { audioBands } from "./audio-bands";
import type { AudioBandsStore } from "./audio-bands";

export type PlayerStatus = "idle" | "loading" | "playing" | "paused" | "error";

export type PlayerSnapshot = {
  status: PlayerStatus;
  currentTime: number;
  duration: number;
  track: typeof NOW_PLAYING_TRACK;
};

export type PlayerStatusSnapshot = Pick<
  PlayerSnapshot,
  "status" | "duration" | "track"
>;

export type PlayerStoreDeps = {
  loadApi: typeof loadYouTubeApi;
  createPlayer: typeof createYouTubePlayer;
  /** Self-hosted backend; used instead of YouTube when `audioUrl` is set. */
  createAudio: typeof createAudioPlayer;
  /** The track file URL, or null to use the YouTube embed. */
  audioUrl: string | null;
  bands: AudioBandsStore;
};

export type PlayerStore = {
  subscribe: (listener: () => void) => () => void;
  subscribeStatus: (listener: () => void) => () => void;
  getSnapshot: () => PlayerSnapshot;
  getStatusSnapshot: () => PlayerStatusSnapshot;
  getServerSnapshot: () => PlayerSnapshot;
  getServerStatusSnapshot: () => PlayerStatusSnapshot;
  attachHost: (host: HTMLElement | null) => void;
  warm: () => void;
  play: () => void;
  pause: () => void;
  toggle: () => void;
  seek: (seconds: number) => void;
  destroy: () => void;
};

const TRACK = NOW_PLAYING_TRACK;
const END_GUARD_S = 0.25;
const POLL_MS = 250;
const SEEK_HOLD_MS = 400;
const LOAD_TIMEOUT_MS = 10000;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function initialSnapshot(): PlayerSnapshot {
  return {
    status: "idle",
    currentTime: 0,
    duration: TRACK.durationSeconds,
    track: TRACK,
  };
}

function toStatus(snapshot: PlayerSnapshot): PlayerStatusSnapshot {
  return {
    status: snapshot.status,
    duration: snapshot.duration,
    track: snapshot.track,
  };
}

/**
 * One external store for the whole app. The hidden YouTube iframe is created
 * lazily on the first warm/play/seek, lives in the root provider's off-screen
 * host, and is never owned by a card or a route.
 *
 * Two listener sets: the full snapshot ticks four times a second while playing,
 * while the status set only wakes on status or duration changes. That keeps the
 * nav control out of the time-tick renders.
 */
export function createPlayerStore(
  deps: Partial<PlayerStoreDeps> = {},
): PlayerStore {
  const loadApi = deps.loadApi ?? loadYouTubeApi;
  const createPlayer = deps.createPlayer ?? createYouTubePlayer;
  const createAudio = deps.createAudio ?? createAudioPlayer;
  const audioUrl =
    deps.audioUrl !== undefined ? deps.audioUrl : audioUrlFor(TRACK);
  const bands = deps.bands ?? audioBands;

  const initial = initialSnapshot();
  const initialStatus = toStatus(initial);
  let snapshot = initial;
  let statusSnapshot = initialStatus;

  const listeners = new Set<() => void>();
  const statusListeners = new Set<() => void>();

  let host: HTMLElement | null = null;
  let handle: YouTubeHandle | null = null;
  let playerPromise: Promise<YouTubeHandle | null> | null = null;
  let requestToken = 0;
  let seekHoldUntil = 0;
  let pollTimer: number | null = null;
  let loadTimer: number | null = null;

  function notifyAll() {
    for (const listener of listeners) listener();
  }

  function notifyStatus() {
    for (const listener of statusListeners) listener();
  }

  function commit(next: PlayerSnapshot) {
    const previousStatus = statusSnapshot;

    snapshot = next;
    bands.setPlaying(next.status === "playing");

    const nextStatus = toStatus(next);
    const statusChanged =
      nextStatus.status !== previousStatus.status ||
      nextStatus.duration !== previousStatus.duration;

    if (statusChanged) {
      statusSnapshot = nextStatus;
      notifyStatus();
    }

    notifyAll();
  }

  function update(partial: Partial<PlayerSnapshot>) {
    commit({ ...snapshot, ...partial });
  }

  function setTime(seconds: number) {
    const next = clamp(seconds, 0, Math.max(0, snapshot.duration));

    if (Math.abs(next - snapshot.currentTime) < 0.01) return;

    snapshot = { ...snapshot, currentTime: next };
    notifyAll();
  }

  function setDuration(seconds: number) {
    if (!Number.isFinite(seconds) || seconds <= 0) return;
    if (Math.abs(seconds - snapshot.duration) < 0.01) return;

    commit({ ...snapshot, duration: seconds });
  }

  function syncTime(player: YouTubeHandle | null) {
    if (!player) return;

    const current = player.currentTime();

    if (Number.isFinite(current)) setTime(current);
  }

  function stopPolling() {
    if (pollTimer === null) return;

    window.clearInterval(pollTimer);
    pollTimer = null;
  }

  function poll() {
    if (snapshot.status !== "playing") {
      stopPolling();
      return;
    }

    if (performance.now() < seekHoldUntil) return;

    syncTime(handle);
  }

  function startPolling() {
    if (pollTimer !== null) return;

    pollTimer = window.setInterval(poll, POLL_MS);
  }

  function clearLoadTimeout() {
    if (loadTimer === null) return;

    window.clearTimeout(loadTimer);
    loadTimer = null;
  }

  function startLoadTimeout() {
    clearLoadTimeout();
    loadTimer = window.setTimeout(() => {
      loadTimer = null;

      if (snapshot.status !== "loading") return;

      const state = handle?.state() ?? -1;

      if (state === 1 || state === 3) return;

      if (state === 2) {
        syncTime(handle);
        update({ status: "paused" });
        return;
      }

      fail();
    }, LOAD_TIMEOUT_MS);
  }

  function fail() {
    clearLoadTimeout();
    stopPolling();

    const failed = handle;

    failed?.destroy();
    handle = null;
    playerPromise = null;

    if (snapshot.status === "idle" || snapshot.status === "error") return;

    requestToken += 1;
    commit({ ...snapshot, status: "error", currentTime: 0 });
  }

  function ended() {
    clearLoadTimeout();
    stopPolling();

    if (snapshot.status === "idle" || snapshot.status === "error") return;

    commit({ ...snapshot, status: "idle", currentTime: 0 });
  }

  function obscureIframe() {
    const iframe = host?.querySelector("iframe");

    if (!iframe) return;

    iframe.tabIndex = -1;
    iframe.setAttribute("aria-hidden", "true");
  }

  /** A re-ready iframe starts at 0; restore the shared playhead and state. */
  function restore(next: YouTubeHandle) {
    if (snapshot.status === "idle" || snapshot.status === "error") return;

    const resumeAt = Math.min(
      snapshot.currentTime,
      Math.max(0, snapshot.duration - END_GUARD_S),
    );

    next.seek(resumeAt);

    if (snapshot.status === "playing" || snapshot.status === "loading") {
      next.play();
    } else if (snapshot.status === "paused") {
      next.pause();
    }
  }

  function onPlayerState(state: number, player: YouTubeHandle) {
    if (state === 1) {
      const live = snapshot.status;

      if (live !== "loading" && live !== "playing") {
        // A stale play request must never win over a pause or a rest.
        player.pause();
        return;
      }

      clearLoadTimeout();

      if (live === "loading") update({ status: "playing" });

      setDuration(player.duration());
      startPolling();
      return;
    }

    if (state === 2) {
      clearLoadTimeout();

      if (snapshot.status === "loading" || snapshot.status === "playing") {
        syncTime(player);
        stopPolling();
        update({ status: "paused" });
      }
      return;
    }

    if (state === 0) {
      ended();
    }
  }

  async function ensurePlayer(): Promise<YouTubeHandle | null> {
    if (handle) return handle;
    if (playerPromise) return playerPromise;

    const target = host;

    if (!target || !target.isConnected) return null;

    playerPromise = (async (): Promise<YouTubeHandle | null> => {
      if (!audioUrl) {
        try {
          await loadApi();
        } catch {
          return null;
        }
      }

      if (!target.isConnected) return null;

      return await new Promise<YouTubeHandle | null>((resolve) => {
        let settled = false;

        const settle = (value: YouTubeHandle | null) => {
          if (settled) return;
          settled = true;
          resolve(value);
        };

        try {
          const callbacks = {
            onReady: (next: YouTubeHandle, duration: number) => {
              const firstReady = handle === null;

              handle = next;
              setDuration(duration);
              obscureIframe();

              if (!firstReady) restore(next);

              settle(next);
            },
            onStateChange: (state: number, next: YouTubeHandle) =>
              onPlayerState(state, next),
            onError: () => {
              settle(null);
              fail();
            },
          };

          if (audioUrl) createAudio(target, audioUrl, callbacks, bands);
          else createPlayer(target, TRACK.videoId, callbacks);
        } catch {
          settle(null);
        }
      });
    })();

    const created = await playerPromise;

    if (!created) playerPromise = null;

    return created;
  }

  function play() {
    const live = snapshot.status;

    if (live === "playing" || live === "loading") return;

    // Runs inside the click, which is what lets the AudioContext start.
    if (audioUrl) bands.prepare();

    const startAt = snapshot.currentTime;

    if (live === "paused" && handle) {
      update({ status: "playing" });
      startPolling();
      handle.play();
      return;
    }

    requestToken += 1;
    const token = requestToken;

    update({ status: "loading" });
    startLoadTimeout();

    void ensurePlayer().then((player) => {
      if (token !== requestToken) return;
      if (!player) {
        fail();
        return;
      }
      if (snapshot.status !== "loading") return;

      player.seek(
        Math.min(startAt, Math.max(0, snapshot.duration - END_GUARD_S)),
      );
      player.play();
    });
  }

  function cancelLoading() {
    requestToken += 1;
    clearLoadTimeout();
    stopPolling();
    handle?.pause();
    handle?.seek(0);
    update({ status: "idle", currentTime: 0 });
  }

  function pause() {
    const live = snapshot.status;

    if (live === "loading") {
      cancelLoading();
      return;
    }

    if (live !== "playing") return;

    clearLoadTimeout();
    syncTime(handle);
    stopPolling();
    handle?.pause();
    update({ status: "paused" });
  }

  function toggle() {
    const live = snapshot.status;

    if (live === "playing") {
      pause();
      return;
    }

    if (live === "loading") {
      cancelLoading();
      return;
    }

    play();
  }

  function seek(seconds: number) {
    if (!Number.isFinite(seconds)) return;

    const display = clamp(seconds, 0, Math.max(0, snapshot.duration));

    seekHoldUntil = performance.now() + SEEK_HOLD_MS;
    setTime(display);

    const target = Math.min(
      display,
      Math.max(0, snapshot.duration - END_GUARD_S),
    );
    const player = handle;

    if (player) {
      player.seek(target);
      return;
    }

    // Scrubbing is a press: it is allowed to create the lazy player.
    void ensurePlayer().then((created) => {
      created?.seek(target);
    });
  }

  function destroy() {
    clearLoadTimeout();
    stopPolling();
    handle?.destroy();
    handle = null;
    playerPromise = null;
    host = null;
    bands.setPlaying(false);
    listeners.clear();
    statusListeners.clear();
  }

  return {
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    subscribeStatus(listener) {
      statusListeners.add(listener);
      return () => statusListeners.delete(listener);
    },
    getSnapshot: () => snapshot,
    getStatusSnapshot: () => statusSnapshot,
    getServerSnapshot: () => initial,
    getServerStatusSnapshot: () => initialStatus,
    attachHost(node) {
      host = node;
    },
    warm() {
      void ensurePlayer();
    },
    play,
    pause,
    toggle,
    seek,
    destroy,
  };
}

/** The app-wide instance. The root provider attaches its one iframe host. */
export const playerStore = createPlayerStore();
