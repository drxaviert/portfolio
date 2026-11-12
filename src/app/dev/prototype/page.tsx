import { notFound } from "next/navigation";
import { HorizonBackground } from "@/components/horizon/horizon-background";
import { GlowTuner } from "./glow-tuner";
import { PhasePicker } from "./phase-picker";
import { PrototypeNav } from "./prototype-nav";
import { RingLayers } from "./ring-hover";
import { RingHoverPointer } from "./ring-pointer";
import { TrackerWidget } from "./tracker-widget";
import "./ring-hover.css";

/**
 * Static homepage prototype for the final Figma frames (Day 121:2003, Night
 * 121:3243). It reuses the phase tokens and theme components; the nav's toggle
 * still switches Day / Night / Auto, and the dev-only phase picker (bottom
 * right) previews any phase without waiting for the clock.
 *
 * Hover is the promoted "Ring + nav bar" language: every card and the nav bar
 * is one ring surface that grows into its own box and is lit by a glow in the
 * phase's horizon palette (see ring-hover.css).
 *
 * Omitted on purpose: the Play card's generative art (the 849x276 shell stays,
 * with no src/components/play import) and the work-card corner button. Work
 * cards have no content in Figma; the highlight card carries the placeholder
 * title.
 */
export const metadata = {
  title: "Prototype · home",
  robots: { index: false, follow: false },
};

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

export default function PrototypePage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  return (
    <>
      <main className="relative flex min-h-dvh flex-col overflow-hidden bg-surface text-on-surface">
        <HorizonBackground />
        <RingHoverPointer />

        <div className="relative mx-auto flex w-full max-w-[1200px] flex-1 flex-col px-4 py-4 md:px-8 md:py-12 xl:py-16">
          {/* Vertical frame lines: 1px hairlines on the content-column edges,
              full frame height (Figma 121:2009/121:2010). */}
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 left-0 hidden w-px bg-frame-line min-[1440px]:block"
          />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 right-0 hidden w-px bg-frame-line min-[1440px]:block"
          />

          <div className="relative mx-auto my-auto flex w-full max-w-[1136px] flex-col gap-3">
            {/* Frame lines: the 1200-wide hairlines sit 64px above and below
                the content column (Figma 121:2007/121:2008). */}
            <span
              aria-hidden="true"
              className="pointer-events-none absolute -inset-x-8 -top-16 hidden h-px bg-frame-line min-[1440px]:block"
            />
            <span
              aria-hidden="true"
              className="pointer-events-none absolute -inset-x-8 -bottom-16 hidden h-px bg-frame-line min-[1440px]:block"
            />

            {/* Top band: the widget card, then the Play card's empty shell at
                its Figma size (275 + 12 + 849 at 1440). No generative art. */}
            <div className="flex gap-3">
              <TrackerWidget />
              <div aria-hidden="true" className="ring-host flex-1 rounded-lg">
                <RingLayers fill="bg-surface-container-low" />
              </div>
            </div>

            {/* Main band: 753 / 180 / 83 / 84 at 1440, 444 / 120 / 52 / 52 at
                768, 656 / 140 / 64 / 64 at 1024, 12px gutters. */}
            <div className="grid gap-3 md:h-[560px] md:grid-cols-[444fr_120fr_52fr_52fr] lg:h-[360px] lg:grid-cols-[656fr_140fr_64fr_64fr] xl:h-[416px] xl:grid-cols-[753fr_180fr_83fr_84fr]">
              <article className="ring-host flex h-[420px] flex-col justify-end rounded-lg p-5 md:h-auto md:p-8">
                <RingLayers fill="bg-surface-container-low" />
                <h1 className="ring-title text-title-sm font-semibold md:text-title">
                  Project name
                </h1>
              </article>

              {WORK_SLIVERS.map((sliver, index) => (
                <div
                  key={index}
                  aria-hidden="true"
                  className={`ring-host rounded-lg md:h-auto ${sliver.height}`}
                >
                  <RingLayers fill={sliver.fill} />
                </div>
              ))}
            </div>

            <PrototypeNav />
          </div>
        </div>
      </main>

      <PhasePicker />
      <GlowTuner />
    </>
  );
}
