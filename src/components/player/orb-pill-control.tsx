"use client";

import { PauseIcon, PlayIcon } from "./player-icons";
import type { PlayerStore } from "./player-store";
import "./orb-player.css";

/**
 * Concept 04: a 32px orb-gradient capsule slides out from behind the orb. The
 * orb stays the Home link; the capsule (equalizer, "title – artist", glyph)
 * toggles playback. It is absolute, so it never reflows the nav.
 */
export function OrbPillControl({
  active,
  playing,
  track,
  store,
}: {
  active: boolean;
  playing: boolean;
  track: { title: string; artist: string };
  store: PlayerStore;
}) {
  const label = playing ? `Pause ${track.title}` : `Play ${track.title}`;

  return (
    <button
      type="button"
      className="orb-pill orb-focus-ring"
      data-visible={active ? "true" : "false"}
      aria-hidden={!active}
      aria-label={label}
      inert={!active}
      onClick={store.toggle}
      onPointerDown={store.warm}
    >
      <span
        className="orb-pill-eq"
        data-playing={playing ? "true" : "false"}
        aria-hidden="true"
      >
        <span />
        <span />
        <span />
      </span>
      <span className="orb-pill-text text-xs font-medium truncate">
        {track.title} – {track.artist}
      </span>
      <span className="orb-pill-glyph" aria-hidden="true">
        {playing ? <PauseIcon size={10} /> : <PlayIcon size={10} />}
      </span>
    </button>
  );
}
