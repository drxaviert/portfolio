import type { ReactNode } from "react";
import { nextWork } from "@/lib/work";
import type { WorkMeta } from "@/lib/work";
import { Breadcrumb } from "./breadcrumb";
import { Intro, NextLink, READER_SCROLL_ID } from "./parts";
import { Hero } from "./media-parts";
import { ReaderMobileActions, ReaderRail } from "./reader-rail";
import { ScrollRuler } from "./scroll-ruler";
import { BlurStack } from "./blur-stack";
import "@/components/home/ring-hover.css";
import "./reader.css";
import "./entrance.css";

export { READER_SCROLL_ID, READER_TITLE_ID } from "./parts";

export type ReaderProps = {
  meta: WorkMeta;
  children: ReactNode;
};

/**
 * The drawer's study content: one scroll container, so the margin notes, the
 * wide breakouts and the sticky rail all measure against the same box.
 *
 * The panel itself — its inset, radius, shadow, dialog role and morph — belongs
 * to the drawer (`drawer-shell.tsx`), which is the same panel the index uses.
 * A study only fills it.
 */
export function Reader({ meta, children }: ReaderProps) {
  return (
    <>
      <BlurStack height="calc(var(--wd-nav-inset) + var(--wd-nav-height))" />

      <div id={READER_SCROLL_ID} className="wd-reader-scroll">
        <div className="wd-reader-back-row">
          <Breadcrumb title={meta.title} />
        </div>

        <div className="wd-reader-column">
          {/* The rail is anchored to the whole column, not to the article
              below the cover: "↑ Top" pins to the scroll area's foot from the
              first paint, and the rail still spans the full article. The way
              back to the index is the shared Breadcrumb above, not the rail. */}
          <div className="wd-rail">
            <ReaderRail />
          </div>

          <Hero scene={meta.cover} coverImage={meta.coverImage} />

          <div className="wd-reader-main">
            <Intro meta={meta} />

            <div className="wd-prose">{children}</div>

            <NextLink next={nextWork(meta.slug)} />
          </div>
        </div>
      </div>

      {/* Beside the scroll box, not inside it: the ruler marks the article's
          position and must not scroll away with it. */}
      <ScrollRuler studySlug={meta.slug} />

      {/* Below 1024px the reach-to-top button is fixed to the panel's foot,
          outside the scroll container so it stays put while the article moves.
          The way back is the shared Breadcrumb at the top, on every width. */}
      <ReaderMobileActions />
    </>
  );
}
