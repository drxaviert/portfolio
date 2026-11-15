"use client";

import { useEffect } from "react";
import type { RefObject } from "react";

/** The Figma canvas every scene is drawn on. */
const SCENE_WIDTH = 753;

export type SceneFit = "contain" | "cover";

/**
 * Scales the fixed 753 x 416 canvas to the stage's width.
 *
 * The shipped cover does this in CSS (`faux-ui.css`, from the stage's container
 * size), so it is already right on the first paint. This hook is for the dev
 * page, whose stage is not inside a sized container and which predates the
 * container query bases.
 */
export function useSceneFit(stageRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const stage = stageRef.current;

    if (!stage) return;

    const resize = () => {
      // offsetWidth is the layout box, so a parent that is mid-transform (the
      // reader panel during the expand morph) cannot shrink the scene.
      const width = stage.offsetWidth;

      if (width === 0) return;

      stage.style.setProperty("--fu-scale", String(width / SCENE_WIDTH));
    };

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(stage);

    return () => observer.disconnect();
  }, [stageRef]);
}
