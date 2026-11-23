"use client";

import { PauseIcon, PlayIcon } from "./player-icons";
import type { PlayerStore } from "./player-store";
import "./orb-player.css";

/**
 * Concept 05: a 13px satellite dot at the orb's 4 o'clock edge while a track is
 * loaded. Hovering or focusing the orb/dot grows it to a 24px play/pause
 * button. The orb itself always goes home.
 */
export function OrbSatelliteControl({
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
      className="orb-satellite orb-focus-ring"
      data-visible={active ? "true" : "false"}
      data-paused={playing ? "false" : "true"}
      aria-label={label}
      inert={!active}
      onClick={store.toggle}
      onPointerDown={store.warm}
    >
      <span
        className="orb-sat-dot"
        data-playing={playing ? "true" : "false"}
        aria-hidden="true"
      />
      <span className="orb-sat-grown" aria-hidden="true">
        {playing ? <PauseIcon size={10} /> : <PlayIcon size={10} />}
      </span>
    </button>
  );
}
