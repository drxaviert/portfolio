import { RingLayers } from "./ring-hover";

/**
 * The home page's cards, shared by / and /dev/prototype.
 *
 * The main band is 753 / 180 / 83 / 84 at 1440, 656 / 140 / 64 / 64 at 1024,
 * 444 / 120 / 52 / 52 at 768, with 12px gutters. Work slivers have no content
 * in Figma, so they are decorative stand-ins; the highlight card carries the
 * placeholder project title.
 */

const WORK_SLIVERS = [
  { fill: "bg-surface-container", height: "h-[72px]" },
  {
    fill: "bg-surface dark:bg-surface-container-high",
    height: "h-14",
  },
  {
    fill: "bg-surface dark:bg-surface-container-highest",
    height: "h-14",
  },
];

/** Highlight card: the only card with a title. */
export function ProjectCard() {
  return (
    <article className="ring-host flex h-[420px] flex-col justify-end rounded-lg p-5 md:h-auto md:p-8">
      <RingLayers fill="bg-surface-container-low" />
      <h1 className="ring-title text-balance text-title-sm font-semibold md:text-title">
        Project name
      </h1>
    </article>
  );
}

/** Decorative work-column stand-ins; empty by design. */
export function WorkSlivers() {
  return (
    <>
      {WORK_SLIVERS.map((sliver, index) => (
        <div
          key={index}
          aria-hidden="true"
          className={`ring-host rounded-lg md:h-auto ${sliver.height}`}
        >
          <RingLayers fill={sliver.fill} />
        </div>
      ))}
    </>
  );
}

/**
 * Play card shell at its Figma size. The generative art is paused, so the card
 * renders as the empty ring surface (no src/components/play import).
 */
export function PlayCard() {
  return (
    <div aria-hidden="true" className="ring-host flex-1 rounded-lg">
      <RingLayers fill="bg-surface-container-low" />
    </div>
  );
}
