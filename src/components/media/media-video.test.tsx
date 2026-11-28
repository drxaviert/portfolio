import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { VideoMedia } from "@/lib/media-types";
import { MediaVideo } from "./media-video";

const media: VideoMedia = {
  id: "test-video-0000000000",
  kind: "video",
  width: 1920,
  height: 1080,
  alt: "Test video",
  caption: "Test",
  createdAt: "2026-11-24T00:00:00.000Z",
  original: "test.webm",
  mp4: { url: "https://media.example.com/test/video.mp4", bytes: 1000 },
  hls: {
    url: "https://media.example.com/test/hls/master.m3u8",
    bytes: 2000,
    levels: [{ height: 1080, bandwidth: 5_000_000 }],
  },
  poster: {
    avif: "https://media.example.com/test/poster.avif",
    jpg: "https://media.example.com/test/poster.jpg",
  },
  duration: 30,
  hasAudio: true,
};

beforeEach(() => {
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
  }));
  vi.clearAllMocks();
  Object.defineProperty(HTMLMediaElement.prototype, "play", {
    configurable: true,
    value: vi.fn().mockResolvedValue(undefined),
  });
  Object.defineProperty(HTMLMediaElement.prototype, "pause", {
    configurable: true,
    value: vi.fn(),
  });
});

describe("MediaVideo", () => {
  it("loopMuted streams the HLS ladder, not the 480p fallback MP4", () => {
    const { container } = render(
      <MediaVideo media={media} alt={media.alt} loopMuted viewerOwned />,
    );
    const video = container.querySelector("video");

    expect(video?.muted).toBe(true);
    expect(video?.loop).toBe(true);
    expect(video?.controls).toBe(false);
    expect(container.querySelectorAll("source")).toHaveLength(0);
  });

  it("loopMuted without HLS renders a silent looping MP4 without controls", () => {
    const progressive = { ...media, hls: undefined };
    const { container } = render(
      <MediaVideo
        media={progressive}
        alt={media.alt}
        loopMuted
        viewerOwned
      />,
    );
    const video = container.querySelector("video");
    const sources = [...container.querySelectorAll("source")];

    expect(video?.muted).toBe(true);
    expect(video?.loop).toBe(true);
    expect(video?.controls).toBe(false);
    expect(video?.autoplay).toBe(true);
    expect(video?.getAttribute("preload")).toBe("auto");
    expect(sources).toHaveLength(1);
    expect(sources[0].getAttribute("src")).toBe(media.mp4.url);
    expect(sources[0].getAttribute("type")).toBe("video/mp4");
  });

  it("keeps the adaptive HLS contract outside the canvas viewer", () => {
    const { container } = render(<MediaVideo media={media} alt={media.alt} />);
    const video = container.querySelector("video");

    expect(video?.controls).toBe(true);
    expect(video?.loop).toBe(false);
  });

  it("holds the viewer clip paused until the open flight lands", () => {
    const { container, rerender } = render(
      <MediaVideo
        media={media}
        alt={media.alt}
        loopMuted
        viewerOwned
        deferPlayback
      />,
    );
    const video = container.querySelector("video");
    const play = vi.mocked(HTMLMediaElement.prototype.play);

    expect(video?.autoplay).toBe(false);
    expect(play).not.toHaveBeenCalled();

    video?.dispatchEvent(new Event("canplay"));
    expect(play).not.toHaveBeenCalled();

    rerender(
      <MediaVideo
        media={media}
        alt={media.alt}
        loopMuted
        viewerOwned
        deferPlayback={false}
      />,
    );

    expect(play).toHaveBeenCalledTimes(1);
  });
});
