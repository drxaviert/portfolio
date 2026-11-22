"use client";

import Link from "next/link";
import type { CSSProperties } from "react";
import { useEffect, useRef } from "react";
import { RingLayers } from "@/components/home/ring-hover";
import { Cover } from "@/components/work/cover";
import { FEATURED_SLUG } from "@/lib/work-order";
import type { WorkMeta } from "@/lib/work";
import { BlurStack } from "./blur-stack";
import { INDEX_SCROLL_ID, INDEX_TITLE_ID } from "./work-index-ids";
import type { WorkVariant } from "./work-variant";
import "./work-bands.css";

/**
 * Variant A — "Composed bands": the featured study at full width, the other two
 * in one row, then a dense index list. It replaces the shipped header, count,
 * grid/list switch and grid, and keeps the drawer's own contract: one scroll
 * box, the index title id, and links into `/work/<slug>`.
 *
 * The card treatment is the homepage's: `--radius-lg`, `--surface-container-low`,
 * `--shadow-card`, no border, 32px padding (20px below md), the 40px/600 title
 * bottom-left over the cover with the same radial scrim, and the ring host's
 * outward-growing hover.
 *
 * `current` never renders this component; WorkIndex keeps its shipped markup.
 */

type ABandVariant = Exclude<WorkVariant, "current" | "e2">;

/**
 * The `tags[0]` the frontmatter does not carry yet. Kept as a study-owned
 * mapping for the prototype instead of touching the content files; the review
 * can replace it with a real `tags` field once the direction is chosen.
 */
const TECHNIQUE: Record<string, string> = {
  "systems-in-motion": "Design system",
  "title-sequence": "Title design",
  "type-in-motion": "Type design",
};

function techniqueFor(work: WorkMeta): string {
  return TECHNIQUE[work.slug] ?? work.cover.replace(/^media:/, "");
}

function kickerFor(work: WorkMeta): string {
  return `${work.year} · ${work.role} · ${techniqueFor(work)}`;
}

/** Where the list was left, like the shipped index's own module memory. */
let bandsScroll = 0;

function isVisible(element: HTMLElement): boolean {
  if (element.getClientRects().length === 0) return false;

  const style = window.getComputedStyle(element);

  return style.visibility !== "hidden" && style.display !== "none";
}

