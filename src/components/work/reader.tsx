import type { ReactNode } from "react";
import { nextWork } from "@/lib/work";
import type { WorkMeta } from "@/lib/work";
import {
  Hero,
  Intro,
  NextLink,
  ProgressionLead,
  READER_SCROLL_ID,
  READER_TITLE_ID,
} from "./parts";
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
 * The drawer's reader: a fixed panel with a single scroll container, so the
 * margin notes, the wide breakouts and the sticky rail all measure against the
 * same box. Both a soft navigation and a direct load render this over the
 * homepage; only the shell around it differs (morph or resting).
 */
export function Reader({ meta, children }: ReaderProps) {
  return (
    <div
      className="wd-reader-panel"
      data-mode="overlay"
      role="dialog"
      // Deliberately not aria-modal: the one nav lives in the root layout, at
      // this panel's sibling, and must stay in the accessibility tree. The
      // homepage is inert and the focus trap holds, so the dialog is modal in
      // behaviour without telling screen readers to hide everything else.
      aria-labelledby={READER_TITLE_ID}
    >
      <ProgressionLead />

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

            <NextLink next={nextWork(meta.slug)} />
          </div>
        </div>
      </div>

      {/* Beside the scroll box, not inside it: the ruler marks the article's
          position and must not scroll away with it. */}
      <ScrollRuler studySlug={meta.slug} />

      {/* Below 1024px the ways back are fixed to the panel's foot, outside the
          scroll container so they stay put while the article moves. */}
      <ReaderMobileActions />
    </div>
  );
}
