"use client";

import Link from "next/link";
import type { CSSProperties } from "react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Cover } from "@/components/work/cover";
import type { WorkMeta } from "@/lib/work";
import { BlurStack } from "./blur-stack";
import { INDEX_SCROLL_ID, INDEX_TITLE_ID } from "./work-index-ids";
import "./work-e2.css";

/**
 * E2 — the shipped list, with one shared thumbnail that hangs in the left
 * margin beside the hovered row.
 *
 * The row keeps the shipped list's geometry and voice (year, a 20px/500 title
 * with a 14px summary, a right-aligned role, 18x16 padding, a 12px radius and
 * the surface-container hover fill). What is removed is only the right-hand
 * preview, its gutter, the heading and the grid/list switch: this variant is
 * the list.
 *
 * One thumbnail element exists for the whole list. Hovering a row places it
 * beside that row; moving between rows glides it vertically and crossfades the
 * cover; leaving the list fades it out. It never sits in a row's layout, so the
 * text cannot move under it.
 *
 * Below 1200px, or whenever the left margin cannot hold 136px (120px + 16px
 * gap), the fallback reserves that width inside the row instead: the year is
 * hidden and the thumbnail sits in the row's left padding, clear of the title.
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

const THUMB_W = 120;
const THUMB_H = 90;
/** The thumbnail plus the 16px air between it and the row. */
const MARGIN_NEED = THUMB_W + 16;

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

