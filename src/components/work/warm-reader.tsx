"use client";

import { useEffect } from "react";

/**
 * The drawer's client modules, evaluated ahead of the first open. A card's
 * prefetch already downloads their chunks, but the modules (the reader parts
 * and motion) were only evaluated when the click's render first required
 * them: about 27ms of the first open at 4x CPU. Importing the same modules on
 * idle runs that evaluation while nothing else is happening, and the click
 * then finds them in the module cache.
 */
const warmReader = () =>
  Promise.all([
    import("./expand-shell"),
    import("./parts"),
    import("./reader-rail"),
    import("./scroll-ruler"),
  ]);

/** Warms the reader once the page is idle after load. Renders nothing. */
export function WarmReader() {
  useEffect(() => {
    let cancelled = false;
    let idle = 0;
    let timer = 0;

    const warm = () => {
      if (!cancelled) void warmReader();
    };

    const schedule = () => {
      // Safari has no requestIdleCallback; a delay past the entrance stands in.
      if (typeof window.requestIdleCallback === "function") {
        idle = window.requestIdleCallback(warm, { timeout: 4000 });
      } else {
        timer = window.setTimeout(warm, 2000);
      }
    };

    if (document.readyState === "complete") schedule();
    else window.addEventListener("load", schedule, { once: true });

    return () => {
      cancelled = true;
      window.removeEventListener("load", schedule);
      if (idle) window.cancelIdleCallback(idle);
      if (timer) window.clearTimeout(timer);
    };
  }, []);

  return null;
}
