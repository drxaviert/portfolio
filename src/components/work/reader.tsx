import type { ReactNode } from "react";
import { nextWork } from "@/lib/work";
import type { WorkMeta } from "@/lib/work";
import {
  Hero,
  Intro,
  NextLink,
  READER_SCROLL_ID,
  READER_TITLE_ID,
} from "./parts";
import { ReaderNavSlot } from "./reader-nav";
import { ReaderMobileActions, ReaderRail } from "./reader-rail";
import { BlurStack } from "./blur-stack";
import "@/components/home/ring-hover.css";
import "./reader.css";

export { READER_SCROLL_ID, READER_TITLE_ID } from "./parts";

export type ReaderMode = "overlay" | "page";

export type ReaderProps = {
  meta: WorkMeta;
  children: ReactNode;
  /** `overlay` is the dialog over the homepage; `page` is a direct load. */
  mode: ReaderMode;
};

/**
 * One reader for both routes: a fixed panel with a single scroll container, so
 * the margin notes, the wide breakouts and the sticky rail all measure against
 * the same box.
 */
export function Reader({ meta, children, mode }: ReaderProps) {
  const overlay = mode === "overlay";
  const Panel = overlay ? "div" : "main";

  return (
    <Panel
      className="wd-reader-panel"
      data-mode={mode}
      role={overlay ? "dialog" : undefined}
      aria-modal={overlay ? true : undefined}
      aria-labelledby={READER_TITLE_ID}
    >
      <ReaderNavSlot />

      <BlurStack height="calc(var(--wd-nav-inset) + var(--wd-nav-height))" />

      <div id={READER_SCROLL_ID} className="wd-reader-scroll">
        <div className="wd-reader-column">
          {/* The rail is anchored to the whole column, not to the article
              below the cover: "← Work" pins to the scroll area's top from the
              first paint, and the rail still spans the full article for the
              foot's "↑ Top". */}
          <div className="wd-rail">
            <ReaderRail />
          </div>

          <Hero scene={meta.cover} />

          <div className="wd-reader-main">
            <Intro meta={meta} />

            <div className="wd-prose">{children}</div>

            <NextLink next={nextWork(meta.slug)} replace={overlay} />
          </div>
        </div>
      </div>

      {/* Below 1024px the ways back are fixed to the panel's foot, outside the
          scroll container so they stay put while the article moves. */}
      <ReaderMobileActions />
    </Panel>
  );
}