function fakeFlag(): boolean {
  try {
    return new URLSearchParams(window.location.search).get("fake") === "1";
  } catch {
    return false;
  }
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

type Slots = {
  front: 0 | 1;
  items: [number | null, number | null];
};

export function WorkIndexListE2({ works }: { works: WorkMeta[] }) {
  const [fake] = useState(() => typeof window !== "undefined" && fakeFlag());
  const [mode, setMode] = useState<"margin" | "inset">("margin");
  const [hovered, setHovered] = useState<number | null>(null);
  const [slots, setSlots] = useState<Slots>({
    front: 1,
    items: [null, null],
  });

  const rootRef = useRef<HTMLDivElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const thumbRef = useRef<HTMLDivElement | null>(null);
  const rowRefs = useRef<(HTMLLIElement | null)[]>([]);
  const shownRef = useRef(false);

  const items = useMemo(() => {
    const real = works.map(toE2Item);

    if (!fake) return real;

    return [
      ...real,
      ...FAKE_WORKS.map((item) => ({
        ...item,
        key: `fake-${item.title}`,
      })),
    ];
  }, [works, fake]);

  // A `?fake=1` link on the homepage loses its query on the Work nav. If the
  // flag was present when E2 mounted (the client router can still carry the old
  // search for that render), put it back on /work so the URL always says why the
  // placeholders are there, and share the explicit variant with it.
  useEffect(() => {
    if (!fake) return;

    try {
      const url = new URL(window.location.href);

      if (
        url.searchParams.get("fake") === "1" &&
        url.searchParams.get("wv") === "e2"
      ) {
        return;
      }

      url.pathname = "/work";
      url.searchParams.set("wv", "e2");
      url.searchParams.set("fake", "1");
      window.history.replaceState(window.history.state, "", url);
    } catch {
      // The rows are already gated on the flag; a blocked URL write is harmless.
    }
  }, [fake]);

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

  // Measure the real left margin, not the panel's opening scale: dividing by
  // the panel's scale makes the result the same during the FLIP and at rest.
  // The thumbnail needs 136px; below 1200 the design uses the in-row fallback
  // by rule even if a wide window could fit it. This is a layout effect so a
  // direct load never paints the margin layout for a frame before switching.
  useLayoutEffect(() => {
    const measure = () => {
      const list = listRef.current;
      const row = rowRefs.current[0];
      const panel = list?.closest<HTMLElement>(".wd-reader-panel");

      if (!list || !row || !panel) return;

      const panelRect = panel.getBoundingClientRect();
      const scale = panel.offsetWidth ? panelRect.width / panel.offsetWidth : 1;
      const space =
        (row.getBoundingClientRect().left - panelRect.left) / (scale || 1);

      const next =
        window.innerWidth >= 1200 && space >= MARGIN_NEED ? "margin" : "inset";

      setMode((previous) => (previous === next ? previous : next));
    };

    measure();
    window.addEventListener("resize", measure);

    const layer = listRef.current?.closest<HTMLElement>(".wd-expand-layer");
    const observer = new MutationObserver(measure);
    if (layer) {
      observer.observe(layer, {
        attributes: true,
        attributeFilter: ["data-phase"],
      });
    }

    return () => {
      window.removeEventListener("resize", measure);
      observer.disconnect();
    };
  }, [items.length]);

  // Place the one thumbnail beside the hovered row. The first appearance snaps
  // vertically (only the 8px enter and fade play); later rows glide.
  useLayoutEffect(() => {
    if (hovered === null) return;

    const thumb = thumbRef.current;
    const row = rowRefs.current[hovered];

    if (!thumb || !row) return;

    const y = row.offsetTop + row.offsetHeight / 2 - THUMB_H / 2;

    thumb.style.setProperty("--e2-y", `${y}px`);

    if (!shownRef.current) {
      shownRef.current = true;
      thumb.dataset.e2Snap = "";
      void thumb.offsetHeight;
      requestAnimationFrame(() => {
        delete thumb.dataset.e2Snap;
      });
    }
  }, [hovered]);

  // The row entrance joins the drawer's open, exactly as the A bands do. A
  // mount at rest (direct load or a step back) stays still.
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
        if (!reduce) root.dataset.e2Anim = "on";
        return;
      }

      if (phase === "closing" || phase === "closed") {
        entered = false;
        delete root.dataset.e2Anim;
        // The pointer is still over a row while the panel leaves; a reopen must
        // not show the last hover's thumbnail before the next hover.
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
    };
  }, []);

  const show = (index: number) => {
    if (!canHover()) return;
    if (hovered === index) return;

    setHovered(index);
    setSlots((previous) => {
      if (previous.items[previous.front] === index) return previous;

      const front: 0 | 1 = previous.front === 0 ? 1 : 0;
      const next: [number | null, number | null] = [...previous.items];
      next[front] = index;

      return { front, items: next };
    });
  };

  const hide = () => {
    setHovered(null);
  };

  return (
    <>
      <BlurStack height="calc(var(--wd-nav-inset) + var(--wd-nav-height))" />

      <div
        id={INDEX_SCROLL_ID}
        className="wd-index-scroll wd-e2-scroll"
        ref={scrollRef}
      >
        <div className="wd-index-column wd-e2-column" ref={rootRef}>
          <h1 id={INDEX_TITLE_ID} tabIndex={-1} className="wd-e2-sr-only">
            Work
          </h1>

          <div
            className="wd-e2-list-wrap"
            ref={listRef}
            data-e2-mode={mode}
            data-e2-active={hovered !== null ? "" : undefined}
            onPointerLeave={hide}
          >
            <ul className="wd-e2-list" aria-label="Case studies">
              {items.map((item, index) => (
                <li
                  key={item.key}
                  ref={(element) => {
                    rowRefs.current[index] = element;
                  }}
                  className="wd-e2-row-item"
                  style={{ "--e2-i": index } as CSSProperties}
                >
                  {item.slug ? (
                    <Link
                      href={`/work/${item.slug}`}
                      className="wd-e2-row"
                      aria-label={`${item.title}, ${item.year}, ${item.role}`}
                      onPointerEnter={() => show(index)}
                    >
                      <span className="wd-e2-year">{item.year}</span>
                      <span className="wd-e2-main">
                        <span className="wd-e2-title">{item.title}</span>
                        <span className="wd-e2-summary">{item.summary}</span>
                      </span>
                      <span className="wd-e2-role">{item.role}</span>
                    </Link>
                  ) : (
                    <div
                      className="wd-e2-row wd-e2-row--fake"
                      onPointerEnter={() => show(index)}
                    >
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

            <div className="wd-e2-thumb" ref={thumbRef} aria-hidden="true">
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
          </div>
        </div>
      </div>
    </>
  );
}
