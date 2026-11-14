"use client";

import { useState } from "react";

/** The CSS animation this layer removes itself on (home-entrance.css). */
const ANIMATION_NAME = "entrance-soft-clear";

/**
 * Throwaway prototype (dev route only): the uniform unblur for the "soft"
 * variant.
 *
 * One fixed layer paints a small backdrop blur plus a faint brightness veil
 * over the whole composition, with no mask and no radial edge. A single
 * opacity animation dissolves the blurred backdrop and the veil together, so
 * the page goes from soft to sharp evenly. The layer leaves the tree at
 * animationend, so no backdrop filter stays composited over the page.
 *
 * `pointer-events: none` keeps it out of the way for the whole 1000ms; a
 * remount (variant switch, reset, replay) starts a fresh instance through the
 * caller's key.
 */
export function SoftOverlay() {
  const [done, setDone] = useState(false);

  if (done) return null;

  return (
    <div
      aria-hidden="true"
      className="entrance-soft"
      onAnimationEnd={(event) => {
        if (event.animationName === ANIMATION_NAME) setDone(true);
      }}
    />
  );
}
