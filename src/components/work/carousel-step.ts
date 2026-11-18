import {
  RETARGET_BEZIER,
  easeSpec,
  parseBezier,
} from "@/components/home/carousel/carousel-math";
import { DEFAULT_SETTINGS } from "@/components/home/carousel/carousel-settings";
import type { Bezier } from "@/components/home/carousel/carousel-math";

/**
 * The drawer's timing. Every open and close part runs on the home carousel's
 * step: the panel FLIPs out of the card, the content rises and defocuses and the
 * nav flies between its two rows, all on these numbers.
 *
 * These are only the numbers - one duration and one curve for the open, one for
 * the close - and every one is READ from the carousel's own settings and maths
 * rather than copied, so retuning the row retunes the drawer with it. The drawer
 * does not borrow the row's motion: its own shape (the card-to-panel morph, the
 * content's rise and defocus, the nav's flight) stays exactly as the pinned one,
 * and only runs on this timing.
 */

/**
 * The open: a step of one slot, `DEFAULT_SETTINGS.duration` on the step's own
 * curve (carousel-settings.ts, carousel-math.ts easeSpec).
 */
export const CAROUSEL_OPEN_S = DEFAULT_SETTINGS.duration / 1000;
export const CAROUSEL_EASE: Bezier =
  parseBezier(easeSpec(DEFAULT_SETTINGS.ease, DEFAULT_SETTINGS.custom).css) ??
  DEFAULT_SETTINGS.custom;

/**
 * The close: the run the carousel gives a step it has to cut short - `SETTLE_MS`
 * on `RETARGET_BEZIER` (home-carousel.tsx settle(), carousel-math.ts) - which is
 * why a close is quicker than an open, the same asymmetry the row has. A
 * drift-guard test reads SETTLE_MS out of home-carousel.tsx.
 */
export const CAROUSEL_CLOSE_S = 0.35;
export const CAROUSEL_CLOSE_EASE: Bezier = RETARGET_BEZIER;
