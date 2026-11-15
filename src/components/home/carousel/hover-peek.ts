import { useSyncExternalStore } from "react";
import { VISIBLE_SLOTS, mod } from "./carousel-math";
import type { Geometry } from "./carousel-math";
import type { BlurMode } from "./blur-mode";

/**
 * Edge peeks (dev comparison, removed once Dat picks).
 *
 * The left edge has a hover peek: the pointer near the first card's left edge
 * pushes that card right and shows a blurred strip of the previous item in the
 * freed space, inside the column. `?peekRight=` picks what the right edge does:
 *
 *   static  the always-shown strip that `?blur=peek` draws
 *   hover   the left behaviour mirrored: last card pushed in, next item peeks
 *   none    nothing
 *
 * When `peekRight` is absent the right edge follows `?blur=` (a strip only with
 * `?blur=peek`), so existing links behave as before. When it is present it
 * governs the right edge, and `?blur=peek` is only honoured with `static`.
 */
export type PeekRight = "static" | "hover" | "none";
export type PeekSide = "left" | "right";

const RIGHT: readonly PeekRight[] = ["static", "hover", "none"];

export function resolveRightEdge(
  search: string,
  blur: BlurMode,
): { right: PeekRight; blur: BlurMode } {
  const value = new URLSearchParams(search).get("peekRight");
  const right =
    RIGHT.find((mode) => mode === value) ??
    (blur === "peek" ? "static" : "none");

  if (right === "static") return { right, blur: "peek" };
  return { right, blur: blur === "peek" ? "none" : blur };
}

export type HoverPeekSettings = {
  /** Width of the peeking strip, px. */
  hoverPeek: number;
  /** Gap between the pushed card and the strip, px. */
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

/** The item whose card peeks at this edge. */
export function peekItem(side: PeekSide, n: number, offset: number): number {
  return side === "left" ? mod(offset - 1, n) : mod(offset + VISIBLE_SLOTS, n);
}

/** The item whose card is pushed to make room (first or last visible). */
export function pushedItem(side: PeekSide, n: number, offset: number): number {
  return side === "left" ? mod(offset, n) : mod(offset + VISIBLE_SLOTS - 1, n);
}

type Rect = { left: number; right: number; top: number; bottom: number };

/**
 * The hover zone: the page gutter beside the column plus `zone` px inside it,
 * over the row's height. One region per edge, tested against the pointer.
 */
export function inZone(
  side: PeekSide,
  x: number,
  y: number,
  row: Rect,
  zone: number,
): boolean {
  if (y < row.top || y > row.bottom) return false;
  return side === "left" ? x < row.left + zone : x > row.right - zone;
}

/** Whether the pointer is on the strip itself. */
export function onStrip(
  side: PeekSide,
  x: number,
  y: number,
  row: Rect,
  size: number,
): boolean {
  if (y < row.top || y > row.bottom) return false;
  return side === "left"
    ? x >= row.left && x <= row.left + size
    : x <= row.right && x >= row.right - size;
}

export type PeekLayout = {
  card: { restX: number; pushX: number; pushR: number; restW: number };
  strip: { box: number; fromX: number; toX: number; r: number };
};

/**
 * Where the pushed card and the strip go, in row pixels. The card keeps its
 * width and is cropped on the right by `size + gap` (the registered `--car-x`
 * and `--car-r`), so the visible gap to the strip is exactly `gap`.
 */
export function peekLayout(
  side: PeekSide,
  g: Geometry,
  size: number,
  gap: number,
): PeekLayout {
  const first = g.slots[0];
  const last = g.slots[VISIBLE_SLOTS - 1];
  const box = Math.max(size, last.w);
  const push = size + gap;

  if (side === "left") {
    return {
      card: {
        restX: first.x,
        pushX: first.x + push,
        pushR: push,
        restW: first.w,
      },
      strip: { box, fromX: first.x - size, toX: first.x, r: box - size },
    };
  }

  return {
    card: { restX: last.x, pushX: last.x, pushR: push, restW: last.w },
    strip: {
      box,
      fromX: g.rowWidth,
      toX: last.x + last.w - size,
      r: box - size,
    },
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
