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

export type EaseKey =
  "smooth" | "glide" | "quint-out" | "sheet" | "expo-out" | "custom";
export type Ease = (t: number) => number;
export type Bezier = [number, number, number, number];

/**
 * Default is "smooth": a gentle start and a long glide. easeOutExpo covers
 * about half the distance in its first ~70ms, so a step starting on it snaps;
 * it stays here as "expo-out" for comparison.
 */
export const EASE_OPTIONS: { value: EaseKey; label: string }[] = [
  { value: "smooth", label: "smooth (0.5, 0, 0.1, 1)" },
  { value: "glide", label: "glide (0.65, 0, 0.35, 1)" },
  { value: "quint-out", label: "quint-out (0.22, 1, 0.36, 1)" },
  { value: "sheet", label: "sheet (0.32, 0.72, 0, 1)" },
  { value: "expo-out", label: "expo-out, exact (1 - 2^-10t)" },
  { value: "custom", label: "custom cubic-bezier" },
];

const BEZIERS: Record<"smooth" | "glide" | "quint-out" | "sheet", Bezier> = {
  smooth: [0.5, 0, 0.1, 1],
  glide: [0.65, 0, 0.35, 1],
  "quint-out": [0.22, 1, 0.36, 1],
  sheet: [0.32, 0.72, 0, 1],
};

/**
 * An interrupted run starts on a card that is already moving. A curve that
 * starts slow would stop it dead and restart, so retargeted runs use an
 * ease-out that carries speed from the first frame.
 */
export const RETARGET_BEZIER: Bezier = BEZIERS["quint-out"];

/** "0.5, 0, 0.1, 1" -> the four numbers, or null if not a valid curve. */
export function parseBezier(text: string): Bezier | null {
  const parts = text
    .replace(/cubic-bezier\(|\)/g, "")
    .split(/[\s,]+/)
    .filter(Boolean)
    .map(Number);

  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) return null;
  if (parts[0] < 0 || parts[0] > 1 || parts[2] < 0 || parts[2] > 1) return null;

  return parts as Bezier;
}

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

const expoOut: Ease = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : 1 - 2 ** (-10 * t));

/** One curve, both as a function (for sampling) and as CSS (for WAAPI). */
export type EaseSpec = { fn: Ease; css: string };

export function bezierSpec(b: Bezier): EaseSpec {
  return { fn: cubicBezier(...b), css: `cubic-bezier(${b.join(", ")})` };
}

export function easeSpec(key: EaseKey, custom: Bezier): EaseSpec {
  if (key === "expo-out") return { fn: expoOut, css: linearEasing(expoOut) };
  if (key === "custom") return bezierSpec(custom);
  return bezierSpec(BEZIERS[key]);
}

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
  return {
    x: g.rowWidth + g.gap,
    w: g.slots[VISIBLE_SLOTS - 1].w,
  };
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

/**
 * Title fades share the step's one timeline and curve, so they are expressed
 * in eased progress (0..1), not time: in once the card is mostly in the wide
 * slot, out almost at once.
 */
export type TitleTiming = {
  /** Progress at which the fade-in starts. */
  start: number;
  /** How much progress the fade-in takes. */
  span: number;
  /** Progress by which a leaving title is gone. */
  outEnd: number;
};

/** Eased progress the title's keyframes sit at: [offset, opacity] pairs. */
export function titleKeys(
  e: Pick<Entity, "fromTitle" | "toTitle">,
  t: TitleTiming,
): { offset: number; opacity: number }[] {
  if (e.toTitle > e.fromTitle) {
    const start = clamp01(t.start);
    const end = Math.min(start + Math.max(t.span, 0.01), 1);

    return [
      { offset: 0, opacity: e.fromTitle },
      { offset: start, opacity: e.fromTitle },
      { offset: end, opacity: e.toTitle },
      { offset: 1, opacity: e.toTitle },
    ];
  }

  return [
    { offset: 0, opacity: e.fromTitle },
    { offset: Math.max(t.outEnd, 0.01), opacity: e.toTitle },
    { offset: 1, opacity: e.toTitle },
  ];
}

export function titleAt(
  e: Pick<Entity, "fromTitle" | "toTitle">,
  progress: number,
  timing: TitleTiming,
): number {
  if (e.fromTitle === e.toTitle) return e.toTitle;

  const keys = titleKeys(e, timing);
  for (let i = 1; i < keys.length; i++) {
    if (progress <= keys[i].offset) {
      const a = keys[i - 1];
      const b = keys[i];
      const span = b.offset - a.offset;
      return span <= 0
        ? b.opacity
        : lerp(a.opacity, b.opacity, (progress - a.offset) / span);
    }
  }

  return e.toTitle;
}

/** Every entity as it looks `elapsed` ms into a run of `duration`. */
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
    fromTitle: titleAt(e, p, timing),
  }));
}
