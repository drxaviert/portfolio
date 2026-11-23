"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { CSSProperties } from "react";
import { thumbnailUrl } from "@/components/home/now-playing-track";
import { usePlayer } from "./player-hooks";
import { playerStore } from "./player-store";
import type { PlayerStore } from "./player-store";
import { CloseIcon, PauseIcon, PlayIcon } from "./player-icons";
import "./player.css";
import "./floating-mini-player.css";

/**
 * The off-home pill. It is a pure view over the shared store: the cover and
 * title go home, the orb button toggles, the × pauses and dismisses, and the
 * 2px bottom line is the shared playhead (read-only).
 *
 * It is always rendered by the pill variant and transitions between hidden and
 * shown, so enter/exit is interruptible and no navigation ever mounts a second
 * player. Hidden means inert, aria-hidden and no pointer target.
 */
export function FloatingMiniPlayer({
  store = playerStore,
}: {
  store?: PlayerStore;
}) {
  const pathname = usePathname();
  const player = usePlayer(store);
  const { status, currentTime, duration, track, dismissed } = player;

  const offHome = pathname !== "/" && !pathname.startsWith("/dev");
  const started = status === "playing" || status === "paused";
  const visible = offHome && started && !dismissed;
  const playing = status === "playing";
  const progress =
    duration > 0 ? Math.min(1, Math.max(0, currentTime / duration)) : 0;

  return (
    <section
      role="region"
      aria-label="Now playing"
      aria-hidden={!visible}
      inert={!visible}
      data-visible={visible ? "true" : "false"}
      style={{ "--mini-progress": progress } as CSSProperties}
      className="mini-player"
      onPointerEnter={store.warm}
      onFocus={store.warm}
    >
      <Link
        href="/"
        aria-label={`${track.title} by ${track.artist}`}
        className="mini-player-link"
      >
        <Image
          src={thumbnailUrl(track.videoId)}
          alt=""
          width={32}
          height={32}
          className="mini-player-cover"
        />
        <span className="mini-player-text">
          <span className="mini-player-title text-xs font-semibold">
            {track.title}
          </span>
          <span className="mini-player-artist text-xs">{track.artist}</span>
        </span>
      </Link>

      <button
        type="button"
        className="player-orb-button mini-player-transport"
        aria-label={playing ? `Pause ${track.title}` : `Play ${track.title}`}
        onClick={store.toggle}
        onPointerDown={store.warm}
      >
        {playing ? <PauseIcon /> : <PlayIcon />}
      </button>

      <button
        type="button"
        className="mini-player-close"
        aria-label="Dismiss now playing"
        onClick={store.dismiss}
      >
        <CloseIcon />
      </button>

      <span className="mini-player-progress" aria-hidden="true">
        <span className="mini-player-progress-fill" />
      </span>
    </section>
  );
}
