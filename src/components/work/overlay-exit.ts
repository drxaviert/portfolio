"use client";

/**
 * The reader announces when its reverse morph has landed. The intercepted
 * slot listens and only then unmounts the page it kept alive for the exit.
 */
export const OVERLAY_EXIT_EVENT = "wd:overlay-exit";

export function announceOverlayExit() {
  window.dispatchEvent(new Event(OVERLAY_EXIT_EVENT));
}
