/**
 * Where the carousel was left, for the life of the document.
 *
 * `/` and `/work*` each mount their own HomeScreen (page vs. layout), so the
 * carousel remounts when the work drawer opens or closes. Its offset lives in
 * component state and would start over at 0 each time. This module-level value
 * outlives the remount and is read synchronously for the first render, so the
 * row is already in place at first paint. In memory only: a reload starts over.
 *
 * It is only ever written from a step (a client event), so the server always
 * reads 0 and the hydrating render matches it.
 */
let remembered = 0;

/** The offset to start from for a carousel of `n` items. */
export function restoredOffset(n: number): number {
  return n > 0 && remembered >= 0 && remembered < n ? remembered : 0;
}

export function rememberOffset(offset: number) {
  remembered = offset;
}

/** Test seam: back to a fresh document. */
export function forgetOffset() {
  remembered = 0;
}
