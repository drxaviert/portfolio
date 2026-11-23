"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { usePlayerStatus } from "./player-hooks";
import { playerStore } from "./player-store";
import type { PlayerStore } from "./player-store";
import type { OffHomeVariant } from "./offhome-variant";
import { OrbHead } from "./orb-head";
import { OrbPillControl } from "./orb-pill-control";
import { OrbRingControl } from "./orb-ring-control";
import { OrbSatelliteControl } from "./orb-satellite-control";
import "./orb-player.css";

/**
 * The nav's orb slot. It stays the plain Home link until a track is playing or
 * paused off-home; then the variant turns it into the matching player control.
 * The home route keeps the card as the only player affordance, and the idle nav
 * is byte-for-byte the existing logo link.
 */
export function NavOrb({
  variant,
  store = playerStore,
}: {
  variant: OffHomeVariant;
  store?: PlayerStore;
}) {
  const pathname = usePathname();
  const { status, track, dismissed } = usePlayerStatus(store);
  const started = status === "playing" || status === "paused";
  const active =
    started && !dismissed && pathname !== "/" && !pathname.startsWith("/dev");
  const playing = status === "playing";

  if (variant === "ring" && active) {
    return <OrbRingControl store={store} playing={playing} />;
  }

  return (
    <div className="orb-shell relative size-9 shrink-0">
      {variant === "pill-orb" ? (
        <OrbPillControl
          active={active}
          playing={playing}
          track={track}
          store={store}
        />
      ) : null}
      {variant === "satellite" ? (
        <OrbSatelliteControl
          active={active}
          playing={playing}
          track={track}
          store={store}
        />
      ) : null}

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
