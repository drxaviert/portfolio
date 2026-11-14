import { ThemeToggle } from "@/components/theme/theme-toggle";
import { NavItems } from "./nav-items";
import { RingLayers } from "./ring-hover";

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
 * The bar is one hover host: its own fill moves to the ring surface, and
 * keyboard focus inside it opens the ring.
 */
function OrbHead() {
  return (
    <div
      aria-hidden="true"
      className="relative size-9 shrink-0 overflow-hidden rounded-full"
      style={{ backgroundImage: "var(--orb-gradient)" }}
    >
      <span className="absolute top-[10.5px] left-[13.5px] h-2 w-[3.4px] rounded-full bg-white" />
      <span className="absolute top-[10.5px] left-[20.6px] h-2 w-[3.4px] rounded-full bg-white" />
    </div>
  );
}

export function HomeNav() {
  return (
    <nav
      aria-label="Primary"
      className="ring-host flex h-16 items-center justify-between rounded-lg px-4"
    >
      <RingLayers fill="bg-surface-container-low" />
      <OrbHead />

      <div className="flex items-center gap-3">
        <NavItems />
        <ThemeToggle />
      </div>
    </nav>
  );
}
