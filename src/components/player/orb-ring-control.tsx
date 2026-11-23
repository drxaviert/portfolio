"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "@/components/theme/theme-provider";
import { usePlayer } from "./player-hooks";
import type { PlayerStore } from "./player-store";
import { OrbHead } from "./orb-head";
import "./orb-player.css";

const RING_RADIUS = 22;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;
const HOLD_MS = 500;

/**
 * Concept 02: a 2px orb-gradient arc around the orb counts the track. The orb
 * itself toggles playback; a 500ms hold goes home; a visually hidden Home link
 * gives keyboard users the home action. Off-home only.
 */
export function OrbRingControl({
  store,
  playing,
}: {
  store: PlayerStore;
  playing: boolean;
}) {
  const router = useRouter();
  const { phase } = useTheme();
  const player = usePlayer(store);
  const rawId = useId();
  const gradientId = `orb-ring-${rawId.replace(/[^a-zA-Z0-9_-]/g, "")}`;

  const [holding, setHolding] = useState(false);
  const holdTimer = useRef<number | null>(null);
  const holdTriggered = useRef(false);

  const progress =
    player.duration > 0
      ? Math.min(1, Math.max(0, player.currentTime / player.duration))
      : 0;
  const midOffset =
    phase === "dusk" ? "50%" : phase === "night" ? "45%" : "100%";
  const paused = !playing;
  const label = paused ? "Play, hold for home" : "Pause, hold for home";
  const tooltip = paused
    ? "Click to play · hold for home"
    : "Click to pause · hold for home";

  const clearHold = useCallback(() => {
    if (holdTimer.current !== null) {
      window.clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }

    setHolding(false);
  }, []);

  useEffect(
    () => () => {
      if (holdTimer.current !== null) {
        window.clearTimeout(holdTimer.current);
      }
    },
    [],
  );

  const onPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      if (event.pointerType === "mouse" && event.button !== 0) return;

      holdTriggered.current = false;
      setHolding(true);
      holdTimer.current = window.setTimeout(() => {
        holdTimer.current = null;
        holdTriggered.current = true;
        setHolding(false);
        router.push("/");
      }, HOLD_MS);
    },
    [router],
  );

  const onClick = useCallback(() => {
    if (holdTriggered.current) {
      holdTriggered.current = false;
      return;
    }

    store.toggle();
  }, [store]);

  return (
    <div className="orb-shell relative size-9 shrink-0">
      <svg
        className="orb-ring"
        width="48"
        height="48"
        viewBox="0 0 48 48"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" style={{ stopColor: "var(--orb-1)" }} />
            <stop offset={midOffset} style={{ stopColor: "var(--orb-2)" }} />
            <stop offset="100%" style={{ stopColor: "var(--orb-3)" }} />
          </linearGradient>
        </defs>
        <circle
          className="orb-ring-track"
          cx="24"
          cy="24"
          r={RING_RADIUS}
          fill="none"
          strokeWidth="2"
        />
        <circle
          className="orb-ring-progress"
          data-ring-progress
          data-paused={paused ? "true" : undefined}
          cx="24"
          cy="24"
          r={RING_RADIUS}
          transform="rotate(-90 24 24)"
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray={`${RING_CIRCUMFERENCE * progress} ${RING_CIRCUMFERENCE}`}
        />
      </svg>

      <button
        type="button"
        className="nav-logo orb-ring-button orb-focus-ring relative flex size-9 shrink-0 items-center justify-center rounded-full"
        aria-label={label}
        data-paused={paused ? "true" : "false"}
        data-holding={holding ? "true" : "false"}
        onClick={onClick}
        onPointerDown={onPointerDown}
        onPointerUp={clearHold}
        onPointerLeave={clearHold}
        onPointerCancel={clearHold}
      >
        <OrbHead ring paused={paused} />
        <span className="orb-hold-fill" aria-hidden="true" />
        <span
          aria-hidden="true"
          className="nav-tooltip orb-ring-tooltip pointer-events-none absolute rounded-md bg-on-surface px-2 py-1 text-xs whitespace-nowrap text-surface"
        >
          {tooltip}
        </span>
      </button>

      <Link href="/" className="orb-home-alt">
        Home
      </Link>
    </div>
  );
}
