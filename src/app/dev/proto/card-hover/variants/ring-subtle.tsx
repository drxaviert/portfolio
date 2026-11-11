import { CardPage } from "../card-page";
import {
  EASE_OPTIONS,
  msControl,
  pxControl,
  speedControl,
} from "./types";
import type { Variant } from "./types";

/**
 * Variant 5 — Ring · subtle. Axis: the ring glow without the growth.
 *
 * Same three layers as Ring, but the card is at full size at rest and never
 * clips open: hover is a 1.01 scale plus the ring lighting up. Everything is
 * capped at 200ms, the glow follows over 200ms instead of trailing for a
 * second, and the arrow/title shift 2px instead of 4.8px.
 */
const CSS = `
[data-variant="ring-subtle"] {
  --ch-dur: 180ms;
  --ch-follow: 200ms;
  --ch-fade: 150ms;
  --ch-shift: 2px;
  --ch-scale: 1.01;
  --ch-ring-ease: cubic-bezier(0.165, 0.84, 0.44, 1);
  --ch-ring-line: var(--frame-line);
  --ch-ring-radius: 12px;
  --ch-ring-inner-radius: 11px;
}

[data-variant="ring-subtle"] .ch-card {
  isolation: isolate;
  background-color: transparent;
  box-shadow: none;
  transition: transform var(--ch-dur) var(--ch-ring-ease);
}

[data-variant="ring-subtle"] .ch-fill {
  display: none;
}

[data-variant="ring-subtle"] .ch-card [role="img"] {
  background-color: transparent;
  box-shadow: none;
}

[data-variant="ring-subtle"] .ch-ring-frame {
  display: block;
  position: absolute;
  inset: 0;
  z-index: -2;
  border-radius: var(--ch-ring-radius);
  background-color: var(--ch-ring-line);
  clip-path: inset(0 round var(--ch-ring-radius));
}

[data-variant="ring-subtle"] .ch-ring-glow {
  display: block;
  position: absolute;
  left: 50%;
  top: 50%;
  width: 614px;
  height: 614px;
  margin: -307px 0 0 -307px;
  background-image: var(--orb-gradient);
  -webkit-mask-image: radial-gradient(
    circle at 50% 50%,
    #000 0%,
    #000 33%,
    transparent 66%
  );
  mask-image: radial-gradient(
    circle at 50% 50%,
    #000 0%,
    #000 33%,
    transparent 66%
  );
  opacity: 0;
  transform: translate3d(var(--mx, 0px), var(--my, 0px), 0);
  transition:
    transform var(--ch-follow) var(--ch-ring-ease),
    opacity var(--ch-fade) linear;
}

[data-variant="ring-subtle"] .ch-ring-surface {
  display: block;
  position: absolute;
  inset: 0;
  z-index: -1;
  border-radius: var(--ch-ring-radius);
  clip-path: inset(1px round var(--ch-ring-inner-radius));
}

[data-variant="ring-subtle"] .ch-ring-title {
  transition: transform var(--ch-dur) var(--ch-ring-ease);
}

[data-variant="ring-subtle"] .ch-ring-arrow {
  display: flex;
  position: absolute;
  z-index: 1;
  color: var(--on-surface-variant);
  transition:
    transform var(--ch-dur) var(--ch-ring-ease),
    color var(--ch-dur) var(--ch-ring-ease);
}

@media (hover: hover) and (pointer: fine) {
  [data-variant="ring-subtle"] .ch-card:hover {
    transform: scale(var(--ch-scale));
  }

  [data-variant="ring-subtle"] .ch-card:hover .ch-ring-glow {
    opacity: 1;
  }

  [data-variant="ring-subtle"] .ch-card:hover .ch-ring-title {
    transform: translate(
      calc(var(--ch-shift) * -1),
      calc(var(--ch-shift) * -0.83)
    );
  }

  [data-variant="ring-subtle"] .ch-card:hover .ch-ring-arrow {
    transform: translate(
      var(--ch-shift),
      calc(var(--ch-shift) * -0.83)
    );
    color: var(--primary);
  }
}

[data-variant="ring-subtle"] .ch-card:focus-visible {
  transform: scale(var(--ch-scale));
}

[data-variant="ring-subtle"] .ch-card:focus-visible .ch-ring-glow {
  opacity: 1;
}

[data-variant="ring-subtle"] .ch-card:active {
  transform: scale(0.99);
  transition-duration: 100ms;
}

@media (prefers-reduced-motion: reduce) {
  [data-variant="ring-subtle"] .ch-card {
    transition: none;
  }

  /* Glow fades only: no scale, no trailing movement. */
  [data-variant="ring-subtle"] .ch-ring-glow {
    transform: none;
    transition: opacity var(--ch-fade) linear;
  }

  [data-variant="ring-subtle"] .ch-card:hover,
  [data-variant="ring-subtle"] .ch-card:focus-visible,
  [data-variant="ring-subtle"] .ch-card:active {
    transform: none;
  }

  [data-variant="ring-subtle"] .ch-card:hover .ch-ring-title,
  [data-variant="ring-subtle"] .ch-card:hover .ch-ring-arrow,
  [data-variant="ring-subtle"] .ch-card:focus-visible .ch-ring-title,
  [data-variant="ring-subtle"] .ch-card:focus-visible .ch-ring-arrow {
    transform: none;
  }
}
`;

export const ringSubtle: Variant = {
  id: "ring-subtle",
  name: "Ring subtle",
  axis: "growth · ring glow only, no clip, 1.01 scale, ≤200ms",
  css: CSS,
  defaults: {
    duration: 180,
    follow: 200,
    fade: 150,
    scale: 1.01,
    shift: 2,
    ease: "cubic-bezier(0.165, 0.84, 0.44, 1)",
    speed: "1",
  },
  controls: [
    msControl("duration", "Duration", "--ch-dur", 60, 400, 10),
    msControl("follow", "Glow follow", "--ch-follow", 100, 600, 10),
    msControl("fade", "Glow fade", "--ch-fade", 60, 400, 10),
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
    pxControl("shift", "Arrow shift", "--ch-shift", 0, 6, 0.5),
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
