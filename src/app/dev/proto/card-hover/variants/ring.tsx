import { CardPage } from "../card-page";
import { RING_CORE_CSS } from "./ring-core";
import { EASE_OPTIONS, msControl, pxControl, speedControl } from "./types";
import type { Variant } from "./types";

/**
 * Variant 1 — Ring. Axis: the card grows into its own box, ring lit by a
 * cursor-following glow (Stripe bento mechanism, recreated closely).
 *
 * Three layers, all inside the card's stacking context at negative z-index so
 * in-flow content paints above them:
 *   frame  (z -2) — the 1px edge, clipped to inset(6px 3.5px) at rest
 *   glow   (in the frame) — orb-gradient token, masked to a 614px radial
 *   surface(z -1) — the card fill, clipped 1px inside the frame
 *
 * On hover both clips open to inset(0)/inset(1px) over 0.8s, so the card grows
 * 6px vertically and 3.5px horizontally. The glow's transform trails the
 * pointer over 1s; its wrapper fades over 0.25s. The title shifts 4.8px/4px.
 *
 * Deviations from Stripe, called out on purpose:
 * - radius 12/11 follows our rounded-lg card token, not Stripe's 6/5.
 * - the glow is --orb-gradient (the phase's own hue pair) masked radially.
 * - no corner arrow (this round): the title shift carries the hover instead.
 */
const CSS =
  RING_CORE_CSS +
  `
[data-variant="ring"] {
  --ch-grow: 800ms;
  --ch-follow: 1000ms;
  --ch-fade: 250ms;
  --ch-shift: 4.8px;
  --ch-ring-ease: cubic-bezier(0.165, 0.84, 0.44, 1);
  --ch-follow-ease: cubic-bezier(0.16, 1, 0.3, 1);
  --ch-ring-line: var(--frame-line);
  --ch-glow-image: var(--orb-gradient);
}
`;

export const ring: Variant = {
  id: "ring",
  name: "Ring",
  axis: "growth · card opens into its box, ring lit by a trailing glow",
  css: CSS,
  defaults: {
    grow: 800,
    follow: 1000,
    fade: 250,
    shift: 4.8,
    ease: "cubic-bezier(0.165, 0.84, 0.44, 1)",
    speed: "1",
  },
  controls: [
    msControl("grow", "Grow", "--ch-grow", 200, 1200, 20),
    msControl("follow", "Glow follow", "--ch-follow", 200, 1600, 20),
    msControl("fade", "Glow fade", "--ch-fade", 100, 600, 10),
    pxControl("shift", "Title shift", "--ch-shift", 0, 10, 0.2),
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
