"use client";

import { useEffect, useRef, useState } from "react";
import type { CSSProperties, MouseEvent, PointerEvent } from "react";
import {
  clamp01,
  nearestSection,
  placeSectionTicks,
  rulerTickCount,
  uniqueHeadingId,
} from "./ruler-model";
import { READER_SCROLL_ID } from "./parts";
import "./scroll-ruler.css";

/**
 * The study reader's scroll ruler: a dense tick column at the right edge of the
 * scroll area. The long bright tick is where you are; the longer ticks are the
 * article's `##` sections, hoverable for their name and clickable to jump.
 *
 * It is built from the rendered DOM, not from the MDX source: any study with
 * `##` headings gets a ruler with no per-study code or config. Headings arrive
 * without ids, so this assigns them (slugified, de-duplicated) as it measures.
 */
export type ScrollRulerProps = {
  /** Re-measures when the reader swaps article (study to study). */
  studySlug: string;
};

type RulerSection = {
  id: string;
  label: string;
  /** Section start, 0–1 of the scrollable height. */
  progress: number;
  /** Index on the tick grid, where this section is drawn. */
  tick: number;
};

type RulerLayout = {
  ticks: number;
  sections: RulerSection[];
  scrollable: boolean;
};

const EMPTY_LAYOUT: RulerLayout = { ticks: 0, sections: [], scrollable: false };

function reducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** The heading's scroll-margin keeps it clear of the reader's blur band. */
function clearanceOf(heading: HTMLElement) {
  return Number.parseFloat(getComputedStyle(heading).scrollMarginTop) || 0;
}

