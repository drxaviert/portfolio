"use client";

/**
 * The reader announces when its reverse morph has landed. The intercepted
 * slot listens and only then unmounts the page it kept alive for the exit.
 */
export const OVERLAY_EXIT_EVENT = "wd:overlay-exit";

export function announceOverlayExit() {
  window.dispatchEvent(new Event(OVERLAY_EXIT_EVENT));
}

/**
 * The home carousel keeps whatever pose it is drawn in while the reader's morph
 * measures its card, so nothing jumps under the opening reader. These two
 * moments are when it may put itself back to rest unseen: once the reader has
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
