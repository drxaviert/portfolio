"use client";

import { NavOrb } from "@/components/player/nav-orb";
import { NavPlayerControl } from "@/components/player/nav-player-control";
import { useOffHomeVariant } from "@/components/player/offhome-variant";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { useTooltipWarm } from "@/components/nav/use-tooltip-warm";
import { NavItems } from "./nav-items";
import { RingLayers } from "./ring-hover";
import "./ring-hover.css";

/**
 * Home nav from the Figma 1440 frame (121:2253).
 *
 * The head is the orb mark: a 36px ball painted with the phase blob gradient
 * (bottom-left → top-right) and two matte eyes, so it recolours with the theme
 * like the rest.
 *
 * The three labels and the design-system glyph are one run with a single
 * capsule: hovering slides it to the pointer with the theme toggle's stretch &
 * snap, so the nav and the toggle share one motion (see nav-items.tsx).
 *
 * The logo is a link home, and "Work" is the link home inside that run (see
 * nav-items.tsx). The reader's nav captures those two and plays the reverse
 * morph instead of navigating; Play and About stay focusable placeholders. The
 * orb carries a "Home" tooltip like the glyph's, and on the homepage it is the
 * page already on screen, so the dock swallows its click (no history entry, no
 * scroll jump).
 *
 * The bar is one hover host: its own fill moves to the ring surface, and
 * keyboard focus inside it (the theme toggle, the links) opens the ring.
 */
export function HomeNav() {
  const tooltips = useTooltipWarm();
  const offHomeVariant = useOffHomeVariant();

  return (
    <nav
      aria-label="Primary"
      className="nav-bar ring-host flex h-16 items-center justify-between rounded-lg px-4"
      data-tooltip-warm={tooltips.warm}
      onPointerEnter={tooltips.onPointerEnter}
      onPointerLeave={tooltips.onPointerLeave}
    >
      <RingLayers fill="bg-surface-container-low" />

      <NavOrb variant={offHomeVariant} />

      <div className="relative flex min-w-0 items-center gap-3">
        {offHomeVariant === "nav" ? <NavPlayerControl /> : null}
        <NavItems />
        <ThemeToggle />
      </div>
    </nav>
  );
}
