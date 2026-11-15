import { describe, expect, it } from "vitest";
import { MORPH_CLOSE_S, MORPH_EASE, MORPH_OPEN_S, flipFrom } from "./morph";

describe("the shared flight", () => {
  it("keeps the panel and the dock on one curve and two durations", () => {
    // use-morph.ts and nav-dock.tsx both import these; one retune moves both.
    expect(MORPH_EASE).toEqual([0.32, 0.72, 0, 1]);
    expect(MORPH_OPEN_S).toBe(0.48);
    expect(MORPH_CLOSE_S).toBe(0.3);
  });
});

describe("flipFrom", () => {
  it("maps the destination box onto the source box", () => {
    expect(
      flipFrom(
        { left: 100, top: 200, width: 753, height: 416 },
        { left: 16, top: 16, width: 1408, height: 868 },
      ),
    ).toEqual({
      x: 84,
      y: 184,
      scaleX: 753 / 1408,
      scaleY: 416 / 868,
    });
  });

  it("is the identity when both boxes match", () => {
    const box = { left: 40, top: 60, width: 300, height: 200 };

    expect(flipFrom(box, box)).toEqual({
      x: 0,
      y: 0,
      scaleX: 1,
      scaleY: 1,
    });
  });
});
