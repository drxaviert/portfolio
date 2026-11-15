"use client";

import { useState } from "react";

/** The CSS animation this layer removes itself on (home-entrance.css). */
const ANIMATION_NAME = "entrance-clear-mask";

/**
 * Throwaway prototype (dev route only): the whole-screen blur for the "clear"
 * variant.
 *
 * One fixed layer paints a backdrop blur over everything in the scope and a
 * radial mask punches a growing clear hole out of it, centred on the horizon
 * glow. The layer is chrome rather than layout: it lives beside the layout in
 * the harness's stable `.entrance-scope` wrapper, so `/` and the shared home
 * components never carry the node.
 *
 * `pointer-events: none` keeps it out of the way for the whole 680ms. When the
 * mask animation finishes the layer is dropped from the tree, so no blurred
 * layer stays composited behind an already-sharp page. A remount (variant
 * switch, reset, replay) starts a fresh instance through the caller's key.
 */
export function ClearOverlay() {
  const [done, setDone] = useState(false);

  if (done) return null;

  return (
    <div
      aria-hidden="true"
      className="entrance-clear"
      onAnimationEnd={(event) => {
        if (event.animationName === ANIMATION_NAME) setDone(true);
      }}
    />
  );
}
