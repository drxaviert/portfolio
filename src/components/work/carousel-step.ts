import {
  easeSpec,
  parseBezier,
} from "@/components/home/carousel/carousel-math";
import { DEFAULT_SETTINGS } from "@/components/home/carousel/carousel-settings";
import type { Bezier } from "@/components/home/carousel/carousel-math";

/**
 * The drawer's timing. Every open part runs on the home carousel's step and
 * every close part on Stripe's dialog close: the panel FLIPs out of the card,
 * the content rises and defocuses and the nav flies between its two rows, all
 * on these numbers.
 *
 * These are only the numbers - one duration and one curve for the open, one for
 * the close. The open is READ from the carousel's own settings and maths rather
 * than copied, so retuning the row retunes the drawer's open with it. The drawer
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
 * The close: Stripe's dialog close, 300ms on the CSS `ease` curve
 * (0.25, 0.1, 0.25, 1). It is the drawer's own number, not the carousel's: Dat
 * picked it over the carousel's 350ms interrupted-step run (`SETTLE_MS` on
 * `RETARGET_BEZIER`) after an A/B on proto/stripe-drawer. The open keeps the
 * carousel's step above, so a close is still quicker than an open.
 */
export const DRAWER_CLOSE_S = 0.3;
export const DRAWER_CLOSE_EASE: Bezier = [0.25, 0.1, 0.25, 1];