export function ScrollRuler({ studySlug }: ScrollRulerProps) {
  const navRef = useRef<HTMLElement>(null);
  const trackRef = useRef<HTMLOListElement>(null);
  const scrollRef = useRef<HTMLElement | null>(null);
  const layoutRef = useRef<RulerLayout>(EMPTY_LAYOUT);
  const signatureRef = useRef("");

  const [layout, setLayout] = useState<RulerLayout | null>(null);
  const [active, setActive] = useState(-1);

  useEffect(() => {
    layoutRef.current = layout ?? EMPTY_LAYOUT;
  }, [layout]);

  useEffect(() => {
    const scrollEl = document.getElementById(READER_SCROLL_ID);
    if (!scrollEl) return;
    scrollRef.current = scrollEl;

    let frame = 0;

    // Scroll fires far more often than the indicator can change, so the write
    // is coalesced into one frame and touches one custom property.
    const writeProgress = () => {
      frame = 0;
      const max = scrollEl.scrollHeight - scrollEl.clientHeight;
      const progress = max > 0 ? clamp01(scrollEl.scrollTop / max) : 0;
      navRef.current?.style.setProperty(
        "--wd-ruler-progress",
        progress.toFixed(4),
      );
    };

    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(writeProgress);
    };

    const measure = () => {
      const max = scrollEl.scrollHeight - scrollEl.clientHeight;
      const scrollable = max > 1;
      const headings = [
        ...scrollEl.querySelectorAll<HTMLElement>(".wd-prose h2"),
      ];

      // A study with no real structure gets the progress tick and nothing else:
      // one heading is not a list to navigate.
      const used = new Set<string>();
      const starts: number[] = [];
      const entries = headings.map((heading) => {
        const label = heading.textContent?.trim() || "Section";
        const id = heading.id || uniqueHeadingId(label, used);
        used.add(id);

        const offset =
          heading.getBoundingClientRect().top -
          scrollEl.getBoundingClientRect().top +
          scrollEl.scrollTop -
          clearanceOf(heading);

        starts.push(max > 0 ? clamp01(offset / max) : 0);
        return { heading, id, label };
      });

      let sections: RulerSection[] = [];

      if (scrollable && entries.length > 1) {
        const placed = placeSectionTicks(
          starts,
          rulerTickCount(entries.length),
        );

        sections = entries.map(({ heading, id, label }, index) => {
          if (!heading.id) heading.id = id;
          return { id, label, progress: starts[index], tick: placed[index] };
        });
      }

      const ticks = sections.length > 0 ? rulerTickCount(sections.length) : 0;
      const signature = `${scrollable}|${ticks}|${sections
        .map((section) => `${section.id}@${section.tick}:${section.progress}`)
        .join("|")}`;

      if (signature !== signatureRef.current) {
        signatureRef.current = signature;
        setActive(-1);
        setLayout({ ticks, sections, scrollable });
      }

      writeProgress();
    };

    measure();

    scrollEl.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", measure);

    const resize = new ResizeObserver(measure);
    resize.observe(scrollEl);
    // The column carries the article: a late font or image reflows it, and the
    // observer is what catches that without listening to every resource.
    const column = scrollEl.firstElementChild;
    if (column) resize.observe(column);

    // While the panel morphs it is scaled, so a rect read now would be short.
    // The reveal is the first frame at its real size.
    const layer = scrollEl.closest(".wd-expand-layer");
    const reveal = new MutationObserver(measure);
    if (layer) {
      reveal.observe(layer, {
        attributes: true,
        attributeFilter: ["data-reveal"],
      });
    }

    void document.fonts?.ready.then(measure);

    return () => {
      scrollEl.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", measure);
      resize.disconnect();
      reveal.disconnect();
      if (frame) cancelAnimationFrame(frame);
    };
  }, [studySlug]);

  /** The section nearest a pointer height, by where its tick is drawn. */
  function sectionAt(clientY: number) {
    const current = layoutRef.current;
    const track = trackRef.current;
    if (!track || current.sections.length === 0) return -1;

    const box = track.getBoundingClientRect();
    if (box.height <= 0) return -1;

    const progress = clamp01((clientY - box.top) / box.height);
    const last = Math.max(1, current.ticks - 1);

    return nearestSection(
      current.sections.map((section) => section.tick / last),
      progress,
    );
  }

  function jumpToSection(index: number) {
    const section = layoutRef.current.sections[index];
    const scrollEl = scrollRef.current;
    if (!section || !scrollEl) return;

    const heading = document.getElementById(section.id);
    if (!heading) return;

    const top =
      heading.getBoundingClientRect().top -
      scrollEl.getBoundingClientRect().top +
      scrollEl.scrollTop -
      clearanceOf(heading);

    scrollEl.scrollTo({
      top: Math.max(0, top),
      behavior: reducedMotion() ? "auto" : "smooth",
    });
  }

  function onTrackClick(event: MouseEvent<HTMLElement>, index: number) {
    // Modified clicks keep the browser's own behaviour: the link's hash is real.
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }

    event.preventDefault();
    jumpToSection(index);
  }

  /** A click anywhere in the column snaps to the nearest section. */
  function onClick(event: MouseEvent<HTMLElement>) {
    if (event.defaultPrevented) return;

    const index = sectionAt(event.clientY);
    if (index < 0) return;

    onTrackClick(event, index);
  }

  function onPointerMove(event: PointerEvent<HTMLElement>) {
    const index = sectionAt(event.clientY);
    if (index >= 0) setActive(index);
  }

  /** Hover and focus both park the label; leaving the column releases it. */
  function release() {
    if (!navRef.current?.contains(document.activeElement)) setActive(-1);
  }

  if (!layout) {
    // The first measure runs after mount; an empty, hidden nav keeps the
    // server markup and the first client render identical.
    return <nav ref={navRef} className="wd-ruler" aria-label="Sections" />;
  }

  const sectionByTick = new Map(
    layout.sections.map((section, index) => [section.tick, { section, index }]),
  );
  const activeSection = active >= 0 ? layout.sections[active] : undefined;

  const style = {
    "--wd-ruler-travel": `calc(${Math.max(0, layout.ticks - 1)} * var(--wd-ruler-step))`,
    "--wd-ruler-label-y": `calc(${activeSection?.tick ?? 0} * var(--wd-ruler-step))`,
  } as CSSProperties;

  return (
    <nav
      ref={navRef}
      className="wd-ruler"
      aria-label="Sections"
      data-visible={layout.scrollable}
      data-active={active >= 0}
      style={style}
      onClick={onClick}
      onPointerMove={onPointerMove}
      onPointerLeave={release}
    >
      <ol className="wd-ruler-track" ref={trackRef}>
        {Array.from({ length: layout.ticks }, (_, tick) => {
          const entry = sectionByTick.get(tick);

          return (
            <li className="wd-ruler-slot" key={tick}>
              {entry ? (
                <a
                  className="wd-ruler-tick wd-ruler-tick-section"
                  href={`#${entry.section.id}`}
                  aria-label={entry.section.label}
                  data-active={entry.index === active}
                  onFocus={() => setActive(entry.index)}
                  onBlur={release}
                  onClick={(event) => onTrackClick(event, entry.index)}
                />
              ) : (
                <span className="wd-ruler-tick" aria-hidden="true" />
              )}
            </li>
          );
        })}
      </ol>

      <span className="wd-ruler-indicator" aria-hidden="true" />

      <span className="wd-ruler-label" aria-hidden="true">
        {activeSection?.label ?? ""}
      </span>
    </nav>
  );
}
