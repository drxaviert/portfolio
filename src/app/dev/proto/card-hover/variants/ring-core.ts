/**
 * The ring mechanism, shared by all four variants of this round.
 *
 * Every host (`:is(.ch-card, .ch-nav-item, .ch-nav-bar)`) gets the same three
 * layers and the same motion; only the geometry vars differ per host:
 *   --ch-rest-y / --ch-rest-x  rest inset (the card grows into its box)
 *   --ch-radius / --ch-inner-radius
 *   --ch-glow-size
 * and the timing vars are set by each variant:
 *   --ch-grow --ch-follow --ch-fade --ch-shift --ch-ring-ease --ch-follow-ease
 *
 * The host's own background and shadow are dropped: the ring surface supplies
 * the fill, so the frame is not covered by the element it outlines.
 */
export const RING_CORE_CSS = `
[data-variant] :is(.ch-card, .ch-nav-item, .ch-nav-bar) {
  isolation: isolate;
  background-color: transparent;
  box-shadow: none;
  transition:
    transform 100ms ease-out,
    z-index 100ms steps(1);
}

[data-variant] .ch-card {
  --ch-rest-y: 6px;
  --ch-rest-x: 3.5px;
  --ch-radius: 12px;
  --ch-inner-radius: 11px;
  --ch-glow-size: 614px;
}

/* The card's own fill moves to the ring surface. */
[data-variant] .ch-fill {
  display: none;
}

/* TrackerWidget owns its own surface; the ring surface replaces it. */
[data-variant] .ch-card [role="img"] {
  background-color: transparent;
  box-shadow: none;
}

[data-variant] .ch-ring-frame {
  display: block;
  position: absolute;
  inset: 0;
  z-index: -2;
  border-radius: var(--ch-radius);
  background-color: var(--ch-ring-line);
  clip-path: inset(
    var(--ch-rest-y) var(--ch-rest-x) round var(--ch-radius)
  );
  transition: clip-path var(--ch-grow) var(--ch-ring-ease);
}

[data-variant] .ch-ring-glow {
  display: block;
  position: absolute;
  left: 50%;
  top: 50%;
  width: var(--ch-glow-size);
  height: var(--ch-glow-size);
  margin: calc(var(--ch-glow-size) / -2) 0 0 calc(var(--ch-glow-size) / -2);
  background-image: var(--ch-glow-image, var(--orb-gradient));
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
    transform var(--ch-follow) var(--ch-follow-ease),
    opacity var(--ch-fade) linear;
  will-change: transform;
}

[data-variant] .ch-ring-surface {
  display: block;
  position: absolute;
  inset: 0;
  z-index: -1;
  border-radius: var(--ch-radius);
  clip-path: inset(
    calc(var(--ch-rest-y) + 1px) calc(var(--ch-rest-x) + 1px)
      round var(--ch-inner-radius)
  );
  transition: clip-path var(--ch-grow) var(--ch-ring-ease);
}

[data-variant] .ch-ring-title {
  transition: transform var(--ch-grow) var(--ch-ring-ease);
}

@media (hover: hover) and (pointer: fine) {
  [data-variant] :is(.ch-card, .ch-nav-item, .ch-nav-bar):hover {
    z-index: 1;
  }

  [data-variant]
    :is(.ch-card, .ch-nav-item, .ch-nav-bar):hover
    .ch-ring-frame {
    clip-path: inset(0 round var(--ch-radius));
  }

  [data-variant]
    :is(.ch-card, .ch-nav-item, .ch-nav-bar):hover
    .ch-ring-surface {
    clip-path: inset(1px round var(--ch-inner-radius));
  }

  [data-variant]
    :is(.ch-card, .ch-nav-item, .ch-nav-bar):hover
    .ch-ring-glow {
    opacity: 1;
  }

  /* Only cards carry a title to shift; nav items move nothing inside. */
  [data-variant] .ch-card:hover .ch-ring-title {
    transform: translate(
      calc(var(--ch-shift) * -1),
      calc(var(--ch-shift) * -0.83)
    );
  }
}

[data-variant]
  :is(.ch-card, .ch-nav-item, .ch-nav-bar):focus-visible
  .ch-ring-frame {
  clip-path: inset(0 round var(--ch-radius));
}

[data-variant]
  :is(.ch-card, .ch-nav-item, .ch-nav-bar):focus-visible
  .ch-ring-surface {
  clip-path: inset(1px round var(--ch-inner-radius));
}

[data-variant]
  :is(.ch-card, .ch-nav-item, .ch-nav-bar):focus-visible
  .ch-ring-glow {
  opacity: 1;
}

[data-variant] .ch-card:focus-visible .ch-ring-title {
  transform: translate(
    calc(var(--ch-shift) * -1),
    calc(var(--ch-shift) * -0.83)
  );
}

[data-variant] :is(.ch-card, .ch-nav-item):active {
  transform: scale(0.99);
  transition-duration: 100ms;
}

@media (prefers-reduced-motion: reduce) {
  [data-variant] :is(.ch-card, .ch-nav-item, .ch-nav-bar) {
    transition: none;
  }

  /* No growth: every host rests at its open geometry. */
  [data-variant] .ch-ring-frame,
  [data-variant] :is(.ch-card, .ch-nav-item, .ch-nav-bar):hover .ch-ring-frame,
  [data-variant]
    :is(.ch-card, .ch-nav-item, .ch-nav-bar):focus-visible
    .ch-ring-frame {
    clip-path: inset(0 round var(--ch-radius));
    transition: none;
  }

  [data-variant] .ch-ring-surface,
  [data-variant]
    :is(.ch-card, .ch-nav-item, .ch-nav-bar):hover
    .ch-ring-surface,
  [data-variant]
    :is(.ch-card, .ch-nav-item, .ch-nav-bar):focus-visible
    .ch-ring-surface {
    clip-path: inset(1px round var(--ch-inner-radius));
    transition: none;
  }

  /* Glow fades only: no trailing movement, it stays centred. */
  [data-variant] .ch-ring-glow {
    transform: none;
    transition: opacity var(--ch-fade) linear;
  }

  [data-variant] .ch-card:hover .ch-ring-title,
  [data-variant] .ch-card:focus-visible .ch-ring-title {
    transform: none;
  }

  [data-variant] :is(.ch-card, .ch-nav-item):hover,
  [data-variant] :is(.ch-card, .ch-nav-item):active {
    transform: none;
    z-index: auto;
  }
}
`;
