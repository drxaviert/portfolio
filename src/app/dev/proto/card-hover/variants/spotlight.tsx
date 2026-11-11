import { CardPage } from "../card-page";
import { durationControl, easeControl, percentControl, speedControl } from "./types";
import type { Variant } from "./types";

/**
 * Variant 2 — Spotlight. Axis: light, no movement.
 *
 * A radial highlight follows the cursor inside the card. The pointer handler
 * in CardPage writes --ch-x / --ch-y per card; this sheet only fades the
 * pseudo-element in. Tint is color-mix over --primary, so each phase gets its
 * own accent and Night lifts the coral rather than tinting the near-black.
 */
const CSS = `
[data-variant="spotlight"] {
  --ch-dur: 150ms;
  --ch-ease: cubic-bezier(0.23, 1, 0.32, 1);
  --ch-spot-size: 180px;
  --ch-spot-strength: 0.6;

  --ch-spot-color: color-mix(in oklab, var(--primary) 18%, transparent);
}

[data-phase="night"] [data-variant="spotlight"] {
  --ch-spot-color: color-mix(in oklab, var(--primary) 26%, transparent);
}

[data-variant="spotlight"] .ch-card::after {
  background: radial-gradient(
    circle var(--ch-spot-size) at var(--ch-x, 50%) var(--ch-y, 50%),
    var(--ch-spot-color) 0%,
    transparent 70%
  );
  opacity: 0;
  transition: opacity var(--ch-dur) var(--ch-ease);
}

@media (hover: hover) and (pointer: fine) {
  [data-variant="spotlight"] .ch-card:hover::after {
    opacity: var(--ch-spot-strength);
  }
}

[data-variant="spotlight"] .ch-card:focus-visible::after {
  opacity: var(--ch-spot-strength);
}

/* Press: no lift to give, so the press is a small squeeze. */
[data-variant="spotlight"] .ch-card:active {
  transform: scale(0.99);
  transition-duration: 100ms;
}

@media (prefers-reduced-motion: reduce) {
  [data-variant="spotlight"] .ch-card,
  [data-variant="spotlight"] .ch-card::after {
    transition: none;
  }

  [data-variant="spotlight"] .ch-card:active {
    transform: none;
  }
}
`;

export const spotlight: Variant = {
  id: "spotlight",
  name: "Spotlight",
  axis: "light · cursor-following radial tint",
  css: CSS,
  defaults: {
    duration: 150,
    size: 180,
    strength: 0.6,
    ease: "cubic-bezier(0.23, 1, 0.32, 1)",
    speed: "1",
  },
  controls: [
    durationControl("Fade"),
    {
      key: "size",
      label: "Radius",
      kind: "range",
      min: 80,
      max: 360,
      step: 10,
      cssVar: "--ch-spot-size",
      toCss: (value) => `${value}px`,
      format: (value) => `${value}px`,
    },
    percentControl("strength", "Intensity", "--ch-spot-strength"),
    easeControl,
    speedControl,
  ],
  Stage: () => <CardPage pointer="spotlight" />,
};
