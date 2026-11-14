"use client";

import { useRef } from "react";
import type { ComponentType } from "react";
import {
  PhoneScene,
  TilesScene,
  WindowScene,
} from "@/components/faux-ui/scenes";
import type { Mode } from "@/components/faux-ui/scenes";
import { useSceneFit } from "@/components/faux-ui/use-scene-fit";
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
 */
export function Cover({ scene }: { scene: WorkMeta["cover"] }) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const shotRef = useRef<HTMLDivElement | null>(null);
  const Scene = SCENES[scene];

  useSceneFit(stageRef);
  useScenePause(shotRef);

  if (!Scene) {
    return (
      <div
        className="aspect-[753/416] w-full rounded-[12px] bg-surface-container"
        data-cover="neutral"
        aria-hidden="true"
      />
    );
  }

  return (
    <div className="relative w-full overflow-hidden" data-scene={scene}>
      <div ref={stageRef} className="fu-stage">
        <div className="fu-card">
          <div ref={shotRef} className="fu-shot" aria-hidden="true">
            <Scene mode="loop" />
          </div>
        </div>
      </div>
    </div>
  );
}
