"use client";

import { useLayoutEffect, useRef } from "react";
import type { WorkMeta } from "@/lib/work";
import { BlurStack } from "./blur-stack";
import { ProtoToggles, useProtoLayout } from "./proto-layout-toggle";
import { WorkGrid } from "./work-grid";
import { WorkIndexList } from "./work-index-list";
import "./work-index.css";

export const INDEX_TITLE_ID = "wd-index-title";
export const INDEX_SCROLL_ID = "wd-index-scroll";

/**
 * Where the index was left. The drawer keeps this module alive while a study
 * takes the panel (the shell does not remount), so stepping back to the index
 * lands where it was; a study always opens at its own top, because its content
 * is new.
 */
let indexScroll = 0;

/**
 * The index inside the drawer: the whole set of studies, in the layout Dat is
 * still choosing (`?layout=grid|list`, keys G / L), with the back prototype
 * (`?close=a|b`, keys A / B) beside it.
 *
 * The column mirrors the reader's own: the same nav clearance at the top, the
 * same safe bottom padding, and one scroll container of its own.
 */
export function WorkIndex({ works }: { works: WorkMeta[] }) {
  const layout = useProtoLayout();
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    const scroll = scrollRef.current;
    if (!scroll) return;

    scroll.scrollTop = indexScroll;

    // Record every scroll rather than the element's last position on unmount:
    // by the time an unmount cleanup runs the node can already be detached, and
    // its scrollTop would read 0 over the real value.
    const record = () => {
      indexScroll = scroll.scrollTop;
    };

    scroll.addEventListener("scroll", record, { passive: true });

    return () => scroll.removeEventListener("scroll", record);
  }, []);

  return (
    <>
      <BlurStack height="calc(var(--wd-nav-inset) + var(--wd-nav-height))" />

      <div id={INDEX_SCROLL_ID} className="wd-index-scroll" ref={scrollRef}>
        <div className="wd-index-column">
          <header className="wd-index-head">
            <div className="wd-index-heading">
              <h1 id={INDEX_TITLE_ID} tabIndex={-1} className="wd-index-title">
                Work
              </h1>
              <p className="wd-index-count">{works.length} studies</p>
            </div>

            <ProtoToggles />
          </header>

          {layout === "grid" ? (
            <WorkGrid works={works} />
          ) : (
            <WorkIndexList works={works} />
          )}
        </div>
      </div>
    </>
  );
}
