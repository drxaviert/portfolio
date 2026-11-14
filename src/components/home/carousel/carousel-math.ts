/**
 * Order, wrap and motion maths for the home carousel. Pure: no DOM, no React.
 *
 * Items sit in a ring of `n`. The first four (from `offset`) fill the four
 * visible slots; the rest wait offscreen to the right, in ring order. A step
 * moves the offset by `k`, so every item travels `k` slots toward the front.
 * An item that would pass slot 0 wraps to the back of the ring.
 */

export const VISIBLE_SLOTS = 4;
export const GAP = 12;

export function mod(a: number, n: number): number {
  return ((a % n) + n) % n;
}

/** The slot an item occupies when the first slot shows `offset`. */
export function slotOf(item: number, offset: number, n: number): number {
  return mod(item - offset, n);
}

/** Item index at every slot, front to back. */
export function slotOrder(n: number, offset: number): number[] {
  return Array.from({ length: n }, (_, slot) => mod(offset + slot, n));
}

/** The items that fill the visible slots. */
export function visibleItems(n: number, offset: number): number[] {
  return slotOrder(n, offset).slice(0, VISIBLE_SLOTS);
}

export function advance(offset: number, k: number, n: number): number {
  return mod(offset + k, n);
}

export type ItemKind = "work" | "placeholder";

export type ClickAction =
  { type: "step"; by: number } | { type: "open" } | { type: "none" };

/**
 * A card in slot k steps the row by k so it lands first. The first card is the
 * entry point: a work opens, the placeholder does nothing.
 */
export function clickAction(slot: number, kind: ItemKind): ClickAction {
  if (slot > 0) return { type: "step", by: slot };
  return kind === "work" ? { type: "open" } : { type: "none" };
}

export function keyStep(key: string): -1 | 0 | 1 {
  if (key === "ArrowRight") return 1;
  if (key === "ArrowLeft") return -1;
  return 0;
}

export type StepMode = "tween" | "crossfade";

/** Reduced motion never moves anything: the row crossfades instead. */
export function stepMode(reduceMotion: boolean): StepMode {
  return reduceMotion ? "crossfade" : "tween";
}

// ---------------------------------------------------------------- easing

export type EaseKey = "expo" | "quint" | "quart" | "stripe";
export type Ease = (t: number) => number;

export const EASE_OPTIONS: { value: EaseKey; label: string }[] = [
  { value: "expo", label: "easeOutExpo, exact (1 - 2^-10t)" },
  { value: "quint", label: "easeOutQuint (1 - (1-t)^5)" },
  { value: "quart", label: "easeOutQuart (1 - (1-t)^4)" },
  { value: "stripe", label: "Stripe bezier (0.16, 1, 0.3, 1)" },
];

export function cubicBezier(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): Ease {
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;
  const sampleX = (t: number) => ((ax * t + bx) * t + cx) * t;
  const sampleY = (t: number) => ((ay * t + by) * t + cy) * t;
  const slopeX = (t: number) => (3 * ax * t + 2 * bx) * t + cx;

  return (x) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;

    let t = x;
    for (let i = 0; i < 8; i++) {
      const error = sampleX(t) - x;
      if (Math.abs(error) < 1e-6) return sampleY(t);
      const slope = slopeX(t);
      if (Math.abs(slope) < 1e-6) break;
      t -= error / slope;
    }

    let lo = 0;
    let hi = 1;
    t = x;
    for (let i = 0; i < 40; i++) {
      const value = sampleX(t);
      if (Math.abs(value - x) < 1e-6) break;
      if (x > value) lo = t;
      else hi = t;
      t = (hi - lo) / 2 + lo;
    }
    return sampleY(t);
  };
}

const clamp01 = (t: number) => Math.min(Math.max(t, 0), 1);

const EASES: Record<EaseKey, Ease> = {
  expo: (t) => (t <= 0 ? 0 : t >= 1 ? 1 : 1 - 2 ** (-10 * t)),
  quint: (t) => 1 - (1 - clamp01(t)) ** 5,
  quart: (t) => 1 - (1 - clamp01(t)) ** 4,
  stripe: cubicBezier(0.16, 1, 0.3, 1),
};

export function easeFn(key: EaseKey): Ease {
  return EASES[key];
}

/** CSS ease-out, for the title fades. */
export const easeOutCss: Ease = cubicBezier(0, 0, 0.58, 1);

function round(value: number, places: number): number {
  const scale = 10 ** places;
  return Math.round(value * scale) / scale;
}

/**
 * The exact easing as a CSS `linear()` list, so WAAPI can run the real curve on
 * the compositor. Samples are denser at the start, where the curve moves most.
 */
export function linearEasing(ease: Ease, points = 72): string {
  const stops: string[] = [];

  for (let i = 0; i <= points; i++) {
    const t = (i / points) ** 1.8;
    stops.push(`${round(ease(t), 4)} ${round(t * 100, 3)}%`);
  }

  return `linear(${stops.join(", ")})`;
}

// -------------------------------------------------------------- geometry

export type Pose = { x: number; w: number };

export type Geometry = {
  /** Rest boxes of slots 0..3, relative to the row. */
  slots: Pose[];
  rowWidth: number;
  gap: number;
};

export const EMPTY_GEOMETRY: Geometry = {
  slots: Array.from({ length: VISIBLE_SLOTS }, () => ({ x: 0, w: 0 })),
  rowWidth: 0,
  gap: GAP,
};

