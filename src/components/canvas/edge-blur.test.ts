import { describe, expect, it } from "vitest";
import {
  EDGE_BLUR,
  EDGE_MASK,
  EDGE_MASK_GLSL,
  edgeBlurDepthPx,
  edgeBlurMask,
  edgeBlurRadiusPx,
} from "./edge-blur";

describe("edgeBlurDepthPx", () => {
  it("clamps the 9vw band at 56px on small screens", () => {
    expect(edgeBlurDepthPx(390)).toBe(56);
    expect(edgeBlurDepthPx(600)).toBe(56);
  });

  it("scales with vw between the clamps", () => {
    expect(edgeBlurDepthPx(1024)).toBeCloseTo(92.16, 5);
    expect(edgeBlurDepthPx(1440)).toBeCloseTo(129.6, 5);
  });

  it("settles at 160px on a wide desktop", () => {
    expect(edgeBlurDepthPx(1920)).toBe(160);
    expect(edgeBlurDepthPx(2560)).toBe(160);
  });
});

describe("edgeBlurRadiusPx", () => {
  it("gives a 16px screen radius at DPR 1 and 2", () => {
    expect(edgeBlurRadiusPx(16, 1)).toBe(16);
    expect(edgeBlurRadiusPx(16, 2)).toBe(32);
  });

  it("is zero for a missing device scale", () => {
    expect(edgeBlurRadiusPx(16, 0)).toBe(0);
  });
});

describe("EDGE_MASK_GLSL parity", () => {
  it("is built from the same epsilon edgeBlurMask() uses", () => {
    expect(EDGE_MASK_GLSL).toContain(
      `max(depth, vec2(${EDGE_MASK.depthEpsilon.toFixed(6)}))`,
    );
    expect(EDGE_MASK_GLSL).toContain("edge * edge * (3.0 - 2.0 * edge)");
  });

  it("treats a zero depth as a sharp band, like the GLSL epsilon floor", () => {
    expect(edgeBlurMask(0.5, 0.5, 0, 0)).toBe(0);
    expect(edgeBlurMask(0, 0.5, 0, 0)).toBe(1);
  });
});

describe("edgeBlurMask", () => {
  const depthX = 0.1;
  const depthY = 0.2;

  it("is zero in the middle", () => {
    expect(edgeBlurMask(0.5, 0.5, depthX, depthY)).toBe(0);
  });

  it("is one on every edge and at the corners", () => {
    expect(edgeBlurMask(0, 0.5, depthX, depthY)).toBe(1);
    expect(edgeBlurMask(1, 0.5, depthX, depthY)).toBe(1);
    expect(edgeBlurMask(0.5, 0, depthX, depthY)).toBe(1);
    expect(edgeBlurMask(0.5, 1, depthX, depthY)).toBe(1);
    expect(edgeBlurMask(0, 0, depthX, depthY)).toBe(1);
    expect(edgeBlurMask(1, 1, depthX, depthY)).toBe(1);
  });

  it("eases from 0.5 at half the band depth to 0 at the boundary", () => {
    expect(edgeBlurMask(depthX / 2, 0.5, depthX, depthY)).toBeCloseTo(0.5, 6);
    expect(edgeBlurMask(depthX, 0.5, depthX, depthY)).toBe(0);
    expect(edgeBlurMask(0.5, depthY / 2, depthX, depthY)).toBeCloseTo(0.5, 6);
    expect(edgeBlurMask(0.5, depthY, depthX, depthY)).toBe(0);
  });

  it("keeps the centre sharp for every aspect and depth", () => {
    for (const depth of [0.03, 0.09, EDGE_BLUR.maxDepthPx / 2560]) {
      expect(edgeBlurMask(0.5, 0.5, depth, depth)).toBe(0);
    }
  });
});
