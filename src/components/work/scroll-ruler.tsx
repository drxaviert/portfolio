"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties, MouseEvent, PointerEvent } from "react";
import {
  blockSpan,
  clamp01,
  collapseText,
  pickBlock,
  placeSectionTicks,
  rulerTickCount,
  tickAt,
  uniqueHeadingId,
} from "./ruler-model";
import type { BlockSpan } from "./ruler-model";
import { READER_SCROLL_ID } from "./parts";
import "./scroll-ruler.css";

/**
 * The study reader's scroll ruler: a dense tick column beside the article's
 * text column, 40px off its right edge. The long bright tick is where you are;
 * every tick is a point in the article, and hovering one grows it and opens a
 * preview of the text that lives there. Clicking jumps to it.
 *
 * It is built from the rendered DOM, not from the MDX source, so any study gets
 * a working ruler with no per-study code or config. Headings arrive without
 * ids, so this assigns them (slugified, de-duplicated) as it measures.
 *
 * The column is centred and capped, so its right edge moves at every breakpoint
 * and whenever the panel does. The ruler reads that edge on every measure and
 * hides itself when the panel leaves it less than a gap plus its own width.
 */
export type ScrollRulerProps = {
  /** Re-measures when the reader swaps article (study to study). */
  studySlug: string;
};

type RulerSection = {
  id: string;
  label: string;
  /** Index on the tick grid, where this section is drawn. */
  tick: number;
};

/** What a tick's preview says: the section it sits in, and the text there. */
type RulerCard = { title: string; excerpt: string };

type RulerLayout = {
  ticks: number;
  sections: RulerSection[];
  cards: RulerCard[];
  scrollable: boolean;
  /** A scroller with enough room beside the column to hold the ruler. */
  visible: boolean;
};

/** Where a tick jumps to, measured in the scroll container's own coordinates. */
type RulerTarget = { element: HTMLElement; top: number };

const EMPTY_LAYOUT: RulerLayout = {
  ticks: 0,
  sections: [],
  cards: [],
  scrollable: false,
  visible: false,
};

const EMPTY_CARD: RulerCard = { title: "", excerpt: "" };

/** Space between the text column's right edge and the ruler column. */
const RULER_GAP = 40;
/** The least the ruler may leave between itself and the panel's right edge. */
const RULER_CLEARANCE = 16;
/** Mirrors `--wd-ruler-width`, for a layout read before CSS is applied. */
const RULER_WIDTH_FALLBACK = 18;

function reducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** The scroll-margin keeps a landing clear of the reader's blur band. */
function clearanceOf(element: HTMLElement) {
  return Number.parseFloat(getComputedStyle(element).scrollMarginTop) || 0;
}

/** A block's preview text: a figure speaks through its caption. */
function textOf(element: HTMLElement) {
  const source = element.querySelector("figcaption") ?? element;
  return collapseText(source.textContent ?? "");
}

