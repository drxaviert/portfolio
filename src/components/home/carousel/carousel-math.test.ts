import { describe, expect, it } from "vitest";
import {
  GAP,
  advance,
  clickAction,
  RETARGET_BEZIER,
  bezierSpec,
  easeSpec,
  entityKey,
  exitLeft,
  keyStep,
  linearEasing,
  parseBezier,
  titleKeys,
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
const TIMING: TitleTiming = { start: 0.75, span: 0.2, outEnd: 0.12 };
const SMOOTH = easeSpec("smooth", [0.5, 0, 0.1, 1]);
const EXPO = easeSpec("expo-out", [0.5, 0, 0.1, 1]);

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
  it("defaults to smooth: a gentle start, not expo's snap", () => {
    expect(SMOOTH.css).toBe("cubic-bezier(0.5, 0, 0.1, 1)");
    // easeOutExpo is already ~40% of the way at 7% of the time; smooth is not.
    expect(EXPO.fn(0.07)).toBeGreaterThan(0.35);
    expect(SMOOTH.fn(0.07)).toBeLessThan(0.05);
    expect(SMOOTH.fn(0)).toBe(0);
    expect(SMOOTH.fn(1)).toBe(1);
    expect(SMOOTH.fn(0.7)).toBeGreaterThan(0.85);
  });

  it("offers the named presets as CSS beziers", () => {
    expect(easeSpec("glide", [0, 0, 1, 1]).css).toBe(
      "cubic-bezier(0.65, 0, 0.35, 1)",
    );
    expect(easeSpec("quint-out", [0, 0, 1, 1]).css).toBe(
      "cubic-bezier(0.22, 1, 0.36, 1)",
    );
    expect(easeSpec("sheet", [0, 0, 1, 1]).css).toBe(
      "cubic-bezier(0.32, 0.72, 0, 1)",
    );
  });

  it("keeps the exact expo curve, sampled for linear()", () => {
    expect(EXPO.fn(0.5)).toBeCloseTo(1 - 2 ** -5, 10);
    expect(EXPO.css.startsWith("linear(0 0%")).toBe(true);
    expect(EXPO.css.endsWith("1 100%)")).toBe(true);
    expect(linearEasing(EXPO.fn)).toBe(EXPO.css);
  });

  it("takes a free cubic-bezier", () => {
    expect(easeSpec("custom", [0.2, 0, 0.8, 1]).css).toBe(
      "cubic-bezier(0.2, 0, 0.8, 1)",
    );
    expect(parseBezier("0.5, 0, 0.1, 1")).toEqual([0.5, 0, 0.1, 1]);
    expect(parseBezier("cubic-bezier(0.3 0 0.7 1)")).toEqual([0.3, 0, 0.7, 1]);
    expect(parseBezier("1.5, 0, 0.1, 1")).toBeNull();
    expect(parseBezier("0.5, 0, 0.1")).toBeNull();
    expect(parseBezier("a, b, c, d")).toBeNull();
  });

  it("retargets on an ease-out that starts moving", () => {
    const retargeted = bezierSpec(RETARGET_BEZIER);
    expect(retargeted.fn(0.07)).toBeGreaterThan(SMOOTH.fn(0.07) * 5);
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
    const midway = sampleEntities(first, 150, 1000, SMOOTH.fn, TIMING);
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
    const midway = sampleEntities(first, 100, 1000, SMOOTH.fn, TIMING);
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
  it("rides the step's own progress: in late, out early", () => {
    const entering = titleKeys({ fromTitle: 0, toTitle: 1 }, TIMING);
    expect(entering[1]).toEqual({ offset: 0.75, opacity: 0 });
    expect(entering[2]).toEqual({ offset: 0.95, opacity: 1 });

    const leaving = titleKeys({ fromTitle: 1, toTitle: 0 }, TIMING);
    expect(leaving[1]).toEqual({ offset: 0.12, opacity: 0 });
  });

  it("is still hidden while the card is mostly narrow", () => {
    const run = (p: number, entity: { fromTitle: number; toTitle: number }) =>
      sampleEntities(
        [{ ...restEntities(G, 4, 0)[0], ...entity }],
        p * 1000,
        1000,
        (t) => t,
        TIMING,
      )[0].fromTitle;

    expect(run(0.5, { fromTitle: 0, toTitle: 1 })).toBe(0);
    expect(run(0.85, { fromTitle: 0, toTitle: 1 })).toBeCloseTo(0.5, 5);
    expect(run(0.06, { fromTitle: 1, toTitle: 0 })).toBeCloseTo(0.5, 5);
    expect(run(0.3, { fromTitle: 1, toTitle: 0 })).toBe(0);
  });
});
