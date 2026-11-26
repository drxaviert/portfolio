"use client";

import Link from "next/link";
import { createPortal } from "react-dom";
import type {
  FocusEvent as ReactFocusEvent,
  PointerEvent as ReactPointerEvent,
  ReactNode,
} from "react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { Cover } from "@/components/work/cover";
import type { WorkMeta } from "@/lib/work";
import { BlurStack } from "./blur-stack";
import { INDEX_SCROLL_ID, INDEX_TITLE_ID } from "./work-index-ids";
import "./work-list.css";

const THUMB_WIDTH = 480;
const THUMB_HEIGHT = 360;
const ENTRANCE_MAX = 12;
const FAST_SCROLL_PX_PER_MS = 1.5;
/** The panel's air from the reading surface's left edge. */
const PANEL_GUTTER = 16;
/** The panel's air from the list's left edge. */
const PANEL_GAP = 32;
/** Below this the left margin cannot hold a readable panel. */
const PANEL_MIN_WIDTH = 320;
/** Above this the panel stops growing and hugs the list instead. */
const PANEL_MAX_WIDTH = 600;

/** The list keeps its place while a study takes the panel. */
let listScroll = 0;

function canHover(): boolean {
  return (
    typeof window.matchMedia === "function" &&
    window.matchMedia("(hover: hover) and (pointer: fine)").matches
  );
}

