"use client";

import { useEffect } from "react";
import { usePlayerStatus } from "@/components/player/player-hooks";

/**
 * Mirrors the player state onto the document so both horizon renderers can see
 * it: :root[data-listening="true"] drives the CSS fallback's crossfade, and the
 * shader observes the same attribute and runs its own ramp on the rAF clock.
 *
 * The attribute lives on <html>, not on the horizon, so it survives the route
 * tree changes inside (site) and is available before either layer reads it. It
 * is removed on unmount; a remount while music is still playing sets it again
 * and the shader swells in from wherever it is.
 *
 * Dev-only: ?listen=1 forces the state on without playback, for tuning. The
 * check is compiled out of production builds.
 */
export function ListeningSync() {
  const { status } = usePlayerStatus();

  useEffect(() => {
    const root = document.documentElement;
    const forced =
      process.env.NODE_ENV !== "production" &&
      new URLSearchParams(window.location.search).get("listen") === "1";
    const listening = status === "playing" || forced;

    if (listening) root.dataset.listening = "true";
    else delete root.dataset.listening;

    return () => {
      delete root.dataset.listening;
    };
  }, [status]);

  return null;
}
