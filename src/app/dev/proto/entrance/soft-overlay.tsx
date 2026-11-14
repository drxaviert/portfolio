"use client";

import { useState } from "react";
import type { SoftMethod } from "./settings";

/** The CSS animation the overlay removes itself on (home-entrance.css). */
const ANIMATION_NAME = "entrance-soft-clear";

/**
 * Throwaway prototype (dev route only): the uniform unblur for the "soft"
 * variant, in whichever blur method the panel has picked.
 *
 * - overlay / lighter / grain: one fixed layer paints a backdrop blur plus a
 *   faint brightness veil over the whole composition, and a single opacity
 *   animation dissolves both. `grain` adds a static texture layer above it so
 *   the blurred field keeps some tooth.
 * - split: the same veil, no backdrop filter (the cards and the glow blur
 *   themselves, see home-entrance.css), so the veil is only a flat wash.
 *
 * The layer leaves the tree at animationend, so nothing stays composited;
 * `pointer-events: none` keeps it out of the way for the whole dissolve.
 */
export function SoftOverlay({ method }: { method: SoftMethod }) {
  const [done, setDone] = useState(false);

  if (done) return null;

  return (
    <>
      <div
        aria-hidden="true"
        className="entrance-soft"
        onAnimationEnd={(event) => {
          if (event.animationName === ANIMATION_NAME) setDone(true);
        }}
      />
      {method === "grain" ? (
        <div aria-hidden="true" className="entrance-soft-grain" />
      ) : null}
    </>
  );
}
