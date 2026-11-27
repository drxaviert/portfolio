"use client";

import { useLayoutEffect, useState } from "react";

/**
 * How long the shipped home entrance runs, in ms: the veil settles at 1400 and
 * the last card at 250 + 6 x 60 + 1100 = 1710. The gate below uses this as the
 * first check, but the entrance's own animations decide when it lands.
 */
export const SHIPPED_ENTRANCE_TOTAL_MS = 1710;

/** Never leave the gate open longer than this if the animation clock stalls. */
const ENTRANCE_GATE_CEILING_MS = 10_000;

/** The shipped entrance's own animations that are still running. */
function runningEntranceAnimations(): Animation[] {
  if (typeof document.getAnimations !== "function") return [];

  return document.getAnimations().filter((animation) => {
    const name =
      "animationName" in animation
        ? (animation as CSSAnimation).animationName
        : "";

    return name.startsWith("entrance-") && animation.playState === "running";
  });
}

type Mount = {
  /** The server's markup for this page was already in the document. */
  serverRendered: boolean;
  /** Home has been on screen before in this document. */
  shownBefore: boolean;
};

/**
 * The one-play-per-document gate for the shipped entrance.
 *
 * The entrance itself is CSS: the server markup and the stylesheet start it at
 * first paint. This component only *ends* it as a replayable animation — once
 * the sequence has settled it marks the document, and the stylesheet cancels
 * the animations for `[data-entrance-played]`.
 *
 * A client-side arrival at `/` has no home to come back to: there is no home
 * markup in the document when React first renders this, so playing the welcome
 * would leave the page blank for its 1.7s. That arrival renders resting — the
 * same page a return from a study shows — while a first load still plays, since
 * its markup is already in the document (`[data-entrance-shipped]`) when the
 * first render runs, even when Next streams the page in after the shell.
 * Leaving `/` mid-sequence still replays on return: home had been shown, and
 * the sequence was never seen.
 */
export function HomeEntrancePlayed() {
  // Read once, on the first render: a client-side arrival has no markup yet, a
  // first load has the server's.
  const [mount] = useState<Mount>(() => ({
    serverRendered:
      typeof document !== "undefined" &&
      document.querySelector("[data-entrance-shipped]") !== null,
    shownBefore:
      typeof document !== "undefined" &&
      document.documentElement.dataset.homeShown !== undefined,
  }));

  useLayoutEffect(() => {
    const root = document.documentElement;

    root.dataset.homeShown = "";

    if (root.dataset.entrancePlayed === "true") return;

    if (!mount.serverRendered && !mount.shownBefore) {
      // Client-side arrival: cancel the animation before its first paint.
      root.dataset.entrancePlayed = "true";
      return;
    }

    let cancelled = false;
    const mark = () => {
      if (!cancelled) root.dataset.entrancePlayed = "true";
    };

    /*
     * A hydration recovery can replace <main> and start the entrance again
     * after this effect mounted (the deployed build regenerates the tree when
     * React recovers from a mismatch). A clock fixed to the first mount would
     * land in the middle of the new run and cancel its delayed cards before
     * they move. Wait for the entrance's own animations instead; a replaced
     * tree starts a fresh batch, and the loop re-checks until none are left.
     */
    const settle = async () => {
      const running = runningEntranceAnimations();

      if (running.length > 0) {
        await Promise.all(
          running.map((animation) => animation.finished.catch(() => undefined)),
        );
      }

      if (cancelled) return;

      if (runningEntranceAnimations().length === 0) mark();
      else void settle();
    };

    const timer = window.setTimeout(
      () => void settle(),
      SHIPPED_ENTRANCE_TOTAL_MS,
    );
    const ceiling = window.setTimeout(mark, ENTRANCE_GATE_CEILING_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      window.clearTimeout(ceiling);
    };
  }, [mount]);

  return null;
}
