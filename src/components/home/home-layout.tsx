import type { CSSProperties } from "react";
import { HorizonLive } from "@/components/horizon/horizon-live";
import { FrameLineSpotlight } from "./frame-line-spotlight";
import { PlayCard, ProjectCard, WorkSlivers } from "./home-cards";
import { HomeNav } from "./home-nav";
import { RingHoverPointer } from "./ring-pointer";
import { TrackerWidget } from "./tracker-widget";
import "./ring-hover.css";

/*
 * Nominal frame: 780px content + 2 x 64px gaps = 908px. A 900px-tall viewport
 * overflows that by 8px, so the horizontal lines fall outside the frame and
 * are clipped. Shrink the gaps to the space available; 64px is kept as soon
 * as 100dvh leaves room (1920x1080 is unchanged).
 */
const frameGapStyle = {
  "--frame-gap": "clamp(0px, calc((100dvh - 780px) / 2), 64px)",
} as CSSProperties;

/**
 * The home page layout, shared by / and /dev/prototype so both routes render
 * the same design. The dev route adds its tools (phase picker, glow tuner)
 * around this component and nothing else.
 *
 * Mirrors the final Figma frames (Day 121:2003, Night 121:3243): a 1200-wide
 * frame with 1px hairlines, a tracker card plus the Play card shell, the
 * 753/180/83/84 main band and the nav bar.
 *
 * Hover is the promoted "Ring + nav bar" language: every card and the nav bar
 * is one ring surface that grows into its own box and is lit by a glow in the
 * phase's horizon palette (see ring-hover.css).
 */
export function HomeLayout() {
  return (
    <main className="relative flex min-h-dvh flex-col overflow-hidden bg-surface text-on-surface">
      <HorizonLive />
      <RingHoverPointer />

      <div
        className="relative mx-auto flex w-full max-w-[1200px] flex-1 flex-col px-4 py-4 md:px-8 md:py-12 xl:py-[60px]"
        style={frameGapStyle}
      >
        {/* Vertical frame lines: 1px hairlines on the content-column edges,
            full frame height (Figma 121:2009/121:2010). */}
        <span
          aria-hidden="true"
          data-frame-line="v"
          className="pointer-events-none absolute inset-y-0 left-0 hidden w-px bg-frame-line min-[1440px]:block"
        />
        <span
          aria-hidden="true"
          data-frame-line="v"
          className="pointer-events-none absolute inset-y-0 right-0 hidden w-px bg-frame-line min-[1440px]:block"
        />

        <div className="relative mx-auto my-auto flex w-full max-w-[1136px] flex-col gap-3">
          {/* Frame lines: the 1200-wide hairlines sit 65px above and 64px
              below the content column (Figma 121:2007/121:2008). */}
          <span
            aria-hidden="true"
            data-frame-line="h"
            className="pointer-events-none absolute -inset-x-8 hidden h-px bg-frame-line min-[1440px]:block"
            style={{ top: "calc(var(--frame-gap) * -1 - 1px)" }}
          />
          <span
            aria-hidden="true"
            data-frame-line="h"
            className="pointer-events-none absolute -inset-x-8 hidden h-px bg-frame-line min-[1440px]:block"
            style={{ bottom: "calc(var(--frame-gap) * -1)" }}
          />

          {/* Top band: the widget card, then the Play card's empty shell at
              its Figma size (275 + 12 + 849 at 1440). No generative art. */}
          <div className="flex gap-3">
            <TrackerWidget />
            <PlayCard />
          </div>

          <div className="grid gap-3 md:h-[560px] md:grid-cols-[444fr_120fr_52fr_52fr] lg:h-[360px] lg:grid-cols-[656fr_140fr_64fr_64fr] xl:h-[416px] xl:grid-cols-[753fr_180fr_83fr_84fr]">
            <ProjectCard />
            <WorkSlivers />
          </div>

          <HomeNav />
        </div>

        <FrameLineSpotlight />
      </div>
    </main>
  );
}
