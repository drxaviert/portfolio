"use client";

import { useEffect } from "react";
import type { RefObject } from "react";

/** The Figma canvas every scene is drawn on. */
export const SCENE_WIDTH = 753;
export const SCENE_HEIGHT = 416;

export type SceneFit = "contain" | "cover";

/**
 * Scales the fixed 753 x 416 canvas to the stage.
 *
 * `contain` scales by width alone: the stage reserves the canvas's aspect, so
 * width is the whole story and the full composition stays visible (the reader
 * hero). `cover` fills a stage of any aspect with the larger of the two ratios;
 * the cover CSS anchors the canvas (top-right for the featured card) and the
 * cover root crops the overflow.
 */
export function useSceneFit(
  stageRef: RefObject<HTMLElement | null>,
  fit: SceneFit = "contain",
) {
  useEffect(() => {
    const stage = stageRef.current;

    if (!stage) return;

    const resize = () => {
      // offsetWidth/offsetHeight are the layout box, so a parent that is
      // mid-transform (the reader panel during the expand morph) cannot shrink
      // the scene.
      const width = stage.offsetWidth;
      const height = stage.offsetHeight;

      if (width === 0) return;

      const scale =
        fit === "cover"
          ? Math.max(width / SCENE_WIDTH, height / SCENE_HEIGHT)
          : width / SCENE_WIDTH;

      stage.style.setProperty("--fu-scale", String(scale));
    };

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(stage);

    return () => observer.disconnect();
  }, [stageRef, fit]);
}