function prefersReducedMotion(): boolean {
  return (
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * The drawer's open timing, repeated as literals because WAAPI cannot read CSS
 * variables (the same reason `LAYOUT_SWITCH_EASE` in work-index.tsx is a
 * literal). The values are `CAROUSEL_OPEN_S` and `CAROUSEL_EASE`.
 */
const MORPH_MS = 900;
const MORPH_EASE = "cubic-bezier(0.25, 0.8, 0.25, 1)";
/** The home entrance's curve, for the two cards that step back in a-full. */
const CALM_EASE = "cubic-bezier(0.4, 0, 0.2, 1)";

type BandMorph = { land: () => void; cancel: () => void };

/**
 * The panel's own transform is the only thing between a child's live rect and
 * its final layout rect. The FLIP writes `translate + scale` about a top-left
 * origin. A child's visual offset inside the panel is simply scaled — the
 * transform origin cancels out — so divide the offset from the panel's visual
 * box, then add the panel's untransformed layout origin.
 */
function untransformedRect(
  element: HTMLElement,
  panel: HTMLElement,
): DOMRect | null {
  const rect = element.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return null;

  const style = window.getComputedStyle(panel);
  const transform = style.transform;
  const panelRect = panel.getBoundingClientRect();
  const parent = panel.offsetParent as HTMLElement | null;
  const parentRect = parent?.getBoundingClientRect();
  const layoutLeft = panel.offsetLeft + (parentRect?.left ?? 0);
  const layoutTop = panel.offsetTop + (parentRect?.top ?? 0);

  if (!transform || transform === "none") {
    return new DOMRect(
      layoutLeft + (rect.left - panelRect.left),
      layoutTop + (rect.top - panelRect.top),
      rect.width,
      rect.height,
    );
  }

  let matrix: DOMMatrixReadOnly;

  try {
    matrix = new DOMMatrixReadOnly(transform);
  } catch {
    return rect;
  }

  // Only the drawer's translate + scale; a rotated or skewed panel is not a
  // shape this prototype can invert.
  if (matrix.b !== 0 || matrix.c !== 0) return rect;

  const scaleX = matrix.a || 1;
  const scaleY = matrix.d || 1;

  return new DOMRect(
    layoutLeft + (rect.left - panelRect.left) / scaleX,
    layoutTop + (rect.top - panelRect.top) / scaleY,
    rect.width / scaleX,
    rect.height / scaleY,
  );
}

/**
 * a-grow / a-full: the homepage's featured card becomes Band 1 while the panel
 * opens. The travelling card is a picture of Band 1 — a clone of the real card
 * with its caption lifted out — so the cover grows with the box while the title
 * stays pinned at the card's bottom-left and translates only.
 *
 * The real Band 1 is hidden for the flight; `land` puts it back at the panel's
 * open beat. Any failure to measure the homepage card returns null and the
 * caller falls back to a-plain.
 */
function startBandMorph(root: HTMLElement): BandMorph | null {
  const panel = root.closest<HTMLElement>(".wd-reader-panel");
  const band = root.querySelector<HTMLElement>('[data-wb-band="1"] .wb-card');
  const caption = root.querySelector<HTMLElement>(
    '[data-wb-band="1"] .wb-caption',
  );
  const title = root.querySelector<HTMLElement>('[data-wb-band="1"] .wb-title');

  if (!panel || !band || !caption || !title) return null;

  const home = [
    ...document.querySelectorAll<HTMLElement>(
      `[data-work-card="${FEATURED_SLUG}"]`,
    ),
  ].find(isVisible);

  if (!home) return null;

  const start = home.getBoundingClientRect();
  const end = untransformedRect(band, panel);
  const captionEnd = untransformedRect(caption, panel);
  const titleEnd = untransformedRect(title, panel);

  if (!end || !captionEnd || !titleEnd) return null;
  if (start.width < 24 || start.height < 24) return null;
  if (end.width < 24 || end.height < 24) return null;
  if (titleEnd.width <= 0 || titleEnd.height <= 0) return null;

  const layer = root.closest<HTMLElement>(".wd-expand-layer");
  const startedAt = Number(layer?.dataset.openStarted);
  const elapsed = Number.isFinite(startedAt)
    ? Math.max(0, performance.now() - startedAt)
    : 0;
  // WAAPI's negative delay starts an animation partway through its own
  // timeline. The clone therefore joins the panel's progress and lands on the
  // panel's beat even if this effect ran a few frames after the open began.
  const delay = -Math.min(elapsed, MORPH_MS - 1);

  const clone = band.cloneNode(true) as HTMLElement;
  clone.querySelectorAll("[id]").forEach((node) => node.removeAttribute("id"));
  // The caption travels on its own so the title never scales with the box.
  clone.querySelector(".wb-caption")?.remove();
  clone.removeAttribute("data-work-card");
  clone.removeAttribute("href");
  clone.setAttribute("aria-hidden", "true");
  clone.setAttribute("tabindex", "-1");
  clone.classList.add("wb-morph");
  Object.assign(clone.style, {
    left: `${end.left}px`,
    top: `${end.top}px`,
    width: `${end.width}px`,
    height: `${end.height}px`,
  });

  const titleClone = title.cloneNode(true) as HTMLElement;
  titleClone
    .querySelectorAll("[id]")
    .forEach((node) => node.removeAttribute("id"));
  titleClone.setAttribute("aria-hidden", "true");
  titleClone.classList.add("wb-morph-title");
  titleClone.classList.remove("ring-title");
  Object.assign(titleClone.style, {
    left: `${titleEnd.left}px`,
    top: `${titleEnd.top}px`,
    width: `${titleEnd.width}px`,
  });

  document.body.append(clone, titleClone);

  const scaleX = start.width / end.width;
  const scaleY = start.height / end.height;
  const moveX = start.left - end.left;
  const moveY = start.top - end.top;

  // The caption's padding is the card's own, both at the start and the end:
  // 32px on md+, 20px below. Starting from the live card's bottom-left keeps
  // the title where the homepage would have put it.
  const padLeft = captionEnd.left - end.left;
  const padBottom = end.bottom - captionEnd.bottom;
  const titleX = start.left + padLeft - titleEnd.left;
  const titleY =
    start.top + start.height - padBottom - titleEnd.height - titleEnd.top;

  const move = clone.animate(
    [
      {
        transform: `translate(${moveX}px, ${moveY}px) scale(${scaleX}, ${scaleY})`,
      },
      { transform: "translate(0px, 0px) scale(1, 1)" },
    ],
    { duration: MORPH_MS, easing: MORPH_EASE, fill: "both", delay },
  );
  const titleMove = titleClone.animate(
    [
      { transform: `translate(${titleX}px, ${titleY}px)` },
      { transform: "translate(0px, 0px)" },
    ],
    { duration: MORPH_MS, easing: MORPH_EASE, fill: "both", delay },
  );

  // The band is the flight's landing frame, not a second copy of it.
  band.style.visibility = "hidden";

  let done = false;

  const clear = () => {
    if (done) return;
    done = true;
    window.clearTimeout(timer);
    move.cancel();
    titleMove.cancel();
    clone.remove();
    titleClone.remove();
    band.style.removeProperty("visibility");
  };

  // A stalled frame loop must not strand a picture of the card over the panel.
  const timer = window.setTimeout(clear, MORPH_MS + 220);

  return { land: clear, cancel: clear };
}

/**
 * a-full: the tracker and the Play card are what the featured card leaves
 * behind. They blur, fade and drop on the Calm curve, then wait for the close.
 */
function blurHomeCards(): Animation[] {
  const cards = [
    ...document.querySelectorAll<HTMLElement>(
      '[data-entrance-item="1"], [data-entrance-item="2"]',
    ),
  ].filter(isVisible);

  return cards.map((card) =>
    card.animate(
      [
        { opacity: 1, filter: "blur(0px)", transform: "translateY(0px)" },
        { opacity: 0, filter: "blur(8px)", transform: "translateY(7px)" },
      ],
      { duration: 450, easing: CALM_EASE, fill: "forwards" },
    ),
  );
}

function BandCard({ work }: { work: WorkMeta }) {
  return (
    <Link
      href={`/work/${work.slug}`}
      className="wb-card ring-host"
      aria-label={work.title}
    >
      <RingLayers fill="bg-surface-container-low" />

      <div className="wb-clip" aria-hidden="true">
        <div className="wb-cover">
          <Cover scene={work.cover} coverImage={work.coverImage} fit="cover" />
        </div>
        <span className="wb-scrim" />
      </div>

      <div className="wb-caption" aria-hidden="true">
        <span className="wb-title-wrap">
          <span className="wb-kicker">{kickerFor(work)}</span>
          <span className="wb-title ring-title">{work.title}</span>
        </span>
      </div>
    </Link>
  );
}

function BandRow({ work, index }: { work: WorkMeta; index: number }) {
  return (
    <li
      className="wb-row-item"
      data-wb-row=""
      style={{ "--wb-i": index } as CSSProperties}
    >
      <Link
        href={`/work/${work.slug}`}
        className="wb-row"
        aria-label={`${work.title}, ${work.year}, ${work.role}`}
      >
        <span className="wb-row-year">{work.year}</span>
        <span className="wb-row-title">{work.title}</span>
        <span className="wb-row-technique">{techniqueFor(work)}</span>
        <span className="wb-row-role">{work.role}</span>

        <div className="wb-row-preview" aria-hidden="true">
          <Cover scene={work.cover} coverImage={work.coverImage} fit="cover" />
        </div>
      </Link>
    </li>
  );
}

export function WorkBands({
  works,
  variant,
}: {
  works: WorkMeta[];
  variant: ABandVariant;
}) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const featured =
    works.find((work) => work.slug === FEATURED_SLUG) ?? works[0];
  const others = works.filter((work) => work !== featured).slice(0, 2);

  useEffect(() => {
    const scroll = scrollRef.current;
    if (!scroll) return;

    scroll.scrollTop = bandsScroll;

    const record = () => {
      bandsScroll = scroll.scrollTop;
    };

    scroll.addEventListener("scroll", record, { passive: true });

    return () => scroll.removeEventListener("scroll", record);
  }, []);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const layer = root.closest<HTMLElement>(".wd-expand-layer");
    if (!layer) return;

    const reduce = prefersReducedMotion();
    let mode: ABandVariant = "a-plain";
    let morph: BandMorph | null = null;
    let othersOut: Animation[] = [];
    let armed = false;
    // A direct load and a step back both mount at rest: there is no open to
    // join, so the content must not replay its entrance.
    let entered = layer.dataset.phase === "open";
    let disposed = false;

    const clearOthers = () => {
      for (const animation of othersOut) animation.cancel();
      othersOut = [];
    };

    const reset = () => {
      morph?.cancel();
      morph = null;
      clearOthers();
      delete root.dataset.wbAnim;
      mode = "a-plain";
    };

    const arm = () => {
      if (armed || disposed) return;
      armed = true;

      if (reduce) return;

      if (variant === "a-grow" || variant === "a-full") {
        morph = startBandMorph(root);

        if (morph) {
          mode = variant;
          if (variant === "a-full") othersOut = blurHomeCards();
        }
      }
    };

    const enter = () => {
      if (entered || disposed) return;
      entered = true;

      morph?.land();
      morph = null;

      if (reduce) return;

      // The CSS picks the timings from this one attribute; setting it in the
      // phase mutation's microtask means the first paint of `open` already has
      // the animation's start state, with no flash of the resting content.
      root.dataset.wbAnim = mode;
    };

    const apply = () => {
      if (disposed) return;

      const phase = layer.dataset.phase;

      if (phase === "opening") {
        arm();
        return;
      }

      if (phase === "open") {
        enter();
        return;
      }

      if (phase === "closing" || phase === "closed") {
        reset();
        armed = false;
        entered = false;
      }
    };

    apply();

    const observer = new MutationObserver(apply);
    observer.observe(layer, {
      attributes: true,
      attributeFilter: ["data-phase"],
    });

    return () => {
      disposed = true;
      observer.disconnect();
      reset();
    };
  }, [variant]);

  if (!featured) {
    return (
      <>
        <BlurStack height="calc(var(--wd-nav-inset) + var(--wd-nav-height))" />
        <div id={INDEX_SCROLL_ID} className="wd-index-scroll">
          <div className="wb-column">
            <h1 id={INDEX_TITLE_ID} tabIndex={-1} className="wb-sr-only">
              Work
            </h1>
            <p className="wb-empty">No studies yet.</p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <BlurStack height="calc(var(--wd-nav-inset) + var(--wd-nav-height))" />

      <div id={INDEX_SCROLL_ID} className="wd-index-scroll" ref={scrollRef}>
        <div className="wb-column" ref={rootRef}>
          <h1 id={INDEX_TITLE_ID} tabIndex={-1} className="wb-sr-only">
            Work
          </h1>

          <section className="wb-bands" aria-label="Case studies">
            <div className="wb-band-1" data-wb-band="1">
              <BandCard work={featured} />
            </div>

            <div className="wb-band-2" data-wb-band="2">
              {others.map((work, index) => (
                <div
                  key={work.slug}
                  className="wb-band-2-cell"
                  style={{ "--wb-i": index } as CSSProperties}
                >
                  <BandCard work={work} />
                </div>
              ))}
            </div>
          </section>

          <ul className="wb-list" aria-label="All studies">
            {works.map((work, index) => (
              <BandRow key={work.slug} work={work} index={index} />
            ))}
          </ul>
        </div>
      </div>
    </>
  );
}
