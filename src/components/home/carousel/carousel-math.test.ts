import { describe, expect, it } from "vitest";
import {
  GAP,
  advance,
  clickAction,
  easeFn,
  entityKey,
  exitLeft,
  keyStep,
  linearEasing,
  offRight,
  restEntities,
  retarget,
  sampleEntities,
  slotOf,
  slotOrder,
  stepMode,
  visibleItems,
} from "./carousel-math";
import type { Entity, Geometry, TitleTiming } from "./carousel-math";

const G: Geometry = {
  slots: [
    { x: 0, w: 753 },
    { x: 765, w: 180 },
    { x: 957, w: 83 },
    { x: 1052, w: 84 },
  ],
  rowWidth: 1136,
  gap: GAP,
};
const TIMING: TitleTiming = { delay: 400, duration: 200, outDuration: 100 };

describe("ring order", () => {
  it("wraps four items by modulo", () => {
    expect(slotOrder(4, 0)).toEqual([0, 1, 2, 3]);
    expect(slotOrder(4, 1)).toEqual([1, 2, 3, 0]);
    expect(slotOrder(4, advance(1, -2, 4))).toEqual([3, 0, 1, 2]);
    expect(advance(3, 1, 4)).toBe(0);
    expect(advance(0, -1, 4)).toBe(3);
    expect(advance(1, 3, 4)).toBe(0);
  });

  it("shows the first four of six and keeps the rest offscreen in order", () => {
    expect(visibleItems(6, 0)).toEqual([0, 1, 2, 3]);
    expect(visibleItems(6, 1)).toEqual([1, 2, 3, 4]);
    expect(visibleItems(6, 5)).toEqual([5, 0, 1, 2]);
    expect(slotOrder(6, 2)).toEqual([2, 3, 4, 5, 0, 1]);
    expect(slotOf(1, 2, 6)).toBe(5);
    expect(slotOf(5, 2, 6)).toBe(3);
  });

  it("steps +1, -1 and +k", () => {
    expect(visibleItems(6, advance(0, 1, 6))).toEqual([1, 2, 3, 4]);
    expect(visibleItems(6, advance(0, -1, 6))).toEqual([5, 0, 1, 2]);
    expect(visibleItems(6, advance(0, 3, 6))).toEqual([3, 4, 5, 0]);
  });
});

describe("clicks and keys", () => {
  it("brings the clicked slot to the front by its slot index", () => {
    expect(clickAction(1, "work")).toEqual({ type: "step", by: 1 });
    expect(clickAction(3, "work")).toEqual({ type: "step", by: 3 });
    const after = advance(0, 3, 4);
    expect(slotOf(3, after, 4)).toBe(0);
  });

  it("opens a work in the first slot and ignores the placeholder", () => {
    expect(clickAction(0, "work")).toEqual({ type: "open" });
    expect(clickAction(0, "placeholder")).toEqual({ type: "none" });
    expect(clickAction(2, "placeholder")).toEqual({ type: "step", by: 2 });
  });

  it("maps the arrow keys to steps", () => {
    expect(keyStep("ArrowRight")).toBe(1);
    expect(keyStep("ArrowLeft")).toBe(-1);
    expect(keyStep("Enter")).toBe(0);
  });

  it("crossfades under reduced motion", () => {
    expect(stepMode(true)).toBe("crossfade");
    expect(stepMode(false)).toBe("tween");
  });
});

describe("easing", () => {
  it("is the exact expo curve", () => {
    const ease = easeFn("expo");
    expect(ease(0)).toBe(0);
    expect(ease(1)).toBe(1);
    expect(ease(0.5)).toBeCloseTo(1 - 2 ** -5, 10);
  });

  it("samples the curve into a linear() list ending at 1", () => {
    const css = linearEasing(easeFn("expo"));
    expect(css.startsWith("linear(0 0%")).toBe(true);
    expect(css.endsWith("1 100%)")).toBe(true);
  });
});

