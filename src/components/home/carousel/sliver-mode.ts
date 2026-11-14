import { useSyncExternalStore } from "react";

/**
 * Dev comparison for what a narrow slot shows (`?sliver=`). Dat picks one and
 * this module goes away, so everything about it lives here: the carousel only
 * asks for a `Look` at a given wideness and animates between two of them.
 *
 *   crop  the card's own cover, cropped to the strip; no title (default)
 *   grey  the flat sliver fills; the cover fades in as the card widens
 *   tint  the cover desaturated and dimmed toward the grey fill
 */
export type SliverMode = "crop" | "grey" | "tint";

const MODES: readonly SliverMode[] = ["crop", "grey", "tint"];

export function parseSliverMode(search: string): SliverMode {
  const value = new URLSearchParams(search).get("sliver");
  return MODES.find((mode) => mode === value) ?? "crop";
}

/** Opacities and desaturation of a card's three picture layers. */
export type Look = { cover: number; grey: number; grayscale: number };

/** `wide` runs from 0 (narrow slot) to 1 (the wide slot). */
export function lookFor(mode: SliverMode, wide: number): Look {
  switch (mode) {
    case "grey":
      return { cover: wide, grey: 1 - wide, grayscale: 0 };
    case "tint":
      return { cover: 0.3 + 0.7 * wide, grey: 1 - wide, grayscale: 1 - wide };
    default:
      return { cover: 1, grey: 0, grayscale: 0 };
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener("popstate", onChange);
  return () => window.removeEventListener("popstate", onChange);
}

/** The query string, read on the client only so the page stays static. */
export function useLocationSearch(): string {
  return useSyncExternalStore(
    subscribe,
    () => window.location.search,
    () => "",
  );
}
