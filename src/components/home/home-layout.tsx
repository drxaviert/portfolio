import type { CSSProperties, ReactNode } from "react";
import { HorizonLive } from "@/components/horizon/horizon-live";
import { EntranceCell } from "./entrance-cell";
import type { EntranceVariant } from "./entrance-cell";
import { EntranceReplayGuard } from "./entrance-replay-guard";
import { HomeEntrancePlayed } from "./home-entrance";
import { EntranceGrain } from "./entrance-grain";
import { HomeCarousel } from "./carousel/home-carousel";
import type { CarouselItem } from "./carousel/home-carousel";
import { EMPTY_WORK_LABEL } from "./empty-work";
import { FrameLineSpotlight } from "./frame-line-spotlight";
import { PlayCard, ProjectCard, WorkSlivers } from "./home-cards";
import { NowPlayingCard } from "./now-playing-card";
import { TrackerWidget } from "./tracker-widget";
import { RingHoverPointer } from "./ring-pointer";
import "./ring-hover.css";

/*
 * Nominal xl frame: 780px content, a 64px bottom gap, and a 65px top gap (the
 * 64px gap plus the 1px top line) = 909px of ink. Fit against 910px: the extra
 * pixel is the column's centring slack, which keeps the top line at y=0
 * instead of 1px above the viewport. A 900px-tall viewport is shorter than
 * that, so the whole frame scales rather than clipping the lines. The 64px
 * gaps are kept as soon as 100dvh / --fit leaves room (1920x1080 unchanged).
 *
 * At 768-1279 the tablet frame takes over: its lines sit flush with the 868px
 * content column, so `--frame-gap-cap` is 0 and the gap collapses to the 1px
 * top line / 1px bottom offset (see globals.css).
 */
const frameGapStyle = {
  "--frame-gap":
    "clamp(0px, calc((100dvh / var(--fit) - 780px) / 2), var(--frame-gap-cap, 64px))",
} as CSSProperties;

/**
 * The home page layout, shared by / and /dev/prototype so both routes render
 * the same design. The dev route adds its tools (phase picker, glow tuner)
 * around this component and nothing else.
 *
 * Mirrors the final Figma frames (Day 121:2003, Night 121:3243): a 1200-wide
 * frame with 1px hairlines, a tracker card plus the Play card shell, the
 * 753/180/83/84 main band and the nav bar. From 768 to 1279 the 768 frame
 * (Home / Dawn / 768) replaces it: a 768x964 portrait frame with a 220px top
 * band (the dot-grid tracker), a 444/120/52/52 band and the same nav.
 *
 * Hover is the promoted "Ring + nav bar" language: every card and the nav bar
 * is one ring surface that grows into its own box and is lit by a glow in the
 * phase's horizon palette (see ring-hover.css).
 *
 * `entrance` wraps each card in an animation cell (the nav, which lives in the
 * root layout's dock, is reached from home-entrance.css) and puts
 * data-entrance on <main> for the variant CSS. `/` passes `entrance="soft"
 * shipped`, which adds the veil layer and the one-play-per-document gate; the
 * dev route passes a variant only and keeps its own overlay in the harness.
 *
 * `shipped` marks <main> so the entrance CSS can tell the production entrance
 * from the prototype's replays.
 */
export type HomeWorkSource = {
  title: string;
  onOpen: (element: HTMLElement) => void;
  slivers?: { title: string; onOpen: (element: HTMLElement) => void }[];
};

type HomeLayoutProps = {
  /**
   * Optional interactive hook: makes the work cards clickable and labels the
   * slivers. Omitted on /, where every card keeps its shipped, non-interactive
   * behaviour.
   */
  work?: HomeWorkSource;
  /**
   * The homepage's featured study. The card becomes the link into the
   * intercepted reader; the title is read on the server so the client graph
   * never touches the content loader.
   */
  featured?: {
    slug: string;
    title: string;
  };
  /**
   * The endless carousel items, front first. From md up they replace the
   * middle row; below md it stays the stacked featured card and slivers.
   */
  items?: CarouselItem[];
  entrance?: EntranceVariant;
  shipped?: boolean;
  /**
   * Optional server-rendered Play card. The shell is also imported by the
   * client-side entrance harness, so it may not fetch on its own: a server
   * route that owns the data passes the filled card here, and every client
   * preview keeps the empty shell. This is what removes the old environment
   * check and the Server Action call during initial render.
   */
  playCard?: ReactNode;
  /**
   * Draw the horizon inside this layout. The shipped routes pass false: the
   * root layout's SharedHorizon owns the one canvas above both routes. Dev
   * prototypes keep their own.
   */
  horizon?: boolean;
};

