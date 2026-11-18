"use client";

/**
 * The hand-off between one study and the next.
 *
 * "Next project" swaps the article, not the drawer. The outgoing article leaves
 * on the reader's own close fade (the 140ms ease-in on the scroll column) and
 * the route moves once it is gone; the incoming mount keeps the panel, the
 * backdrop and the nav in place and runs the same entrance the drawer plays on
 * open - the wd-enter-fade + wd-enter-defocus cascade - from its first frame.
 *
 * The marker is module-level, not React state: a study -> study navigation
 * remounts the whole reader shell (Next keys the intercepted page by its slug),
 * so nothing in the tree survives the swap. It is peeked by the incoming mount
 * and cleared once that mount has read it.
 */

/** The outgoing article's fade; the reader's own close fade, in ms. */
export const PROGRESSION_EXIT_MS = 140;
/**
 * A marker this old means the navigation never landed. Don't leak it into a
 * card open: the exit fade plus a slow route is still far inside this.
 */
const HANDOFF_TTL_MS = 1500;

type Handoff = {
  at: number;
  /**
   * The history depth the incoming entry should carry: how many studies have
   * been opened on top of the entry the drawer was opened from. `null` for a
   * Back/Forward, whose entry already carries its own depth.
   */
  depth: number | null;
};

let handoff: Handoff | null = null;

/**
 * Whether a drawer is already on screen. A study -> study navigation remounts
 * the reader, and the incoming mount has to know it is the same drawer even
 * when the route change was the browser's (Back/Forward), not a click this
 * module was told about.
 */
let drawerOpen = false;

/** A shell mounted: from now until it closes, study swaps join the drawer. */
export function enterDrawer() {
  drawerOpen = true;
}

/** The drawer closed (or left for the homepage): the next open flies again. */
export function leaveDrawer() {
  drawerOpen = false;
}

export function isDrawerOpen() {
  return drawerOpen;
}

/** The route is about to change: the next mount of the reader joins the drawer. */
export function announceProgressionEntry(depth: number | null = null) {
  handoff = { at: performance.now(), depth };
}

/** The pending hand-off, if the next mount of the reader can still join it. */
export function peekProgressionEntry(): { depth: number | null } | null {
  if (!handoff) return null;

  if (performance.now() - handoff.at > HANDOFF_TTL_MS) {
    handoff = null;

    return null;
  }

  return { depth: handoff.depth };
}

/** The incoming mount has read the hand-off. */
export function clearProgressionEntry() {
  handoff = null;
}

/**
 * The outgoing article leaves the way it does on close: one 140ms ease-in
 * opacity fade on the scroll column. Resolves once the fade is done, so the
 * route moves onto a settled panel rather than cutting a half-faded article.
 *
 * Reduced motion has no fade and no wait: the content changes in one commit and
 * the incoming column takes the 120ms opacity pass instead.
 */
export async function leaveForNextStudy(): Promise<void> {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduce) return;

  fadeStudyOut();

  await new Promise((resolve) => {
    window.setTimeout(resolve, PROGRESSION_EXIT_MS);
  });
}

/**
 * Fade the article that is on screen. The route commit may replace it before
 * the fade ends (a Back/Forward fetch is not ours to hold), in which case the
 * incoming entrance is the visible half of the swap.
 */
export function fadeStudyOut() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const scroll = document.querySelector<HTMLElement>(".wd-reader-scroll");

  scroll?.animate([{ opacity: 1 }, { opacity: 0 }], {
    duration: PROGRESSION_EXIT_MS,
    easing: "ease-in",
    // The navigation removes the element; keep the last frame until it does.
    fill: "forwards",
  });
}
