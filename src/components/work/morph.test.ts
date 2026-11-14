import { describe, expect, it } from "vitest";
import { flipFrom } from "./morph";

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