/** Waiting place for items beyond the visible slots, and the seam's origin. */
export function offRight(g: Geometry): Pose {
  return { x: g.rowWidth + g.gap, w: g.slots[VISIBLE_SLOTS - 1].w };
}

/** Where a card leaving slot 0 ends up: one narrow slot to the left of it. */
export function exitLeft(g: Geometry): Pose {
  const w = g.slots[VISIBLE_SLOTS - 1].w;
  return { x: -(w + g.gap), w };
}

export function slotPose(g: Geometry, slot: number): Pose {
  return slot < VISIBLE_SLOTS ? g.slots[slot] : offRight(g);
}

function nearestExit(g: Geometry, pose: Pose): Pose {
  return pose.x + pose.w / 2 < g.rowWidth / 2 ? exitLeft(g) : offRight(g);
}

// -------------------------------------------------------------- entities

/**
 * One drawn card. Every item has a main entity; an item that wraps also has a
 * ghost, the plain copy that enters at the far end while the main one leaves.
 * `wide` is 1 in slot 0 and 0 elsewhere; it drives the title and the covers.
 */
export type Entity = {
  item: number;
  ghost: boolean;
  from: Pose;
  to: Pose;
  fromWide: number;
  toWide: number;
  fromTitle: number;
  toTitle: number;
};

export function entityKey(e: Pick<Entity, "item" | "ghost">): string {
  return `${e.ghost ? "g" : "m"}${e.item}`;
}

export function restEntities(g: Geometry, n: number, offset: number): Entity[] {
  return Array.from({ length: n }, (_, item) => {
    const slot = slotOf(item, offset, n);
    const pose = slotPose(g, slot);
    const wide = slot === 0 ? 1 : 0;

    return {
      item,
      ghost: false,
      from: pose,
      to: pose,
      fromWide: wide,
      toWide: wide,
      fromTitle: wide,
      toTitle: wide,
    };
  });
}

function retargetTo(e: Entity, to: Pose, wide: number): Entity {
  return { ...e, to, toWide: wide, toTitle: wide };
}

/**
 * Plans a step of `k` from whatever is on screen now. `current` carries every
 * entity with its present pose in `from`; the result keeps those starts and
 * assigns new ends, so an interrupt continues from where the cards are instead
 * of snapping or queueing. Only the offset moves; nothing is replayed.
 */
export function retarget(
  g: Geometry,
  n: number,
  prevOffset: number,
  k: number,
  current: Entity[],
): Entity[] {
  const out: Entity[] = [];
  const exit = k > 0 ? exitLeft(g) : offRight(g);
  const entry = k > 0 ? offRight(g) : exitLeft(g);

  for (let item = 0; item < n; item++) {
    const ents = current.filter((e) => e.item === item);
    const prevSlot = slotOf(item, prevOffset, n);
    const unwrapped = prevSlot - k;
    const dest = mod(unwrapped, n);
    const wraps = unwrapped < 0 || unwrapped >= n;
    const destPose = slotPose(g, dest);
    const wide = dest === 0 ? 1 : 0;
    const visible = dest < VISIBLE_SLOTS;

    if (ents.length >= 2) {
      const [a, b] = ents;
      if (!visible) {
        out.push(retargetTo(a, nearestExit(g, a.from), 0));
        out.push(retargetTo(b, nearestExit(g, b.from), 0));
      } else {
        const aLeads =
          Math.abs(a.from.x - destPose.x) <= Math.abs(b.from.x - destPose.x);
        const [lead, other] = aLeads ? [a, b] : [b, a];
        out.push(retargetTo(lead, destPose, wide));
        out.push(retargetTo(other, nearestExit(g, other.from), 0));
      }
      continue;
    }

    const main = ents[0];

    if (!wraps) {
      out.push(retargetTo(main, destPose, wide));
      continue;
    }

    out.push(retargetTo(main, exit, 0));

    if (visible) {
      out.push({
        item,
        ghost: true,
        from: entry,
        to: destPose,
        fromWide: 0,
        toWide: wide,
        fromTitle: 0,
        toTitle: wide,
      });
    }
  }

  return out;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export type TitleTiming = {
  /** Fade-in start, from the step's start, so it lands once the card is wide. */
  delay: number;
  duration: number;
  /** Fade-out is short and immediate so it never shows on a narrowing card. */
  outDuration: number;
};

export function titleAt(
  e: Pick<Entity, "fromTitle" | "toTitle">,
  elapsed: number,
  timing: TitleTiming,
): number {
  if (e.fromTitle === e.toTitle) return e.toTitle;

  const entering = e.toTitle > e.fromTitle;
  const delay = entering ? timing.delay : 0;
  const duration = entering ? timing.duration : timing.outDuration;
  const u = clamp01((elapsed - delay) / duration);

  return lerp(e.fromTitle, e.toTitle, easeOutCss(u));
}

/** Every entity as it looks `elapsed` ms into a tween of `duration`. */
export function sampleEntities(
  entities: Entity[],
  elapsed: number,
  duration: number,
  ease: Ease,
  timing: TitleTiming,
): Entity[] {
  const p = ease(clamp01(elapsed / duration));

  return entities.map((e) => ({
    ...e,
    from: { x: lerp(e.from.x, e.to.x, p), w: lerp(e.from.w, e.to.w, p) },
    fromWide: lerp(e.fromWide, e.toWide, p),
    fromTitle: titleAt(e, elapsed, timing),
  }));
}
