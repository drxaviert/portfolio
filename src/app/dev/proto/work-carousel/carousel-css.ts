/**
 * Everything the throwaway work-carousel route paints, kept in one string so
 * the prototype stays one small client file.
 *
 * The ring hover is copied from src/app/dev/proto/card-hover/variants/ring.tsx
 * (that route belongs to another worker, so nothing is imported from it):
 * frame clipped to inset(6px 3.5px) at rest, opening to inset(0) over 800ms;
 * surface one pixel inside; orb-gradient glow trailing the pointer. Titles
 * shift 4.8px / 4px. No corner arrow.
 */
export const CAROUSEL_CSS = `
/* ---------------------------------------------------------------- card ---- */
.wc-card {
  --wc-rest-y: 6px;
  --wc-rest-x: 3.5px;
  --wc-radius: 12px;
  --wc-inner-radius: 11px;
  --wc-glow-size: 614px;
  --wc-grow: 800ms;
  --wc-follow: 1000ms;
  --wc-fade: 250ms;
  --wc-shift: 4.8px;
  --wc-ring-ease: cubic-bezier(0.165, 0.84, 0.44, 1);
  --wc-follow-ease: cubic-bezier(0.16, 1, 0.3, 1);

  position: relative;
  display: block;
  width: 100%;
  height: 100%;
  overflow: hidden;
  border-radius: var(--wc-radius);
  background-color: transparent;
  box-shadow: none;
  color: var(--on-surface);
  text-align: left;
  cursor: pointer;
  isolation: isolate;
  transition: transform 100ms ease-out;
  -webkit-tap-highlight-color: transparent;
}

.wc-card[data-slot="peek"] {
  cursor: default;
}

/* Transparent hit target: the interactive element is separate from the visual
   layer so a slot change does not remount the art or the title layers. */
.wc-hit {
  position: absolute;
  inset: 0;
  z-index: 3;
  display: block;
  width: 100%;
  padding: 0;
  border: 0;
  border-radius: var(--wc-radius);
  background: transparent;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.wc-hit:focus-visible {
  outline: none;
}

.wc-card:has(.wc-hit:focus-visible) {
  outline: 2px solid var(--primary);
  outline-offset: 2px;
}

/* The edge: a 1px frame that opens from its resting inset to the full box. */
.wc-ring-frame {
  position: absolute;
  inset: 0;
  z-index: -2;
  border-radius: var(--wc-radius);
  background-color: var(--frame-line);
  clip-path: inset(var(--wc-rest-y) var(--wc-rest-x) round var(--wc-radius));
  transition: clip-path var(--wc-grow) var(--wc-ring-ease);
}

/* Cursor-trailing wash, only visible through the 1px frame. */
.wc-ring-glow {
  position: absolute;
  top: 50%;
  left: 50%;
  width: var(--wc-glow-size);
  height: var(--wc-glow-size);
  margin: calc(var(--wc-glow-size) / -2) 0 0 calc(var(--wc-glow-size) / -2);
  background-image: var(--orb-gradient);
  -webkit-mask-image: radial-gradient(circle at 50% 50%, #000 0%, #000 33%, transparent 66%);
  mask-image: radial-gradient(circle at 50% 50%, #000 0%, #000 33%, transparent 66%);
  opacity: 0;
  transform: translate3d(var(--mx, 0px), var(--my, 0px), 0);
  transition:
    transform var(--wc-follow) var(--wc-follow-ease),
    opacity var(--wc-fade) linear;
  will-change: transform;
}

/* The card fill, held one pixel inside the frame. */
.wc-surface {
  position: absolute;
  inset: 0;
  z-index: -1;
  border-radius: var(--wc-radius);
  background-color: var(--surface-container-low);
  clip-path: inset(
    calc(var(--wc-rest-y) + 1px) calc(var(--wc-rest-x) + 1px)
      round var(--wc-inner-radius)
  );
  transition: clip-path var(--wc-grow) var(--wc-ring-ease);
}

@media (hover: hover) and (pointer: fine) {
  .wc-card:hover .wc-ring-frame {
    clip-path: inset(0 round var(--wc-radius));
  }

  .wc-card:hover .wc-surface {
    clip-path: inset(1px round var(--wc-inner-radius));
  }

  .wc-card:hover .wc-ring-glow {
    opacity: 1;
  }

  .wc-card:hover .wc-titlebox {
    transform: translate(
      calc(var(--wc-shift) * -1),
      calc(var(--wc-shift) * -0.83)
    );
  }

  .wc-card[data-slot="peek"]:hover .wc-surface {
    clip-path: inset(
      calc(var(--wc-rest-y) + 1px) calc(var(--wc-rest-x) + 1px)
        round var(--wc-inner-radius)
    );
  }

  .wc-card[data-slot="peek"]:hover .wc-ring-frame {
    clip-path: inset(var(--wc-rest-y) var(--wc-rest-x) round var(--wc-radius));
  }
}

.wc-card:has(.wc-hit:focus-visible) .wc-ring-frame {
  clip-path: inset(0 round var(--wc-radius));
}

.wc-card:has(.wc-hit:focus-visible) .wc-surface {
  clip-path: inset(1px round var(--wc-inner-radius));
}

.wc-card:has(.wc-hit:focus-visible) .wc-ring-glow {
  opacity: 1;
}

.wc-card:has(.wc-hit:focus-visible) .wc-titlebox {
  transform: translate(
    calc(var(--wc-shift) * -1),
    calc(var(--wc-shift) * -0.83)
  );
}

.wc-card:active {
  transform: scale(0.99);
}

/* The card's content (art + text block) grows with the surface, so the ring's
   6px / 3.5px resting inset is visible around it at rest. */
.wc-content {
  position: absolute;
  inset: 0;
  z-index: 0;
  overflow: hidden;
  border-radius: var(--wc-inner-radius);
  clip-path: inset(
    calc(var(--wc-rest-y) + 1px) calc(var(--wc-rest-x) + 1px)
      round var(--wc-inner-radius)
  );
  transition: clip-path var(--wc-grow) var(--wc-ring-ease);
}

@media (hover: hover) and (pointer: fine) {
  .wc-card:hover .wc-content {
    clip-path: inset(1px round var(--wc-inner-radius));
  }
}

.wc-card:has(.wc-hit:focus-visible) .wc-content {
  clip-path: inset(1px round var(--wc-inner-radius));
}

/* A sliver is narrower than the ring inset; it stays full bleed. */
.wc-card[data-slot="peek"] .wc-content {
  border-radius: var(--wc-radius);
  clip-path: none;
}

/* ----------------------------------------------------------------- art ---- */
/* Fixed width (the featured width) anchored left, cropped by the card: a
   narrow slot reveals the left of the poster instead of rescaling it. */
.wc-art {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  height: 100%;
  pointer-events: none;
  -webkit-mask-image: linear-gradient(180deg, #000 0%, #000 46%, transparent 86%);
  mask-image: linear-gradient(180deg, #000 0%, #000 46%, transparent 86%);
}

.wc-art-wash {
  position: absolute;
  inset: 0;
  background-image: var(--orb-gradient);
  opacity: 0.5;
}

.wc-art-motif {
  position: absolute;
  inset: 0;
}

.wc-art-motif[data-art="0"] {
  background:
    radial-gradient(
      circle at 74% 30%,
      transparent 0 17.6%,
      color-mix(in oklab, var(--on-surface) 22%, transparent) 17.9% 18.2%,
      transparent 18.5%
    ),
    radial-gradient(
      circle at 74% 30%,
      transparent 0 11.4%,
      color-mix(in oklab, var(--on-surface) 15%, transparent) 11.7% 12%,
      transparent 12.3%
    ),
    radial-gradient(
      circle at 74% 30%,
      color-mix(in oklab, var(--surface-bright) 70%, transparent) 0 6.4%,
      transparent 6.9%
    );
}

.wc-art-motif[data-art="1"] {
  background:
    linear-gradient(
      180deg,
      transparent 0 38%,
      color-mix(in oklab, var(--on-surface) 10%, transparent) 38% 39%,
      transparent 39%
    ),
    linear-gradient(
      180deg,
      transparent 0 54%,
      color-mix(in oklab, var(--on-surface) 8%, transparent) 54% 66%,
      transparent 66%
    ),
    linear-gradient(
      180deg,
      transparent 0 74%,
      color-mix(in oklab, var(--on-surface) 6%, transparent) 74% 82%,
      transparent 82%
    );
}

.wc-art-motif[data-art="2"] {
  background: repeating-linear-gradient(
    118deg,
    color-mix(in oklab, var(--on-surface) 12%, transparent) 0 1px,
    transparent 1px 22px
  );
}

.wc-art-motif[data-art="3"] {
  background:
    radial-gradient(
      circle at 2% 104%,
      color-mix(in oklab, var(--surface-bright) 82%, transparent) 0 37%,
      transparent 37.4%
    ),
    radial-gradient(
      circle at 2% 104%,
      transparent 0 45%,
      color-mix(in oklab, var(--on-surface) 14%, transparent) 45.3% 45.7%,
      transparent 46%
    );
}

.wc-art-motif[data-art="4"] {
  background-image: radial-gradient(
    color-mix(in oklab, var(--on-surface) 22%, transparent) 1.6px,
    transparent 1.8px
  );
  background-size: 20px 20px;
}

.wc-art-motif[data-art="5"] {
  background: repeating-linear-gradient(
    90deg,
    color-mix(in oklab, var(--on-surface) 9%, transparent) 0 18px,
    transparent 18px 54px
  );
}

.wc-card[data-slot="peek"] .wc-art {
  filter: blur(2px);
  opacity: 0.85;
}

/* ---------------------------------------------------------------- text ---- */
.wc-body {
  position: absolute;
  inset: 0;
  z-index: 1;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  padding: 20px;
}

@media (min-width: 768px) {
  .wc-body {
    padding: 32px;
  }
}

.wc-card[data-slot="medium"] .wc-body {
  padding: 16px;
}

.wc-card[data-slot="peek"] .wc-body {
  display: none;
}

.wc-meta {
  margin: 0 0 6px;
  overflow: hidden;
  color: var(--on-surface-variant);
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.08em;
  line-height: 1.2;
  text-overflow: ellipsis;
  text-transform: uppercase;
  white-space: nowrap;
}

/* Work number: real DOM text at the top of the card, so a narrow slot crops it
   the same way the art crops. */
.wc-index {
  margin-bottom: auto;
  color: var(--on-surface-variant);
  font-size: 11px;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.08em;
  line-height: 1;
}

/* Constant height in every slot, so the meta line and the title bottom stay
   put while the card changes width: only the two title layers cross-fade. */
.wc-titlebox {
  position: relative;
  height: 4.4rem;
  transition: transform var(--wc-grow) var(--wc-ring-ease);
}

.wc-title {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  display: -webkit-box;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  transition: opacity 180ms ease-out;
}

/* Cross-fade waits for most of the width move (easeOutExpo fronts it), so the
   big title lands on a card that is already close to featured width. */
.wc-title--featured {
  font-size: 2rem;
  font-weight: 600;
  letter-spacing: -0.4px;
  line-height: 2.2rem;
  opacity: 0;
  transition: opacity 200ms ease-out;
}

/* The prototype's display step from 768 up (Figma: 40/44). */
@media (min-width: 768px) {
  .wc-titlebox {
    height: 5.5rem;
  }

  .wc-title--featured {
    font-size: 2.5rem;
    line-height: 2.75rem;
  }
}

.wc-title--compact {
  font-size: 1rem;
  font-weight: 500;
  line-height: 1.25rem;
  opacity: 1;
}

.wc-card[data-slot="featured"] .wc-title--featured {
  opacity: 1;
  transition-delay: calc(var(--wc-morph, 1000ms) * 0.35);
}

.wc-card[data-slot="featured"] .wc-title--compact {
  opacity: 0;
}

/* ---------------------------------------------------------- mobile stack ---- */
/* Under 768px the carousel is gone: a tight overlapping deck of full-width
   links. Each card sits --overlap over the one below it; earlier cards stay on
   top (--wc-z), so only the covered card's padding is hidden. */
.wc-stack-card {
  position: relative;
  z-index: var(--wc-z, 0);
  display: flex;
  width: 100%;
  flex-direction: column;
  justify-content: space-between;
  gap: 24px;
  padding: 20px;
  border-radius: 12px;
  background-color: var(--surface-container-low);
  box-shadow: var(--shadow-card);
  color: var(--on-surface);
  text-align: left;
  transition: transform 150ms ease-out;
  -webkit-tap-highlight-color: transparent;
}

.wc-stack-card:active {
  transform: scale(0.99);
}

.wc-stack-card:focus-visible {
  z-index: 60;
  outline: 2px solid var(--primary);
  outline-offset: 2px;
}

.wc-stack-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
}

.wc-stack-index {
  color: var(--on-surface-variant);
  font-size: 10px;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.08em;
  line-height: 1.2;
}

.wc-stack-meta {
  margin: 0;
  overflow: hidden;
  color: var(--on-surface-variant);
  font-size: 10px;
  font-weight: 500;
  letter-spacing: 0.08em;
  line-height: 1.2;
  text-align: right;
  text-overflow: ellipsis;
  text-transform: uppercase;
  white-space: nowrap;
}

.wc-stack-title {
  display: -webkit-box;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  font-size: 1.375rem;
  font-weight: 600;
  letter-spacing: -0.3px;
  line-height: 1.2;
}

/* ------------------------------------------------------- reduced motion ---- */
@media (prefers-reduced-motion: reduce) {
  .wc-card {
    transition: none;
  }

  .wc-card .wc-ring-frame,
  .wc-card:hover .wc-ring-frame,
  .wc-card:has(.wc-hit:focus-visible) .wc-ring-frame {
    clip-path: inset(0 round var(--wc-radius));
    transition: none;
  }

  .wc-card .wc-surface,
  .wc-card:hover .wc-surface,
  .wc-card:has(.wc-hit:focus-visible) .wc-surface {
    clip-path: inset(1px round var(--wc-inner-radius));
    transition: none;
  }

  .wc-card .wc-content,
  .wc-card:hover .wc-content,
  .wc-card:has(.wc-hit:focus-visible) .wc-content {
    clip-path: inset(1px round var(--wc-inner-radius));
    transition: none;
  }

  .wc-ring-glow {
    transform: none;
    transition: opacity var(--wc-fade) linear;
  }

  .wc-card:hover .wc-titlebox,
  .wc-card:has(.wc-hit:focus-visible) .wc-titlebox {
    transform: none;
  }

  .wc-card:hover,
  .wc-card:active {
    transform: none;
  }

  .wc-title,
  .wc-card[data-slot="featured"] .wc-title--featured {
    transition: none;
  }

  .wc-stack-card {
    transition: none;
  }

  .wc-stack-card:active {
    transform: none;
  }
}
`;
