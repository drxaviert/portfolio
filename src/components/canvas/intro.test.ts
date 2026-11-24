import { describe, expect, it } from "vitest";
import {
  INTRO,
  introCameraZ,
  introEnded,
  introGapProgress,
  introGray,
  introPlaneOpacity,
  introSegment,
  introVideosReady,
  introZoom,
  power3InOut,
  power3Out,
  power4InOut,
  reducedIntroEnded,
  reducedOpacity,
} from "./intro";

describe("intro eases", () => {
  it("hits both ends and stays inside them", () => {
    for (const ease of [power3Out, power3InOut, power4InOut]) {
      expect(ease(0)).toBe(0);
      expect(ease(1)).toBe(1);
      expect(ease(-1)).toBe(0);
      expect(ease(2)).toBe(1);
    }
  });

  it("gives the reference's halfway shapes", () => {
    // power3.out is fast first: 1 - .5^3.
    expect(power3Out(0.5)).toBeCloseTo(0.875, 6);
    expect(power3InOut(0.5)).toBeCloseTo(0.5, 6);
    expect(power4InOut(0.5)).toBeCloseTo(0.5, 6);
  });

  it("is monotonic through the segment", () => {
    let previous = -1;
    for (let i = 0; i <= 20; i += 1) {
      const value = introSegment(i * 100, 0, 2000, power3InOut);
      expect(value).toBeGreaterThanOrEqual(previous);
      previous = value;
    }
  });
});

describe("intro camera", () => {
  it("holds at 700 until 1.3s, passes 600 halfway, and lands at 500", () => {
    expect(introCameraZ(0)).toBe(INTRO.cameraFromZ);
    expect(introCameraZ(INTRO.cameraDelayMs)).toBe(INTRO.cameraFromZ);
    expect(introCameraZ(2300)).toBeCloseTo(600, 6);
    expect(introCameraZ(3300)).toBe(INTRO.cameraToZ);
  });
});

describe("intro grid gap", () => {
  it("moves from 8 to the final gap between 1.5s and 3.5s", () => {
    expect(introGapProgress(0)).toBe(0);
    expect(introGapProgress(INTRO.gapDelayMs)).toBe(0);
    expect(introGapProgress(2500)).toBeCloseTo(0.5, 6);
    expect(introGapProgress(3500)).toBe(1);
  });
});

describe("intro plane values", () => {
  it("staggers opacity by its per-plane delay", () => {
    expect(introPlaneOpacity(0, 500)).toBe(0);
    expect(introPlaneOpacity(500, 500)).toBe(0);
    expect(introPlaneOpacity(1500, 500)).toBeCloseTo(0.875, 6);
    expect(introPlaneOpacity(2500, 500)).toBe(1);
  });

  it("takes grayscale from 1 to 0 from 2.25s to 4.25s", () => {
    expect(introGray(0)).toBe(1);
    expect(introGray(INTRO.grayDelayMs)).toBe(1);
    expect(introGray(3250)).toBeCloseTo(0.125, 6);
    expect(introGray(INTRO.endMs)).toBe(0);
  });

  it("settles the texture zoom from 1.3 to 1", () => {
    expect(introZoom(0)).toBe(INTRO.zoomFrom);
    expect(introZoom(INTRO.zoomDelayMs)).toBe(INTRO.zoomFrom);
    expect(introZoom(2375)).toBeCloseTo(1.15, 6);
    expect(introZoom(3500)).toBe(1);
  });

  it("marks the end and the video start at their boundaries", () => {
    expect(introEnded(INTRO.endMs - 1)).toBe(false);
    expect(introEnded(INTRO.endMs)).toBe(true);
    expect(introVideosReady(INTRO.videoStartMs - 1)).toBe(false);
    expect(introVideosReady(INTRO.videoStartMs)).toBe(true);
  });
});

describe("reduced motion", () => {
  it("uses only a 200ms opacity fade", () => {
    expect(reducedOpacity(0)).toBe(0);
    expect(reducedOpacity(100)).toBeCloseTo(0.5, 6);
    expect(reducedOpacity(200)).toBe(1);
    expect(reducedIntroEnded(199)).toBe(false);
    expect(reducedIntroEnded(200)).toBe(true);
  });
});
