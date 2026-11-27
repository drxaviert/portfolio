"use client";

import { useEffect } from "react";
import { usePlayerStatus } from "@/components/player/player-hooks";
import { setListeningForced, useListeningForced } from "./listening-tuning";

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
 * The Force listening toggle in the dev tuning panel and the dev-only
 * ?listen=1 override both drive the same shared force store. The URL seeds it
 * once; after that the panel's checkbox is the only writer, so it can turn the
 * state back off without the URL fighting it.
 */
export function ListeningSync() {
  const { status } = usePlayerStatus();
  const forced = useListeningForced();

  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;

    if (new URLSearchParams(window.location.search).get("listen") === "1") {
      setListeningForced(true);
    }
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    const listening = status === "playing" || forced;

    if (listening) root.dataset.listening = "true";
    else delete root.dataset.listening;

    return () => {
      delete root.dataset.listening;
    };
  }, [status, forced]);

  return null;
}
