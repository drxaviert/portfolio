import { blur, motionBlurAt } from "./blur-mode";
import type { BlurMode } from "./blur-mode";
import { lookFor } from "./sliver-mode";
import type { Look, SliverMode } from "./sliver-mode";
import { lerp, titleKeys } from "./carousel-math";
import type { Entity, Pose, TitleTiming } from "./carousel-math";

/**
 * Imperative styling for a carousel card (the `.car-slide` element).
 *
 * A card is laid out once at the wide slot's width inside `.car-content`, so
 * its content never reflows. At rest the card's own box is the slot box and
 * everything (shadow, ring, fill) is native. During a step the box is as wide
 * as the wider of the two ends and `clip-path` crops it to the width the step
 * is at.
 *
 * Position and crop are two registered custom properties, `--car-x` and
 * `--car-r` (home-carousel.css), animated in ONE animation. Animating
 * `transform` and `clip-path` directly desynced them: Chrome runs the
 * transform on the compositor and the clip-path on the main thread, so at
 * speed the crop lagged the move by a frame and a shrinking card's surface
 * showed across the gap. As custom properties both are resolved on the main
 * thread in the same frame, so the visible box is always exactly the box the
 * card is moving to.
 */

type Parts = {
  cover: HTMLElement | null;
  grey: HTMLElement | null;
  title: HTMLElement | null;
};

function parts(el: HTMLElement): Parts {
  return {
    cover: el.querySelector<HTMLElement>("[data-car-cover]"),
    grey: el.querySelector<HTMLElement>("[data-car-grey]"),
    title: el.querySelector<HTMLElement>("[data-car-title]"),
  };
}

function coverFilter(grayscale: number): string {
  return grayscale > 0 ? `grayscale(${grayscale})` : "";
}

function applyLook(el: HTMLElement, look: Look) {
  const { cover, grey } = parts(el);

  if (cover) {
    cover.style.opacity = String(look.cover);
    cover.style.filter = coverFilter(look.grayscale);
  }
  if (grey) grey.style.opacity = String(look.grey);
}

/** Puts a card at rest: slot box, no clip, the look and title for `wide`. */
export function restStyle(
  el: HTMLElement,
  pose: Pose,
  wide: number,
  visible: boolean,
  mode: SliverMode,
) {
  el.style.width = `${pose.w}px`;
  el.style.setProperty("--car-x", `${pose.x}px`);
  el.style.setProperty("--car-r", "0px");
  delete el.dataset.clipped;
  el.style.visibility = visible ? "" : "hidden";

  applyLook(el, lookFor(mode, wide));

  const { title } = parts(el);
  if (title) title.style.opacity = String(wide);
}

/** How much of the box the crop removes on the right. */
function crop(visibleOf: number, boxWidth: number): string {
  return `${Math.max(boxWidth - visibleOf, 0)}px`;
}

export type PlayBlur = {
  mode: BlurMode;
  motionPeak: number;
  /** Blur a moving card already has (an interrupt), px. */
  motionFrom: number;
  peekBlur: number;
  edgeBlur: number;
  rowWidth: number;
};

type PlayOptions = {
  duration: number;
  easing: string;
  mode: SliverMode;
  timing: TitleTiming;
  blur: PlayBlur;
};

/**
 * Starts one entity's run. Everything on it (the card's transform and clip-path
 * and blur, the picture layers, the title) uses the same duration and curve and
 * starts together, so nothing drifts out of sync. Returns every animation so
 * the caller can cancel them as one.
 */
export function playEntity(
  el: HTMLElement,
  e: Entity,
  { duration, easing, mode, timing, blur: b }: PlayOptions,
): Animation[] {
  const box = Math.max(e.from.w, e.to.w);
  const timeline = { duration, easing, fill: "both" as const };

  el.style.visibility = "visible";
  el.style.width = `${box}px`;
  el.dataset.clipped = "";
  el.style.setProperty("--car-x", `${e.from.x}px`);
  el.style.setProperty("--car-r", crop(e.from.w, box));

  const moves = e.from.x !== e.to.x || e.from.w !== e.to.w;
  const enters = e.from.x >= b.rowWidth;
  const keyframes: PropertyIndexedKeyframes = {
    "--car-x": [`${e.from.x}px`, `${e.to.x}px`],
    "--car-r": [crop(e.from.w, box), crop(e.to.w, box)],
  };

  if (b.mode === "motion" && moves) {
    // Peaks mid-step, 0 at rest; mid keyframe sits on the straight line so the
    // path is unchanged.
    keyframes["--car-x"] = [
      `${e.from.x}px`,
      `${lerp(e.from.x, e.to.x, 0.5)}px`,
      `${e.to.x}px`,
    ];
    keyframes["--car-r"] = [
      crop(e.from.w, box),
      crop(lerp(e.from.w, e.to.w, 0.5), box),
      crop(e.to.w, box),
    ];
    keyframes.filter = [
      blur(b.motionFrom),
      blur(Math.max(b.motionFrom, motionBlurAt(b.motionPeak, 0.5))),
      "none",
    ];
    keyframes.offset = [0, 0.5, 1];
  } else if (b.mode === "peek" && enters) {
    keyframes.filter = [blur(b.peekBlur), "none"];
  } else if (b.mode === "edge") {
    const outside = (x: number) => x < 0 || x >= b.rowWidth;

    if (outside(e.to.x)) keyframes.filter = ["none", blur(b.edgeBlur)];
    else if (outside(e.from.x)) keyframes.filter = [blur(b.edgeBlur), "none"];
  }

  if (e.blurFrom && b.mode !== "motion") {
    keyframes.filter = [blur(e.blurFrom), "none"];
  }

  const animations: Animation[] = [el.animate(keyframes, timeline)];

  const { cover, grey, title } = parts(el);
  const a = lookFor(mode, e.fromWide);
  const z = lookFor(mode, e.toWide);

  if (cover && (a.cover !== z.cover || a.grayscale !== z.grayscale)) {
    animations.push(
      cover.animate(
        {
          opacity: [a.cover, z.cover],
          filter: [
            coverFilter(a.grayscale) || "none",
            coverFilter(z.grayscale) || "none",
          ],
        },
        timeline,
      ),
    );
  } else if (cover) {
    applyLook(el, z);
  }

  if (grey && a.grey !== z.grey) {
    animations.push(grey.animate({ opacity: [a.grey, z.grey] }, timeline));
  }

  if (title) {
    if (e.fromTitle === e.toTitle) {
      title.style.opacity = String(e.toTitle);
    } else {
      animations.push(
        title.animate(
          titleKeys(e, timing).map((k) => ({
            offset: k.offset,
            opacity: k.opacity,
          })),
          timeline,
        ),
      );
    }
  }

  return animations;
}
