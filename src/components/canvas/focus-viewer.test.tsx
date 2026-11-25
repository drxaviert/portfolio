import { act, cleanup, fireEvent, render } from "@testing-library/react";
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

  it("renders chrome only for a canvas-owned open and closes through the canvas", () => {
    const onClosing = vi.fn(() => ({
      rect: null,
      prepared: Promise.resolve(),
    }));
    const onClosed = vi.fn();

    const { container } = render(
      <FocusViewer
        items={[item]}
        initialIndex={0}
        canvasOwned
        onClosing={onClosing}
        onClosed={onClosed}
      />,
    );

    expect(container.querySelector(".cv-viewer")).toHaveAttribute(
      "data-canvas-owned",
    );
    expect(container.querySelector(".cv-viewer__media")).toBeNull();

    fireEvent.keyDown(window, { key: "Escape" });

    expect(onClosing).toHaveBeenCalledWith(0, undefined, true);

    act(() => {
      vi.advanceTimersByTime(1600);
    });

    expect(onClosed).toHaveBeenCalledTimes(1);
  });
});

describe("FocusViewer caption anchor", () => {
  it("publishes the fit width for CSS and leaves the caption free of an inline top", () => {
    const { container } = render(
      <FocusViewer
        items={[item]}
        initialIndex={0}
        canvasOwned
        onClosed={() => undefined}
      />,
    );
    const stage = container.querySelector(
      ".cv-viewer__stage",
    ) as HTMLElement | null;
    const caption = container.querySelector(
      ".cv-viewer__caption",
    ) as HTMLElement | null;

    expect(stage?.style.getPropertyValue("--cv-viewer-frame-width")).not.toBe(
      "",
    );
    expect(caption?.style.top).toBe("");
  });
});

describe("FocusViewer Arrow step", () => {
  it("reveals and plays the DOM fallback video after a canvas-owned open", () => {
    const onStep = vi.fn();
    const onClosed = vi.fn();
    const nextItem: CanvasItem = {
      key: "test-1",
      project: "Test",
      media: { ...media, id: "test-video-1111111111" },
    };

    const { container } = render(
      <FocusViewer
        items={[item, nextItem]}
        initialIndex={0}
        canvasOwned
        onStep={onStep}
        onClosed={onClosed}
      />,
    );

    fireEvent.keyDown(window, { key: "ArrowRight" });

    expect(onStep).toHaveBeenCalledTimes(1);
    expect(container.querySelector(".cv-viewer")).not.toHaveAttribute(
      "data-canvas-owned",
    );
    expect(container.querySelector(".cv-viewer__slide")).not.toBeNull();
    const video = container.querySelector(".cv-viewer__video");
    expect(video).not.toBeNull();
    expect(video).toHaveAttribute("data-visible");
    expect(
      container.querySelector('[data-testid="viewer-video"]'),
    ).not.toBeNull();
  });
});
