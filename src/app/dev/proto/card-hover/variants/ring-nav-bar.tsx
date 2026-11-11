import { CardPage } from "../card-page";
import { HORIZON_GLOW_CSS } from "./horizon-glow";
import { RING_CORE_CSS } from "./ring-core";
import {
  EASE_OPTIONS,
  glowSourceControl,
  horizonBoostControl,
  msControl,
  pxControl,
  speedControl,
} from "./types";
import type { Variant } from "./types";

/**
 * Variant 4 — Ring + nav bar. Axis: the whole nav is one ring.
 *
 * Cards behave exactly like Ring. The nav container becomes a single ring
 * surface: the frame is inset 6px/3.5px at rest and opens to the full bar on
 * hover, the glow follows the cursor along the bar, and the nav's own
 * background and shadow are dropped so the ring surface is the fill. The items
 * inside keep their own hover (the theme toggle is untouched).
 */
const CSS =
  RING_CORE_CSS +
  HORIZON_GLOW_CSS +
  `
[data-variant="ring-nav-bar"] {
  --ch-grow: 800ms;
  --ch-follow: 1000ms;
  --ch-fade: 250ms;
  --ch-shift: 4.8px;
  --ch-ring-ease: cubic-bezier(0.165, 0.84, 0.44, 1);
  --ch-follow-ease: cubic-bezier(0.16, 1, 0.3, 1);
  --ch-ring-line: var(--frame-line);
  /* First paint (SSR, before the panel writes its var) is already horizon. */
  --ch-glow-image: var(--ch-horizon-glow);
}

[data-variant="ring-nav-bar"] .ch-nav-bar {
  --ch-rest-y: 6px;
  --ch-rest-x: 3.5px;
  --ch-radius: 12px;
  --ch-inner-radius: 11px;
  --ch-glow-size: 614px;
}

/* The nav's own surface moves to the ring surface. */
[data-variant="ring-nav-bar"] .ch-nav-bar > nav {
  background-color: transparent;
  box-shadow: none;
}
`;

export const ringNavBar: Variant = {
  id: "ring-nav-bar",
  name: "Ring + nav bar",
  axis: "growth · the nav bar itself is one ring surface",
  css: CSS,
  defaults: {
    grow: 800,
    follow: 1000,
    fade: 250,
    shift: 4.8,
    boost: 55,
    source: "horizon",
    ease: "cubic-bezier(0.165, 0.84, 0.44, 1)",
    speed: "1",
  },
  controls: [
    msControl("grow", "Grow", "--ch-grow", 200, 1200, 20),
    msControl("follow", "Glow follow", "--ch-follow", 200, 1600, 20),
    msControl("fade", "Glow fade", "--ch-fade", 100, 600, 10),
    pxControl("shift", "Title shift", "--ch-shift", 0, 10, 0.2),
    glowSourceControl,
    horizonBoostControl,
    {
      key: "ease",
      label: "Easing",
      kind: "select",
      options: EASE_OPTIONS,
      cssVar: "--ch-ring-ease",
      toCss: (value) => String(value),
      format: (value) => String(value).replace("cubic-bezier", ""),
    },
    speedControl,
  ],
  Stage: () => <CardPage pointer="ring" nav="bar" />,
};