describe("wrap seam", () => {
  it("sends the card leaving slot 0 out left and a copy in from the right", () => {
    const planned = retarget(G, 4, 0, 1, restEntities(G, 4, 0));
    const main = planned.find((e) => e.item === 0 && !e.ghost)!;
    const ghost = planned.find((e) => e.item === 0 && e.ghost)!;

    expect(main.to).toEqual(exitLeft(G));
    expect(ghost.from).toEqual(offRight(G));
    expect(ghost.to).toEqual(G.slots[3]);
    expect(planned.filter((e) => e.ghost)).toHaveLength(1);
  });

  it("moves everything else one slot forward with no copy", () => {
    const planned = retarget(G, 4, 0, 1, restEntities(G, 4, 0));

    expect(planned.find((e) => e.item === 1)!.to).toEqual(G.slots[0]);
    expect(planned.find((e) => e.item === 3)!.to).toEqual(G.slots[2]);
  });

  it("wraps the other way on a backward step", () => {
    const planned = retarget(G, 4, 0, -1, restEntities(G, 4, 0));
    const ghost = planned.find((e) => e.ghost)!;

    expect(ghost.item).toBe(3);
    expect(ghost.from).toEqual(exitLeft(G));
    expect(ghost.to).toEqual(G.slots[0]);
    expect(planned.find((e) => e.item === 3 && !e.ghost)!.to).toEqual(
      offRight(G),
    );
  });

  it("only slides in from the right for more than four items", () => {
    const planned = retarget(G, 6, 0, 1, restEntities(G, 6, 0));

    expect(planned.filter((e) => e.ghost)).toHaveLength(0);
    expect(planned.find((e) => e.item === 4)!.from).toEqual(offRight(G));
    expect(planned.find((e) => e.item === 4)!.to).toEqual(G.slots[3]);
    expect(planned.find((e) => e.item === 0)!.to).toEqual(exitLeft(G));
  });
});

describe("interrupt", () => {
  it("retargets from the current pose with one entity per item", () => {
    const first = retarget(G, 4, 0, 1, restEntities(G, 4, 0));
    const midway = sampleEntities(first, 150, 1000, easeFn("expo"), TIMING);
    const second = retarget(G, 4, 1, 1, midway);

    // No pile-up: still one main per item, plus at most one copy per item.
    const keys = second.map(entityKey);
    expect(new Set(keys).size).toBe(keys.length);
    expect(second.filter((e) => !e.ghost)).toHaveLength(4);

    // No snap back: each card starts exactly where it was drawn.
    for (const e of second) {
      const before = midway.find((m) => entityKey(m) === entityKey(e));
      if (before) expect(e.from).toEqual(before.from);
    }

    // Item 2 was heading for slot 1 and is now headed for slot 0.
    expect(second.find((e) => e.item === 2 && !e.ghost)!.to).toEqual(
      G.slots[0],
    );
  });

  it("lands every item on its slot after two quick steps", () => {
    const first = retarget(G, 4, 0, 1, restEntities(G, 4, 0));
    const midway = sampleEntities(first, 100, 1000, easeFn("expo"), TIMING);
    const second: Entity[] = retarget(G, 4, 1, 1, midway);
    const offset = advance(advance(0, 1, 4), 1, 4);

    for (let item = 0; item < 4; item++) {
      const slot = slotOf(item, offset, 4);
      const ends = second.filter((e) => e.item === item).map((e) => e.to);
      expect(ends).toContainEqual(G.slots[slot]);
    }
  });
});

describe("title timing", () => {
  it("fades in after the delay and out immediately", () => {
    const entering = { fromTitle: 0, toTitle: 1 };
    const leaving = { fromTitle: 1, toTitle: 0 };

    const early = sampleEntities(
      [{ ...restEntities(G, 4, 0)[0], ...entering }],
      300,
      1000,
      easeFn("expo"),
      TIMING,
    )[0];
    expect(early.fromTitle).toBe(0);

    const out = sampleEntities(
      [{ ...restEntities(G, 4, 0)[0], ...leaving }],
      100,
      1000,
      easeFn("expo"),
      TIMING,
    )[0];
    expect(out.fromTitle).toBe(0);
  });
});
