import type { ReactNode } from "react";
import { nextWork } from "@/lib/work";
import type { WorkMeta } from "@/lib/work";
import { Hero, Intro, NextLink, READER_TITLE_ID } from "./parts";
import "./reader.css";

export { READER_TITLE_ID } from "./parts";

export const READER_SCROLL_ID = "wd-reader-scroll";

export type ReaderMode = "overlay" | "page";

export type ReaderProps = {
  meta: WorkMeta;
  children: ReactNode;
  /** `overlay` is the dialog over the homepage; `page` is a direct load. */
  mode: ReaderMode;
};

/**
 * One reader for both routes: a fixed panel with a single scroll container, so
 * the margin notes, the wide breakouts and (later) the sticky rail all measure
 * against the same box.
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
      <div id={READER_SCROLL_ID} className="wd-reader-scroll">
        <div className="wd-reader-column">
          <Hero />

          <div className="wd-reader-main">
            <div className="wd-rail" />

            <Intro meta={meta} />

            <div className="wd-prose">{children}</div>

            <NextLink next={nextWork(meta.slug)} />
          </div>
        </div>
      </div>
    </Panel>
  );
}
