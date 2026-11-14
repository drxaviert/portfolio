"use client";

import { useEffect } from "react";

/**
 * How long the shipped home entrance runs, in ms: the veil settles at 1400 and
 * the last card at 250 + 6 x 60 + 1100 = 1710. Recorded here so the gate below
 * and the prototype's readout cannot drift apart.
 */
export const SHIPPED_ENTRANCE_TOTAL_MS = 1710;

/**
 * The one-play-per-document gate for the shipped entrance.
 *
 * The entrance itself is CSS: the server markup and the stylesheet start it at
 * first paint. This component only *ends* it as a replayable animation — once
 * the sequence has settled it marks the document, and the stylesheet cancels
 * the animations for `[data-entrance-shipped]`. A client-side return to `/` in
 * the same tab therefore renders the resting page, while a hard load is a new
 * document without the mark and plays again.
 *
 * The timer is the only writer: a cleanup must not mark, or React's dev
 * double-mount would cancel the entrance one tick after it started. Leaving the
 * page mid-sequence therefore costs a replay on return, which is the right
 * trade — the entrance was never seen in full.
 */
export function HomeEntrancePlayed() {
  useEffect(() => {
    const root = document.documentElement;

    if (root.dataset.entrancePlayed === "true") return;

    const timer = window.setTimeout(() => {
      root.dataset.entrancePlayed = "true";
    }, SHIPPED_ENTRANCE_TOTAL_MS);

    return () => window.clearTimeout(timer);
  }, []);

  return null;
}
