import { blur } from "./edge-blur";
import { titleKeys } from "./carousel-math";
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

function titleOf(el: HTMLElement): HTMLElement | null {
  return el.querySelector<HTMLElement>("[data-car-title]");
}

/** Puts a card at rest: slot box, no clip, the title for `wide`. */
export function restStyle(
  el: HTMLElement,
  pose: Pose,
  wide: number,
  visible: boolean,
) {
  el.style.width = `${pose.w}px`;
  el.style.setProperty("--car-x", `${pose.x}px`);
  el.style.setProperty("--car-r", "0px");
  delete el.dataset.clipped;
  delete el.dataset.edgeBlur;
  // A card that stepped out of the peek's left fade has no fade at rest; the
  // mask and the strength both belong to that move only.
  delete el.dataset.peekFade;
  el.style.removeProperty("--car-lf");
  el.style.visibility = visible ? "" : "hidden";

  const title = titleOf(el);
  if (title) title.style.opacity = String(wide);
}

/** How much of the box the crop removes on the right. */
function crop(visibleOf: number, boxWidth: number): string {
  return `${Math.max(boxWidth - visibleOf, 0)}px`;
}

export type PlayBlur = {
  edgeBlur: number;
  rowWidth: number;
};

type PlayOptions = {
  duration: number;
  easing: string;
  timing: TitleTiming;
  blur: PlayBlur;
};

/**
 * Starts one entity's run. Everything on it (the card's transform and clip-path
 * and blur, the title) uses the same duration and curve and starts together, so
 * nothing drifts out of sync. Returns every animation so the caller can cancel
 * them as one.
 */
export function playEntity(
  el: HTMLElement,
  e: Entity,
  { duration, easing, timing, blur: b }: PlayOptions,
): Animation[] {
  const box = Math.max(e.from.w, e.to.w);
  const timeline = { duration, easing, fill: "both" as const };

  el.style.visibility = "visible";
  el.style.width = `${box}px`;
  el.dataset.clipped = "";
  el.style.setProperty("--car-x", `${e.from.x}px`);
  el.style.setProperty("--car-r", crop(e.from.w, box));

  const moves = e.from.x !== e.to.x || e.from.w !== e.to.w;
  const keyframes: PropertyIndexedKeyframes = {
    "--car-x": [`${e.from.x}px`, `${e.to.x}px`],
    "--car-r": [crop(e.from.w, box), crop(e.to.w, box)],
  };

  if (moves && b.edgeBlur > 0.01) {
    const outside = (x: number) => x < 0 || x >= b.rowWidth;

    if (outside(e.to.x)) keyframes.filter = ["none", blur(b.edgeBlur)];
    else if (outside(e.from.x)) keyframes.filter = [blur(b.edgeBlur), "none"];
    // Promoted only for the step, only for the cards that blur (see the css).
    if (keyframes.filter) el.dataset.edgeBlur = "";
  }

  if (e.peekFrom) {
    // The previous card leaves the peek with its left end faded and loses that as
    // it grows into the wide slot: no pop.
    el.dataset.peekFade = "";
    el.style.setProperty("--car-lf", String(e.peekFrom.fade));
    keyframes["--car-lf"] = [e.peekFrom.fade, 0];
  }

  const animations: Animation[] = [el.animate(keyframes, timeline)];

  const title = titleOf(el);

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
