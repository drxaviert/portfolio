"use client";

import { useEffect, useRef } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
import { PauseIcon, PlayIcon } from "./player-icons";
import type { PlayerStore } from "./player-store";
import "./orb-player.css";

/**
 * Concept 05: a 13px satellite dot at the orb's 4 o'clock edge while a track is
 * loaded. Hovering or keyboard-focusing it grows it to a 24px play/pause
 * button. The orb itself always goes home.
 *
 * A mouse resume must collapse the satellite without waiting for the pointer to
 * leave, so the click sets data-suppress-hover until the pointer leaves the
 * orb shell. Keyboard focus uses :focus-visible, so a mouse click never latches
 * the grown state.
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
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const button = buttonRef.current;
    const shell = button?.closest(".orb-shell");

    if (!button || !shell) return;

    const clearSuppression = () => button.removeAttribute("data-suppress-hover");

    shell.addEventListener("pointerleave", clearSuppression);

    return () => shell.removeEventListener("pointerleave", clearSuppression);
  }, []);

  useEffect(() => {
    if (!active) buttonRef.current?.removeAttribute("data-suppress-hover");
  }, [active]);

  function onClick(event: ReactMouseEvent<HTMLButtonElement>) {
    if (active && !playing && event.detail > 0) {
      buttonRef.current?.setAttribute("data-suppress-hover", "true");
    }

    store.toggle();
  }

  return (
    <button
      ref={buttonRef}
      type="button"
      className="orb-satellite orb-focus-ring"
      data-visible={active ? "true" : "false"}
      data-paused={playing ? "false" : "true"}
      aria-label={label}
      inert={!active}
      onClick={onClick}
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
