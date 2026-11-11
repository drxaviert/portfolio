"use client";

import type { MouseEvent } from "react";
import { PrototypeNav } from "@/app/dev/prototype/prototype-nav";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { RingLayers } from "./ring-layers";

/**
 * Nav treatments for the two nav variants. Copied from
 * src/app/dev/prototype/prototype-nav.tsx (owned by another worker) because the
 * ring has to live on each item, which the imported component cannot do.
 *
 * The item's own background is dropped and carried by the ring surface, so the
 * frame is not covered by the pill it outlines. Links and the design-system
 * glyph become real anchors here so they can hold focus; the theme toggle is
 * wrapped as ONE item, not one ring per segment.
 */

function stopNavigation(event: MouseEvent<HTMLAnchorElement>) {
  event.preventDefault();
}

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

/** Variant: one small ring per nav item, toggle included as a single item. */
export function RingNavItems() {
  return (
    <nav
      aria-label="Primary"
      className="flex h-16 items-center justify-between rounded-lg bg-surface-container-low px-4 shadow-card"
    >
      <OrbHead />

      <div className="flex items-center gap-6 md:gap-0">
        <div className="flex items-center">
          {LINKS.map((link) => (
            <a
              key={link.label}
              href="#"
              onClick={stopNavigation}
              aria-current={link.active ? "page" : undefined}
              className={
                link.active
                  ? "ch-nav-item relative flex h-8 items-center rounded-md px-2 text-base leading-5 font-medium text-on-surface"
                  : "ch-nav-item relative flex h-8 items-center rounded-md px-2 text-base leading-5 font-medium text-on-surface-variant"
              }
            >
              <RingLayers
                fill={
                  link.active ? "bg-surface-container" : "bg-surface-container-low"
                }
              />
              {link.label}
            </a>
          ))}
        </div>

        <span
          aria-hidden="true"
          className="mx-6 hidden h-5 w-px bg-outline-variant md:block"
        />

        <div className="flex items-center gap-3">
          <a
            href="#"
            onClick={stopNavigation}
            aria-label="Design system"
            className="ch-nav-item relative hidden size-8 items-center justify-center rounded-md text-on-surface md:flex"
          >
            <RingLayers fill="bg-surface-container-low" />
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
          </a>

          <span className="ch-nav-item ch-nav-item--toggle relative flex items-center rounded-md">
            <RingLayers fill="bg-surface-container-low" />
            <ThemeToggle />
          </span>
        </div>
      </div>
    </nav>
  );
}

/** Variant: the whole nav container is one ring surface. */
export function RingNavBar() {
  return (
    <div className="ch-nav-bar relative rounded-lg">
      <RingLayers fill="bg-surface-container-low" />
      <PrototypeNav />
    </div>
  );
}
