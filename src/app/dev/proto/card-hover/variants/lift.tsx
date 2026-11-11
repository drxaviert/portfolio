import { CardPage } from "../card-page";
import { durationControl, easeControl, percentControl, speedControl } from "./types";
import type { Variant } from "./types";

/**
 * Variant 1 — Lift. Axis: elevation.
 *
 * translateY + a shadow step. The shadow is a pseudo-element whose opacity
 * crossfades, so box-shadow itself is never animated.
 *
 * Token gap: globals.css ships --shadow-card only (no hover/raised step), so
 * --ch-shadow-raised is derived here from the same ingredients: a 1px ring, a
 * tight layer, a soft layer. Night collapses to the ring plus a top inset
 * highlight, because a black shadow is invisible on #191919.
 */
const CSS = `
[data-variant="lift"] {
  --ch-dur: 160ms;
  --ch-ease: cubic-bezier(0.23, 1, 0.32, 1);
  --ch-lift: 2px;
  --ch-shadow-strength: 0.85;

  --ch-shadow-raised:
    0 0 0 1px rgb(0 0 0 / 0.07),
    0 1px 2px -1px rgb(0 0 0 / 0.08),
    0 4px 10px -4px rgb(0 0 0 / 0.1),
    0 14px 32px -14px rgb(0 0 0 / 0.14);
}

[data-phase="night"] [data-variant="lift"] {
  --ch-shadow-raised:
    0 0 0 1px rgb(255 255 255 / 0.2),
    inset 0 1px 0 rgb(255 255 255 / 0.09),
    0 10px 28px -10px rgb(0 0 0 / 0.65);
}

[data-variant="lift"] .ch-card::before {
  box-shadow: var(--ch-shadow-raised);
  opacity: 0;
  transition: opacity var(--ch-dur) var(--ch-ease);
}

@media (hover: hover) and (pointer: fine) {
  [data-variant="lift"] .ch-card:hover {
    transform: translateY(calc(var(--ch-lift) * -1));
  }

  [data-variant="lift"] .ch-card:hover::before {
    opacity: var(--ch-shadow-strength);
  }
}

[data-variant="lift"] .ch-card:focus-visible {
  transform: translateY(calc(var(--ch-lift) * -1));
}

[data-variant="lift"] .ch-card:focus-visible::before {
  opacity: var(--ch-shadow-strength);
}

/* Press: down to the surface, 100ms. */
[data-variant="lift"] .ch-card:active {
  transform: translateY(0) scale(0.99);
  transition-duration: 100ms;
}

@media (prefers-reduced-motion: reduce) {
  [data-variant="lift"] .ch-card,
  [data-variant="lift"] .ch-card::before {
    transition: none;
  }

  [data-variant="lift"] .ch-card:hover,
  [data-variant="lift"] .ch-card:focus-visible,
  [data-variant="lift"] .ch-card:active {
    transform: none;
  }
}
`;

export const lift: Variant = {
  id: "lift",
  name: "Lift",
  axis: "elevation · 2px rise + shadow step",
  css: CSS,
  defaults: {
    duration: 160,
    lift: 2,
    shadow: 0.85,
    ease: "cubic-bezier(0.23, 1, 0.32, 1)",
    speed: "1",
  },
  controls: [
    durationControl("Duration"),
    {
      key: "lift",
      label: "Rise",
      kind: "range",
      min: 0,
      max: 6,
      step: 0.5,
      cssVar: "--ch-lift",
      toCss: (value) => `${value}px`,
      format: (value) => `${value}px`,
    },
    percentControl("shadow", "Shadow", "--ch-shadow-strength"),
    easeControl,
    speedControl,
  ],
  Stage: () => <CardPage />,
};
