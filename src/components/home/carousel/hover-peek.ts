import { useSyncExternalStore } from "react";
import { VISIBLE_SLOTS, mod } from "./carousel-math";
import type { Geometry } from "./carousel-math";
import { fitWidths } from "./peek-fit";
import type { PeekFit } from "./peek-fit";

/**
 * The left hover peek. The pointer near the first card's left edge slides the
 * whole row right by `size + gap`, like scrolling a strip, and shows a blurred
 * strip of the previous item in the freed space, inside the column. The last
 * card slips under the column's right edge, cut by the row clip, and both
 * edges fade with an alpha mask while the peek is active.
 */
export type HoverPeekSettings = {
  /** Width of the peeking strip, px. */
  hoverPeek: number;
  /** Gap between the first card and the strip, px. */
  hoverGap: number;
  /** How far in from the column edge the hover zone reaches, px. */
  hoverZone: number;
  revealMs: number;
  retractMs: number;
  /** Delay before the peek retracts once the pointer leaves, ms. */
  leaveMs: number;
  /** Strip blur at rest and under the pointer, px. */
  hoverBlur: number;
  hoverBlurOn: number;
  /** How much the outer edge of each treated slice fades: 0 none, 1 fully. */
  hoverFade: number;
};

export const DEFAULT_HOVER_PEEK: HoverPeekSettings = {
  hoverPeek: 20,
  hoverGap: 12,
  hoverZone: 40,
  revealMs: 250,
  retractMs: 200,
  leaveMs: 120,
  hoverBlur: 4,
  hoverBlurOn: 2,
  hoverFade: 0.45,
};

export const REVEAL_EASING = "cubic-bezier(0.23, 1, 0.32, 1)";
export const RETRACT_EASING = "ease-out";
export const PEEK_FADE_MS = 120;

/** The item whose card peeks: order[(first - 1 + n) % n]. */
export function peekItem(n: number, offset: number): number {
  return mod(offset - 1, n);
}

/** The items in the visible slots, front to back, that the peek moves. */
export function movedItems(n: number, offset: number): number[] {
  return Array.from({ length: Math.min(VISIBLE_SLOTS, n) }, (_, slot) =>
    mod(offset + slot, n),
  );
}

type Rect = { left: number; right: number; top: number; bottom: number };

/**
 * The hover zone: the page gutter beside the column plus `zone` px inside it,
 * over the row's height.
 */
export function inZone(x: number, y: number, row: Rect, zone: number): boolean {
  return y >= row.top && y <= row.bottom && x < row.left + zone;
}

/** Whether the pointer is on the strip itself. */
export function onStrip(
  x: number,
  y: number,
  row: Rect,
  size: number,
): boolean {
  return (
    y >= row.top && y <= row.bottom && x >= row.left && x <= row.left + size
  );
}

export type PeekCardLayout = {
  /** Where the card's box starts, and how much of it shows. */
  x: number;
  w: number;
  /** The box the card is laid out in while the peek is open: never narrower than rest. */
  box: number;
};

export type PeekLayout = {
  /** Blur of the last card's visible slice, the same as the left strip's. */
  blur: number;
  /** The four visible cards, front to back. */
  cards: PeekCardLayout[];
  strip: { box: number; fromX: number; toX: number; r: number };
};

/**
 * The row with the peek open reads
 * [strip][gap][A][gap][B][gap][C][gap][last], strip and last both `size` wide,
 * so A + B + C is the column minus both ends and four gaps. `fit` decides how
 * the middle cards share what that frees. The last card keeps its box and slides
 * under the column's edge until `size` of it shows. Every change is a position
 * and a crop (`--car-x`, `--car-r`), never a width tween.
 */
export function peekLayout(
  g: Geometry,
  size: number,
  gap: number,
  blur: number,
  fit: PeekFit,
): PeekLayout {
  const first = g.slots[0];
  const last = g.slots[VISIBLE_SLOTS - 1];
  const rest = g.slots.slice(0, VISIBLE_SLOTS - 1).map((slot) => slot.w);
  const extra =
    g.rowWidth -
    2 * size -
    VISIBLE_SLOTS * gap -
    rest.reduce((a, w) => a + w, 0);
  const widths = fitWidths(fit, rest, extra);

  const cards: PeekCardLayout[] = [];
  let x = first.x + size + gap;
  widths.forEach((w, index) => {
    cards.push({ x, w, box: Math.max(w, g.slots[index].w) });
    x += w + gap;
  });
  cards.push({ x: g.rowWidth - size, w: last.w, box: last.w });

  const box = Math.max(size, last.w);

  return {
    blur,
    cards,
    strip: { box, fromX: first.x - size, toX: first.x, r: box - size },
  };
}

const QUERY = "(hover: hover) and (pointer: fine)";

function subscribe(onChange: () => void) {
  if (typeof window.matchMedia !== "function") return () => {};

  const list = window.matchMedia(QUERY);
  list.addEventListener?.("change", onChange);
  return () => list.removeEventListener?.("change", onChange);
}

/** True for a mouse-like pointer that can really hover (not touch). */
export function useHoverCapable(): boolean {
  return useSyncExternalStore(
    subscribe,
    () =>
      typeof window.matchMedia === "function" &&
      window.matchMedia(QUERY).matches,
    () => false,
  );
}
