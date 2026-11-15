"use client";

import { animate, useReducedMotion } from "motion/react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { moveNav, registerReaderClose } from "@/components/nav/nav-flight";
import { CLOSE_DROP_PX, landWithin, MORPH_CLOSE_S } from "./morph";
import { ReaderCloseProvider } from "./reader-close";
import { FADE_S } from "./use-morph";

/**
 * A direct load's reader (`/work/<slug>`): the page itself. There is no card
 * behind it and no overlay to unmount, so leaving is an exit — the panel flies
 * out on the close gesture while the nav returns home, then the route leaves
 * for `/`. The rail, the thumb action and the nav's Work/Home all close here.
 */
export function PageReaderShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const reduce = useReducedMotion() ?? false;
  const closingRef = useRef<Promise<void> | null>(null);

  const close = useCallback(() => {
    if (closingRef.current) return closingRef.current;

    const closed = (async () => {
      const route = window.location.pathname;
      const panel = document.querySelector<HTMLElement>(
        '.wd-reader-panel[data-mode="page"]',
      );

      if (!panel) {
        router.push("/");
        return;
      }

      // The panel is leaving: nothing in it may take a click on the way out.
      panel.style.pointerEvents = "none";

      // The exit is a visual: the route change must not outlive it. Each wait is
      // capped at the flight's own duration (morph.ts), so a frame loop that has
      // stopped — an occluded window, a background tab — cannot leave the reader
      // transparent with no way home.
      const exitSeconds = reduce ? FADE_S : MORPH_CLOSE_S;
      const navHome = moveNav("home", reduce ? "fade" : "flip");
      const exit = reduce
        ? animate(panel, { opacity: 0 }, { duration: FADE_S, ease: "easeOut" })
        : animate(
            panel,
            { opacity: 0, y: CLOSE_DROP_PX },
            { duration: MORPH_CLOSE_S, ease: "easeIn" },
          );

      await Promise.all([
        landWithin(exit.finished, exitSeconds),
        landWithin(navHome, exitSeconds),
      ]);

      panel.style.opacity = "0";
      panel.style.removeProperty("transform");

      // Back (or any other route change) owns the screen now.
      if (window.location.pathname !== route) return;

      // Home arrives by client navigation, so it must render resting. Mark the
      // document before the route change: home's own gate is a client component
      // and can land after the content does, which would leave the entrance CSS
      // holding every card at opacity 0 until it runs.
      document.documentElement.dataset.entrancePlayed = "true";

      router.push("/");
    })();

    closingRef.current = closed;

    return closed;
  }, [reduce, router]);

  // The nav dock lives in the root layout, outside this tree: it reaches the
  // same exit through nav-flight, as it does for the overlay.
  useEffect(() => registerReaderClose(close), [close]);

  // Home is not mounted behind a direct load, so the push at the end of the
  // exit would otherwise wait on its RSC (and land on empty background). Warm
  // the route while the reader is still on screen.
  useEffect(() => {
    router.prefetch("/");
  }, [router]);

  return <ReaderCloseProvider close={close}>{children}</ReaderCloseProvider>;
}
