/**
 * Order, wrap and motion maths for the home carousel. Pure: no DOM, no React.
 *
 * Items sit in a ring of `n`. The first four (from `offset`) fill the four
 * visible slots; the rest wait offscreen to the right, in ring order. A step
 * moves the offset by `k`, so every item travels `k` slots toward the front.
 * An item that would pass slot 0 wraps to the back of the ring.
 */

export const VISIBLE_SLOTS = 4;
/** Slot gap in px. Mirrors `calc(var(--spacing) * 3)` in home-carousel.css. */
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

/**
 * The columns a run lays out: one per item, never more than the four slots. A
 * list with fewer items than slots keeps its cards at the Figma widths and
 * centres them instead of leaving the unused columns empty.
 */
export function slotCount(n: number): number {
  return Math.min(Math.max(n, 0), VISIBLE_SLOTS);
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
  "quick" | "smooth" | "glide" | "quint-out" | "sheet" | "expo-out" | "custom";
export type Ease = (t: number) => number;
export type Bezier = [number, number, number, number];

/**
 * Default is "quick": a fast, decelerating start (about 18% of the travel by
 * 50ms, 36% by 100ms of a 900ms step), so the whole row is visibly moving from
 * the first frames instead of holding still for ~150ms. "smooth" is the old
 * gentle-start-and-long-glide curve, kept as a preset; easeOutExpo covers about
 * half the distance in its first ~70ms, so a step starting on it snaps — it
 * stays as "expo-out" for comparison.
 */
export const EASE_OPTIONS: { value: EaseKey; label: string }[] = [
  { value: "quick", label: "quick (0.25, 0.8, 0.25, 1)" },
  { value: "smooth", label: "smooth (0.5, 0, 0.1, 1)" },
  { value: "glide", label: "glide (0.65, 0, 0.35, 1)" },
  { value: "quint-out", label: "quint-out (0.22, 1, 0.36, 1)" },
  { value: "sheet", label: "sheet (0.32, 0.72, 0, 1)" },
  { value: "expo-out", label: "expo-out, exact (1 - 2^-10t)" },
  { value: "custom", label: "custom cubic-bezier" },
];

const BEZIERS: Record<
  "quick" | "smooth" | "glide" | "quint-out" | "sheet",
  Bezier
> = {
  quick: [0.25, 0.8, 0.25, 1],
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
 */
export type Entity = {
  item: number;
  ghost: boolean;
  from: Pose;
  to: Pose;
  /** A card stepping in from the hover peek: the left fade it had. */
  peekFrom?: { fade: number };
  /** A card already blurred by the previous run: the filter it is drawn at. */
  edgeBlurFrom?: string;
  /** Leaves through the left end: it carries the peek's left-edge treatment. */
  edgeLeft?: boolean;
};

export function entityKey(e: Pick<Entity, "item" | "ghost">): string {
  return `${e.ghost ? "g" : "m"}${e.item}`;
}

export function restEntities(g: Geometry, n: number, offset: number): Entity[] {
  return Array.from({ length: n }, (_, item) => {
    const slot = slotOf(item, offset, n);
    const pose = slotPose(g, slot);

    return {
      item,
      ghost: false,
      from: pose,
      to: pose,
    };
  });
}

function retargetTo(e: Entity, to: Pose): Entity {
  return { ...e, to };
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

  // Every card that enters from the right starts at the same offRight point:
  // the seam copies of a far step, and the waiting main card parked past the
  // last slot. Left on that one point they pile up, and the card growing into a
  // wide slot covers the one behind it for most of the run, because a growing
  // card takes the gap to the next slot as it widens. Queue them in landing
  // order instead, one entry column plus a gap apart, so the gap between them
  // stays the same on every frame: the lead card's growth exactly matches the
  // extra distance it travels. One entrant (a one-slot step) keeps the point.
  const entrance = new Map<number, number>();
  if (k > 0) {
    current
      .map((e) => e.item)
      .filter((item, index, all) => all.indexOf(item) === index)
      .filter((item) => current.filter((e) => e.item === item).length === 1)
      .map((item) => {
        const prevSlot = slotOf(item, prevOffset, n);
        const unwrapped = prevSlot - k;
        const dest = mod(unwrapped, n);
        const wraps = unwrapped < 0 || unwrapped >= n;
        const entering =
          dest < VISIBLE_SLOTS && (wraps || prevSlot >= VISIBLE_SLOTS);

        return entering ? { item, dest } : null;
      })
      .filter(
        (candidate): candidate is { item: number; dest: number } =>
          candidate !== null,
      )
      .sort((a, b) => a.dest - b.dest)
      .forEach((candidate, index) => entrance.set(candidate.item, index));
  }

  // The cards a rightward step pushes out through the left end leave as one
  // group: each moves by the same distance, the one that takes the last of them
  // just past the edge. Sent each to just past the edge on its own, a wide card
  // and the slim ones behind it travelled different distances in the same time,
  // so the slim ones caught up and slid over the wide one, which read as cards
  // cut off midway. A step of one has one leaving card, so it is unchanged.
  const pushOut =
    k > 0
      ? Math.max(
          0,
          ...current
            .filter((e) => {
              if (current.filter((o) => o.item === e.item).length !== 1)
                return false;
              const unwrapped = slotOf(e.item, prevOffset, n) - k;
              return unwrapped < 0 || unwrapped >= n;
            })
            .map((e) => e.from.x + e.from.w + g.gap),
        )
      : 0;

  for (let item = 0; item < n; item++) {
    const ents = current.filter((e) => e.item === item);
    const prevSlot = slotOf(item, prevOffset, n);
    const unwrapped = prevSlot - k;
    const dest = mod(unwrapped, n);
    const wraps = unwrapped < 0 || unwrapped >= n;
    const destPose = slotPose(g, dest);
    const visible = dest < VISIBLE_SLOTS;

    if (ents.length >= 2) {
      const [a, b] = ents;
      if (!visible) {
        out.push(retargetTo(a, nearestExit(g, a.from)));
        out.push(retargetTo(b, nearestExit(g, b.from)));
      } else {
        const aLeads =
          Math.abs(a.from.x - destPose.x) <= Math.abs(b.from.x - destPose.x);
        const [lead, other] = aLeads ? [a, b] : [b, a];
        out.push(retargetTo(lead, destPose));
        out.push(retargetTo(other, nearestExit(g, other.from)));
      }
      continue;
    }

    const main = ents[0];

    if (!wraps) {
      // A main card waiting past the last slot enters from its place in the
      // right-hand queue (see `entrance`), not from the raw offRight point.
      const queued = entrance.get(item);
      if (k > 0 && queued !== undefined && prevSlot >= VISIBLE_SLOTS) {
        out.push(
          retargetTo(
            {
              ...main,
              from: {
                x: entry.x + queued * (entry.w + g.gap),
                w: main.from.w,
              },
            },
            destPose,
          ),
        );
      } else {
        out.push(retargetTo(main, destPose));
      }
      continue;
    }

    if (k > 0) {
      // A card leaving through the left end slides out at its own width, with
      // the rest of the leaving group (pushOut) - a push, not a shrink. It keeps
      // the left-edge treatment for the run (see playEntity), so its edge fades
      // and blurs as it goes.
      out.push({
        ...retargetTo(main, { x: main.from.x - pushOut, w: main.from.w }),
        edgeLeft: true,
      });
    } else {
      out.push(retargetTo(main, exit));
    }

    if (visible) {
      const queued = k > 0 ? (entrance.get(item) ?? 0) : 0;
      out.push({
        item,
        ghost: true,
        from: { ...entry, x: entry.x + queued * (entry.w + g.gap) },
        to: destPose,
      });
    }
  }

  return out;
}

/**
 * The left edge's strength over a run, for a card leaving through the left
 * end: how far its left edge has crossed the column's edge (x = 0), over the
 * fade width, clamped to 0..1. Offsets are in eased progress, so the keyframes
 * go on an animation with the step's own easing and the strength follows the
 * card's position exactly: no ramp before the card reaches the edge (it would
 * fade a card still resting there), a full ramp as soon as it is one fade width
 * past it (a ramp that rose on the run's clock left a hard cut at the edge for
 * the first frames, when the card has already travelled furthest).
 */
export function edgeLeftKeys(
  fromX: number,
  toX: number,
  fadeWidth: number,
): { offset: number; value: number }[] {
  const at = (x: number) =>
    fadeWidth > 0 ? Math.min(1, Math.max(0, -x / fadeWidth)) : x < 0 ? 1 : 0;
  const keys = [{ offset: 0, value: at(fromX) }];
  if (toX !== fromX) {
    const crossings = [0, -fadeWidth]
      .map((x) => ({ offset: (x - fromX) / (toX - fromX), value: at(x) }))
      .filter((k) => k.offset > 0 && k.offset < 1)
      .sort((a, b) => a.offset - b.offset);
    keys.push(...crossings);
  }
  keys.push({ offset: 1, value: at(toX) });
  return keys;
}

/**
 * Whether a run takes the card's drawn right edge past the column's right edge
 * (x = rowWidth) at either end: it crosses that edge, so it carries the right
 * edge's column-anchored fade and progressive blur (home-carousel.css) instead
 * of a blur over the whole card. The drawn edge is `x + w` (the pose's width,
 * not the wider box a moving card is laid out in).
 */
export function crossesRight(
  e: Pick<Entity, "from" | "to">,
  rowWidth: number,
): boolean {
  return Math.max(e.from.x + e.from.w, e.to.x + e.to.w) > rowWidth + 0.5;
}

/**
 * How much longer a step runs for each slot past the first. A step of two or
 * three moves the incoming card 1.25x / 1.38x as far as a step of one in the
 * same time, so its peak speed was that much higher and read as a lurch. At
 * +15% per extra slot the far steps peak within ~10% of a one-slot step.
 */
export const FAR_STEP_STRETCH = 0.15;

/** The run time of a step of `k` slots: one slot (either way) keeps `base`. */
export function stepDuration(base: number, k: number): number {
  const extra = Math.max(0, Math.abs(k) - 1);
  return Math.round(base * (1 + FAR_STEP_STRETCH * extra));
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Every entity as it looks `elapsed` ms into a run of `duration`. */
export function sampleEntities(
  entities: Entity[],
  elapsed: number,
  duration: number,
  ease: Ease,
): Entity[] {
  const p = ease(clamp01(elapsed / duration));

  return entities.map((e) => ({
    ...e,
    from: { x: lerp(e.from.x, e.to.x, p), w: lerp(e.from.w, e.to.w, p) },
  }));
}
