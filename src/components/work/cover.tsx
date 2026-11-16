"use client";

import { useRef } from "react";
import type { ComponentType } from "react";
import {
  PhoneScene,
  TilesScene,
  WindowScene,
} from "@/components/faux-ui/scenes";
import type { Mode } from "@/components/faux-ui/scenes";
import type { SceneFit } from "@/components/faux-ui/use-scene-fit";
import { useScenePause } from "@/components/faux-ui/use-scene-pause";
import type { WorkMeta } from "@/lib/work";
import "@/components/faux-ui/faux-ui.css";

const SCENES: Record<string, ComponentType<{ mode: Mode }> | undefined> = {
  tiles: TilesScene,
  window: WindowScene,
  phone: PhoneScene,
};

/**
 * The featured card's product visual, shared by the home card and the reader
 * hero so the expand morph carries the same picture across.
 *
 * The scene is decorative. Its loop pauses offscreen and in a hidden tab; the
 * faux-UI CSS holds the still frame under reduced motion, so there is no mode
 * switch here. A scene the map cannot resolve falls back to the neutral
 * surface the design system already uses for media.
 *
 * `fit` is the slot's contract: the hero contains the whole 753:416 canvas;
 * the featured card covers its own box and crops the overflow.
 */
export function Cover({
  scene,
  fit = "contain",
}: {
  scene: WorkMeta["cover"];
  fit?: SceneFit;
}) {
  const shotRef = useRef<HTMLDivElement | null>(null);
  const Scene = SCENES[scene];

  useScenePause(shotRef);

  if (!Scene) {
    return (
      <div
        className="h-full w-full rounded-[12px] bg-surface-container"
        data-cover="neutral"
        aria-hidden="true"
      />
    );
  }

  return (
    <div className="relative h-full w-full overflow-hidden" data-scene={scene}>
      <div className="fu-stage" data-fit={fit}>
        <div className="fu-card">
          <div ref={shotRef} className="fu-shot" aria-hidden="true">
            <Scene mode="loop" />
          </div>
        </div>
      </div>
    </div>
  );
}
