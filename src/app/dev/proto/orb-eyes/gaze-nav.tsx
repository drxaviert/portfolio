"use client";

import Link from "next/link";
import { NavItems } from "@/components/home/nav-items";
import { RingLayers } from "@/components/home/ring-hover";
import { useTooltipWarm } from "@/components/nav/use-tooltip-warm";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { GazeOrb } from "./gaze-orb";

const FOCUS_RING =
  "focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

type GazeNavProps = {
  strength: number;
  lookDistance: number;
};

/**
 * The shipped home nav with one part swapped: its orb head looks at the
 * pointer. Everything else is the real bar (the same labels, glyph, theme
 * toggle, glide capsule, tooltip and ring), so the prototype is judged on the
 * face and not on a mock of the nav.
 */
export function GazeNav({ strength, lookDistance }: GazeNavProps) {
  const tooltips = useTooltipWarm();

  return (
    <nav
      aria-label="Primary"
      className="nav-bar ring-host flex h-16 items-center justify-between rounded-lg px-4"
      data-tooltip-warm={tooltips.warm}
      onPointerEnter={tooltips.onPointerEnter}
      onPointerLeave={tooltips.onPointerLeave}
    >
      <RingLayers fill="bg-surface-container-low" />

      <Link
        href="/"
        aria-label="Home"
        className={`nav-logo relative shrink-0 rounded-full no-underline ${FOCUS_RING}`}
      >
        <GazeOrb strength={strength} lookDistance={lookDistance} />
        <span
          aria-hidden="true"
          className="nav-tooltip pointer-events-none absolute -top-9 left-1/2 -translate-x-1/2 rounded-md bg-on-surface px-2 py-1 text-xs whitespace-nowrap text-surface"
        >
          Home
        </span>
      </Link>

      <div className="flex min-w-0 items-center gap-3">
        <NavItems />
        <ThemeToggle />
      </div>
    </nav>
  );
}
