"use client";

/**
 * The hand-off between one study and the next.
 *
 * "Next project" used to swap the article in one commit: the old body vanished
 * and the new body started at opacity 0, so the panel showed a frame or two of
 * bare surface. Now the outgoing article leaves on the reader's own close fade
 * (the 140ms ease-in on the scroll column), the route is pushed part-way into
 * it, and the incoming entrance mounts with its first 120ms already elapsed.
 * The exit is seen, the entry is already at ~55% when it paints, and the two
 * overlap: no frame has an empty panel with nothing entering.
 *
 * The lead is a module-level timestamp, not React state: a study -> study
 * navigation remounts the whole reader shell, so nothing in the tree survives
 * the swap. It is read once by the incoming mount and cleared.
 */

export const PROGRESSION_EXIT_MS = 140;
/** How far into the incoming entrance its first paint lands. */
export const PROGRESSION_LEAD_MS = 120;
/**
 * Push the route this far into the fade. The commit then lands while the old
 * column is still faintly there, instead of cutting it at full strength (push
 * at 0) or showing an empty panel while the route loads (push after the fade).
 */
const PUSH_RATIO = 0.35;
/** A lead this old means the navigation never landed; don't leak it into a card open. */
const LEAD_TTL_MS = 900;

let entryAt: number | null = null;

/** The route is about to change: the next mount of the reader is a hand-off. */
export function announceProgressionEntry() {
  entryAt = performance.now();
}

/** The incoming mount's head start in ms; 0 for every other way in. */
export function peekProgressionLead(): number {
  if (entryAt === null) return 0;

  if (performance.now() - entryAt > LEAD_TTL_MS) {
    entryAt = null;

    return 0;
  }

  return PROGRESSION_LEAD_MS;
}

export function clearProgressionLead() {
  entryAt = null;
}

/**
 * The outgoing article leaves the way it does on close: one 140ms ease-in
 * opacity fade on the scroll column. Resolves when the route should be pushed,
 * before the fade ends, so the incoming article is on screen while the old one
 * is still faint.
 *
 * Reduced motion has no fade and no wait: the content changes in one commit,
 * and the incoming column skips its own fade (the data attribute), so nothing
 * moves and no empty beat is added.
 */
export async function leaveForNextStudy(): Promise<void> {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduce) return;

  const scroll = document.querySelector<HTMLElement>(".wd-reader-scroll");

  scroll?.animate([{ opacity: 1 }, { opacity: 0 }], {
    duration: PROGRESSION_EXIT_MS,
    easing: "ease-in",
    // The navigation removes the element; keep the last frame until it does.
    fill: "forwards",
  });

  await new Promise((resolve) => {
    window.setTimeout(resolve, Math.round(PROGRESSION_EXIT_MS * PUSH_RATIO));
  });
}
