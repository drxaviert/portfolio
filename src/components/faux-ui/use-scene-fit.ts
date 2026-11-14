"use client";

import { useEffect } from "react";
import type { RefObject } from "react";

/** The Figma canvas every scene is drawn on. */
export const SCENE_WIDTH = 753;

/**
 * The scenes are drawn at 753 x 416 and never reflow, so scale the canvas down
 * to the width the stage actually gets. The stage reserves the same aspect, so
 * the scaled card fits it exactly.
 */
export function useSceneFit(stageRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const stage = stageRef.current;

    if (!stage) return;

    const fit = () => {
      // offsetWidth is the layout width, so a parent that is mid-transform (the
      // reader panel during the expand morph) cannot shrink the scene.
      const width = stage.offsetWidth;

      if (width > 0) {
        stage.style.setProperty("--fu-scale", String(width / SCENE_WIDTH));
      }
    };

    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(stage);

    return () => observer.disconnect();
  }, [stageRef]);
}
