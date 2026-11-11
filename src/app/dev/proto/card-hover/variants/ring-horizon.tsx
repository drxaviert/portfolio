import { CardPage } from "../card-page";
import { HORIZON_GLOW_CSS } from "./horizon-glow";
import { RING_CORE_CSS } from "./ring-core";
import { EASE_OPTIONS, msControl, pxControl, speedControl } from "./types";
import type { Variant } from "./types";

/**
 * Variant 2 — Ring · horizon. Axis: Ring, lit by the page's own horizon.
 *
 * Same geometry, timings and title shift as Ring. The only change is the glow
 * source: the two horizon blob hues for the current phase, at a boosted alpha
 * (--ch-boost) so they survive on a 1px ring. See horizon-glow.ts for why the
 * --horizon-* tokens themselves cannot be used at 1px.
 */
const CSS =
  RING_CORE_CSS +
  HORIZON_GLOW_CSS +
  `
[data-variant="ring-horizon"] {
  --ch-grow: 800ms;
  --ch-follow: 1000ms;
  --ch-fade: 250ms;
  --ch-shift: 4.8px;
  --ch-ring-ease: cubic-bezier(0.165, 0.84, 0.44, 1);
  --ch-follow-ease: cubic-bezier(0.16, 1, 0.3, 1);
  --ch-ring-line: var(--frame-line);
  --ch-glow-image: var(--ch-horizon-glow);
}
`;

export const ringHorizon: Variant = {
  id: "ring-horizon",
  name: "Ring · horizon",
  axis: "growth · same ring, lit by the phase's horizon hues",
  css: CSS,
  defaults: {
    grow: 800,
    follow: 1000,
    fade: 250,
    shift: 4.8,
    boost: 55,
    ease: "cubic-bezier(0.165, 0.84, 0.44, 1)",
    speed: "1",
  },
  controls: [
    msControl("grow", "Grow", "--ch-grow", 200, 1200, 20),
    msControl("follow", "Glow follow", "--ch-follow", 200, 1600, 20),
    msControl("fade", "Glow fade", "--ch-fade", 100, 600, 10),
    pxControl("shift", "Title shift", "--ch-shift", 0, 10, 0.2),
    {
      key: "boost",
      label: "Horizon boost",
      kind: "range",
      min: 10,
      max: 100,
      step: 5,
      cssVar: "--ch-boost",
      toCss: (value) => `${value}%`,
      format: (value) => `${value}%`,
    },
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
  Stage: () => <CardPage pointer="ring" />,
};
