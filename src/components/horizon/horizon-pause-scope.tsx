"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";

/**
 * Pauses the ambient glow while the tab is hidden.
 *
 * The flag is React state rather than a direct style write so the wrappers keep
 * a single declarative source; it starts false on both server and client, so
 * hydration never mismatches, and the effect reads the real visibility right
 * after mount (a background tab that loads late stays paused).
 */
export function HorizonPauseScope({
  motion,
  children,
}: {
  motion: string;
  children: ReactNode;
}) {
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    const sync = () => setPaused(document.hidden);

    sync();
    document.addEventListener("visibilitychange", sync);

    return () => {
      document.removeEventListener("visibilitychange", sync);
    };
  }, []);

  return (
    <div
      className="horizon-motion-layer absolute inset-0"
      data-motion={motion}
      data-paused={paused ? "true" : undefined}
    >
      {children}
    </div>
  );
}
