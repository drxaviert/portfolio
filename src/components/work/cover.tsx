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
import { HumanContactCover } from "@/components/human-contact/human-contact-cover";
import type { CoverImage } from "@/lib/media";
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
 * A drawn scene is decorative: its loop pauses offscreen and in a hidden tab,
 * and the faux-UI CSS holds the still frame under reduced motion, so there is no
 * mode switch here. A `media:<id>` cover arrives with the picture the server
 * resolved from its manifest — one AVIF with a WebP fallback, drawn cover. A
 * scene or picture the props cannot resolve falls back to the neutral surface
 * the design system already uses for media.
 *
 * `fit` is the slot's contract: the hero contains the whole 753:416 canvas;
 * the featured card covers its own box and crops the overflow.
 *
 * `human-contact` is the one live cover: its still is the first paint and the
 * scene loads itself when the slot is near the viewport. `still` keeps that
 * slot on the still alone; the /work hover thumbnail uses it while idle, then
 * lets the live scene mount with the thumbnail.
 */
export function Cover({
  scene,
  fit = "contain",
  coverImage,
  alt = "",
  still = false,
}: {
  scene: WorkMeta["cover"];
  fit?: SceneFit;
  coverImage?: CoverImage;
  alt?: string;
  still?: boolean;
}) {
  const shotRef = useRef<HTMLDivElement | null>(null);

  useScenePause(shotRef);

  if (scene.startsWith("media:")) {
    if (!coverImage) {
      return (
        <div
          className="h-full w-full rounded-[12px] bg-surface-container"
          data-cover="neutral"
          aria-hidden="true"
        />
      );
    }

    return (
      <div
        className="relative h-full w-full overflow-hidden rounded-[12px] bg-surface-container"
        data-cover="media"
        aria-hidden="true"
      >
        {coverImage.lqip ? (
          <span
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url("${coverImage.lqip}")` }}
          />
        ) : null}
        <picture>
          <source type="image/avif" srcSet={coverImage.avif} />
          <img
            className="absolute inset-0 h-full w-full object-cover"
            src={coverImage.fallback}
            width={coverImage.width}
            height={coverImage.height}
            alt={alt}
            loading="lazy"
            decoding="async"
          />
        </picture>
      </div>
    );
  }

  if (scene === "human-contact") {
    return <HumanContactCover live={!still} />;
  }

  const Scene = SCENES[scene];

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
