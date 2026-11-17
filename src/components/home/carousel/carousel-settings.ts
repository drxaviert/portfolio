import { DEFAULT_BLUR } from "./edge-blur";
import { DEFAULT_HOVER_PEEK } from "./hover-peek";
import type { BlurSettings } from "./edge-blur";
import type { HoverPeekSettings } from "./hover-peek";
import type { Bezier, EaseKey } from "./carousel-math";

export type CarouselSettings = BlurSettings &
  HoverPeekSettings & {
    duration: number;
    ease: EaseKey;
    /** Free cubic-bezier, used when `ease` is "custom". */
    custom: Bezier;
    /** Eased progress at which the title starts fading in, and how long it takes. */
    titleStart: number;
    titleSpan: number;
  };

/** The one step: 900ms on the quick-start ease-out curve. */
export const DEFAULT_SETTINGS: CarouselSettings = {
  duration: 900,
  ease: "quick",
  custom: [0.25, 0.8, 0.25, 1],
  titleStart: 0.75,
  titleSpan: 0.2,
  ...DEFAULT_BLUR,
  ...DEFAULT_HOVER_PEEK,
};
