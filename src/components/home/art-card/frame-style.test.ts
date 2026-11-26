import { describe, expect, it } from "vitest";
import { frameStyleFor } from "./frame-style";
import type { FrameArt } from "./frame-style";

function art(overrides: Partial<FrameArt> = {}): FrameArt {
  return {
    dateStart: 1850,
    placeOfOrigin: "France",
    width: 1200,
    height: 900,
    ...overrides,
  };
}

describe("frameStyleFor", () => {
  it("uses the era boundaries", () => {
    expect(frameStyleFor(art({ dateStart: 1699 })).era).toBe("gilt-ornate");
    expect(frameStyleFor(art({ dateStart: 1700 })).era).toBe("gilt-carved");
    expect(frameStyleFor(art({ dateStart: 1879 })).era).toBe("gilt-carved");
    expect(frameStyleFor(art({ dateStart: 1880 })).era).toBe("walnut");
    expect(frameStyleFor(art({ dateStart: 1944 })).era).toBe("walnut");
    expect(frameStyleFor(art({ dateStart: 1945 })).era).toBe("modern");
  });

  it("keeps undated works in the neutral walnut frame", () => {
    expect(frameStyleFor(art({ dateStart: null })).era).toBe("walnut");
  });

  it("hangs tall East Asian works as a silk scroll", () => {
    expect(
      frameStyleFor(
        art({
          dateStart: 1775,
          placeOfOrigin: "Japan",
          width: 924,
          height: 2250,
        }),
      ),
    ).toEqual({ era: "scroll", mount: "hanging" });

    expect(
      frameStyleFor(
        art({
          dateStart: 1600,
          placeOfOrigin: "China",
          width: 900,
          height: 2250,
        }),
      ).mount,
    ).toBe("hanging");
  });

  it("does not scroll-mount a tall Western portrait or a wide Japanese screen", () => {
    expect(
      frameStyleFor(
        art({
          dateStart: 1897,
          placeOfOrigin: "London",
          width: 3330,
          height: 6269,
        }),
      ).era,
    ).toBe("walnut");

    expect(
      frameStyleFor(
        art({
          dateStart: 1560,
          placeOfOrigin: "Japan",
          width: 3000,
          height: 987,
        }),
      ).era,
    ).toBe("gilt-ornate");
  });

  it("treats a square work as a panel, not a scroll", () => {
    expect(
      frameStyleFor(
        art({
          dateStart: 1914,
          placeOfOrigin: "China",
          width: 1000,
          height: 1000,
        }),
      ).mount,
    ).toBe("panel");
  });
});
