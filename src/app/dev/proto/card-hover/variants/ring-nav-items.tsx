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
 * Variant 3 — Ring + nav items. Axis: the same ring, per nav item.
 *
 * Cards behave exactly like Ring. Every nav item (Work / Play / About, the
 * design-system glyph, and the theme toggle as ONE item) gets its own ring at
 * a smaller scale: rest inset 3px/2px (2px/1.5px for the toggle, which needs a
 * 3px pad so its own track does not cover the frame), growing to full on
 * hover, with the same trailing glow. Nothing inside an item shifts.
 *
 * The active link's pill is carried by its ring surface, so it shrinks and
 * grows with the ring instead of covering it.
 */
const CSS =
  RING_CORE_CSS +
  HORIZON_GLOW_CSS +
  `
[data-variant="ring-nav-items"] {
  --ch-grow: 800ms;
  --ch-follow: 1000ms;
  --ch-fade: 250ms;
  --ch-shift: 4.8px;
  --ch-ring-ease: cubic-bezier(0.165, 0.84, 0.44, 1);
  --ch-follow-ease: cubic-bezier(0.16, 1, 0.3, 1);
  --ch-ring-line: var(--frame-line);
  --ch-glow-image: var(--orb-gradient);
}

[data-variant="ring-nav-items"] .ch-nav-item {
  --ch-rest-y: 3px;
  --ch-rest-x: 2px;
  --ch-radius: 8px;
  --ch-inner-radius: 7px;
  --ch-glow-size: 240px;
}

/* The toggle keeps its own track: pad it so the ring floats outside. */
[data-variant="ring-nav-items"] .ch-nav-item--toggle {
  --ch-rest-y: 2px;
  --ch-rest-x: 1.5px;
  --ch-radius: 10px;
  --ch-inner-radius: 9px;
  padding: 3px;
}
`;

export const ringNavItems: Variant = {
  id: "ring-nav-items",
  name: "Ring + nav items",
  axis: "growth · one small ring per nav item, toggle as one",
  css: CSS,
  defaults: {
    grow: 800,
    follow: 1000,
    fade: 250,
    shift: 4.8,
    boost: 55,
    source: "orb",
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
  Stage: () => <CardPage pointer="ring" nav="items" />,
};
