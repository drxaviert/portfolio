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
/** The row-to-row glide in the snap variant. */
const SNAP_MS = 200;

/**
 * Prototype switch, `?thumb=<value>`: `cursor` is the shipped thumb that follows
 * the pointer; the three `left-*` modes lock X to the list's left edge and differ
 * only in how Y is chosen. Anything else, including no param, is `cursor`.
 */
const VARIANTS = [
  { value: "cursor", label: "Cursor" },
  { value: "left-follow", label: "Left follow" },
  { value: "left-snap", label: "Left snap" },
  { value: "left-fixed", label: "Left fixed" },
] as const;

type ThumbVariant = (typeof VARIANTS)[number]["value"];

function readThumbVariant(): ThumbVariant {
  if (typeof window === "undefined") return "cursor";

  const param = new URLSearchParams(window.location.search).get("thumb");

  return VARIANTS.find((variant) => variant.value === param)?.value ?? "cursor";
}

/**
 * The left modes keep the list exactly as it ships, so they need no room of
 * their own; the gate is only the width at which the 480px thumb can sit over
 * the list with the list's left edge in view, and a fine pointer to hover with.
 * Below that (and on touch) the list keeps the shipped cursor thumb.
 */
const LEFT_QUERY = "(min-width: 1200px) and (hover: hover) and (pointer: fine)";

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

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
 * The row is the shipped list's voice: an 80px year, a flexible main column,
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
 * The `?thumb=` prototype keeps that as the default and adds three left modes
 * that leave the list's size and position untouched: the thumb's left edge sits
 * on the list's left edge (X locked), the cursor stays visible, and Y is either
 * the cursor (`left-follow`), the hovered row with a short glide between rows
 * (`left-snap`), or one Y for the whole list (`left-fixed`). They are gated to
 * 1200px and up on a fine pointer; below that the shipped thumb is used.
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
  const [variant, setVariant] = useState<ThumbVariant>("cursor");
  const [leftFits, setLeftFits] = useState(false);
  const activeVariant: ThumbVariant =
    variant !== "cursor" && leftFits ? variant : "cursor";
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
  const activeVariantRef = useRef<ThumbVariant>("cursor");
  /** The snap glide: last Y written, and the tween when one is in flight. */
  const snapRef = useRef({
    row: null as number | null,
    y: 0,
    from: 0,
    to: 0,
    start: 0,
    frame: 0,
  });

  const stopSnap = useCallback(() => {
    const snap = snapRef.current;

    if (snap.frame) cancelAnimationFrame(snap.frame);

    snap.frame = 0;
  }, []);

  // Read the prototype param and the left gate before paint, and re-read them
  // whenever the environment changes.
  //
  // The router caches this segment with React Activity, which tears the effects
  // down while the view is away and runs them again on every reveal. So this is
  // also the reveal: the variant follows the URL the view came back on (the
  // shipped cursor is the no-param default), and the hover left over from before
  // the view went away is dropped, because a revealed view is not a hovered one
  // (the pointer may be somewhere else entirely, with no event to say so). The
  // same reset covers a resize across the gate, which changes how the thumb is
  // placed.
  useLayoutEffect(() => {
    if (typeof window.matchMedia !== "function") return;

    const query = window.matchMedia(LEFT_QUERY);
    const sync = () => {
      const next = readThumbVariant();
      const snap = snapRef.current;

      if (snap.frame) cancelAnimationFrame(snap.frame);

      snap.frame = 0;
      snap.row = null;
      setLeftFits(query.matches);
      setVariant((current) => (next === current ? current : next));
      hoveredRef.current = null;
      focusedRef.current = null;
      pointerRef.current = null;
      setHovered(null);
      setFocused(null);
      setDimActive(false);
    };

    sync();
    query.addEventListener("change", sync);

    return () => query.removeEventListener("change", sync);
  }, []);

  // The placement code is shared by pointer, scroll and tween frames, so it
  // reads the active mode through a ref rather than closing over the state.
  useLayoutEffect(() => {
    activeVariantRef.current = activeVariant;
  }, [activeVariant]);

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

  const writeThumb = useCallback((x: number, y: number) => {
    const thumb = thumbRef.current;

    if (!thumb) return;

    thumb.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    snapRef.current.y = y;
  }, []);

  /**
   * The snap variant's row-to-row glide: 200ms on the toggle's leading-edge
   * ease-out cubic, `1-(1-t)^3`. A second row change mid-flight retargets from
   * the current Y, so scrubbing the list is one continuous move instead of a
   * restart.
   */
  const glideTo = useCallback(
    (x: number, y: number) => {
      const snap = snapRef.current;

      stopSnap();
      snap.from = snap.y;
      snap.to = y;
      snap.start = performance.now();

      const tick = () => {
        const thumb = thumbRef.current;

        if (!thumb) {
          snap.frame = 0;
          return;
        }

        const t = Math.min(1, (performance.now() - snap.start) / SNAP_MS);
        const eased = 1 - Math.pow(1 - t, 3);
        const nextY = snap.from + (snap.to - snap.from) * eased;

        writeThumb(x, nextY);
        snap.frame = t < 1 ? requestAnimationFrame(tick) : 0;
      };

      snap.frame = requestAnimationFrame(tick);
    },
    [stopSnap, writeThumb],
  );

  /**
   * Where the thumbnail is. The cursor variant is the shipped one, unchanged:
   * centred on the pointer, or parked at the focused row's right end. The left
   * modes all lock X to the list's left edge and only choose Y: the cursor
   * (follow), the hovered row (snap), or the list block's centre (fixed).
   */
  const placeThumb = useCallback(() => {
    const thumb = thumbRef.current;
    const clip = clipRef.current;

    if (!thumb || !clip) return;

    const clipRect = clip.getBoundingClientRect();
    const point = pointerRef.current;
    const mode = activeVariantRef.current;
    const index = hoveredRef.current ?? focusedRef.current;

    if (mode === "cursor") {
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
        stopSnap();
        snapRef.current.row = null;
        return;
      }

      stopSnap();
      snapRef.current.row = index;
      writeThumb(x, y);
      return;
    }

    const row = index === null ? null : rowRefs.current[index];
    const scroll = scrollRef.current;
    const list = listColumnRef.current;

    if (!row || !scroll || !list) {
      stopSnap();
      snapRef.current.row = null;
      return;
    }

    const scrollRect = scroll.getBoundingClientRect();
    const listRect = list.getBoundingClientRect();
    const rowRect = row.getBoundingClientRect();
    const minTop = visibleTop(scrollRect);
    const maxTop = Math.max(minTop, scrollRect.bottom - THUMB_HEIGHT - 12);
    const x = listRect.left - clipRect.left;

    if (mode === "left-fixed") {
      // One Y for the whole list: its block's centre, kept inside the viewport.
      const centre = listRect.top + listRect.height / 2 - THUMB_HEIGHT / 2;

      stopSnap();
      snapRef.current.row = index;
      writeThumb(x, clamp(centre, minTop, maxTop));
      return;
    }

    if (mode === "left-follow" && hoveredRef.current !== null && point) {
      // Same centring as the shipped thumb; X stays on the list's edge.
      stopSnap();
      snapRef.current.row = index;
      writeThumb(x, point.y - clipRect.top - THUMB_HEIGHT / 2);
      return;
    }

    // The row owns Y: left-snap, and left-follow when a keyboard focus has no
    // pointer to follow.
    const targetY = clamp(
      rowRect.top + rowRect.height / 2 - THUMB_HEIGHT / 2,
      minTop,
      maxTop,
    );
    const snap = snapRef.current;
    const glides =
      mode === "left-snap" &&
      snap.row !== null &&
      snap.row !== index &&
      !prefersReducedMotion();

    if (glides) {
      snap.row = index;
      glideTo(x, targetY);
      return;
    }

    stopSnap();
    snap.row = index;
    writeThumb(x, targetY);
  }, [glideTo, stopSnap, writeThumb]);

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
      stopSnap();
    };
  }, [stopSnap]);

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

  /** A fling cuts the show's crossfade, whichever variant is on. */
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
    // The next show enters where the pointer is, never glides in from the old
    // row's Y.
    stopSnap();
    snapRef.current.row = null;

    if (focusedRef.current === null) scheduleDimClear();
  }, [scheduleDimClear, stopSnap]);

  const leaveList = useCallback(() => {
    pointerRef.current = null;
    hoveredRef.current = null;
    setHovered(null);
    clearDimTimer();
    stopSnap();
    snapRef.current.row = null;

    if (focusedRef.current === null) {
      setDimActive(false);
    } else {
      // A keyboard focus still owns the thumbnail after the pointer leaves;
      // bring its image and its parked position back.
      setSlotsFor(focusedRef.current);
      scheduleThumb();
    }
  }, [clearDimTimer, scheduleThumb, setSlotsFor, stopSnap]);

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
        hoveredRef.current = null;
        setHovered(null);
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
  }, [clearEntrance]);

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

  // The dev-only switch writes the param and swaps the mode in place. The list
  // does not move, but the pointer is not "on" a row for the new mode's
  // purposes, so any hover is dropped.
  const switchVariant = (next: ThumbVariant) => {
    const url = new URL(window.location.href);

    if (next === "cursor") url.searchParams.delete("thumb");
    else url.searchParams.set("thumb", next);

    window.history.replaceState(window.history.state, "", url);
    stopSnap();
    snapRef.current.row = null;
    setVariant(next);
    clearDimTimer();
    hoveredRef.current = null;
    pointerRef.current = null;
    setHovered(null);
    setDimActive(false);
  };

  const currentRow = hovered ?? focused;
  const thumbActive = hovered !== null || focused !== null;

  // Two stacked images; the front one is the current row's cover, swapped by
  // the same crossfade in every variant.
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

  const thumbNode = (
    <div className="wd-work-thumb" ref={thumbRef} aria-hidden="true">
      <div className="wd-work-thumb-in">{mediaSlots}</div>
    </div>
  );

  return (
    <>
      <BlurStack height="calc(var(--wd-nav-inset) + var(--wd-nav-height))" />

      <div id={INDEX_SCROLL_ID} className="wd-index-scroll" ref={scrollRef}>
        <div
          className="wd-index-column wd-work-column"
          ref={rootRef}
          data-thumb={activeVariant}
        >
          <h1 id={INDEX_TITLE_ID} tabIndex={-1} className="wd-work-sr-only">
            Work
          </h1>

          {topControl}

          {process.env.NODE_ENV === "development" ? (
            <div
              className="wd-work-dev"
              role="group"
              aria-label="Thumbnail prototype"
            >
              {VARIANTS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className="wd-work-dev-option"
                  aria-pressed={variant === option.value}
                  onClick={() => switchVariant(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          ) : null}

          <div
            className="wd-work-group"
            data-work-dim={dimActive ? "" : undefined}
            ref={groupRef}
            data-work-active={thumbActive ? "" : undefined}
            data-work-pointer={
              activeVariant === "cursor" && hovered !== null ? "" : undefined
            }
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
                      aria-label={`${work.title}, ${work.year}, ${work.role}`}
                    >
                      <span className="wd-work-year">{work.year}</span>
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
              data-work-variant={activeVariant}
            >
              {thumbNode}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
