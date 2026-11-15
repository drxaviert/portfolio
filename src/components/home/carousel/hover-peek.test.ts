import { describe, expect, it } from "vitest";
import {
  inZone,
  onStrip,
  peekItem,
  peekLayout,
  pushedItem,
  resolveRightEdge,
} from "./hover-peek";
import type { Geometry } from "./carousel-math";

const G: Geometry = {
  slots: [
    { x: 0, w: 594 },
    { x: 606, w: 170 },
    { x: 788, w: 100 },
    { x: 900, w: 100 },
  ],
  rowWidth: 1000,
  gap: 12,
};

describe("peek item", () => {
  it("is order[(first - 1 + n) % n] on the left", () => {
    // n = 4: the last card; n = 6: the one before the first.
    expect(peekItem("left", 4, 0)).toBe(3);
    expect(peekItem("left", 4, 2)).toBe(1);
    expect(peekItem("left", 6, 0)).toBe(5);
    expect(peekItem("left", 6, 3)).toBe(2);
  });

  it("is the item after the last slot on the right", () => {
    expect(peekItem("right", 4, 0)).toBe(0);
    expect(peekItem("right", 6, 0)).toBe(4);
    expect(peekItem("right", 6, 4)).toBe(2);
  });

  it("pushes the first card on the left and the last visible on the right", () => {
    expect(pushedItem("left", 6, 2)).toBe(2);
    expect(pushedItem("right", 6, 2)).toBe(5);
  });
});

describe("hover zone", () => {
  const row = { left: 100, right: 1100, top: 50, bottom: 466 };

  it("covers the gutter and the first 40px of the column", () => {
    expect(inZone("left", 0, 200, row, 40)).toBe(true);
    expect(inZone("left", 139, 200, row, 40)).toBe(true);
    expect(inZone("left", 141, 200, row, 40)).toBe(false);
    expect(inZone("right", 1061, 200, row, 40)).toBe(true);
    expect(inZone("right", 1059, 200, row, 40)).toBe(false);
  });

  it("is limited to the row's height", () => {
    expect(inZone("left", 110, 20, row, 40)).toBe(false);
    expect(inZone("left", 110, 500, row, 40)).toBe(false);
  });

  it("finds the strip inside the column only", () => {
    expect(onStrip("left", 110, 200, row, 20)).toBe(true);
    expect(onStrip("left", 90, 200, row, 20)).toBe(false);
    expect(onStrip("right", 1090, 200, row, 20)).toBe(true);
  });
});

describe("peek layout", () => {
  it("keeps the strip inside the column with a clean gap to the card", () => {
    const l = peekLayout("left", G, 20, 12);
    const visibleLeft = l.card.pushX;
    const stripRight = l.strip.toX + 20;

    expect(l.strip.toX).toBe(0);
    expect(l.strip.fromX).toBe(-20);
    expect(visibleLeft - stripRight).toBe(12);
    expect(l.card.pushR).toBe(32);
  });

  it("mirrors on the right without moving the last card", () => {
    const r = peekLayout("right", G, 20, 12);
    const visibleRight = r.card.restX + r.card.restW - r.card.pushR;
    const stripLeft = r.strip.toX;

    expect(r.card.pushX).toBe(r.card.restX);
    expect(stripLeft + 20).toBe(1000);
    expect(stripLeft - visibleRight).toBe(12);
    expect(r.strip.fromX).toBe(1000);
  });
});

describe("right edge resolution", () => {
  it("follows ?blur= when peekRight is absent", () => {
    expect(resolveRightEdge("", "edge")).toEqual({
      right: "none",
      blur: "edge",
    });
    expect(resolveRightEdge("", "peek")).toEqual({
      right: "static",
      blur: "peek",
    });
  });

  it("lets peekRight govern the right edge", () => {
    expect(resolveRightEdge("?peekRight=static", "edge")).toEqual({
      right: "static",
      blur: "peek",
    });
    expect(resolveRightEdge("?peekRight=hover", "motion")).toEqual({
      right: "hover",
      blur: "motion",
    });
    expect(resolveRightEdge("?peekRight=none", "peek")).toEqual({
      right: "none",
      blur: "none",
    });
    expect(resolveRightEdge("?peekRight=hover", "peek")).toEqual({
      right: "hover",
      blur: "none",
    });
  });

  it("ignores a value it does not know", () => {
    expect(resolveRightEdge("?peekRight=wide", "edge").right).toBe("none");
  });
});
