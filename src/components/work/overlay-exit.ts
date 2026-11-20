"use client";

/**
 * The home carousel keeps whatever pose it is drawn in while the drawer's morph
 * measures its card, so nothing jumps under the opening drawer. These two
 * moments are when it may put itself back to rest unseen: once the drawer has
 * landed over it, and as the reverse morph is about to measure the card again.
 */
export const OVERLAY_OPENED_EVENT = "wd:overlay-opened";
export const OVERLAY_CLOSING_EVENT = "wd:overlay-closing";

export function announceOverlayOpened() {
  window.dispatchEvent(new Event(OVERLAY_OPENED_EVENT));
}

export function announceOverlayClosing() {
  window.dispatchEvent(new Event(OVERLAY_CLOSING_EVENT));
}
