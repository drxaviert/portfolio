import { describe, expect, it } from "vitest";
import {
  TRANSITION,
  boxInsideViewport,
  canClose,
  canOpen,
  closeComplete,
  closeFadeProgress,
  closeShrinkProgress,
  fadeOutProgress,
  fitBox,
  glideProgress,
  growProgress,
  handoffProgress,
  nextPhase,
  openComplete,
  shortestWrappedDelta,
  viewerOpenNeedsFrames,
} from "./transition";
import type { TransitionPhase } from "./transition";

describe("shortestWrappedDelta", () => {
  it("takes the direct route inside a period", () => {
    expect(shortestWrappedDelta(0, 90, 100)).toBe(90);
    expect(shortestWrappedDelta(0, -90, 100)).toBe(-90);
    expect(shortestWrappedDelta(-40, 40, 100)).toBe(80);
  });

  it("crosses the seam the short way", () => {
    expect(shortestWrappedDelta(90, -90, 100)).toBe(20);
    expect(shortestWrappedDelta(-90, 90, 100)).toBe(-20);
  });

  it("keeps the exact half-period and handles zero", () => {
    expect(shortestWrappedDelta(0, 100, 100)).toBe(100);
    expect(shortestWrappedDelta(0, 0, 100)).toBe(0);
    expect(shortestWrappedDelta(5, -5, 0)).toBe(-10);
  });
});

describe("transition state machine", () => {
  it("walks idle -> opening -> open -> closing -> idle", () => {
    let phase: TransitionPhase = "idle";

    phase = nextPhase(phase, "open");
    expect(phase).toBe("opening");
    phase = nextPhase(phase, "opened");
    expect(phase).toBe("open");
    phase = nextPhase(phase, "close");
    expect(phase).toBe("closing");
    phase = nextPhase(phase, "closed");
    expect(phase).toBe("idle");
  });

  it("ignores clicks and stale events mid-transition", () => {
    expect(nextPhase("opening", "open")).toBe("opening");
    expect(nextPhase("closing", "open")).toBe("closing");
    expect(nextPhase("open", "open")).toBe("open");
    expect(nextPhase("idle", "close")).toBe("idle");
    expect(nextPhase("opening", "closed")).toBe("opening");
    expect(nextPhase("closing", "opened")).toBe("closing");
  });

  it("only opens from idle and closes from open", () => {
    expect(canOpen("idle")).toBe(true);
    expect(canOpen("opening")).toBe(false);
    expect(canOpen("open")).toBe(false);
    expect(canClose("open")).toBe(true);
    expect(canClose("opening")).toBe(false);
    expect(canClose("closing")).toBe(false);
  });
});

describe("transition timeline", () => {
  it("glides for 1s with power3.inOut", () => {
    expect(glideProgress(0)).toBe(0);
    expect(glideProgress(500)).toBeCloseTo(0.5, 6);
    expect(glideProgress(TRANSITION.glideMs)).toBe(1);
  });

  it("fades the other planes over 0.9s", () => {
    expect(fadeOutProgress(0)).toBe(0);
    expect(fadeOutProgress(450)).toBeCloseTo(0.5, 6);
    expect(fadeOutProgress(TRANSITION.fadeOutMs)).toBe(1);
  });

  it("grows after 850ms and finishes at 1450ms", () => {
    expect(growProgress(0)).toBe(0);
    expect(growProgress(TRANSITION.growDelayMs)).toBe(0);
    expect(growProgress(TRANSITION.growDelayMs + 300)).toBeCloseTo(0.875, 6);
    expect(growProgress(TRANSITION.growDelayMs + TRANSITION.growMs)).toBe(1);
    expect(openComplete(TRANSITION.growDelayMs + TRANSITION.growMs - 1)).toBe(
      false,
    );
    expect(openComplete(TRANSITION.growDelayMs + TRANSITION.growMs)).toBe(true);
  });

  it("cross-fades over 200ms and closes over 1.55s", () => {
    expect(handoffProgress(0)).toBe(0);
    expect(handoffProgress(100)).toBeCloseTo(0.5, 6);
    expect(handoffProgress(TRANSITION.handoffMs)).toBe(1);
    expect(closeShrinkProgress(TRANSITION.closeCrossFadeMs)).toBe(0);
    expect(closeShrinkProgress(500)).toBeCloseTo(0.5, 6);
    expect(
      closeShrinkProgress(TRANSITION.closeCrossFadeMs + TRANSITION.closeShrinkMs),
    ).toBe(1);
    expect(
      closeFadeProgress(
        TRANSITION.closeCrossFadeMs + TRANSITION.closeFadeDelayMs,
      ),
    ).toBe(0);
    expect(closeFadeProgress(1100)).toBeCloseTo(0.5, 6);
    expect(closeFadeProgress(TRANSITION.closeTotalMs)).toBe(1);
    expect(closeComplete(TRANSITION.closeTotalMs - 1)).toBe(false);
    expect(closeComplete(TRANSITION.closeTotalMs)).toBe(true);
  });
});

describe("fitBox", () => {
  it("fits the media ratio inside 88vw x 80vh", () => {
    expect(fitBox(1000, 500, 1000, 1000)).toEqual({
      width: 880,
      height: 440,
    });
  });
});

describe("boxInsideViewport", () => {
  it("accepts a fully visible tile and rejects every clipped edge", () => {
    const viewport = { width: 1440, height: 860 };
    const box = { left: 100, top: 100, width: 108, height: 70 };

    expect(boxInsideViewport(box, viewport.width, viewport.height)).toBe(true);
    expect(
      boxInsideViewport({ ...box, left: -1 }, viewport.width, viewport.height),
    ).toBe(false);
    expect(
      boxInsideViewport({ ...box, top: -1 }, viewport.width, viewport.height),
    ).toBe(false);
    expect(
      boxInsideViewport(
        { ...box, left: 1333 },
        viewport.width,
        viewport.height,
      ),
    ).toBe(false);
    expect(
      boxInsideViewport({ ...box, top: 791 }, viewport.width, viewport.height),
    ).toBe(false);
  });

  it("accepts a tile flush with the viewport edge", () => {
    expect(
      boxInsideViewport(
        { left: 0, top: 0, width: 1440, height: 860 },
        1440,
        860,
      ),
    ).toBe(true);
  });
});

describe("viewerOpenNeedsFrames", () => {
  it("idles after the grid fade, before the viewer can be ready", () => {
    expect(viewerOpenNeedsFrames(0)).toBe(true);
    expect(viewerOpenNeedsFrames(TRANSITION.fadeOutMs - 1)).toBe(true);
    expect(viewerOpenNeedsFrames(TRANSITION.fadeOutMs)).toBe(false);
    expect(viewerOpenNeedsFrames(8000)).toBe(false);
  });
});
