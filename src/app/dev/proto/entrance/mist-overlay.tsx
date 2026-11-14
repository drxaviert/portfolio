"use client";

import { useState } from "react";

/** The CSS animation this layer removes itself on (home-entrance.css). */
const ANIMATION_NAME = "entrance-mist-lift";

/**
 * Throwaway prototype (dev route only): the soft haze for the "mist" variant.
 *
 * One fixed layer above the whole composition paints a theme-tinted gradient
 * that is denser at the top, so the horizon is the clearest part of the screen
 * from the first frame. It thins upward and away (translate + opacity only, no
 * filter), and drops out of the tree when the animation ends so nothing stays
 * composited over the page.
 *
 * `pointer-events: none` keeps it out of the way for the whole 1100ms; a
 * remount (variant switch, reset, replay) starts a fresh instance through the
 * caller's key.
 */
export function MistOverlay() {
  const [done, setDone] = useState(false);

  if (done) return null;

  return (
    <div
      aria-hidden="true"
      className="entrance-mist"
      onAnimationEnd={(event) => {
        if (event.animationName === ANIMATION_NAME) setDone(true);
      }}
    />
  );
}
