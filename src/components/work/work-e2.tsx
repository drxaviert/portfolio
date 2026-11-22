"use client";

import Link from "next/link";
import { createPortal } from "react-dom";
import type {
  CSSProperties,
  FocusEvent as ReactFocusEvent,
  PointerEvent as ReactPointerEvent,
} from "react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { Cover } from "@/components/work/cover";
import type { WorkMeta } from "@/lib/work";
import { BlurStack } from "./blur-stack";
import { INDEX_SCROLL_ID, INDEX_TITLE_ID } from "./work-index-ids";
import "./work-e2.css";

/**
 * E2 — the shipped list with a permanent left rail and one shared thumbnail.
 *
 * At 1200px and up the index is a centred group: a 240px rail, a 24px gap and
 * an 880px list column. The rail is empty at rest. One 240x180 thumbnail lives
 * in it, aligned to the hovered row and clamped below the nav and above the
 * panel's bottom edge. Below 1200 the rail collapses and the thumbnail moves
 * into the row's left padding (160x120 from 768, 120x90 below that), with the
 * year hidden so the title starts beside it.
 *
 * The row keeps the shipped list's voice: an 80px year, a 20px/500 title with
 * a 14px summary, a 160px right role, 18x16 padding, a 12px radius and the
 * surface-container hover fill.
 *
 * Scrolling uses the pointer's last position: a rAF-throttled scroll handler
 * finds the row under it with elementFromPoint and moves the same thumbnail,
 * so a stationary pointer stays attached to the row travelling under it. Fast
 * scrolling shortens the glide to 120ms; leaving the list hides it.
 */

type E2Item = {
  key: string;
  title: string;
  year: string;
  summary: string;
  role: string;
  slug?: string;
  cover?: WorkMeta["cover"];
  coverImage?: WorkMeta["coverImage"];
  gradient?: string;
};

type FakeMode = 0 | 1 | 2;

const THUMB_FALLBACK_H = 120;
const ENTRANCE_MAX = 12;
const FAST_SCROLL_PX_PER_MS = 1.5;

const FAKE_WORKS: Omit<E2Item, "key">[] = [
  {
    title: "Tidal",
    year: "2019",
    summary: "A placeholder study for the shared-thumbnail review.",
    role: "Studio",
    gradient: "linear-gradient(160deg, #c8d8e4 0%, #6f93a8 55%, #253746 100%)",
  },
  {
    title: "Lumen",
    year: "2020",
    summary: "A placeholder study for the shared-thumbnail review.",
    role: "Studio",
    gradient: "linear-gradient(145deg, #f2e2c4 0%, #e0a86b 50%, #8a4b2a 100%)",
  },
  {
    title: "Soft Focus",
    year: "2021",
    summary: "A placeholder study for the shared-thumbnail review.",
    role: "Studio",
    gradient: "linear-gradient(135deg, #e9e3f1 0%, #b6a7c9 55%, #5f5273 100%)",
  },
  {
    title: "Driftfield",
    year: "2022",
    summary: "A placeholder study for the shared-thumbnail review.",
    role: "Studio",
    gradient: "linear-gradient(150deg, #dfe8d7 0%, #9db58a 55%, #455a37 100%)",
  },
  {
    title: "Paper planes",
    year: "2023",
    summary: "A placeholder study for the shared-thumbnail review.",
    role: "Studio",
    gradient: "linear-gradient(135deg, #f4f1ea 0%, #d8cdb7 55%, #8a7a62 100%)",
  },
  {
    title: "Night clock",
    year: "2024",
    summary: "A placeholder study for the shared-thumbnail review.",
    role: "Studio",
    gradient: "linear-gradient(150deg, #1b2438 0%, #364b73 55%, #0b0f19 100%)",
  },
  {
    title: "Halftone",
    year: "2025",
    summary: "A placeholder study for the shared-thumbnail review.",
    role: "Studio",
    gradient: "linear-gradient(135deg, #e7e7e7 0%, #9a9a9a 45%, #2b2b2b 100%)",
  },
  {
    title: "Orrery",
    year: "2019",
    summary: "A placeholder study for the shared-thumbnail review.",
    role: "Studio",
    gradient: "linear-gradient(150deg, #1f2a2f 0%, #6d8a8f 55%, #d4b483 100%)",
  },
  {
    title: "Static",
    year: "2023",
    summary: "A placeholder study for the shared-thumbnail review.",
    role: "Studio",
    gradient: "linear-gradient(135deg, #d7d2cc 0%, #8e8880 50%, #3b3834 100%)",
  },
];

