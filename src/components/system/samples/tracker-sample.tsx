"use client";

import { useState } from "react";
import type { JSX } from "react";
import { RingLayers } from "@/components/home/ring-hover";
import type { ForceState } from "@/components/system/component-doc";
import "@/components/home/ring-hover.css";

const LEVEL_CLASSES = [
  "bg-tracker-0",
  "bg-tracker-1",
  "bg-tracker-2",
  "bg-tracker-3",
  "bg-tracker-4",
] as const;

const DAYS = 7;
const WEEKS = 32;
const BAND_CELLS = (WEEKS / 2) * DAYS;

/** Deterministic placeholder levels: 0 (empty) to 4 (busiest), as on the site. */
function levelFor(index: number): number {
  const value = Math.sin(index * 12.9898 + 4.1414) * 43758.5453;
  const fraction = value - Math.floor(value);

  if (fraction < 0.24) return 0;
  if (fraction < 0.48) return 1;
  if (fraction < 0.72) return 2;
  if (fraction < 0.9) return 3;
  return 4;
}

const CELLS = Array.from({ length: WEEKS * DAYS }, (_, index) =>
  levelFor(index),
);

function Cell({ level }: { level: number }): JSX.Element {
  return (
    <span
      className={`tracker-cell aspect-square rounded-xs ${LEVEL_CLASSES[level]}`}
    />
  );
}

/** 375: one 7x7 square. */
function MiniGrid({ cells }: { cells: number[] }): JSX.Element {
  return (
    <div className="grid grid-flow-col grid-cols-7 grid-rows-7 gap-[3px]">
      {cells.map((level, index) => (
        <Cell key={index} level={level} />
      ))}
    </div>
  );
}

/** 768 and up: two stacked 7-row bands of 16 weeks. */
function Band({ cells }: { cells: number[] }): JSX.Element {
  return (
    <div
      data-tracker-band
      className="grid grid-flow-col grid-cols-16 grid-rows-7 gap-[3px]"
    >
      {cells.map((level, index) => (
        <Cell key={index} level={level} />
      ))}
    </div>
  );
}

/**
 * The live tracker widget, mirrored: the square ring card, the mobile 7x7
 * mini grid, the two 16-week bands at 768+, the three-dot pager and the
 * deterministic placeholder levels. The live card has no caption or focusable
 * cells; the hover caption below is the documentation sample's addition.
 */
export function TrackerSample({
  forceState,
}: {
  forceState?: Extract<ForceState, "rest" | "hover">;
} = {}): JSX.Element {
  const [hovered, setHovered] = useState(false);
  const showCaption = forceState === "hover" || hovered;

  return (
    <div
      role="img"
      aria-label="Contribution tracker, placeholder data"
      data-state={forceState}
      data-tracker-sample
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      className="ring-host flex h-40 w-40 flex-col rounded-lg pt-[22px] pb-[22px] md:size-[220px] md:pt-[26px] xl:h-[276px] xl:w-[275px]"
    >
      <RingLayers fill="bg-surface-container-low" />

      <div className="mx-auto w-[98px] md:hidden">
        <MiniGrid cells={CELLS.slice(0, DAYS * 7)} />
      </div>

      <div className="mx-auto hidden w-[165px] flex-col gap-[9px] md:flex xl:w-[223px]">
        <Band cells={CELLS.slice(0, BAND_CELLS)} />
        <Band cells={CELLS.slice(BAND_CELLS)} />
      </div>

      <div className="mt-auto flex justify-center gap-1.5">
        <span
          data-tracker-dot
          className="size-1.5 rounded-full bg-tracker-4"
        />
        <span
          data-tracker-dot
          className="size-1.5 rounded-full bg-tracker-2"
        />
        <span
          data-tracker-dot
          className="size-1.5 rounded-full bg-tracker-2"
        />
      </div>

      {showCaption ? (
        <p
          data-testid="tracker-caption"
          data-tracker-caption
          className="pointer-events-none absolute inset-x-2 bottom-8 rounded-md bg-surface-container-high px-2 py-1 text-center text-[10px] leading-tight font-medium text-on-surface-variant shadow-card motion-reduce:transition-none"
        >
          Contribution tracker · placeholder data
        </p>
      ) : null}
    </div>
  );
}
