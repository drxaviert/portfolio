/**
 * Keyboard tile navigation on the canvas grid.
 *
 * The canvas is one focusable region, not 88 focusable tiles. A Tab (or a
 * viewer close) puts keyboard focus on the tile at the centre of the grid;
 * arrow keys then move that focus one cell at a time and the scroll glides the
 * tile to the centre. The grid wraps on both axes, so the edge cells have a
 * neighbour on the other side.
 *
 * The glide is the reference's tile step: 700ms power3.inOut
 * (cubic-bezier(.65, 0, .35, 1)). It is retargeted from the current scroll, so
 * a second arrow press mid-glide continues from where the first one reached.
 */

import { power3InOut } from "./intro";

export const KEYBOARD_GLIDE_MS = 700;

export type GridCell = {
  col: number;
  row: number;
};

/** One cell in a direction, wrapping at both edges. */
export function adjacentCell(
  cell: GridCell,
  dx: number,
  dy: number,
  cols: number,
  rows: number,
): GridCell {
  const wrap = (value: number, length: number) =>
    ((value % length) + length) % length;

  return {
    col: wrap(cell.col + dx, cols),
    row: wrap(cell.row + dy, rows),
  };
}

/** 0 at the press, 1 when the tile has landed; clamped outside the segment. */
export function keyboardGlideProgress(
  startedAt: number,
  now: number,
  durationMs = KEYBOARD_GLIDE_MS,
): number {
  if (durationMs <= 0) return 1;

  return power3InOut(
    Math.min(1, Math.max(0, (now - startedAt) / durationMs)),
  );
}
