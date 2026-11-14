"use client";

import { useState } from "react";

/** The CSS animation this layer removes itself on (home-entrance.css). */
const ANIMATION_NAME = "entrance-dawn-dim";

/**
 * Throwaway prototype (dev route only): the low-exposure veil for the "dawn"
 * variant.
 *
 * One fixed, theme-tinted layer above the whole composition, so the page starts
 * as if the light has not come up yet. It fades out over the bloom duration and
 * leaves the tree at animationend, so nothing stays composited afterwards.
 *
 * `pointer-events: none` keeps it out of the way for the whole 1300ms; a
 * remount (variant switch, reset, replay) starts a fresh instance through the
 * caller's key.
 */
export function DawnOverlay() {
  const [done, setDone] = useState(false);

  if (done) return null;

  return (
    <div
      aria-hidden="true"
      className="entrance-dawn"
      onAnimationEnd={(event) => {
        if (event.animationName === ANIMATION_NAME) setDone(true);
      }}
    />
  );
}