function prefersReducedMotion(): boolean {
  return (
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * The top of the usable scroll area: below the fixed nav dock, with a small
 * gap. The dock is measured rather than derived from `--wd-nav-height`, which
 * is expressed in `rem` and would read as "4" to parseFloat.
 */
function visibleTop(scrollRect: DOMRect): number {
  const dock = document.querySelector<HTMLElement>("[data-nav-dock]");
  const navBottom = dock
    ? dock.getBoundingClientRect().bottom
    : scrollRect.top + 92;

  return Math.max(scrollRect.top + 8, navBottom + 12);
}

type Slots = { front: 0 | 1; items: [number | null, number | null] };

// The clip layer needs the body after hydration; an external-store read keeps
// the server render free of it without a mount effect.
const subscribeClient = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

/**
 * The /work index list with one shared hover thumbnail.
 *
 * The row is the shipped list's voice: an 80px year when present, a flexible
 * main column,
 * a 200px right-aligned role, 18x16 padding, a 12px radius and the
 * surface-container hover fill, with a hairline --outline-variant divider
 * between rows. While a row is current the others drop to 40%.
 *
 * The 480x360 thumbnail is centred on the cursor and follows it 1:1 with one
 * rAF-coalesced translate3d per frame. It lives in a fixed layer portalled to
 * the body, above the nav, clipped only by the viewport. With no pointer (a
 * keyboard focus) it parks at the focused row's right end. Touch has no
 * thumbnail. Scroll tracking finds the row under the stationary pointer, and
 * the cursor is hidden only while the thumbnail is showing over a row.
 *
 * Where the centred list leaves an empty left margin wide enough for a 4:3
 * panel (a fine pointer and at least 320px after the gutters), the same media
 * is shown there instead: sticky beside the list, which never moves, with the
 * cursor visible. The media crossfades between rows and nothing shows until a
 * row is current. Below that gate the cursor thumbnail above is the thumbnail.
 */
export function WorkList({
  works,
  topControl,
}: {
  works: WorkMeta[];
  /** Chrome above the rows (the shared Breadcrumb), part of the column. */
  topControl?: ReactNode;
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  const [focused, setFocused] = useState<number | null>(null);
  const [dimActive, setDimActive] = useState(false);
  const [panelFits, setPanelFits] = useState(false);
  const portalReady = useSyncExternalStore(
    subscribeClient,
    getClientSnapshot,
    getServerSnapshot,
  );
  const [slots, setSlots] = useState<Slots>({
    front: 1,
    items: [null, null],
  });

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const groupRef = useRef<HTMLDivElement | null>(null);
  const listColumnRef = useRef<HTMLDivElement | null>(null);
  const thumbRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const clipRef = useRef<HTMLDivElement | null>(null);
  const rowRefs = useRef<(HTMLLIElement | null)[]>([]);
  const hoveredRef = useRef<number | null>(null);
  const focusedRef = useRef<number | null>(null);
  const dimTimerRef = useRef<number | null>(null);
  const pointerRef = useRef<{ x: number; y: number } | null>(null);
  const scrollRafRef = useRef<number | null>(null);
  const fastRef = useRef(false);
  const fastTimerRef = useRef<number | null>(null);
  const lastScrollRef = useRef({ top: 0, time: 0 });
  const velocityRef = useRef(0);
  const frameRef = useRef(0);

  /**
   * The panel's gate is a measurement, not a breakpoint: from the reading
   * surface's left edge plus the gutter, to the list's left edge minus the gap,
   * there must be room for a readable 320px panel, and the pointer must be able
   * to hover. Measured from the layout at rest (the drawer's open pose scales
   * the rects, so the phase observer re-measures when it lands) and again on
   * every resize and reveal.
   */
  const measurePanel = useCallback(() => {
    const scroll = scrollRef.current;
    const list = listColumnRef.current;

    if (!scroll || !list) return;

    const surface = scroll.getBoundingClientRect();
    const listRect = list.getBoundingClientRect();
    const available = listRect.left - PANEL_GAP - (surface.left + PANEL_GUTTER);

    setPanelFits(available >= PANEL_MIN_WIDTH && canHover());
  }, []);

  // The list keeps its place while a study takes the panel.
  useLayoutEffect(() => {
    const scroll = scrollRef.current;
    if (!scroll) return;

    scroll.scrollTop = listScroll;

    const record = () => {
      listScroll = scroll.scrollTop;
    };

    scroll.addEventListener("scroll", record, { passive: true });

    return () => scroll.removeEventListener("scroll", record);
  }, []);

  /**
   * The panel's box in the empty left margin. The reading surface's left edge
   * plus 16px starts it and the list's left edge minus 32px ends it, so its
   * width is whatever the centred list leaves. Past 600px it stops growing and
   * right-aligns to the list (it keeps hugging the list) rather than drifting
   * away from it. Height is the thumb's 4:3; the top is the first row's top and
   * sticks under the nav.
   */
  const placePanel = useCallback(() => {
    const panel = panelRef.current;
    const clip = clipRef.current;
    const scroll = scrollRef.current;
    const list = listColumnRef.current;
    const firstRow = rowRefs.current[0];

    if (!panel || !clip || !scroll || !list || !firstRow) return;

    const clipRect = clip.getBoundingClientRect();
    const scrollRect = scroll.getBoundingClientRect();
    const listRect = list.getBoundingClientRect();
    const firstRowRect = firstRow.getBoundingClientRect();
    const left = scrollRect.left + PANEL_GUTTER;
    const right = listRect.left - PANEL_GAP;
    const available = right - left;

    if (available < PANEL_MIN_WIDTH) return;

    const width = Math.min(PANEL_MAX_WIDTH, available);
    const height = width * (THUMB_HEIGHT / THUMB_WIDTH);
    const x = (width < available ? right - width : left) - clipRect.left;
    const y = Math.max(firstRowRect.top, visibleTop(scrollRect)) - clipRect.top;

    panel.style.width = `${width}px`;
    panel.style.height = `${height}px`;
    panel.style.transform = `translate3d(${x}px, ${y}px, 0)`;
  }, []);

  /**
   * Where the thumbnail is. The margin panel places its own fixed box; the
   * cursor thumbnail is centred on the pointer, or parked at the focused row's
   * right end when there is no pointer to follow.
   */
  const placeThumb = useCallback(() => {
    const clip = clipRef.current;

    if (!clip) return;

    if (panelRef.current) {
      placePanel();
      return;
    }

    const thumb = thumbRef.current;
    const point = pointerRef.current;

    if (!thumb) return;

    const clipRect = clip.getBoundingClientRect();
    let x: number;
    let y: number;

    if (hoveredRef.current !== null && point) {
      x = point.x - clipRect.left - THUMB_WIDTH / 2;
      y = point.y - clipRect.top - THUMB_HEIGHT / 2;
    } else if (focusedRef.current !== null) {
      const row = rowRefs.current[focusedRef.current];
      const scroll = scrollRef.current;
      const list = listColumnRef.current;

      if (!row || !scroll || !list) return;

      const scrollRect = scroll.getBoundingClientRect();
      const listRect = list.getBoundingClientRect();
      const rowRect = row.getBoundingClientRect();
      const minTop = visibleTop(scrollRect);

      x =
        Math.max(listRect.left + 12, rowRect.right - THUMB_WIDTH - 16) -
        clipRect.left;
      y =
        Math.max(
          minTop,
          Math.min(rowRect.top, scrollRect.bottom - THUMB_HEIGHT - 12),
        ) - clipRect.top;
    } else {
      return;
    }

    thumb.style.transform = `translate3d(${x}px, ${y}px, 0)`;
  }, [placePanel]);

  // One write per frame, always from the latest pointer event.
  const scheduleThumb = useCallback(() => {
    if (frameRef.current) return;

    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = 0;
      placeThumb();
    });
  }, [placeThumb]);

  useEffect(() => {
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, []);

  const resetHover = useCallback(() => {
    hoveredRef.current = null;
    focusedRef.current = null;
    pointerRef.current = null;
    setHovered(null);
    setFocused(null);
    setDimActive(false);
  }, []);

  // The router caches this segment with React Activity: its effects are torn
  // down while the view is away and run again on every reveal, so this setup is
  // also the reveal. A revealed view is not a hovered one: drop the hover left
  // from before it went away (the pointer may be elsewhere, with no event to say
  // so) and re-measure the margin the panel needs. A resize moves both, so the
  // same handler listens for that.
  useLayoutEffect(() => {
    const sync = () => {
      resetHover();
      measurePanel();
    };

    sync();

    const onResize = () => {
      measurePanel();
      scheduleThumb();
    };

    window.addEventListener("resize", onResize);

    return () => window.removeEventListener("resize", onResize);
  }, [measurePanel, resetHover, scheduleThumb]);

  // Size and place the parked panel while it is idle, so its first hover cannot
  // paint a zero-sized frame for a frame.
  useLayoutEffect(() => {
    if (panelFits) scheduleThumb();
  }, [panelFits, scheduleThumb]);

  const clearDimTimer = useCallback(() => {
    if (dimTimerRef.current) {
      window.clearTimeout(dimTimerRef.current);
      dimTimerRef.current = null;
    }
  }, []);

  // A list-level dim with an 80ms grace, so moving between rows never flashes
  // the others back to full.
  const scheduleDimClear = useCallback(() => {
    clearDimTimer();
    dimTimerRef.current = window.setTimeout(() => {
      dimTimerRef.current = null;
      if (hoveredRef.current === null && focusedRef.current === null) {
        setDimActive(false);
      }
    }, 80);
  }, [clearDimTimer]);

  /** A fling cuts the cursor thumbnail's crossfade. */
  const markFast = useCallback((on: boolean) => {
    const thumb = thumbRef.current;

    if (!thumb) return;

    if (on) thumb.setAttribute("data-work-fast", "");
    else thumb.removeAttribute("data-work-fast");
  }, []);

  const setSlotsFor = useCallback((index: number) => {
    setSlots((previous) => {
      if (previous.items[previous.front] === index) return previous;

      const front: 0 | 1 = previous.front === 0 ? 1 : 0;
      const next: [number | null, number | null] = [
        previous.items[0],
        previous.items[1],
      ];
      next[front] = index;

      return { front, items: next };
    });
  }, []);

  const show = useCallback(
    (index: number) => {
      if (!canHover()) return;

      clearDimTimer();
      setDimActive(true);

      if (hoveredRef.current === index) return;

      hoveredRef.current = index;
      setHovered(index);
      setSlotsFor(index);
    },
    [clearDimTimer, setSlotsFor],
  );

  const hide = useCallback(() => {
    if (hoveredRef.current === null) return;

    hoveredRef.current = null;
    setHovered(null);

    if (focusedRef.current === null) scheduleDimClear();
  }, [scheduleDimClear]);

  const leaveList = useCallback(() => {
    pointerRef.current = null;
    hoveredRef.current = null;
    setHovered(null);
    clearDimTimer();

    if (focusedRef.current === null) {
      setDimActive(false);
    } else {
      // A keyboard focus still owns the thumbnail after the pointer leaves;
      // bring its image and its parked position back.
      setSlotsFor(focusedRef.current);
      scheduleThumb();
    }
  }, [clearDimTimer, scheduleThumb, setSlotsFor]);

  const onFocus = (event: ReactFocusEvent<HTMLDivElement>) => {
    const target = event.target;

    if (!(target instanceof HTMLElement) || !target.matches(":focus-visible")) {
      return;
    }

    const row = target.closest<HTMLElement>("[data-work-index]");
    if (!row) return;

    const index = Number(row.dataset.workIndex);
    if (!Number.isInteger(index)) return;

    focusedRef.current = index;
    setFocused(index);
    clearDimTimer();
    setDimActive(true);

    if (hoveredRef.current === null) {
      setSlotsFor(index);
      scheduleThumb();
    }
  };

  const onBlur = (event: ReactFocusEvent<HTMLDivElement>) => {
    const next = event.relatedTarget;

    if (next instanceof Node && event.currentTarget.contains(next)) return;

    focusedRef.current = null;
    setFocused(null);

    if (hoveredRef.current === null) scheduleDimClear();
  };

  useEffect(() => {
    return () => {
      clearDimTimer();
      if (fastTimerRef.current) window.clearTimeout(fastTimerRef.current);
      if (scrollRafRef.current) cancelAnimationFrame(scrollRafRef.current);
    };
  }, [clearDimTimer]);

  const clearEntrance = useCallback(() => {
    for (const row of rowRefs.current) {
      if (!row) continue;
      row.removeAttribute("data-work-enter");
      row.style.removeProperty("--work-enter-i");
    }
  }, []);

  // Scroll with a stationary pointer: find the row under the last pointer
  // position and move the thumbnail's image onto it. The position stays at the
  // cursor. A fling holds the image until the scroll settles, then crossfades.
  useEffect(() => {
    const scroll = scrollRef.current;
    const list = listColumnRef.current;

    if (!scroll || !list) return;

    lastScrollRef.current = {
      top: scroll.scrollTop,
      time: performance.now(),
    };

    const updateFromPoint = () => {
      const point = pointerRef.current;

      if (!point) {
        hide();
        return;
      }

      const listRect = list.getBoundingClientRect();

      if (
        point.x < listRect.left ||
        point.x > listRect.right ||
        point.y < listRect.top ||
        point.y > listRect.bottom
      ) {
        leaveList();
        return;
      }

      const element = document.elementFromPoint(point.x, point.y);
      const row =
        element instanceof Element
          ? element.closest<HTMLElement>("[data-work-index]")
          : null;

      if (!row || !list.contains(row)) {
        if (!(element instanceof Element) || !list.contains(element)) {
          leaveList();
          return;
        }
        hide();
        return;
      }

      const index = Number(row.dataset.workIndex);

      if (!Number.isInteger(index)) return;

      if (!fastRef.current) show(index);
      scheduleThumb();
    };

    const onScroll = () => {
      const now = performance.now();
      const top = scroll.scrollTop;
      const last = lastScrollRef.current;
      const dt = Math.max(1, now - last.time);
      const velocity = Math.abs(top - last.top) / dt;

      lastScrollRef.current = { top, time: now };
      velocityRef.current = Math.max(velocity, velocityRef.current * 0.8);

      if (velocityRef.current > FAST_SCROLL_PX_PER_MS) {
        fastRef.current = true;
        markFast(true);
      }

      if (fastRef.current) {
        if (fastTimerRef.current) window.clearTimeout(fastTimerRef.current);
        fastTimerRef.current = window.setTimeout(() => {
          fastRef.current = false;
          velocityRef.current = 0;
          markFast(false);
          updateFromPoint();
        }, 140);
      }

      if (!scrollRafRef.current) {
        scrollRafRef.current = requestAnimationFrame(() => {
          scrollRafRef.current = null;
          updateFromPoint();
        });
      }
    };

    scroll.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      scroll.removeEventListener("scroll", onScroll);
      if (scrollRafRef.current) cancelAnimationFrame(scrollRafRef.current);
      if (fastTimerRef.current) window.clearTimeout(fastTimerRef.current);
      markFast(false);
    };
  }, [hide, leaveList, markFast, scheduleThumb, show]);

  // A pointer already over the list (switching into this view) gets placed on
  // the next frame once the portal exists.
  useEffect(() => {
    if (!portalReady) return;

    if (pointerRef.current || focusedRef.current !== null) scheduleThumb();
  }, [portalReady, scheduleThumb]);

  // The row entrance joins the drawer's open beat. Only the rows visible at
  // that moment stagger (capped at twelve); everything below the fold is
  // already visible and never animates on scroll.
  useEffect(() => {
    const root = rootRef.current;
    const layer = root?.closest<HTMLElement>(".wd-expand-layer");

    if (!root || !layer) return;

    const reduce = prefersReducedMotion();
    let entered = layer.dataset.phase === "open";

    const apply = () => {
      const phase = layer.dataset.phase;

      if (phase === "open") {
        // The drawer has landed (scale 1), so the panel's margin can be
        // measured for real, including after a soft open.
        measurePanel();
        if (entered) return;
        entered = true;

        clearEntrance();

        if (!reduce) {
          const scroll = scrollRef.current;
          const scrollRect = scroll?.getBoundingClientRect();

          if (scroll && scrollRect) {
            const top = visibleTop(scrollRect);
            let stagger = 0;

            for (const row of rowRefs.current) {
              if (!row || stagger >= ENTRANCE_MAX) break;

              const rect = row.getBoundingClientRect();

              if (rect.bottom > top && rect.top < scrollRect.bottom) {
                row.dataset.workEnter = "";
                row.style.setProperty("--work-enter-i", String(stagger));
                stagger += 1;
              }
            }

            if (stagger > 0) root.dataset.workAnim = "on";
          }
        }

        return;
      }

      if (phase === "closing" || phase === "closed") {
        entered = false;
        delete root.dataset.workAnim;
        clearEntrance();
        resetHover();
      }
    };

    apply();

    const observer = new MutationObserver(apply);
    observer.observe(layer, {
      attributes: true,
      attributeFilter: ["data-phase"],
    });

    return () => {
      observer.disconnect();
      delete root.dataset.workAnim;
      clearEntrance();
    };
  }, [clearEntrance, measurePanel, resetHover]);

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!canHover()) return;

    pointerRef.current = { x: event.clientX, y: event.clientY };
    scheduleThumb();

    const row = (event.target as Element).closest<HTMLElement>(
      "[data-work-index]",
    );

    if (!row) {
      hide();
      return;
    }

    const index = Number(row.dataset.workIndex);

    if (Number.isInteger(index)) show(index);
  };

  const onPointerLeave = () => {
    leaveList();
  };

  const currentRow = hovered ?? focused;
  const thumbActive = hovered !== null || focused !== null;

  // Two stacked images; the front one is the current row's cover, swapped by
  // the same crossfade in both treatments. The crop is the same too.
  const mediaSlots = ([0, 1] as const).map((slot) => {
    const index = slots.items[slot];
    const work = index === null ? null : works[index];

    return (
      <div
        key={slot}
        className="wd-work-thumb-img"
        data-front={slots.front === slot ? "" : undefined}
      >
        {work ? (
          <Cover
            scene={work.cover ?? "tiles"}
            coverImage={work.coverImage}
            fit="cover"
          />
        ) : null}
      </div>
    );
  });

  // Distinct keys: both are a bare div in the same slot, and React would
  // otherwise reuse one DOM node across the swap, keeping the other
  // treatment's inline width/height/transform.
  const thumbNode = (
    <div
      key="cursor-thumb"
      className="wd-work-thumb"
      ref={thumbRef}
      aria-hidden="true"
    >
      <div className="wd-work-thumb-in">{mediaSlots}</div>
    </div>
  );

  // The panel takes the thumb's radius, shadow and cover fit; it is positioned
  // by placePanel in the fixed clip layer, so the list's layout is never
  // involved.
  const panelNode = (
    <div
      key="panel-thumb"
      className="wd-work-panel"
      ref={panelRef}
      aria-hidden="true"
      data-work-active={thumbActive ? "" : undefined}
    >
      {mediaSlots}
    </div>
  );

  return (
    <>
      <BlurStack height="calc(var(--wd-nav-inset) + var(--wd-nav-height))" />

      <div id={INDEX_SCROLL_ID} className="wd-index-scroll" ref={scrollRef}>
        <div className="wd-index-column wd-work-column" ref={rootRef}>
          <h1 id={INDEX_TITLE_ID} tabIndex={-1} className="wd-work-sr-only">
            Work
          </h1>

          {topControl}

          <div
            className="wd-work-group"
            data-work-dim={dimActive ? "" : undefined}
            ref={groupRef}
            data-work-active={thumbActive ? "" : undefined}
            data-work-pointer={!panelFits && hovered !== null ? "" : undefined}
          >
            <div
              className="wd-work-list-column"
              ref={listColumnRef}
              onPointerMove={onPointerMove}
              onPointerLeave={onPointerLeave}
              onFocus={onFocus}
              onBlur={onBlur}
            >
              <ul className="wd-work-list" aria-label="Case studies">
                {works.map((work, index) => (
                  <li
                    key={work.slug}
                    ref={(element) => {
                      rowRefs.current[index] = element;
                    }}
                    className="wd-work-row-item"
                    data-work-index={index}
                    data-work-current={currentRow === index ? "" : undefined}
                  >
                    <Link
                      href={`/work/${work.slug}`}
                      className="wd-work-row"
                      data-work-no-year={work.year ? undefined : ""}
                      aria-label={
                        work.year
                          ? `${work.title}, ${work.year}, ${work.role}`
                          : `${work.title}, ${work.role}`
                      }
                    >
                      {work.year ? (
                        <span className="wd-work-year">{work.year}</span>
                      ) : null}
                      <span className="wd-work-main">
                        <span className="wd-work-title">{work.title}</span>
                        <span className="wd-work-summary">{work.summary}</span>
                      </span>
                      <span className="wd-work-role">{work.role}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>

      {portalReady
        ? createPortal(
            <div
              className="wd-work-thumb-clip"
              ref={clipRef}
              aria-hidden="true"
              data-work-active={thumbActive ? "" : undefined}
            >
              {panelFits ? panelNode : thumbNode}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