export function ScrollRuler({ studySlug }: ScrollRulerProps) {
  const navRef = useRef<HTMLElement>(null);
  const trackRef = useRef<HTMLOListElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLElement | null>(null);
  const layoutRef = useRef<RulerLayout>(EMPTY_LAYOUT);
  const targetsRef = useRef<RulerTarget[]>([]);
  const signatureRef = useRef("");

  const [layout, setLayout] = useState<RulerLayout | null>(null);
  // Hover and focus are separate: clicking a tick blurs the section link, and
  // the pointer is still on the ruler, so the preview must not close under it.
  const [hovered, setHovered] = useState(-1);
  const [focused, setFocused] = useState(-1);
  const active = hovered >= 0 ? hovered : focused;

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
      const scrollRect = scrollEl.getBoundingClientRect();
      const prose = scrollEl.querySelector<HTMLElement>(".wd-prose");

      // The ruler sits beside the text column, so it is placed from the
      // column's own right edge rather than from the panel's: the column is
      // centred and capped, and that edge moves at every breakpoint. The room
      // the panel leaves on that side is the one measured number CSS cannot
      // know; the gap, the ruler width and the clearance all come from the
      // component's own variables, so there is one source for each.
      const nav = navRef.current;
      const panel = nav?.closest<HTMLElement>(".wd-reader-panel");
      const column = scrollEl.querySelector<HTMLElement>(".wd-reader-column");

      let roomForRuler = false;

      if (nav && panel && column) {
        const width =
          Number.parseFloat(
            getComputedStyle(nav).getPropertyValue("--wd-ruler-width"),
          ) || RULER_WIDTH_FALLBACK;
        const room =
          panel.getBoundingClientRect().right -
          column.getBoundingClientRect().right;

        roomForRuler = room >= RULER_GAP + width + RULER_CLEARANCE;
        // The column is centred and capped, so its edge moves at every
        // breakpoint; this is the one offset that has to be measured.
        nav.style.setProperty(
          "--wd-ruler-right",
          `${room - RULER_GAP - width}px`,
        );
      }

      // The article's own blocks, in reading order: a tick previews whichever
      // one sits at its scroll position, so headings, paragraphs, figures and
      // notes are all first-class marks.
      const blocks = prose ? ([...prose.children] as HTMLElement[]) : [];
      const intro = collapseText(
        scrollEl.querySelector(".wd-intro-title")?.textContent ?? "",
      );

      const spans: BlockSpan[] = blocks.map((block) => {
        const box = block.getBoundingClientRect();
        const offset = box.top - scrollRect.top + scrollEl.scrollTop;

        return blockSpan(offset, box.height, clearanceOf(block));
      });

      const used = new Set<string>();
      const headings = blocks.filter((block) => block.tagName === "H2");
      const sectionOf = new Map<HTMLElement, { id: string; label: string }>();

      const starts = headings.map((heading) => {
        const label = collapseText(heading.textContent ?? "") || "Section";
        const id = heading.id || uniqueHeadingId(label, used);
        used.add(id);
        sectionOf.set(heading, { id, label });

        const top = heading.getBoundingClientRect().top - scrollRect.top;
        const offset = top + scrollEl.scrollTop - clearanceOf(heading);

        return max > 0 ? clamp01(offset / max) : 0;
      });

      // One preview per block: a heading names its own section and borrows the
      // first thing under it; anything else takes the section it sits in.
      const blockCards: RulerCard[] = [];
      let sectionTitle = intro || "Top";

      blocks.forEach((block, index) => {
        const own = textOf(block);

        if (block.tagName === "H2") {
          sectionTitle = own || sectionTitle;
          const next = blocks
            .slice(index + 1)
            .find((candidate) => candidate.tagName !== "H2");
          blockCards.push({
            title: sectionTitle,
            excerpt: next ? textOf(next) : own,
          });
          return;
        }

        blockCards.push({ title: sectionTitle, excerpt: own });
      });

      let sections: RulerSection[] = [];

      if (scrollable && headings.length > 1) {
        const placed = placeSectionTicks(
          starts,
          rulerTickCount(headings.length),
        );

        sections = headings.map((heading, index) => {
          const info = sectionOf.get(heading);
          if (!info) throw new Error("heading lost its section");

          if (!heading.id) heading.id = info.id;

          return { id: info.id, label: info.label, tick: placed[index] };
        });
      }

      const ticks = scrollable ? rulerTickCount(sections.length) : 0;
      const cards: RulerCard[] = [];
      const targets: RulerTarget[] = [];

      for (let tick = 0; tick < ticks; tick += 1) {
        const position = ticks > 1 ? (tick / (ticks - 1)) * max : 0;
        const index = pickBlock(spans, position);
        const block = index >= 0 ? blocks[index] : null;

        cards.push(
          index >= 0
            ? blockCards[index]
            : { title: intro || "Top", excerpt: "" },
        );
        targets.push(
          block
            ? {
                element: block,
                top: Math.max(0, spans[index].top),
              }
            : { element: scrollEl, top: 0 },
        );
      }

      // A section tick is the section's own mark, whatever block happens to be
      // at that row: its link, its card and its landing all say the heading.
      sections.forEach((section) => {
        const heading = headings.find(
          (candidate) => candidate.id === section.id,
        );
        if (!heading) return;

        const index = blocks.indexOf(heading);
        cards[section.tick] = blockCards[index];
        targets[section.tick] = {
          element: heading,
          top: Math.max(0, spans[index].top),
        };
      });

      targetsRef.current = targets;

      const signature = [
        scrollable,
        roomForRuler,
        ticks,
        sections.map((section) => `${section.id}@${section.tick}`).join(","),
        cards.map((card) => `${card.title}~${card.excerpt}`).join("|"),
      ].join("|");

      if (signature !== signatureRef.current) {
        signatureRef.current = signature;
        setHovered(-1);
        setFocused(-1);
        setLayout({
          ticks,
          sections,
          cards,
          scrollable,
          visible: scrollable && roomForRuler,
        });
      }

      writeProgress();
    };

    measure();

    scrollEl.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", measure);

    // The entrance moves every block by up to 10px, so a measure taken while it
    // runs is short by that much. It ends once per block; the frame coalesces
    // them into one more read of the settled layout.
    let settleFrame = 0;
    const onEntranceEnd = () => {
      if (settleFrame) return;
      settleFrame = requestAnimationFrame(() => {
        settleFrame = 0;
        measure();
      });
    };
    scrollEl.addEventListener("animationend", onEntranceEnd);

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
        // The reveal releases the content mid-morph; the phase settles it. Both
        // move the panel, and the panel's box is what the ruler is placed from.
        attributeFilter: ["data-reveal", "data-phase"],
      });
    }

    void document.fonts?.ready.then(measure);

    return () => {
      scrollEl.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", measure);
      scrollEl.removeEventListener("animationend", onEntranceEnd);
      resize.disconnect();
      reveal.disconnect();
      if (frame) cancelAnimationFrame(frame);
      if (settleFrame) cancelAnimationFrame(settleFrame);
    };
  }, [studySlug]);

  /**
   * The preview is centred on its tick but never leaves the reader: at the top
   * and bottom rows it slides inward instead of being cut off by the panel.
   */
  useLayoutEffect(() => {
    const card = cardRef.current;
    const nav = navRef.current;
    const track = trackRef.current;
    if (!card || !nav || !track || active < 0) return;

    const slot = track.children[active] as HTMLElement | undefined;
    if (!slot) return;

    const navBox = nav.getBoundingClientRect();
    const slotBox = slot.getBoundingClientRect();
    const cardBox = card.getBoundingClientRect();
    const panel = nav.closest<HTMLElement>(".wd-reader-panel") ?? nav;
    const panelBox = panel.getBoundingClientRect();

    const centre = slotBox.top + slotBox.height / 2;
    const margin = 12;
    const lowest = panelBox.bottom - margin - cardBox.height;
    const top = Math.min(
      Math.max(centre - cardBox.height / 2, panelBox.top + margin),
      Math.max(panelBox.top + margin, lowest),
    );

    nav.style.setProperty(
      "--wd-ruler-card-y",
      `${Math.round(top - navBox.top)}px`,
    );
  }, [active, layout]);

  /** The tick under a pointer height: every row is live, none is a gap. */
  function tickFromPointer(clientY: number) {
    const current = layoutRef.current;
    const track = trackRef.current;
    if (!track || current.ticks === 0) return -1;

    const box = track.getBoundingClientRect();
    if (box.height <= 0) return -1;

    return tickAt((clientY - box.top) / box.height, current.ticks);
  }

  function jumpToTick(tick: number) {
    const target = targetsRef.current[tick];
    const scrollEl = scrollRef.current;
    if (!target || !scrollEl) return;

    const top = target.element.getBoundingClientRect().top;
    const offset =
      target.element === scrollEl
        ? 0
        : top -
          scrollEl.getBoundingClientRect().top +
          scrollEl.scrollTop -
          clearanceOf(target.element);

    scrollEl.scrollTo({
      top: Math.max(0, offset),
      behavior: reducedMotion() ? "auto" : "smooth",
    });
  }

  function onTickClick(event: MouseEvent<HTMLElement>, tick: number) {
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
    jumpToTick(tick);
  }

  /** A click anywhere in the column snaps to the tick under the pointer. */
  function onClick(event: MouseEvent<HTMLElement>) {
    if (event.defaultPrevented) return;

    const tick = tickFromPointer(event.clientY);
    if (tick < 0) return;

    onTickClick(event, tick);
  }

  function onPointerMove(event: PointerEvent<HTMLElement>) {
    const tick = tickFromPointer(event.clientY);
    if (tick >= 0) setHovered(tick);
  }

  function onPointerLeave() {
    setHovered(-1);
  }

  if (!layout) {
    // The first measure runs after mount; an empty, hidden nav keeps the
    // server markup and the first client render identical.
    return <nav ref={navRef} className="wd-ruler" aria-label="Sections" />;
  }

  const sectionByTick = new Map(
    layout.sections.map((section) => [section.tick, section]),
  );
  const card = active >= 0 ? (layout.cards[active] ?? EMPTY_CARD) : EMPTY_CARD;

  const style = {
    "--wd-ruler-travel": `calc(${Math.max(0, layout.ticks - 1)} * var(--wd-ruler-step))`,
  } as CSSProperties;

  return (
    <nav
      ref={navRef}
      className="wd-ruler"
      aria-label="Sections"
      data-visible={layout.visible}
      data-active={active >= 0}
      style={style}
      onClick={onClick}
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
    >
      <ol className="wd-ruler-track" ref={trackRef}>
        {Array.from({ length: layout.ticks }, (_, tick) => {
          const section = sectionByTick.get(tick);

          if (section) {
            return (
              <li className="wd-ruler-slot" key={tick}>
                <a
                  className="wd-ruler-tick wd-ruler-tick-section"
                  href={`#${section.id}`}
                  aria-label={section.label}
                  data-active={tick === active}
                  onFocus={() => setFocused(tick)}
                  onBlur={() => setFocused(-1)}
                  onClick={(event) => onTickClick(event, tick)}
                />
              </li>
            );
          }

          return (
            <li className="wd-ruler-slot" key={tick}>
              <span
                className="wd-ruler-tick"
                aria-hidden="true"
                data-active={tick === active}
              />
            </li>
          );
        })}
      </ol>

      <span className="wd-ruler-indicator" aria-hidden="true" />

      {/*
        One card, always mounted: scrubbing moves it from tick to tick and swaps
        its text in place, so it never closes and reopens between marks.
      */}
      <div className="wd-ruler-card" ref={cardRef} aria-hidden="true">
        <div className="wd-ruler-card-inner">
          <p className="wd-ruler-card-title">{card.title}</p>
          <p className="wd-ruler-card-body">{card.excerpt}</p>
        </div>
      </div>
    </nav>
  );
}
