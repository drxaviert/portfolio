import { lookFor } from "./sliver-mode";
import type { Look, SliverMode } from "./sliver-mode";
import type { Entity, Pose, TitleTiming } from "./carousel-math";

/**
 * Imperative styling for a carousel card (the `.car-slide` element).
 *
 * A card is laid out once at the wide slot's width inside `.car-content`, so
 * its content never reflows. At rest the card's own box is the slot box and
 * everything (shadow, ring, fill) is native. During a step the box is as wide
 * as the wider of the two ends and `clip-path` crops it to the width the step
 * is at; only `transform`, `clip-path` and `opacity` ever animate.
 */

const RADIUS = 12;

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
  el.style.transform = `translateX(${pose.x}px)`;
  el.style.clipPath = "";
  el.style.visibility = visible ? "" : "hidden";

  applyLook(el, lookFor(mode, wide));

  const { title } = parts(el);
  if (title) title.style.opacity = String(wide);
}

function inset(visibleOf: number, boxWidth: number): string {
  return `inset(0px ${Math.max(boxWidth - visibleOf, 0)}px 0px 0px round ${RADIUS}px)`;
}

type PlayOptions = {
  duration: number;
  easing: string;
  mode: SliverMode;
  timing: TitleTiming;
};

/**
 * Starts one entity's tween: transform and clip-path together on the card, the
 * look on its picture layers, the title on its own short clock. Returns every
 * animation so the caller can cancel them as one.
 */
export function playEntity(
  el: HTMLElement,
  e: Entity,
  { duration, easing, mode, timing }: PlayOptions,
): Animation[] {
  const box = Math.max(e.from.w, e.to.w);

  el.style.visibility = "visible";
  el.style.width = `${box}px`;
  el.style.transform = `translateX(${e.from.x}px)`;
  el.style.clipPath = inset(e.from.w, box);

  const animations: Animation[] = [
    el.animate(
      {
        transform: [`translateX(${e.from.x}px)`, `translateX(${e.to.x}px)`],
        clipPath: [inset(e.from.w, box), inset(e.to.w, box)],
      },
      { duration, easing, fill: "both" },
    ),
  ];

  const { cover, grey, title } = parts(el);
  const a = lookFor(mode, e.fromWide);
  const b = lookFor(mode, e.toWide);

  if (cover && (a.cover !== b.cover || a.grayscale !== b.grayscale)) {
    animations.push(
      cover.animate(
        {
          opacity: [a.cover, b.cover],
          filter: [
            coverFilter(a.grayscale) || "none",
            coverFilter(b.grayscale) || "none",
          ],
        },
        { duration, easing, fill: "both" },
      ),
    );
  } else if (cover) {
    applyLook(el, b);
  }

  if (grey && a.grey !== b.grey) {
    animations.push(
      grey.animate(
        { opacity: [a.grey, b.grey] },
        { duration, easing, fill: "both" },
      ),
    );
  }

  if (title) {
    if (e.fromTitle === e.toTitle) {
      title.style.opacity = String(e.toTitle);
    } else {
      const entering = e.toTitle > e.fromTitle;

      animations.push(
        title.animate(
          { opacity: [e.fromTitle, e.toTitle] },
          {
            duration: entering ? timing.duration : timing.outDuration,
            delay: entering ? timing.delay : 0,
            easing: "ease-out",
            fill: "both",
          },
        ),
      );
    }
  }

  return animations;
}