/**
 * fake=2: thirty placeholders from the nine names, plus three one-off
 * variations. Years cycle through 2014-2025.
 */
const LONG_FAKE_WORKS: E2Item[] = (() => {
  const variations = FAKE_WORKS.flatMap((work) => [
    work,
    { ...work, title: `${work.title} II` },
    { ...work, title: `${work.title} (study)` },
  ]);
  const extras: Omit<E2Item, "key">[] = [
    { ...FAKE_WORKS[0], title: "Tidal III" },
    { ...FAKE_WORKS[4], title: "Paper planes — notes" },
    { ...FAKE_WORKS[8], title: "Static (alt)" },
  ];

  return [...variations, ...extras].map((work, index) => ({
    ...work,
    key: `fake2-${index}-${work.title}`,
    year: String(2014 + (index % 12)),
    summary: "A placeholder study for the long-list review.",
  }));
})();

/** The list's own scroll memory, like the shipped index's module variable. */
let e2Scroll = 0;

function prefersReducedMotion(): boolean {
  return (
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function canHover(): boolean {
  return (
    typeof window.matchMedia === "function" &&
    window.matchMedia("(hover: hover) and (pointer: fine)").matches
  );
}

function readFakeMode(): FakeMode {
  try {
    const value = new URLSearchParams(window.location.search).get("fake");
    if (value === "2") return 2;
    if (value === "1") return 1;
    return 0;
  } catch {
    return 0;
  }
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

function toE2Item(work: WorkMeta): E2Item {
  return {
    key: work.slug,
    title: work.title,
    year: work.year,
    summary: work.summary,
    role: work.role,
    slug: work.slug,
    cover: work.cover,
    coverImage: work.coverImage,
  };
}

function ThumbVisual({ item }: { item: E2Item }) {
  if (item.gradient) {
    return (
      <span
        className="wd-e2-thumb-grad"
        style={{ backgroundImage: item.gradient }}
      />
    );
  }

  return (
    <Cover
      scene={item.cover ?? "tiles"}
      coverImage={item.coverImage}
      fit="cover"
    />
  );
}

type Slots = { front: 0 | 1; items: [number | null, number | null] };

// The v5 layer needs the body after hydration; an external-store read is the
// lint-safe way to know the client render is live without a mount effect.
const subscribeClient = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

export function WorkIndexListE2({
  works,
  version,
}: {
  works: WorkMeta[];
  version: "v1" | "v2" | "v3" | "v4" | "v5";
}) {
  const [fake] = useState<FakeMode>(() =>
    typeof window !== "undefined" ? readFakeMode() : 0,
  );
  const [mode, setMode] = useState<"margin" | "inset">("margin");
  const [wide, setWide] = useState(false);
  const [v4Width, setV4Width] = useState(240);
  const [hovered, setHovered] = useState<number | null>(null);
  const [focused, setFocused] = useState<number | null>(null);
  const [dimActive, setDimActive] = useState(false);
  const portalReady = useSyncExternalStore(
    subscribeClient,
    getClientSnapshot,
    getServerSnapshot,
  );
  const [slots, setSlots] = useState<Slots>({
    front: 1,
    items: [null, null],
  });

  const rootRef = useRef<HTMLDivElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const groupRef = useRef<HTMLDivElement | null>(null);
  const listColumnRef = useRef<HTMLDivElement | null>(null);
  const thumbRef = useRef<HTMLDivElement | null>(null);
  const rowRefs = useRef<(HTMLLIElement | null)[]>([]);
  const shownRef = useRef(false);
  const hoveredRef = useRef<number | null>(null);
  const focusedRef = useRef<number | null>(null);
  const dimTimerRef = useRef<number | null>(null);
  const pointerRef = useRef<{ x: number; y: number } | null>(null);
  const rafRef = useRef<number | null>(null);
  const fastRef = useRef(false);
  const fastTimerRef = useRef<number | null>(null);
  const lastScrollRef = useRef({ top: 0, time: 0 });
  const velocityRef = useRef(0);
  const v5LayerRef = useRef<HTMLDivElement | null>(null);
  const v5FrameRef = useRef(0);

  const items = useMemo(() => {
    const real = works.map(toE2Item);

    if (fake === 1) {
      return [
        ...real,
        ...FAKE_WORKS.map((item) => ({
          ...item,
          key: `fake-${item.title}`,
        })),
      ];
    }

    if (fake === 2) return [...real, ...LONG_FAKE_WORKS];

    return real;
  }, [works, fake]);

  // A `?fake=1` or `?fake=2` link on the homepage loses its query on the Work
  // nav. If the flag was present when E2 mounted (the client router can still
  // carry the old search for that render), put it back on /work so the URL
  // always says why the placeholders are there, and keep the version's own wv.
  useEffect(() => {
    if (!fake) return;

    const variantParam =
      version === "v1"
        ? "e2-v1"
        : version === "v3"
          ? "e2-v3"
          : version === "v4"
            ? "e2-v4"
            : version === "v5"
              ? "e2-v5"
              : "e2";

    try {
      const url = new URL(window.location.href);
      const same =
        url.searchParams.get("wv") === variantParam &&
        url.searchParams.get("fake") === String(fake);

      if (same) return;

      url.pathname = "/work";
      url.searchParams.set("wv", variantParam);
      url.searchParams.set("fake", String(fake));
      window.history.replaceState(window.history.state, "", url);
    } catch {
      // The rows are already gated on the flag; a blocked URL write is harmless.
    }
  }, [fake, version]);

  // The list keeps its place while a study takes the panel.
  useLayoutEffect(() => {
    const scroll = scrollRef.current;
    if (!scroll) return;

    scroll.scrollTop = e2Scroll;

    const record = () => {
      e2Scroll = scroll.scrollTop;
    };

    scroll.addEventListener("scroll", record, { passive: true });

    return () => scroll.removeEventListener("scroll", record);
  }, []);

  // The scrollbar gutter makes the scroll content narrower than the panel. Put
  // that width on the column's left padding so the rail + gap + list stays on
  // the panel's true centre instead of half a gutter to its left.
  useLayoutEffect(() => {
    const scroll = scrollRef.current;
    const root = rootRef.current;

    if (!scroll || !root) return;

    const update = () => {
      const gutter = Math.max(0, scroll.offsetWidth - scroll.clientWidth);
      root.style.setProperty("--e2-gutter", `${gutter}px`);
    };

    update();
    window.addEventListener("resize", update);

    const observer = new ResizeObserver(update);
    observer.observe(scroll);

    return () => {
      window.removeEventListener("resize", update);
      observer.disconnect();
    };
  }, []);

  // e2-v1, v3 and v4 keep the 2fb7c3f margin rule. v1/v3 need 136px for their
  // 120px thumbnail; v3's 240px form needs 256px. v4's thumbnail is fluid:
  // width = min(240, space - 16 gap - 8 breathing), 4:3, with 120 as its
  // minimum; under 120 it uses v1's 152px in-row fallback. The panel's opening
  // scale is divided out so the chosen mode is right on the first frame.
  useLayoutEffect(() => {
    if (version === "v2" || version === "v5") return;

    const measure = () => {
      const list = listColumnRef.current;
      const row = rowRefs.current[0];
      const panel = list?.closest<HTMLElement>(".wd-reader-panel");

      if (!list || !row || !panel) return;

      const panelRect = panel.getBoundingClientRect();
      const scale = panel.offsetWidth ? panelRect.width / panel.offsetWidth : 1;
      const space =
        (row.getBoundingClientRect().left - panelRect.left) / (scale || 1);
      const fluid = Math.min(240, Math.max(0, space - 24));
      const next =
        window.innerWidth >= 1200 &&
        (version === "v4" ? fluid >= 120 : space >= 136)
          ? "margin"
          : "inset";
      const nextWide =
        version === "v3" && window.innerWidth >= 1200 && space >= 256;

      setMode((previous) => (previous === next ? previous : next));
      setWide((previous) => (previous === nextWide ? previous : nextWide));

      if (version === "v4") {
        const nextWidth = fluid >= 120 ? fluid : 120;
        setV4Width((previous) =>
          Math.abs(previous - nextWidth) < 0.25 ? previous : nextWidth,
        );
      }
    };

    measure();
    window.addEventListener("resize", measure);

    const layer =
      listColumnRef.current?.closest<HTMLElement>(".wd-expand-layer");
    const observer = new MutationObserver(measure);
    const panel =
      listColumnRef.current?.closest<HTMLElement>(".wd-reader-panel");
    const resizeObserver =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(measure)
        : null;

    if (layer) {
      observer.observe(layer, {
        attributes: true,
        attributeFilter: ["data-phase"],
      });
    }

    if (listColumnRef.current) {
      resizeObserver?.observe(listColumnRef.current);
    }

    if (panel) resizeObserver?.observe(panel);

    return () => {
      window.removeEventListener("resize", measure);
      observer.disconnect();
      resizeObserver?.disconnect();
    };
  }, [version, items.length]);

  // The nav clearance is measured from the dock in `visibleTop`, so the value
  // follows the drawer's actual nav row on resize and at both breakpoints.

  /**
   * Put the one thumbnail beside a row and clamp its viewport box between the
   * nav's bottom edge and the panel's bottom edge. The y is written in the
   * group's coordinates, so it survives the scroll and is recomputed each
   * scroll frame.
   */
  const placeThumb = useCallback(
    (index: number, snap = false) => {
      const thumb = thumbRef.current;
      const group = groupRef.current;
      const list = listColumnRef.current;
      const scroll = scrollRef.current;
      const row = rowRefs.current[index];

      if (!thumb || !group || !list || !scroll || !row) return;

      const rowRect = row.getBoundingClientRect();
      const scrollRect = scroll.getBoundingClientRect();
      const height = thumb.offsetHeight || THUMB_FALLBACK_H;
      const minTop = visibleTop(scrollRect);
      const maxTop = scrollRect.bottom - height - 12;
      const v3Wide = version === "v3" && wide;
      const v4Fluid = version === "v4" && mode === "margin";
      const topAligned = v3Wide || v4Fluid;
      const desired = topAligned
        ? rowRect.top
        : rowRect.top + rowRect.height / 2 - height / 2;
      const clamped = Math.min(
        Math.max(desired, minTop),
        Math.max(minTop, maxTop),
      );
      const listRect = list.getBoundingClientRect();
      let left: string;

      if (v4Fluid) {
        // v4: fluid width = min(240, space - 24), right edge 16px left of the
        // row, top aligned. The left keeps the 8px breathing room for the
        // shadow until the width caps at 240.
        left = `${rowRect.left - (v4Width + 16)}px`;
      } else if (v3Wide) {
        // v3: the 240px thumbnail's top sits on the row's top and its right edge
        // stays 16px left of the row; the margin has 256px to give it.
        left = `${rowRect.left - 256}px`;
      } else if (version === "v1" || version === "v3" || version === "v4") {
        // 2fb7c3f: the 120px thumbnail hangs 16px left of the row in the margin;
        // the fallback reserves 152px inside the row and puts it 16px in.
        left =
          mode === "margin"
            ? `${rowRect.left - 136}px`
            : `${listRect.left + 16}px`;
      } else {
        // 3d07ab9: the 240px thumbnail fills the rail; the fallback uses the
        // row's left padding.
        const railMode =
          window.matchMedia("(min-width: 1200px)").matches && canHover();
        left = `${railMode ? group.getBoundingClientRect().left : listRect.left + 16}px`;
      }

      if (thumb.style.left !== left) thumb.style.left = left;
      thumb.style.setProperty("--e2-y", `${clamped}px`);

      if (snap) {
        thumb.dataset.e2Snap = "";
        void thumb.offsetHeight;
        requestAnimationFrame(() => {
          delete thumb.dataset.e2Snap;
        });
      }
    },
    [version, mode, wide, v4Width],
  );

  // e2-v5 sits on the cursor with no easing: the outer box is translated by
  // (cursor - layer origin - half the 480x360 box), so its centre is the
  // pointer. The layer is portalled to the body above the nav and clipped only
  // by the viewport, so the box is never shifted back inside: anything past an
  // edge is simply cut. Keyboard focus parks the same box at the focused row's
  // right end.
  const placeV5 = useCallback(() => {
    if (version !== "v5") return;

    const thumb = thumbRef.current;
    const layer = v5LayerRef.current;

    if (!thumb || !layer) return;

    const layerRect = layer.getBoundingClientRect();
    const point = pointerRef.current;
    let x: number;
    let y: number;

    if (hoveredRef.current !== null && point) {
      x = point.x - layerRect.left - 240;
      y = point.y - layerRect.top - 180;
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
        Math.max(listRect.left + 12, rowRect.right - 480 - 16) - layerRect.left;
      y =
        Math.max(minTop, Math.min(rowRect.top, scrollRect.bottom - 360 - 12)) -
        layerRect.top;
    } else {
      return;
    }

    thumb.style.transform = `translate3d(${x}px, ${y}px, 0)`;
  }, [version]);

  // One write per frame, always from the latest pointer event.
  const scheduleV5 = useCallback(() => {
    if (version !== "v5" || v5FrameRef.current) return;

    v5FrameRef.current = requestAnimationFrame(() => {
      v5FrameRef.current = 0;
      placeV5();
    });
  }, [placeV5, version]);

  const clearDimTimer = useCallback(() => {
    if (dimTimerRef.current) {
      window.clearTimeout(dimTimerRef.current);
      dimTimerRef.current = null;
    }
  }, []);

  const scheduleDimClear = useCallback(() => {
    clearDimTimer();
    dimTimerRef.current = window.setTimeout(() => {
      dimTimerRef.current = null;
      if (hoveredRef.current === null && focusedRef.current === null) {
        setDimActive(false);
      }
    }, 80);
  }, [clearDimTimer]);

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
    } else if (version === "v5") {
      // A keyboard focus still owns the thumbnail after the pointer leaves;
      // bring its image back if the hover had replaced it.
      setSlotsFor(focusedRef.current);
    }
  }, [clearDimTimer, setSlotsFor, version]);

  const onFocus = (event: ReactFocusEvent<HTMLDivElement>) => {
    const target = event.target;

    if (!(target instanceof HTMLElement) || !target.matches(":focus-visible")) {
      return;
    }

    const row = target.closest<HTMLElement>("[data-e2-index]");
    if (!row) return;

    const index = Number(row.dataset.e2Index);
    if (!Number.isInteger(index)) return;

    focusedRef.current = index;
    setFocused(index);
    clearDimTimer();
    setDimActive(true);

    if (version === "v5" && hoveredRef.current === null) {
      setSlotsFor(index);
      scheduleV5();
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
      if (dimTimerRef.current) window.clearTimeout(dimTimerRef.current);
    };
  }, []);

  const clearEntrance = useCallback(() => {
    for (const row of rowRefs.current) {
      if (!row) continue;
      row.removeAttribute("data-e2-enter");
      row.style.removeProperty("--e2-enter-i");
    }
  }, []);

  // Place the thumbnail after a hover (mouse or scroll). The first appearance
  // snaps vertically; the 8px enter and fade still play from the CSS. v5 has
  // its own cursor rAF instead.
  useLayoutEffect(() => {
    if (version === "v5" || hovered === null) return;

    placeThumb(hovered, !shownRef.current);
    shownRef.current = true;
  }, [hovered, placeThumb, version]);

  // Switching E2 versions (or crossing a v1/v3/v4 margin threshold or a v4
  // width step) keeps the same hovered row but changes the rail, size, x and
  // vertical alignment; re-place it in the new layout.
  useLayoutEffect(() => {
    if (version === "v5") return;
    if (hoveredRef.current !== null) placeThumb(hoveredRef.current);
  }, [version, mode, wide, v4Width, placeThumb]);

  // A resize moves the clamp edges under the same row.
  useEffect(() => {
    if (version === "v5") return;

    const onResize = () => {
      if (hoveredRef.current !== null) placeThumb(hoveredRef.current);
    };

    window.addEventListener("resize", onResize);

    return () => window.removeEventListener("resize", onResize);
  }, [placeThumb, version]);

  // Scroll with a stationary pointer: find the row now under the last pointer
  // position and move the same thumbnail onto it. The scroll velocity switches
  // the glide and crossfade to 120ms so the thumbnail stays with the rows.
  useEffect(() => {
    const scroll = scrollRef.current;
    const list = listColumnRef.current;
    const thumb = thumbRef.current;

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
          ? element.closest<HTMLElement>("[data-e2-index]")
          : null;

      if (!row || !list.contains(row)) {
        if (!(element instanceof Element) || !list.contains(element)) {
          leaveList();
          return;
        }
        hide();
        return;
      }

      const index = Number(row.dataset.e2Index);

      if (!Number.isInteger(index)) return;

      // During a fast fling the position still follows the row, but the cover
      // stays put until the scroll settles: crossfading thirty covers while the
      // list flies is the jitter, not the 120ms glide.
      if (!fastRef.current) show(index);
      if (version === "v5") scheduleV5();
      else placeThumb(index);
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
        thumb?.setAttribute("data-e2-fast", "");
      }

      if (fastRef.current) {
        if (fastTimerRef.current) window.clearTimeout(fastTimerRef.current);
        fastTimerRef.current = window.setTimeout(() => {
          fastRef.current = false;
          velocityRef.current = 0;
          thumb?.removeAttribute("data-e2-fast");
          updateFromPoint();
        }, 140);
      }

      if (!rafRef.current) {
        rafRef.current = requestAnimationFrame(() => {
          rafRef.current = null;
          updateFromPoint();
        });
      }
    };

    scroll.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      scroll.removeEventListener("scroll", onScroll);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (fastTimerRef.current) window.clearTimeout(fastTimerRef.current);
      thumb?.removeAttribute("data-e2-fast");
    };
  }, [hide, leaveList, placeThumb, scheduleV5, show, version]);

  // v5 tracks the pointer exactly, so there is no loop and no easing to read:
  // every move schedules one write, and the image crossfade stays on the inner
  // element. The layer is portalled to the body so it can paint above the nav;
  // portalReady keeps the server render free of it.
  useEffect(() => {
    if (version !== "v5" || !portalReady) return;

    if (pointerRef.current || focusedRef.current !== null) scheduleV5();
  }, [portalReady, scheduleV5, version]);

  useEffect(() => {
    return () => {
      if (v5FrameRef.current) cancelAnimationFrame(v5FrameRef.current);
    };
  }, []);

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
                row.dataset.e2Enter = "";
                row.style.setProperty("--e2-enter-i", String(stagger));
                stagger += 1;
              }
            }

            if (stagger > 0) root.dataset.e2Anim = "on";
          }
        }

        return;
      }

      if (phase === "closing" || phase === "closed") {
        entered = false;
        delete root.dataset.e2Anim;
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
      delete root.dataset.e2Anim;
      clearEntrance();
    };
  }, [clearEntrance]);

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!canHover()) return;

    pointerRef.current = { x: event.clientX, y: event.clientY };
    scheduleV5();

    const row = (event.target as Element).closest<HTMLElement>(
      "[data-e2-index]",
    );

    if (!row) {
      hide();
      return;
    }

    const index = Number(row.dataset.e2Index);

    if (Number.isInteger(index)) show(index);
  };

  const onPointerLeave = () => {
    leaveList();
  };

  const currentRow = hovered ?? focused;
  const thumbActive =
    hovered !== null || (version === "v5" && focused !== null);

  const thumbNode = (
    <div
      className="wd-e2-thumb"
      ref={thumbRef}
      aria-hidden="true"
      style={
        version === "v4"
          ? ({
              "--e2-thumb-w": `${v4Width}px`,
              "--e2-thumb-h": `${v4Width * 0.75}px`,
            } as CSSProperties)
          : undefined
      }
    >
      <div className="wd-e2-thumb-in">
        {([0, 1] as const).map((slot) => {
          const index = slots.items[slot];
          const item = index === null ? null : items[index];

          return (
            <div
              key={slot}
              className="wd-e2-thumb-layer"
              data-front={slots.front === slot ? "" : undefined}
            >
              {item ? <ThumbVisual item={item} /> : null}
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <>
      <BlurStack height="calc(var(--wd-nav-inset) + var(--wd-nav-height))" />

      <div
        id={INDEX_SCROLL_ID}
        className="wd-index-scroll wd-e2-scroll"
        ref={scrollRef}
      >
        <div
          className="wd-index-column wd-e2-column"
          data-e2-layout={version === "v2" ? "rail" : "margin"}
          data-e2-version={version}
          ref={rootRef}
        >
          <h1 id={INDEX_TITLE_ID} tabIndex={-1} className="wd-e2-sr-only">
            Work
          </h1>

          <div
            className="wd-e2-group"
            data-e2-layout={version === "v2" ? "rail" : "margin"}
            data-e2-version={version}
            data-e2-mode={
              version === "v1" || version === "v3" || version === "v4"
                ? mode
                : undefined
            }
            data-e2-wide={version === "v3" && wide ? "" : undefined}
            data-e2-dim={
              (version === "v4" || version === "v5") && dimActive
                ? ""
                : undefined
            }
            ref={groupRef}
            data-e2-active={thumbActive ? "" : undefined}
          >
            {version === "v2" ? (
              <div className="wd-e2-rail" aria-hidden="true" />
            ) : null}

            <div
              className="wd-e2-list-column"
              ref={listColumnRef}
              onPointerMove={onPointerMove}
              onPointerLeave={onPointerLeave}
              onFocus={onFocus}
              onBlur={onBlur}
            >
              <ul className="wd-e2-list" aria-label="Case studies">
                {items.map((item, index) => (
                  <li
                    key={item.key}
                    ref={(element) => {
                      rowRefs.current[index] = element;
                    }}
                    className="wd-e2-row-item"
                    data-e2-index={index}
                    data-e2-current={
                      (version === "v4" || version === "v5") &&
                      currentRow === index
                        ? ""
                        : undefined
                    }
                  >
                    {item.slug ? (
                      <Link
                        href={`/work/${item.slug}`}
                        className="wd-e2-row"
                        aria-label={`${item.title}, ${item.year}, ${item.role}`}
                      >
                        <span className="wd-e2-year">{item.year}</span>
                        <span className="wd-e2-main">
                          <span className="wd-e2-title">{item.title}</span>
                          <span className="wd-e2-summary">{item.summary}</span>
                        </span>
                        <span className="wd-e2-role">{item.role}</span>
                      </Link>
                    ) : (
                      <div className="wd-e2-row wd-e2-row--fake">
                        <span className="wd-e2-year">{item.year}</span>
                        <span className="wd-e2-main">
                          <span className="wd-e2-title">{item.title}</span>
                          <span className="wd-e2-summary">{item.summary}</span>
                        </span>
                        <span className="wd-e2-role">{item.role}</span>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>

            {version === "v5" ? null : thumbNode}
          </div>
        </div>
      </div>

      {version === "v5" && portalReady
        ? createPortal(
            <div
              className="wd-e2-v5-layer"
              ref={v5LayerRef}
              aria-hidden="true"
              data-e2-active={thumbActive ? "" : undefined}
            >
              {thumbNode}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
