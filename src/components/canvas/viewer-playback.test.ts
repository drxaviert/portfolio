import { describe, expect, it } from "vitest";
import { ownViewerVideo } from "./viewer-playback";

class FakeVideo extends EventTarget {
  paused = true;
  controls = false;
  muted = false;
  playCalls = 0;
  pauseCalls = 0;
  seekWrites = 0;
  playImpl: () => Promise<void> = () => Promise.resolve();

  private time = 0;

  get currentTime(): number {
    return this.time;
  }

  set currentTime(value: number) {
    this.time = value;
    this.seekWrites += 1;
  }

  play(): Promise<void> {
    this.playCalls += 1;
    return this.playImpl();
  }

  pause(): void {
    this.pauseCalls += 1;
    this.paused = true;
  }

  fire(type: string): void {
    this.dispatchEvent(new Event(type));
  }
}

function videoAsElement(video: FakeVideo): HTMLVideoElement {
  return video as unknown as HTMLVideoElement;
}

function playingImpl(video: FakeVideo): () => Promise<void> {
  return () => {
    video.paused = false;
    video.fire("playing");
    return Promise.resolve();
  };
}

describe("ownViewerVideo", () => {
  it("starts once, never seeks, and lets a user pause stick", () => {
    const video = new FakeVideo();

    video.playImpl = playingImpl(video);
    const cleanup = ownViewerVideo(videoAsElement(video));

    expect(video.controls).toBe(true);
    expect(video.muted).toBe(true);
    expect(video.playCalls).toBe(1);
    expect(video.pauseCalls).toBe(0);
    expect(video.seekWrites).toBe(0);

    video.fire("canplay");
    video.fire("canplay");
    expect(video.playCalls).toBe(1);

    video.pause();
    video.fire("canplay");
    expect(video.playCalls).toBe(1);
    expect(video.pauseCalls).toBe(1);

    cleanup();
    expect(video.pauseCalls).toBe(2);
    video.fire("canplay");
    expect(video.playCalls).toBe(1);
  });

  it("retries a rejected start until the first playing frame", async () => {
    const video = new FakeVideo();
    let ready = false;

    video.playImpl = () => {
      if (!ready) return Promise.reject(new Error("not ready"));
      return playingImpl(video)();
    };
    const cleanup = ownViewerVideo(videoAsElement(video));

    expect(video.playCalls).toBe(1);
    video.fire("canplay");
    expect(video.playCalls).toBe(2);
    await Promise.resolve();

    ready = true;
    video.fire("canplay");
    expect(video.playCalls).toBe(3);
    video.fire("canplay");
    expect(video.playCalls).toBe(3);

    cleanup();
  });

  it("does not call play when the element is already playing", () => {
    const video = new FakeVideo();
    video.paused = false;

    const cleanup = ownViewerVideo(videoAsElement(video));

    expect(video.playCalls).toBe(0);
    video.fire("canplay");
    expect(video.playCalls).toBe(0);
    expect(video.seekWrites).toBe(0);

    cleanup();
  });
});
