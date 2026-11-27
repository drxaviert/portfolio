"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { PointerEvent as ReactPointerEvent, RefObject } from "react";
import { useLayoutEffect, useRef, useState } from "react";
import { isPhaseSwitching } from "@/lib/theme";
import { layoutZoom } from "./layout-zoom";
import { GlideCapsule } from "./glide-capsule";
import { NAV_ITEM_CLASS } from "./nav-item-class";
import { NavGlyphIcon } from "./nav-glyph-icon";
import "./nav-items.css";

const LINKS = [
  { label: "Work", href: "/work" },
  { label: "Play" },
  { label: "About" },
];

/**
 * Work is current only on its own route. The home page and the prototype are
 * not the work section, so there it keeps the plain resting style and only the
 * Glide hover capsule marks the pointer.
 */
function isCurrent(pathname: string, href?: string): boolean {
  return (
    href !== undefined && (pathname === href || pathname.startsWith(`${href}/`))
  );
}

const CLIPPED_CLASS = "min-w-0 truncate";

const NO_CLIPS: readonly number[] = [];

const GLYPH_CLASS = [
  "nav-glyph relative hidden size-8 shrink-0 cursor-pointer items-center justify-center",
  "rounded-md text-on-surface-variant md:flex",
  "outline-hidden focus-visible:outline-solid focus-visible:outline-2",
  "focus-visible:outline-offset-0 focus-visible:outline-primary",
].join(" ");

/**
 * The labels that no longer fit in their item, so only those get the clip that
 * makes `text-overflow` draw the ellipsis. A clipped item rasterises its text
 * differently from an unclipped one, so a label that fits keeps its exact
 * resting pixels; the label still comes from its own width, and the capsule
 * measures the item's real box either way.
 */
function useClippedLabels(
  items: RefObject<(HTMLElement | null)[]>,
  count: number,
): readonly number[] {
  const [clipped, setClipped] = useState<readonly number[]>(NO_CLIPS);

  useLayoutEffect(() => {
    let alive = true;

    const check = () => {
      if (!alive) return;

      const next: number[] = [];
      for (let index = 0; index < count; index += 1) {
        const node = items.current[index];
        if (!node) continue;

        // The text's own width, which a clip does not shrink, against the room
        // the item's padding leaves. Measuring the item's overflow instead
        // would clear the clip that hides it and flip back every frame.
        const range = document.createRange();
        range.selectNodeContents(node);
        // jsdom has no Range metrics; the item's own scroll width is the same
        // number there (and 0 either way, so nothing clips in tests).
        const text =
          typeof range.getBoundingClientRect === "function"
            ? range.getBoundingClientRect().width / layoutZoom(node)
            : node.scrollWidth;
        const style = window.getComputedStyle(node);
        const padding =
          (Number.parseFloat(style.paddingLeft) || 0) +
          (Number.parseFloat(style.paddingRight) || 0);
        const room = node.clientWidth - padding;

        if (text > room + 1) next.push(index);
      }

      setClipped((previous) =>
        previous.length === next.length &&
        previous.every((value, index) => value === next[index])
          ? previous
          : next,
      );
    };

    const observer = new ResizeObserver(check);
    for (const node of items.current) {
      if (node) observer.observe(node);
    }
    // A font swap changes every label's width, and the observer cannot see it.
    document.fonts?.ready.then(check);
    check();

    return () => {
      alive = false;
      observer.disconnect();
    };
  }, [items, count]);

  return clipped;
}

/**
 * The whole interactive run: the three labels, the divider and the glyph,
 * inside one positioning box so a single capsule can travel between them all.
 *
 * The destination routes do not exist yet, so the labels are focusable anchors
 * that hold the page: the point today is the nav's real hover and focus states.
 */
export function NavItems() {
  const itemRefs = useRef<(HTMLElement | null)[]>([]);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const clipped = useClippedLabels(itemRefs, LINKS.length);
  const pathname = usePathname();

  function enter(index: number, event: ReactPointerEvent<HTMLElement>) {
    if (event.pointerType === "touch") return;

    setHoverIndex(index);
  }

  return (
    <div
      className="nav-run relative flex min-w-0 items-center"
      onPointerLeave={() => {
        // A theme crossfade snapshots the page and the live document stops
        // receiving hit tests for its length, so this is not a real leave.
        if (isPhaseSwitching()) return;

        setHoverIndex(null);
      }}
    >
      <GlideCapsule
        items={itemRefs}
        target={hoverIndex ?? 0}
        visible={hoverIndex !== null}
      />

      {LINKS.map((link, index) => {
        const current = isCurrent(pathname, link.href);
        const classes = [
          NAV_ITEM_CLASS,
          current
            ? "bg-surface-container text-on-surface"
            : "text-on-surface-variant",
        ].join(" ");
        const ref = (node: HTMLElement | null) => {
          itemRefs.current[index] = node;
        };

        // "Work" opens the index sheet; the logo goes home. In the reader, the
        // nav's click capture consumes both and plays the reverse morph; the
        // placeholders keep holding the page.
        //
        // A label longer than the bar allows gets an ellipsis instead of
        // wrapping out of the 32px item; `aria-label` keeps the whole string.
        // A label that fits stays bare text, so its resting pixels are the
        // shipped ones.
        const label = clipped.includes(index) ? (
          <span className={CLIPPED_CLASS}>{link.label}</span>
        ) : (
          link.label
        );

        return link.href ? (
          <Link
            key={link.label}
            href={link.href}
            ref={ref}
            aria-label={link.label}
            aria-current={current ? "page" : undefined}
            onPointerEnter={(event) => enter(index, event)}
            className={`no-underline ${classes}`}
          >
            {label}
          </Link>
        ) : (
          <button
            key={link.label}
            type="button"
            ref={ref}
            aria-label={link.label}
            onPointerEnter={(event) => enter(index, event)}
            // Preflight already resets font, colour, background, border and
            // padding; these three still differ from an anchor's UA style.
            className={`${classes} appearance-none cursor-pointer text-start`}
          >
            {label}
          </button>
        );
      })}

      <span
        aria-hidden="true"
        className="mx-6 hidden h-5 w-px shrink-0 bg-outline-variant md:block"
      />

      {/*
       * The glyph is a capsule target like any label; it is only hidden below
       * md, where the runner never measures or selects it. Its
       * `data-glide-break` cuts the run here so the capsule never stretches
       * across the divider.
       */}
      <button
        type="button"
        aria-label="Design system"
        data-glide-break=""
        ref={(node) => {
          itemRefs.current[LINKS.length] = node;
        }}
        onPointerEnter={(event) => enter(LINKS.length, event)}
        className={GLYPH_CLASS}
      >
        <NavGlyphIcon />
        <span
          aria-hidden="true"
          className="nav-tooltip pointer-events-none absolute -top-9 left-1/2 -translate-x-1/2 rounded-md bg-on-surface px-2 py-1 text-xs whitespace-nowrap text-surface"
        >
          Design system
        </span>
      </button>
    </div>
  );
}
