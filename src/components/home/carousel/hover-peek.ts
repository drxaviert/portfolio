import { useSyncExternalStore } from "react";
import { VISIBLE_SLOTS, mod } from "./carousel-math";
import type { Geometry } from "./carousel-math";

/**
 * The left hover peek: a one-column shift. The pointer near the first card's
 * left edge slides the whole row right by one narrow column plus a gap (the
 * last slot's width + 12px, 96px at xl). Every card keeps its rest width and
 * only moves; the last card is pushed out past the column's right edge, and
 * the previous item enters from beyond the left edge into a new first slot the
 * size of the last column. The row then reads
 * [prev 84][12][featured 753][12][180][12][83], exactly the column.
 */
export type HoverPeekSettings = {
  /** How far in from the column edge the hover zone reaches at rest, px. */
  hoverZone: number;
  revealMs: number;
  retractMs: number;
  /** Delay before the peek retracts once the pointer leaves, ms. */
  leaveMs: number;
};

export const DEFAULT_HOVER_PEEK: HoverPeekSettings = {
  hoverZone: 40,
  revealMs: 250,
  retractMs: 200,
  leaveMs: 120,
};

export const REVEAL_EASING = "cubic-bezier(0.23, 1, 0.32, 1)";
export const RETRACT_EASING = "ease-out";
export const PEEK_FADE_MS = 120;

/** The item that peeks in on the left: order[(first - 1 + n) % n]. */
export function peekItem(n: number, offset: number): number {
  return mod(offset - 1, n);
}

/** The items in the visible slots, front to back: the ones the shift moves. */
export function movedItems(n: number, offset: number): number[] {
  return Array.from({ length: Math.min(VISIBLE_SLOTS, n) }, (_, slot) =>
    mod(offset + slot, n),
  );
}

type Rect = { left: number; right: number; top: number; bottom: number };

/**
 * The hover zone: the page gutter beside the column plus `reach` px inside it,
 * over the row's height. At rest the reach is the tunable zone; while the peek
 * is open it grows to cover the previous card, so the pointer can move onto it.
 */
export function inZone(
  x: number,
  y: number,
  row: Rect,
  reach: number,
): boolean {
  return y >= row.top && y <= row.bottom && x < row.left + reach;
}

/** Whether the pointer is on the previous card (the first `width` px). */
export function onPrev(
  x: number,
  y: number,
  row: Rect,
  width: number,
): boolean {
  return (
    y >= row.top && y <= row.bottom && x >= row.left && x <= row.left + width
  );
}

export type PeekLayout = {
  /** How far every card moves right: the last slot's width plus a gap. */
  shift: number;
  /** The previous card's box, the same size as the last column. */
  prevW: number;
  /** Where each visible card's box goes with the peek open (widths unchanged). */
  cardX: number[];
  /** The previous card: from beyond the left edge to the first slot. */
  prev: { fromX: number; toX: number };
};

export function peekLayout(g: Geometry): PeekLayout {
  const last = g.slots[VISIBLE_SLOTS - 1];
  const shift = last.w + g.gap;

  return {
    shift,
    prevW: last.w,
    cardX: g.slots.map((slot) => slot.x + shift),
    prev: { fromX: g.slots[0].x - shift, toX: g.slots[0].x },
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
