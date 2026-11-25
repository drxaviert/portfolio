import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CanvasItem } from "./infinite-canvas";
import type { VideoMedia } from "@/lib/media-types";
import { FocusViewer } from "./focus-viewer";

vi.mock("@/components/media/media-video", () => ({
  MediaVideo: () => <video data-testid="viewer-video" />,
}));

vi.mock("@/components/media/media-image", () => ({
  MediaImage: () => <div data-testid="viewer-image" />,
}));

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
  poster: {
    avif: "https://media.example.com/test/poster.avif",
    jpg: "https://media.example.com/test/poster.jpg",
  },
  duration: 30,
  hasAudio: false,
};

const item: CanvasItem = { key: "test-0", project: "Test", media };

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
  }));
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("FocusViewer open wait", () => {
  it("does not call onReady after an unmount during the 8s wait", async () => {
    const onReady = vi.fn();
    const onClosed = vi.fn();

    const { unmount } = render(
      <FocusViewer
        items={[item]}
        initialIndex={0}
        onReady={onReady}
        onClosed={onClosed}
      />,
    );

    unmount();
    await act(async () => {
      await Promise.resolve();
    });
    vi.advanceTimersByTime(8100);

    expect(onReady).not.toHaveBeenCalled();
    expect(onClosed).not.toHaveBeenCalled();
  });
});
