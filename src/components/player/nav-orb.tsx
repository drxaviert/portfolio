"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { usePlayerStatus } from "./player-hooks";
import { playerStore } from "./player-store";
import type { PlayerStore } from "./player-store";
import { OrbHead } from "./orb-head";
import { OrbSatelliteControl } from "./orb-satellite-control";
import "./orb-player.css";

/**
 * The nav's orb slot. The orb stays the plain Home link; off-home, while a
 * track is playing or paused, a satellite dot at its 4 o'clock edge is the
 * play/pause control. On the home route the card remains the only player
 * affordance, and the idle nav is the existing logo link.
 */
export function NavOrb({ store = playerStore }: { store?: PlayerStore }) {
  const pathname = usePathname();
  const { status, track } = usePlayerStatus(store);
  const started = status === "playing" || status === "paused";
  const active = started && pathname !== "/" && !pathname.startsWith("/dev");
  const playing = status === "playing";

  return (
    <div className="orb-shell relative size-9 shrink-0">
      <OrbSatelliteControl
        active={active}
        playing={playing}
        track={track}
        store={store}
      />

      <Link
        href="/"
        aria-label="Home"
        className="nav-logo orb-focus-ring relative flex size-9 shrink-0 items-center justify-center rounded-full no-underline"
      >
        <OrbHead />
        <span
          aria-hidden="true"
          className="nav-tooltip pointer-events-none absolute -top-9 left-1/2 -translate-x-1/2 rounded-md bg-on-surface px-2 py-1 text-xs whitespace-nowrap text-surface"
        >
          Home
        </span>
      </Link>
    </div>
  );
}
