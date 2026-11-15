import { useSyncExternalStore } from "react";
import { VISIBLE_SLOTS, mod } from "./carousel-math";
import type { Geometry } from "./carousel-math";

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

export type PeekLayout = {
  /** How far every card moves right: strip plus gap. */
  shift: number;
  strip: { box: number; fromX: number; toX: number; r: number };
};

/**
 * Where the strip goes, in row pixels. Every card keeps its width and moves
 * right by `size + gap` along `--car-x`, so the strip and the first card are
 * exactly `gap` apart.
 */
export function peekLayout(g: Geometry, size: number, gap: number): PeekLayout {
  const first = g.slots[0];
  const box = Math.max(size, g.slots[VISIBLE_SLOTS - 1].w);

  return {
    shift: size + gap,
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
