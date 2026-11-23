"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { usePlayerStatus } from "./player-hooks";
import { playerStore } from "./player-store";
import type { PlayerStore } from "./player-store";
import { PauseIcon, PlayIcon } from "./player-icons";
import "./player.css";
import "./nav-player-control.css";

/**
 * The A/B nav variant: off-home, a 28px orb transport and a three-bar
 * equalizer inside the existing nav. The transport toggles the shared player;
 * the bars are the way home.
 *
 * It is absolutely placed to the left of the nav run, so showing it never moves
 * another nav item. Hidden means opacity/clip zero, inert and no pointer target;
 * the resting nav is pixel-identical.
 */
export function NavPlayerControl({
  store = playerStore,
}: {
  store?: PlayerStore;
}) {
  const pathname = usePathname();
  const { status, track, dismissed } = usePlayerStatus(store);

  const offHome = pathname !== "/" && !pathname.startsWith("/dev");
  const started = status === "playing" || status === "paused";
  const visible = offHome && started && !dismissed;
  const playing = status === "playing";
  const label = `${track.title} - ${track.artist}`;

  return (
    <div
      className="nav-player"
      data-visible={visible ? "true" : "false"}
      aria-hidden={!visible}
      inert={!visible}
      onPointerEnter={store.warm}
      onFocus={store.warm}
    >
      <button
        type="button"
        className="player-orb-button nav-player-transport"
        aria-label={playing ? `Pause ${track.title}` : `Play ${track.title}`}
        onClick={store.toggle}
        onPointerDown={store.warm}
      >
        {playing ? <PauseIcon size={10} /> : <PlayIcon size={10} />}
      </button>

      <Link href="/" aria-label={label} className="nav-player-home">
        <span
          className="nav-player-eq"
          data-playing={playing ? "true" : "false"}
          aria-hidden="true"
        >
          <span />
          <span />
          <span />
        </span>
        <span className="nav-player-tooltip" aria-hidden="true">
          {label}
        </span>
      </Link>
    </div>
  );
}
