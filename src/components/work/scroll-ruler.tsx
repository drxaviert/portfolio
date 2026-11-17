"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import type { MouseEvent, PointerEvent } from "react";
import {
  activeTick,
  blockSpan,
  clamp01,
  collapseText,
  pickBlock,
  placeSectionTicks,
  rulerTickCount,
  tickAt,
  uniqueHeadingId,
} from "./ruler-model";
import type { BlockSpan, SectionCrossing } from "./ruler-model";
import {
  LEADING_DURATION_MS,
  leadingEase,
  TRAILING_DELAY_MS,
  TRAILING_DURATION_MS,
  trailingEase,
} from "@/components/theme/theme-toggle";
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
/** How long a click's scroll keeps the indicator on its destination. */
const JUMP_HOLD_MS = 1200;
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

  // The indicator's tick is the only thing scroll changes in React: a section
  // crossing, not a frame. The move itself is written straight to the DOM.
  const [indicatorTick, setIndicatorTick] = useState(0);
  const indicatorTickRef = useRef(0);
  const indicatorRef = useRef<HTMLSpanElement>(null);
  const crossingsRef = useRef<SectionCrossing[]>([]);
  const edgesRef = useRef({ lo: 0, hi: 0, placed: false });
  const flightRef = useRef(0);
  const jumpRef = useRef<{ top: number } | null>(null);
  const jumpTimerRef = useRef(0);

  useEffect(() => {
    layoutRef.current = layout ?? EMPTY_LAYOUT;
  }, [layout]);

  /** The two edges of a tick's mark, in px from the nav's own top. */
  const edgesFor = useCallback((tick: number) => {
    const nav = navRef.current;
    const slot = trackRef.current?.children[tick] as HTMLElement | undefined;
    if (!nav || !slot) return null;

    // Layout offsets, not bounding rects: while the panel morphs in it is
    // scaled, and a rect read then is short by that scale, so the bar landed
    // off its tick and popped to the right one when the morph ended. The bar is
    // positioned in the nav's own (unscaled) pixels, so measure in them.
    const centre = slot.offsetTop + slot.offsetHeight / 2;

    return { lo: centre - 1, hi: centre + 1 };
  }, []);

  /** The bar's whole state is one transform: its top edge, then its height. */
  const drawIndicator = useCallback((lo: number, hi: number) => {
    const element = indicatorRef.current;
    if (!element) return;

    const height = Math.max(2, hi - lo);
    element.style.transform = `translateY(${lo}px) scaleY(${height / 2})`;
  }, []);

  /**
   * The theme toggle's stretch and snap, turned ninety degrees: the edge in the
   * direction of travel leaves on 180ms ease-out cubic, the other holds for
   * 120ms and closes on 220ms ease-out quint. Both edges are read from where
   * the bar is right now, so a second crossing mid-flight retargets it instead
   * of restarting it. Under reduced motion it is already there.
   */
  const moveIndicator = useCallback(
    (tick: number, animate: boolean) => {
      const target = edgesFor(tick);
      if (!target) return;

      cancelAnimationFrame(flightRef.current);
      flightRef.current = 0;

      const current = edgesRef.current;

      if (!animate || !current.placed || reducedMotion()) {
        edgesRef.current = { ...target, placed: true };
        drawIndicator(target.lo, target.hi);
        return;
      }

      const movingDown =
        (target.lo + target.hi) / 2 >= (current.lo + current.hi) / 2;

      const flight = {
        start: performance.now(),
        leadFrom: movingDown ? current.hi : current.lo,
        leadTo: movingDown ? target.hi : target.lo,
        trailFrom: movingDown ? current.lo : current.hi,
        trailTo: movingDown ? target.lo : target.hi,
        leadingDown: movingDown,
      };

      const loop = (now: number) => {
        const elapsed = Math.max(0, (now - flight.start) / 1000);
        const leadProgress = Math.min(
          1,
          elapsed / (LEADING_DURATION_MS / 1000),
        );
        const trailProgress = Math.min(
          1,
          Math.max(0, elapsed - TRAILING_DELAY_MS / 1000) /
            (TRAILING_DURATION_MS / 1000),
        );

        const lead =
          flight.leadFrom +
          (flight.leadTo - flight.leadFrom) * leadingEase(leadProgress);
        const trail =
          flight.trailFrom +
          (flight.trailTo - flight.trailFrom) * trailingEase(trailProgress);

        edgesRef.current = flight.leadingDown
          ? { lo: trail, hi: lead, placed: true }
          : { lo: lead, hi: trail, placed: true };

        drawIndicator(edgesRef.current.lo, edgesRef.current.hi);

        if (leadProgress >= 1 && trailProgress >= 1) {
          edgesRef.current = { ...target, placed: true };
          drawIndicator(target.lo, target.hi);
          flightRef.current = 0;

          return;
        }

        flightRef.current = requestAnimationFrame(loop);
      };

      flightRef.current = requestAnimationFrame(loop);
    },
    [drawIndicator, edgesFor],
  );

  /**
   * One section crossing, one state change: the tick is the only thing React
   * re-renders for while the article scrolls.
   */
  const syncIndicator = useCallback(
    (tick: number, animate: boolean) => {
      if (tick !== indicatorTickRef.current) {
        indicatorTickRef.current = tick;
        setIndicatorTick(tick);
      }

      moveIndicator(tick, animate);
    },
    [moveIndicator],
  );

  useEffect(() => () => cancelAnimationFrame(flightRef.current), []);

  /**
   * The first measure runs before the ticks exist (`layout` is still null), so
   * it has no slot to place the bar on and leaves it at the column's top edge
   * until a later measure (fonts, the entrance settling) happens to run. The
   * ticks arrive with the next commit; place the bar on them before that
   * commit paints, so its first visible frame is already at the right tick.
   */
  useLayoutEffect(() => {
    if (!layout || layout.ticks === 0) return;
    moveIndicator(indicatorTickRef.current, false);
  }, [layout, moveIndicator]);

  useEffect(() => {
    const scrollEl = document.getElementById(READER_SCROLL_ID);
    if (!scrollEl) return;
    scrollRef.current = scrollEl;

    let frame = 0;

    // Scroll fires far more often than a section can change, so the read is
    // coalesced into one frame; the crossing is all it can write.
    const onScroll = () => {
      if (frame) return;

      frame = requestAnimationFrame(() => {
        frame = 0;

        const jump = jumpRef.current;
        if (jump) {
          // The click already put the mark on the destination's section; the
          // frames that land the scroll must not recompute it a hair short and
          // flick it back one section.
          if (Math.abs(scrollEl.scrollTop - jump.top) >= 2) return;
          jumpRef.current = null;
          return;
        }

        const max = scrollEl.scrollHeight - scrollEl.clientHeight;
        syncIndicator(
          activeTick(crossingsRef.current, scrollEl.scrollTop, max),
          true,
        );
      });
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

        // Centred in the gutter the panel leaves beside the column, never
        // closer than the minimum gap. The column is centred and capped, so its
        // edge moves at every breakpoint; this is the offset that is measured.
        const gap = Math.max(RULER_GAP, (room - width) / 2);

        roomForRuler = room >= RULER_GAP + width + RULER_CLEARANCE;
        nav.style.setProperty("--wd-ruler-right", `${room - gap - width}px`);
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

      const starts: number[] = [];
      const crosses: number[] = [];

      headings.forEach((heading) => {
        const label = collapseText(heading.textContent ?? "") || "Section";
        const id = heading.id || uniqueHeadingId(label, used);
        used.add(id);
        sectionOf.set(heading, { id, label });

        const top = heading.getBoundingClientRect().top - scrollRect.top;
        const offset = top + scrollEl.scrollTop - clearanceOf(heading);

        crosses.push(Math.max(0, offset));
        starts.push(max > 0 ? clamp01(offset / max) : 0);
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
      crossingsRef.current = sections.map((section, index) => ({
        tick: section.tick,
        at: crosses[index],
      }));

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

      // A fresh measure is a fresh geometry: place the mark, never animate it.
      if (!jumpRef.current) {
        syncIndicator(
          activeTick(crossingsRef.current, scrollEl.scrollTop, max),
          false,
        );
      }
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
  }, [studySlug, syncIndicator]);

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

    const max = scrollEl.scrollHeight - scrollEl.clientHeight;
    const destination = Math.min(max, Math.max(0, offset));

    // The scroll passes every section in between; the mark goes straight to the
    // section that will be current when it lands (the clicked tick itself when
    // that tick is a section's) and holds it until the scroll arrives.
    jumpRef.current = { top: destination };
    window.clearTimeout(jumpTimerRef.current);
    jumpTimerRef.current = window.setTimeout(() => {
      jumpRef.current = null;
    }, JUMP_HOLD_MS);
    syncIndicator(activeTick(crossingsRef.current, destination, max), true);

    scrollEl.scrollTo({
      top: destination,
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

  return (
    <nav
      ref={navRef}
      className="wd-ruler"
      aria-label="Sections"
      data-visible={layout.visible}
      data-active={active >= 0}
      data-indicator={indicatorTick}
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

      <span
        className="wd-ruler-indicator"
        ref={indicatorRef}
        aria-hidden="true"
      />

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
