import { afterEach, describe, expect, it, vi } from "vitest";
import type { YouTubeCallbacks } from "@/components/home/now-playing-youtube";
import { createAudioPlayer } from "./audio-backend";
import type { AudioBandsStore } from "./audio-bands";
import { createPlayerStore } from "./player-store";

const cleanups: (() => void)[] = [];

afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup();
  vi.restoreAllMocks();
});

function makeCallbacks(): YouTubeCallbacks {
  return { onReady: vi.fn(), onStateChange: vi.fn(), onError: vi.fn() };
}

function makeBands(): AudioBandsStore {
  return {
    prepare: vi.fn(),
    attach: vi.fn(),
    detach: vi.fn(),
    setPlaying: vi.fn(),
    getBands: vi.fn(() => ({ bass: 0, mid: 0, high: 0, energy: 0 })),
  };
}

function setup() {
  const host = document.createElement("div");
  document.body.append(host);
  cleanups.push(() => host.remove());

  vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(
    async () => {},
  );
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
  vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => {});

  const callbacks = makeCallbacks();
  const bands = makeBands();
  const handle = createAudioPlayer(
    host,
    "/media/local/a.mp3",
    callbacks,
    bands,
  );
  const audio = host.querySelector("audio") as HTMLAudioElement;

  return { host, callbacks, bands, handle, audio };
}

describe("createAudioPlayer", () => {
  it("builds an anonymous-CORS audio element and routes it to the analyser", () => {
    const { audio, bands } = setup();

    expect(audio.crossOrigin).toBe("anonymous");
    expect(audio.getAttribute("src")).toBe("/media/local/a.mp3");
    expect(bands.attach).toHaveBeenCalledWith(audio);
  });

  it("reports ready with the duration once metadata loads", () => {
    const { audio, callbacks, handle } = setup();

    Object.defineProperty(audio, "duration", {
      configurable: true,
      value: 375,
    });
    audio.dispatchEvent(new Event("loadedmetadata"));

    expect(callbacks.onReady).toHaveBeenCalledWith(handle, 375);
  });

  it("maps media events onto the YouTube state codes", () => {
    const { audio, callbacks, handle } = setup();

    audio.dispatchEvent(new Event("playing"));
    audio.dispatchEvent(new Event("pause"));
    audio.dispatchEvent(new Event("ended"));

    expect(callbacks.onStateChange).toHaveBeenNthCalledWith(1, 1, handle);
    expect(callbacks.onStateChange).toHaveBeenNthCalledWith(2, 2, handle);
    expect(callbacks.onStateChange).toHaveBeenNthCalledWith(3, 0, handle);
  });

  it("reports an element error", () => {
    const { audio, callbacks } = setup();

    audio.dispatchEvent(new Event("error"));

    expect(callbacks.onError).toHaveBeenCalledTimes(1);
  });

  it("drives the element and tears down on destroy", () => {
    const { audio, bands, handle, callbacks } = setup();

    handle.seek(42);
    expect(audio.currentTime).toBe(42);
    handle.play();
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalled();

    handle.destroy();
    expect(bands.detach).toHaveBeenCalledWith(audio);
    expect(audio.isConnected).toBe(false);

    audio.dispatchEvent(new Event("playing"));
    expect(callbacks.onStateChange).not.toHaveBeenCalled();
  });
});

describe("player store audio backend", () => {
  function storeHarness(audioUrl: string | null) {
    const host = document.createElement("div");
    document.body.append(host);

    const handle = {
      play: vi.fn(),
      pause: vi.fn(),
      seek: vi.fn(),
      currentTime: vi.fn(() => 0),
      duration: vi.fn(() => 375),
      state: vi.fn(() => -1),
      destroy: vi.fn(),
    };
    let callbacks: YouTubeCallbacks | null = null;
    const createAudio = vi.fn(
      (_host: HTMLElement, _url: string, next: YouTubeCallbacks) => {
        callbacks = next;
        queueMicrotask(() => next.onReady(handle, 375));
        return handle;
      },
    );
    const createPlayer = vi.fn(() => handle);
    const loadApi = vi.fn(async () => ({}) as never);
    const bands = makeBands();
    const store = createPlayerStore({
      createAudio,
      createPlayer,
      loadApi,
      audioUrl,
      bands,
    });

    store.attachHost(host);
    cleanups.push(() => {
      store.destroy();
      host.remove();
    });

    return {
      store,
      handle,
      createAudio,
      createPlayer,
      loadApi,
      bands,
      state(next: number) {
        callbacks?.onStateChange(next, handle);
      },
    };
  }

  it("uses the audio backend, not YouTube, when the track has a URL", async () => {
    const h = storeHarness("/media/local/a.mp3");

    h.store.play();
    await vi.waitFor(() => expect(h.handle.play).toHaveBeenCalled());

    expect(h.createAudio).toHaveBeenCalledWith(
      expect.anything(),
      "/media/local/a.mp3",
      expect.anything(),
      h.bands,
    );
    expect(h.createPlayer).not.toHaveBeenCalled();
    expect(h.loadApi).not.toHaveBeenCalled();
  });

  it("prepares the analyser from the play gesture", () => {
    const h = storeHarness("/media/local/a.mp3");

    h.store.play();

    expect(h.bands.prepare).toHaveBeenCalledTimes(1);
  });

  it("keeps the statuses and tells the analyser when audio is playing", async () => {
    const h = storeHarness("/media/local/a.mp3");

    h.store.play();
    expect(h.store.getSnapshot().status).toBe("loading");
    await vi.waitFor(() => expect(h.handle.play).toHaveBeenCalled());

    h.state(1);
    expect(h.store.getSnapshot().status).toBe("playing");
    expect(h.bands.setPlaying).toHaveBeenLastCalledWith(true);

    h.state(2);
    expect(h.store.getSnapshot().status).toBe("paused");
    expect(h.bands.setPlaying).toHaveBeenLastCalledWith(false);
  });

  it("falls back to YouTube when there is no audio URL", async () => {
    const h = storeHarness(null);

    h.store.play();
    await vi.waitFor(() => expect(h.createPlayer).toHaveBeenCalled());

    expect(h.loadApi).toHaveBeenCalled();
    expect(h.createAudio).not.toHaveBeenCalled();
    expect(h.bands.prepare).not.toHaveBeenCalled();
  });
});
