import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  YouTubeCallbacks,
  YouTubeHandle,
} from "@/components/home/now-playing-youtube";
import { createPlayerStore } from "./player-store";

const cleanups: (() => void)[] = [];

afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup();
});

function makeHarness() {
  const host = document.createElement("div");
  document.body.append(host);

  const handle: YouTubeHandle = {
    play: vi.fn(),
    pause: vi.fn(),
    seek: vi.fn(),
    currentTime: vi.fn(() => 0),
    duration: vi.fn(() => 249),
    state: vi.fn(() => -1),
    destroy: vi.fn(),
  };

  let callbacks: YouTubeCallbacks | null = null;

  const createPlayer = vi.fn(
    (_host: HTMLElement, _videoId: string, next: YouTubeCallbacks) => {
      callbacks = next;
      return handle;
    },
  );
  const loadApi = vi.fn(async () => ({}) as never);
  const store = createPlayerStore({ loadApi, createPlayer });

  store.attachHost(host);

  cleanups.push(() => {
    store.destroy();
    host.remove();
  });

  return {
    store,
    handle,
    createPlayer,
    loadApi,
    ready(duration = 249) {
      callbacks?.onReady(handle, duration);
    },
    playerState(next: number) {
      callbacks?.onStateChange(next, handle);
    },
    error() {
      callbacks?.onError(150, handle);
    },
  };
}

async function playingHarness() {
  const harness = makeHarness();

  harness.store.play();
  await vi.waitFor(() => expect(harness.createPlayer).toHaveBeenCalledTimes(1));
  harness.ready();
  await vi.waitFor(() => expect(harness.handle.play).toHaveBeenCalled());
  harness.playerState(1);

  return harness;
}

describe("player store", () => {
  it("starts idle with the track and its drawn duration", () => {
    const harness = makeHarness();
    const snapshot = harness.store.getSnapshot();

    expect(snapshot.status).toBe("idle");
    expect(snapshot.currentTime).toBe(0);
    expect(snapshot.duration).toBe(249);
    expect(snapshot.track.title).toBe("Get Lucky");
    expect(snapshot.track.artist).toBe("Daft Punk");
  });

  it("does not touch YouTube until a player control asks for it", async () => {
    const harness = makeHarness();

    expect(harness.loadApi).not.toHaveBeenCalled();
    expect(harness.createPlayer).not.toHaveBeenCalled();

    harness.store.warm();

    await vi.waitFor(() =>
      expect(harness.createPlayer).toHaveBeenCalledTimes(1),
    );
    expect(harness.loadApi).toHaveBeenCalledTimes(1);
  });

  it("plays through exactly one lazy player", async () => {
    const harness = await playingHarness();

    expect(harness.store.getSnapshot().status).toBe("playing");
    expect(harness.handle.play).toHaveBeenCalledTimes(1);
    expect(harness.handle.seek).toHaveBeenCalledWith(0);

    harness.store.play();
    harness.store.warm();

    expect(harness.createPlayer).toHaveBeenCalledTimes(1);
  });

  it("keeps the frozen playhead when paused", async () => {
    const harness = await playingHarness();

    vi.mocked(harness.handle.currentTime).mockReturnValue(42.4);
    harness.store.pause();

    expect(harness.store.getSnapshot().status).toBe("paused");
    expect(harness.store.getSnapshot().currentTime).toBeCloseTo(42.4);
    expect(harness.handle.pause).toHaveBeenCalled();
  });

  it("seeks the player and updates the shared time", async () => {
    const harness = await playingHarness();

    harness.store.seek(90);

    expect(harness.store.getSnapshot().currentTime).toBe(90);
    expect(harness.store.getSnapshot().status).toBe("playing");
    expect(harness.handle.seek).toHaveBeenCalledWith(90);
  });

  it("keeps an idle scrub as the start position for the next play", async () => {
    const harness = makeHarness();

    harness.store.seek(30);

    await vi.waitFor(() =>
      expect(harness.createPlayer).toHaveBeenCalledTimes(1),
    );
    harness.ready();

    await vi.waitFor(() =>
      expect(harness.handle.seek).toHaveBeenCalledWith(30),
    );
    expect(harness.store.getSnapshot().status).toBe("idle");
    expect(harness.store.getSnapshot().currentTime).toBe(30);

    harness.store.play();

    await vi.waitFor(() => expect(harness.handle.play).toHaveBeenCalled());
    expect(harness.handle.seek).toHaveBeenCalledWith(30);
  });

  it("toggles between playing and paused", async () => {
    const harness = await playingHarness();

    harness.store.toggle();
    expect(harness.store.getSnapshot().status).toBe("paused");

    harness.store.toggle();
    expect(harness.store.getSnapshot().status).toBe("playing");
    expect(harness.handle.play).toHaveBeenCalledTimes(2);
  });

  it("returns to rest when the track ends", async () => {
    const harness = await playingHarness();

    harness.playerState(0);

    expect(harness.store.getSnapshot().status).toBe("idle");
    expect(harness.store.getSnapshot().currentTime).toBe(0);
  });

  it("surfaces a player error and clears the playhead", async () => {
    const harness = await playingHarness();

    harness.error();

    expect(harness.store.getSnapshot().status).toBe("error");
    expect(harness.store.getSnapshot().currentTime).toBe(0);
    expect(harness.handle.destroy).toHaveBeenCalledTimes(1);
  });

  it("creates a fresh player after a failure tears the old one down", async () => {
    const harness = await playingHarness();

    harness.error();
    harness.store.play();

    await vi.waitFor(() =>
      expect(harness.createPlayer).toHaveBeenCalledTimes(2),
    );
  });

  it("notifies time listeners without waking status-only listeners", async () => {
    const harness = await playingHarness();
    const all = vi.fn();
    const statusOnly = vi.fn();

    harness.store.subscribe(all);
    harness.store.subscribeStatus(statusOnly);
    harness.store.seek(15);

    expect(all).toHaveBeenCalled();
    expect(statusOnly).not.toHaveBeenCalled();
  });
});
