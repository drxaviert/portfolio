"use client";

import type { MouseEvent, PointerEvent } from "react";
import { HorizonBackground } from "@/app/dev/prototype/horizon-background";
import { PrototypeNav } from "@/app/dev/prototype/prototype-nav";
import { TrackerWidget } from "@/app/dev/prototype/tracker-widget";
import { RingLayers } from "./ring-layers";
import { RingNavBar, RingNavItems } from "./ring-nav";

/**
 * The real /dev/prototype page, card for card, with every card carrying the
 * shared `.ch-card` hover language. Nav is deliberately left out of the plain
 * variants; the two nav variants swap in their own nav treatment.
 *
 * Markup is copied from src/app/dev/prototype/page.tsx (that file belongs to
 * another worker, so nothing here is imported from it except the three
 * components). Every card also carries the three ring layers; they are
 * display:none until a ring variant's sheet switches them on.
 */

const WORK_SLIVERS = [
  { fill: "bg-surface-container", height: "h-[72px]" },
  {
    fill: "bg-surface dark:bg-surface-container-high",
    height: "h-14",
  },
  {
    fill: "bg-surface-dim dark:bg-surface-container-highest",
    height: "h-14",
  },
];

/**
 * Shared across every variant: one transition list, one focus ring, one
 * pseudo-element shape. Variants only add their axis on top.
 *
 * The hover shadow rides a pseudo-element's opacity instead of box-shadow, so
 * the crossfade stays on the compositor. `z-index: 1` keeps it above the Play
 * card's inner clipped layer.
 */
const BASE_CSS = `
.ch-card {
  transition:
    transform var(--ch-dur, 160ms) var(--ch-ease, cubic-bezier(0.23, 1, 0.32, 1)),
    opacity var(--ch-dur, 160ms) var(--ch-ease, cubic-bezier(0.23, 1, 0.32, 1));
}

.ch-card::before,
.ch-card::after {
  content: "";
  position: absolute;
  inset: 0;
  z-index: 1;
  border-radius: inherit;
  pointer-events: none;
}

.ch-card:focus-visible {
  outline: 2px solid var(--primary);
  outline-offset: 2px;
}

/* Ring layers stay out of the way until a ring variant turns them on. */
.ch-ring-frame,
.ch-ring-glow,
.ch-ring-surface {
  display: none;
}
`;

function stopNavigation(event: MouseEvent<HTMLAnchorElement>) {
  // Prototype only: nowhere real to go, and a reload would lose the picker.
  event.preventDefault();
}

/** Everything the cursor can light up: cards, nav items, the nav bar. */
const RING_HOST = ".ch-card, .ch-nav-item, .ch-nav-bar";

export function CardPage({
  pointer,
  nav = "default",
}: {
  pointer?: "spotlight" | "ring";
  nav?: "default" | "items" | "bar";
}) {
  function trackPointer(event: PointerEvent<HTMLElement>) {
    const host = (event.target as Element).closest<HTMLElement>(RING_HOST);

    if (!host) return;

    const rect = host.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    // Spotlight reads from the top-left; the ring glow is centred, so it reads
    // the offset from the middle.
    host.style.setProperty("--ch-x", `${x}px`);
    host.style.setProperty("--ch-y", `${y}px`);
    host.style.setProperty("--mx", `${x - rect.width / 2}px`);
    host.style.setProperty("--my", `${y - rect.height / 2}px`);
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: BASE_CSS }} />

      <main
        onPointerMove={pointer ? trackPointer : undefined}
        className="relative flex min-h-dvh flex-col overflow-hidden bg-surface text-on-surface"
      >
        <HorizonBackground />

        <div className="relative mx-auto flex w-full max-w-[1200px] flex-1 flex-col px-4 py-4 md:px-8 md:py-12 xl:py-16">
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 left-0 hidden w-px bg-frame-line min-[1440px]:block"
          />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 right-0 hidden w-px bg-frame-line min-[1440px]:block"
          />

          <div className="ch-field relative mx-auto my-auto flex w-full max-w-[1136px] flex-col gap-3">
            <span
              aria-hidden="true"
              className="pointer-events-none absolute -inset-x-8 -top-16 hidden h-px bg-frame-line min-[1440px]:block"
            />
            <span
              aria-hidden="true"
              className="pointer-events-none absolute -inset-x-8 -bottom-16 hidden h-px bg-frame-line min-[1440px]:block"
            />

            {/* Top band: the tracker card, then the Play shell at its Figma size. */}
            <div className="flex gap-3">
              <a
                href="#"
                onClick={stopNavigation}
                aria-label="Contribution tracker, placeholder data"
                className="ch-card relative w-fit shrink-0 rounded-lg"
              >
                <RingLayers fill="bg-surface-container-low" />
                <TrackerWidget />
              </a>

              <a
                href="#"
                onClick={stopNavigation}
                aria-label="Play: interactive art"
                className="ch-card relative flex-1 rounded-lg"
              >
                <RingLayers fill="bg-surface-container-low" />
                <span
                  aria-hidden="true"
                  className="ch-fill absolute inset-0 overflow-hidden rounded-lg bg-surface-container-low shadow-card"
                />
              </a>
            </div>

            {/* Main band: 753 / 180 / 83 / 84 at 1440. */}
            <div className="grid gap-3 md:h-[560px] md:grid-cols-[444fr_120fr_52fr_52fr] lg:h-[360px] lg:grid-cols-[656fr_140fr_64fr_64fr] xl:h-[416px] xl:grid-cols-[753fr_180fr_83fr_84fr]">
              <a
                href="#"
                onClick={stopNavigation}
                className="ch-card relative flex h-[420px] flex-col justify-end rounded-lg bg-surface-container-low p-5 shadow-card md:h-auto md:p-8"
              >
                <RingLayers fill="bg-surface-container-low" />
                <h1 className="ch-ring-title text-title-sm font-semibold md:text-title">
                  Project name
                </h1>
              </a>

              {WORK_SLIVERS.map((sliver, index) => (
                <div
                  key={index}
                  aria-hidden="true"
                  className={`ch-card relative rounded-lg shadow-card md:h-auto ${sliver.fill} ${sliver.height}`}
                >
                  <RingLayers fill={sliver.fill} />
                </div>
              ))}
            </div>

            {nav === "items" ? (
              <RingNavItems />
            ) : nav === "bar" ? (
              <RingNavBar />
            ) : (
              <PrototypeNav />
            )}
          </div>
        </div>
      </main>
    </>
  );
}
