"use client";

/**
 * The work sheet's session state, kept outside React.
 *
 * The reader's morph needs the item that was clicked *on the sheet*: the
 * homepage's carousel carries a card with the same slug, and its origin lookup
 * takes the first laid-out copy, which is the home one. The sheet sits over the
 * home page, so without this record the reverse morph would fly into a card the
 * visitor never clicked.
 *
 * No React state and no motion import here: the nav dock reads this module to
 * decide what a "Work" click means, and the dock is in the root layout, which
 * must not pull the overlay's code into the home route's first-load JS.
 */

let origin: HTMLElement | null = null;

/** The sheet item a click is opening, so the reader starts and ends there. */
export function markSheetOrigin(element: HTMLElement | null): void {
  origin = element;
}

/**
 * The recorded sheet item for `slug`, while it is still laid out in the
 * document. A stale element (the sheet has been unmounted or is being kept
 * hidden by the router) is not an origin: it has no box to fly from or into.
 */
export function sheetOrigin(slug: string): HTMLElement | null {
  if (!origin || !origin.isConnected || origin.getClientRects().length === 0) {
    return null;
  }

  const elementSlug = origin.dataset.workSlug ?? origin.dataset.workCard;

  return elementSlug === slug ? origin : null;
}

/**
 * "Work" was clicked while the sheet is already the destination. The dock
 * cannot call into the sheet (that would import motion into every route), so
 * the sheet listens for this and re-opens if it is mid-close.
 */
export const WORK_SHEET_OPEN_EVENT = "wd:work-sheet-open";

export function requestWorkSheetOpen(): void {
  window.dispatchEvent(new Event(WORK_SHEET_OPEN_EVENT));
}

/** Whether a sheet is mounted: the dock's no-op test for the nav item. */
export function isWorkSheetMounted(): boolean {
  return document.querySelector("[data-work-sheet]") !== null;
}
