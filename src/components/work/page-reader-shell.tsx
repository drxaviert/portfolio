"use client";

import { animate, useReducedMotion } from "motion/react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { moveNav, registerReaderClose } from "@/components/nav/nav-flight";
import { CLOSE_DROP_PX, MORPH_CLOSE_S } from "./morph";
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

      const navHome = moveNav("home", reduce ? "fade" : "flip");
      const exit = reduce
        ? animate(panel, { opacity: 0 }, { duration: FADE_S, ease: "easeOut" })
        : animate(
            panel,
            { opacity: 0, y: CLOSE_DROP_PX },
            { duration: MORPH_CLOSE_S, ease: "easeIn" },
          );

      await Promise.all([exit.finished.catch(() => undefined), navHome]);

      panel.style.opacity = "0";
      panel.style.removeProperty("transform");

      // Back (or any other route change) owns the screen now.
      if (window.location.pathname !== route) return;

      router.push("/");
    })();

    closingRef.current = closed;

    return closed;
  }, [reduce, router]);

  // The nav dock lives in the root layout, outside this tree: it reaches the
  // same exit through nav-flight, as it does for the overlay.
  useEffect(() => registerReaderClose(close), [close]);

  return <ReaderCloseProvider close={close}>{children}</ReaderCloseProvider>;
}
