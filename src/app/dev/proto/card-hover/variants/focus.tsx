import { CardPage } from "../card-page";
import { durationControl, easeControl, speedControl } from "./types";
import type { Variant } from "./types";

/**
 * Variant 3 — Focus. Axis: group context.
 *
 * The hovered card holds full presence at 1.01 while its siblings ease to 0.75.
 * :has() on the shared .ch-field container makes the whole card field one
 * group, so hovering a work card also quiets the tracker and Play card.
 * Keyboard focus runs the same rule.
 */
const CSS = `
[data-variant="focus"] {
  --ch-dur: 180ms;
  --ch-ease: cubic-bezier(0.23, 1, 0.32, 1);
  --ch-dim: 0.75;
  --ch-scale: 1.01;
}

@media (hover: hover) and (pointer: fine) {
  [data-variant="focus"] .ch-field:has(.ch-card:hover) .ch-card:not(:hover) {
    opacity: var(--ch-dim);
  }

  [data-variant="focus"] .ch-card:hover {
    transform: scale(var(--ch-scale));
  }
}

[data-variant="focus"] .ch-field:has(.ch-card:focus-visible) .ch-card:not(:focus-visible) {
  opacity: var(--ch-dim);
}

[data-variant="focus"] .ch-card:focus-visible {
  transform: scale(var(--ch-scale));
}

/* Press: back through 1 to 0.99, 100ms. */
[data-variant="focus"] .ch-card:active {
  transform: scale(0.99);
  transition-duration: 100ms;
}

@media (prefers-reduced-motion: reduce) {
  [data-variant="focus"] .ch-card {
    transition: none;
  }

  [data-variant="focus"] .ch-card:hover,
  [data-variant="focus"] .ch-card:focus-visible,
  [data-variant="focus"] .ch-card:active {
    transform: none;
  }
}
`;

export const focus: Variant = {
  id: "focus",
  name: "Focus",
  axis: "group · 1.01 on the card, 0.75 on its siblings",
  css: CSS,
  defaults: {
    duration: 180,
    dim: 0.75,
    scale: 1.01,
    ease: "cubic-bezier(0.23, 1, 0.32, 1)",
    speed: "1",
  },
  controls: [
    durationControl("Duration"),
    {
      key: "dim",
      label: "Sibling opacity",
      kind: "range",
      min: 0.4,
      max: 1,
      step: 0.05,
      cssVar: "--ch-dim",
      toCss: (value) => String(value),
      format: (value) => `${Math.round(Number(value) * 100)}%`,
    },
    {
      key: "scale",
      label: "Scale",
      kind: "range",
      min: 1,
      max: 1.02,
      step: 0.005,
      cssVar: "--ch-scale",
      toCss: (value) => String(value),
      format: (value) => Number(value).toFixed(3),
    },
    easeControl,
    speedControl,
  ],
  Stage: () => <CardPage />,
};
