import { ThemeToggle } from "@/components/theme/theme-toggle";
import { RingLayers } from "./ring-hover";

/**
 * Static nav from the Figma 1440 frame (121:2253).
 *
 * The links and the design-system glyph are non-interactive on purpose: this
 * prototype's only interaction is the theme toggle. The head is the orb mark:
 * a 36px ball painted with the phase blob gradient (bottom-left → top-right)
 * and two matte eyes, so it recolours with the theme like the rest.
 *
 * The bar is one hover host: its own fill moves to the ring surface, and
 * keyboard focus inside it (the theme toggle) opens the ring.
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

const LINKS = [
  { label: "Work", active: true },
  { label: "Play", active: false },
  { label: "About", active: false },
];

export function PrototypeNav() {
  return (
    <nav
      aria-label="Primary"
      className="ring-host flex h-16 items-center justify-between rounded-lg px-4"
    >
      <RingLayers fill="bg-surface-container-low" />
      <OrbHead />

      <div className="flex items-center gap-6 md:gap-0">
        <div className="flex items-center">
          {LINKS.map((link) => (
            <span
              key={link.label}
              aria-current={link.active ? "page" : undefined}
              className={
                link.active
                  ? "flex h-8 items-center rounded-md bg-surface-container px-2 text-base leading-5 font-medium text-on-surface"
                  : "flex h-8 items-center rounded-md px-2 text-base leading-5 font-medium text-on-surface-variant"
              }
            >
              {link.label}
            </span>
          ))}
        </div>

        <span
          aria-hidden="true"
          className="mx-6 hidden h-5 w-px bg-outline-variant md:block"
        />

        <div className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className="hidden size-8 items-center justify-center rounded-md text-on-surface md:flex"
          >
            <svg
              viewBox="0 0 20 20"
              width="20"
              height="20"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              focusable="false"
            >
              <rect x="2.75" y="2.75" width="6" height="6" rx="1.5" />
              <circle cx="14.25" cy="5.75" r="3" />
              <rect x="2.75" y="11.25" width="6" height="6" rx="1.5" />
              <path d="M14.25 11.1 17.4 14.25 14.25 17.4 11.1 14.25Z" />
            </svg>
          </span>

          <ThemeToggle />
        </div>
      </div>
    </nav>
  );
}
