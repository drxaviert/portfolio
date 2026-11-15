"use client";

import { useEffect } from "react";
import type { RefObject } from "react";

/**
 * Loops are decoration. Hold every animated frame while the shot is offscreen
 * or the tab is hidden, then resume from the same frame. The CSS holds the
 * frames when the shot carries `data-paused`.
 */
export function useScenePause(shotRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const root = shotRef.current;

    if (!root) return;

    let onScreen = true;
    let visible = !document.hidden;

    const sync = () => {
      root.toggleAttribute("data-paused", !onScreen || !visible);
    };

    const observer = new IntersectionObserver(([entry]) => {
      onScreen = entry.isIntersecting;
      sync();
    });

    observer.observe(root);

    const onVisibilityChange = () => {
      visible = !document.hidden;
      sync();
    };

    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [shotRef]);
}