export function HomeLayout({
  work,
  featured,
  items,
  entrance,
  shipped = false,
  playCard,
  horizon = true,
}: HomeLayoutProps = {}) {
  const lead = items?.[0];
  const stacked =
    lead?.kind === "work"
      ? {
          slug: lead.slug,
          title: lead.title,
        }
      : featured;

  return (
    <main
      data-entrance={entrance}
      data-entrance-shipped={shipped ? "" : undefined}
      className={`relative flex min-h-dvh flex-col overflow-hidden text-on-surface ${
        horizon ? "bg-surface" : "bg-transparent"
      }`}
    >
      {horizon ? <HorizonLive /> : null}
      {shipped && entrance === "soft" ? <EntranceReplayGuard /> : null}
      {/* Prototype hook: the grain sits above the glow and under the cards,
          so it can only live between the two. Absent on `/`. */}
      {entrance === "grain" ? <EntranceGrain /> : null}
      <RingHoverPointer />

      <div
        data-home-frame=""
        className="relative mx-auto flex w-full max-w-[1200px] flex-1 flex-col px-4 py-4 md:px-8 md:py-15"
        style={frameGapStyle}
      >
        {/* Vertical frame lines: 1px hairlines on the frame's edges. The 768
            frame is 964 tall, so they run its full height; the xl frame is the
            910px ink box centred in the viewport, so they follow that box
            rather than the raw viewport (Figma 121:2009/121:2010). */}
        <span
          aria-hidden="true"
          data-frame-line="v"
          className="pointer-events-none absolute left-0 hidden w-px bg-frame-line md:block"
          style={{
            top: "var(--frame-line-top)",
            height: "var(--frame-line-height)",
          }}
        />
        <span
          aria-hidden="true"
          data-frame-line="v"
          className="pointer-events-none absolute right-0 hidden w-px bg-frame-line md:block"
          style={{
            top: "var(--frame-line-top)",
            height: "var(--frame-line-height)",
          }}
        />

        <div className="relative mx-auto my-auto flex w-full max-w-[1136px] flex-col gap-3">
          {/* Frame lines: the 1200-wide hairlines sit 65px above and 64px
              below the content column (Figma 121:2007/121:2008). */}
          <span
            aria-hidden="true"
            data-frame-line="h"
            className="pointer-events-none absolute -inset-x-8 hidden h-px bg-frame-line md:block"
            style={{ top: "calc(var(--frame-gap) * -1 - 1px)" }}
          />
          <span
            aria-hidden="true"
            data-frame-line="h"
            className="pointer-events-none absolute -inset-x-8 hidden h-px bg-frame-line md:block"
            style={{ bottom: "var(--frame-line-bottom)" }}
          />

          {/* Top band. The xl frame pairs the music card with the Play card
              (275 + 12 + 849 at 1440); the 768 frame pairs the dot-grid tracker
              with it (220 + 12 + 472). Both are 220/276 tall, so the visible
              card drives the row. */}
          <div className="flex gap-3">
            <EntranceCell
              variant={entrance}
              item={1}
              row={1}
              className="shrink-0"
            >
              <div className="hidden shrink-0 max-md:block xl:block">
                <NowPlayingCard />
              </div>
              <div className="hidden shrink-0 md:block xl:hidden">
                <TrackerWidget />
              </div>
            </EntranceCell>
            <EntranceCell
              variant={entrance}
              item={2}
              row={1}
              className="min-w-0 flex-1"
            >
              {playCard ?? <PlayCard />}
            </EntranceCell>
          </div>

          {items && items.length === 0 ? (
            // No studies yet: one line in the band's own height, in the same
            // place the cards would be. No stand-in card, no empty slot.
            <div className="flex h-[420px] items-center justify-center md:h-[416px]">
              <p className="text-base text-on-surface-variant">
                {EMPTY_WORK_LABEL}
              </p>
            </div>
          ) : items && !work ? (
            <>
              {/* Below md the row is the stacked featured card and slivers,
                  exactly as before; the carousel is md and up. Both carry the
                  entrance as items 3-6, and CSS shows only one of them. */}
              <div className="grid gap-3 md:hidden">
                <EntranceCell variant={entrance} item={3} row={2}>
                  <ProjectCard title={stacked?.title} slug={stacked?.slug} />
                </EntranceCell>
                <WorkSlivers entrance={entrance} />
              </div>
              <HomeCarousel items={items} entrance={entrance} />
            </>
          ) : (
            <div className="grid gap-3 md:h-[416px] md:grid-cols-[753fr_180fr_83fr_84fr]">
              <EntranceCell variant={entrance} item={3} row={2}>
                {work ? (
                  <ProjectCard title={work.title} onOpen={work.onOpen} />
                ) : (
                  <ProjectCard title={featured?.title} slug={featured?.slug} />
                )}
              </EntranceCell>
              <WorkSlivers items={work?.slivers} entrance={entrance} />
            </div>
          )}

          {/* The nav itself lives in the root layout, so one element carries
              from the homepage into the drawer. This slot reserves its box and
              gives the dock its home position. The slot keeps item 7 so the
              reading order stays whole; the nav's own entrance is applied to
              the dock in home-entrance.css. */}
          <EntranceCell variant={entrance} item={7} row={3}>
            <div className="h-16" aria-hidden="true" data-nav-slot="" />
          </EntranceCell>
        </div>

        <FrameLineSpotlight />
      </div>

      {/* The shipped entrance's veil: server-rendered so the first frame is
          already washed, CSS-only so it clears without JS, and cancelled by
          the played gate on a client-side return. */}
      {shipped && entrance === "soft" ? (
        <div aria-hidden="true" className="entrance-soft" />
      ) : null}
      {shipped ? <HomeEntrancePlayed /> : null}
    </main>
  );
}
