/**
 * Prototype-only stand-in for the top-left widget card (Figma "emoji" 121:2022).
 *
 * Figma fills the card with the GitHub contribution tracker: square cells,
 * radius 2, 3px gaps and a 3-dot pager. The card is 160 at 375, 220 at 768/1024
 * and 275x276 at 1440. At 375 the grid is a 7x7 square (98x98, 11.43px cells);
 * from 768 up it is two stacked bands of 7 rows x 16 weeks (165x150, 7.5px
 * cells; 223x200.75 and 11.125px cells at 1440), with 9px between bands. The
 * pager sits 22px above the card bottom. Levels are placeholder data drawn from
 * the tracker ramp, so all four phases recolour it.
 */
import { RingLayers } from "./ring-hover";

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

/** Deterministic placeholder levels: 0 (empty) to 4 (busiest). */
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

function Cell({ level }: { level: number }) {
  return (
    <span
      className={`tracker-cell aspect-square rounded-[2px] ${LEVEL_CLASSES[level]}`}
    />
  );
}

/** 375: one 7x7 square. */
function MiniGrid({ cells }: { cells: number[] }) {
  return (
    <div className="grid grid-flow-col grid-cols-7 grid-rows-7 gap-[3px]">
      {cells.map((level, index) => (
        <Cell key={index} level={level} />
      ))}
    </div>
  );
}

/** 768 and up: two stacked 7-row bands of 16 weeks. */
function Band({ cells }: { cells: number[] }) {
  return (
    <div className="grid grid-flow-col grid-cols-16 grid-rows-7 gap-[3px]">
      {cells.map((level, index) => (
        <Cell key={index} level={level} />
      ))}
    </div>
  );
}

export function TrackerWidget() {
  return (
    <div
      role="img"
      aria-label="Contribution tracker, placeholder data"
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
        <span className="size-1.5 rounded-full bg-tracker-4" />
        <span className="size-1.5 rounded-full bg-tracker-2" />
        <span className="size-1.5 rounded-full bg-tracker-2" />
      </div>
    </div>
  );
}
