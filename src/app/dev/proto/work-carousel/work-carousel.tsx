"use client";

import type {
  CSSProperties,
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
} from "react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { useReducedMotion } from "motion/react";
import type { Transition } from "motion/react";
import { HorizonBackground } from "@/app/dev/prototype/horizon-background";
import { PrototypeNav } from "@/app/dev/prototype/prototype-nav";
import { RingHoverPointer } from "@/app/dev/prototype/ring-pointer";
import { RingLayers } from "@/app/dev/prototype/ring-hover";
import { TrackerWidget } from "@/app/dev/prototype/tracker-widget";
import { CAROUSEL_CSS } from "./carousel-css";
import { Controls, DEFAULT_SETTINGS, EASE_CURVES } from "./controls";
import type { Settings } from "./controls";
import { WorkCard } from "./work-card";
import type { Slot } from "./work-card";
import { WORKS } from "./works";

/** Row height per content width, carried over from /dev/prototype's bands. */
const ROW_HEIGHT_WIDE = 416;
const ROW_HEIGHT_MID = 360;
const ROW_HEIGHT_NARROW = 420;

/** Stripe's sliver hint: 8px wide, half the row gap between two of them. */
const SLIVER_WIDTH = 8;

export function WorkCarousel() {
  const [order, setOrder] = useState(WORKS);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [rowWidth, setRowWidth] = useState(1136);

  const reduceMotion = useReducedMotion();
  const rowRef = useRef<HTMLUListElement | null>(null);
  const featuredRef = useRef<HTMLAnchorElement | null>(null);
  const moveFocus = useRef(false);
  // Widths snap on resize; only a slot change earns the carousel timing.
  const [snapping, setSnapping] = useState(false);
  const measuredWidth = useRef(1136);
  const snapTimer = useRef<number | null>(null);

  // Widths are numbers (the strip's slots are fixed px), so the row is
  // measured once and then kept current by the observer.
  useLayoutEffect(() => {
    const row = rowRef.current;

    if (!row) return;

    const measure = () => {
      const width = row.getBoundingClientRect().width;

      // display:none under 768px reports 0; keep the last real measurement.
      if (width <= 320 || Math.abs(width - measuredWidth.current) < 0.5) return;

      measuredWidth.current = width;
      setSnapping(true);
      setRowWidth(width);

      if (snapTimer.current !== null) window.clearTimeout(snapTimer.current);

      snapTimer.current = window.setTimeout(() => setSnapping(false), 80);
    };

    measure();

    const observer = new ResizeObserver(measure);

    observer.observe(row);

    return () => {
      observer.disconnect();

      if (snapTimer.current !== null) window.clearTimeout(snapTimer.current);
    };
  }, []);

  const total = order.length;
  const rowHeight =
    rowWidth >= 1100
      ? ROW_HEIGHT_WIDE
      : rowWidth >= 880
        ? ROW_HEIGHT_MID
        : ROW_HEIGHT_NARROW;

  const mediumCount = Math.min(
    rowWidth >= 900 ? 3 : rowWidth >= 600 ? 2 : 1,
    Math.max(total - 1, 1),
  );
  const sliverCount = settings.slivers
    ? Math.min(Math.max(total - 1 - mediumCount, 0), 4)
    : 0;

  const sliverGap = Math.max(4, Math.round(settings.gap / 2));
  const gaps =
    mediumCount * settings.gap +
    (sliverCount > 0 ? (sliverCount - 1) * sliverGap + settings.gap : 0);
  const available = Math.max(rowWidth - gaps - sliverCount * SLIVER_WIDTH, 0);

  // The featured slot is height × ratio, capped so the mediums keep a readable
  // slice even at 768.
  const featuredWidth = Math.max(
    Math.min(
      rowHeight * settings.ratio,
      available - mediumCount * 36,
      rowWidth * 0.68,
    ),
    Math.max(rowWidth * 0.38, 240),
  );
  const remaining = Math.max(available - featuredWidth, 0);
  const weights = settings.weights.slice(0, mediumCount);
  const weightSum = weights.reduce((sum, weight) => sum + weight, 0);
  // A 2px floor per medium, so zeroed weights can never push the strip past
  // the row: the floor is taken out of the flexible width first.
  const minMedium = 2;
  const flexible = Math.max(remaining - mediumCount * minMedium, 0);
  const mediumWidths = weights.map(
    (weight) =>
      minMedium +
      (weightSum > 0.001
        ? (flexible * weight) / weightSum
        : flexible / weights.length),
  );

  const slotFor = (index: number): Slot =>
    index === 0 ? "featured" : index <= mediumCount ? "medium" : "peek";

  const widthFor = (index: number) => {
    if (index === 0) return Math.round(featuredWidth);
    if (index <= mediumCount) {
      return Math.max(2, Math.round(mediumWidths[index - 1] ?? 0));
    }

    return SLIVER_WIDTH;
  };

  const marginFor = (index: number) => {
    if (index === 0) return 0;

    return slotFor(index - 1) === "peek" ? sliverGap : settings.gap;
  };

  const visibleCount = Math.min(1 + mediumCount + sliverCount, total);

  // Absolute slots: every card's left edge is a transform, so a click slides
  // the strip instead of teleporting the clicked card to the front.
  const offsets: number[] = [];
  let cursor = 0;

  for (let index = 0; index < visibleCount; index += 1) {
    if (index > 0) cursor += marginFor(index);

    offsets.push(cursor);
    cursor += widthFor(index);
  }

  const transition: Transition = {
    duration: snapping ? 0 : (reduceMotion ? 200 : settings.duration) / 1000,
    ease: EASE_CURVES[settings.ease],
  };

  const featureAt = useCallback((index: number, keyboard: boolean) => {
    if (index > 0) {
      moveFocus.current = keyboard;
      setOrder((previous) => [
        ...previous.slice(index),
        ...previous.slice(0, index),
      ]);
    }
  }, []);

  const rotate = useCallback((direction: 1 | -1) => {
    moveFocus.current = true;
    setOrder((previous) =>
      direction === 1
        ? [...previous.slice(1), ...previous.slice(0, 1)]
        : [...previous.slice(-1), ...previous.slice(0, -1)],
    );
  }, []);

  useEffect(() => {
    if (!moveFocus.current) return;

    moveFocus.current = false;
    featuredRef.current?.focus({ preventScroll: true });
  }, [order]);

  function handleKeyDown(event: ReactKeyboardEvent<HTMLElement>) {
    if (event.key === "ArrowRight") {
      event.preventDefault();
      rotate(1);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      rotate(-1);
    }
  }

  function trackPointer(event: ReactPointerEvent<HTMLUListElement>) {
    const host = (event.target as Element).closest<HTMLElement>(".wc-card");

    if (!host) return;

    const rect = host.getBoundingClientRect();

    host.style.setProperty(
      "--mx",
      `${event.clientX - rect.left - rect.width / 2}px`,
    );
    host.style.setProperty(
      "--my",
      `${event.clientY - rect.top - rect.height / 2}px`,
    );
  }

  const featuredItem = WORKS.findIndex((work) => work.id === order[0].id);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CAROUSEL_CSS }} />

      <main className="relative flex min-h-dvh flex-col overflow-hidden bg-surface text-on-surface">
        <HorizonBackground />
        <RingHoverPointer />

        <div className="relative mx-auto flex w-full max-w-[1200px] flex-1 flex-col px-4 py-4 md:px-8 md:py-12 xl:py-16">
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 left-0 hidden w-px bg-frame-line min-[1440px]:block"
          />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 right-0 hidden w-px bg-frame-line min-[1440px]:block"
          />

          <div className="relative mx-auto my-auto flex w-full max-w-[1136px] flex-col gap-3">
            <span
              aria-hidden="true"
              className="pointer-events-none absolute -inset-x-8 -top-16 hidden h-px bg-frame-line min-[1440px]:block"
            />
            <span
              aria-hidden="true"
              className="pointer-events-none absolute -inset-x-8 -bottom-16 hidden h-px bg-frame-line min-[1440px]:block"
            />

            <h1 className="sr-only">Selected work</h1>

            {/* Top band: the tracker card, then the Play shell at its Figma site. */}
            <div className="flex gap-3">
              <TrackerWidget />
              <div aria-hidden="true" className="ring-host flex-1 rounded-lg">
                <RingLayers fill="bg-surface-container-low" />
              </div>
            </div>

            {/* Middle band, replaced: one featured slot, three medium slots and
                a couple of sliver hints, rotating like a loop. */}
            <section
              aria-roledescription="carousel"
              aria-label="Featured work"
              onKeyDown={handleKeyDown}
              className="hidden md:block"
            >
              <p className="sr-only">
                Use the left and right arrow keys to rotate the carousel.
              </p>

              <ul
                ref={rowRef}
                onPointerMove={trackPointer}
                className="relative m-0 list-none p-0"
                style={
                  {
                    height: `${rowHeight}px`,
                    // Lets the title cross-fade wait on the chosen duration.
                    "--wc-morph": `${reduceMotion ? 200 : settings.duration}ms`,
                  } as CSSProperties
                }
              >
                {order.slice(0, visibleCount).map((work, index) => (
                  <WorkCard
                    key={work.id}
                    work={work}
                    slot={slotFor(index)}
                    index={index}
                    position={
                      WORKS.findIndex((entry) => entry.id === work.id) + 1
                    }
                    width={widthFor(index)}
                    x={offsets[index] ?? 0}
                    artWidth={Math.round(featuredWidth)}
                    transition={transition}
                    onSelect={featureAt}
                    featuredRef={featuredRef}
                  />
                ))}
              </ul>
            </section>

            {/* Below 768px: no carousel, an overlapping deck of full-width
                links, one per work, tightened by the stack-overlap control. */}
            <ul className="m-0 flex list-none flex-col p-0 md:hidden">
              {order.map((work, index) => (
                <li
                  key={work.id}
                  style={
                    {
                      marginTop: index === 0 ? 0 : -settings.overlap,
                      "--wc-z": total - index,
                    } as CSSProperties
                  }
                >
                  <a
                    href={`/work/${work.slug}`}
                    className="wc-stack-card"
                    style={{ height: index === 0 ? 148 : 132 }}
                  >
                    <span className="wc-stack-row">
                      <span className="wc-stack-index">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <span className="wc-stack-meta">
                        {work.meta} · {work.year}
                      </span>
                    </span>
                    <span className="wc-stack-title">{work.title}</span>
                  </a>
                </li>
              ))}
            </ul>

            <PrototypeNav />
          </div>
        </div>
      </main>

      <p className="sr-only" aria-live="polite">
        {`Featured: ${order[0].title}, item ${featuredItem + 1} of ${WORKS.length}`}
      </p>

      <Controls
        settings={settings}
        onChange={(patch) =>
          setSettings((previous) => ({ ...previous, ...patch }))
        }
      />
    </>
  );
}
