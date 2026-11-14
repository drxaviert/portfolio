"use client";

import type { PointerEvent as ReactPointerEvent, RefObject } from "react";
import { useEffect, useRef, useState } from "react";
import {
  LEADING_DURATION_MS,
  TRAILING_DELAY_MS,
  TRAILING_DURATION_MS,
  leadingEase,
  trailingEase,
} from "@/components/theme/theme-toggle";
import { NavGlyphIcon } from "./nav-glyph-icon";
import "./nav-items.css";

const LINKS = [
  { label: "Work", current: true },
  { label: "Play", current: false },
  { label: "About", current: false },
];

const ITEM_CLASS = [
  "nav-item relative flex h-8 items-center rounded-md px-2",
  "text-base leading-5 font-medium",
  "outline-hidden focus-visible:outline-solid focus-visible:outline-2",
  "focus-visible:outline-offset-0 focus-visible:outline-primary",
].join(" ");

const GLYPH_CLASS = [
  "nav-glyph relative hidden size-8 items-center justify-center",
  "rounded-md text-on-surface-variant md:flex",
  "outline-hidden focus-visible:outline-solid focus-visible:outline-2",
  "focus-visible:outline-offset-0 focus-visible:outline-primary",
].join(" ");

/* ---------- Glide: stretch & snap, constants and curves from the toggle ---------- */

const LEADING_DURATION = LEADING_DURATION_MS / 1000;
const TRAILING_DURATION = TRAILING_DURATION_MS / 1000;
const TRAILING_DELAY = TRAILING_DELAY_MS / 1000;

// Mirrors the layer's 150ms opacity fade in nav-items.css, used to let a
// capsule fade out before it is re-placed across a group break.
const FADE_DURATION_MS = 150;

type GlideFlight = {
  start: number;
  leadFrom: number;
  leadTo: number;
  trailFrom: number;
  trailTo: number;
  leadingRight: boolean;
};

type GlideState = {
  target: number;
  placed: boolean;
  lastVisible: boolean;
  left: number;
  right: number;
  flight: GlideFlight | null;
  raf: number;
};

function prefersReducedMotion(): boolean {
  return (
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * One shared capsule across the whole item run — Work, Play, About, divider,
 * glyph. Same motion as the theme toggle's selection highlight: the leading
 * edge leaves in 180ms, the trailing edge holds 120ms then closes in 220ms.
 * The layer fades in/out in 150ms and is hidden under reduced motion (the
 * hovered item's fill takes over, see nav-items.css).
 *
 * The pill is the layer's clip, not its box: the layer keeps the run's width
 * and each edge is cut to its animated position, so a frame only paints and
 * the corners ride with the edges.
 */
function GlideCapsule({
  items,
  target,
  visible,
}: {
  items: RefObject<(HTMLElement | null)[]>;
  target: number;
  visible: boolean;
}) {
  const capsuleRef = useRef<HTMLSpanElement>(null);
  const breakTimerRef = useRef(0);
  const [breaking, setBreaking] = useState(false);
  const shown = visible && !breaking;
  const stateRef = useRef<GlideState>({
    target: -1,
    placed: false,
    lastVisible: false,
    left: 0,
    right: 0,
    flight: null,
    raf: 0,
  });

  useEffect(() => {
    const el = capsuleRef.current;

    if (!el) return;

    const st = stateRef.current;
    const nodes = items.current;

    // An item flagged with `data-glide-break` starts a new group: the capsule
    // never stretches across it, so a move over the break gets the first-entry
    // treatment instead of a glide.
    const cutByBreak = (from: number, to: number) => {
      const lo = Math.min(from, to) + 1;
      const hi = Math.max(from, to);

      for (let i = lo; i <= hi; i += 1) {
        if (nodes[i]?.dataset.glideBreak !== undefined) return true;
      }

      return false;
    };

    const measure = (index: number) => {
      const node = nodes[index];

      // Hidden items (the glyph below md) report a zero box; never target them.
      return node && node.offsetWidth > 0
        ? { left: node.offsetLeft, right: node.offsetLeft + node.offsetWidth }
        : null;
    };

    const draw = () => {
      const left = Math.min(st.left, st.right);
      const right = left + Math.max(2, Math.abs(st.right - st.left));

      el.style.clipPath = `inset(0 calc(100% - ${right}px) 0 ${left}px round var(--radius-md, 6px))`;
    };

    const stop = () => {
      if (st.raf) {
        window.cancelAnimationFrame(st.raf);
        st.raf = 0;
      }
    };

    const snap = (index: number) => {
      const box = measure(index);

      if (!box) return false;

      st.target = index;
      st.flight = null;
      st.left = box.left;
      st.right = box.right;

      return true;
    };

    if (!st.placed) {
      if (snap(target)) {
        st.placed = true;
        draw();
      }

      return;
    }

    if (!shown) {
      st.lastVisible = false;

      return;
    }

    // First item entered or reduced motion: appear where the pointer is, with
    // no travel (the layer still fades in via CSS, or is hidden entirely).
    if (!st.lastVisible || prefersReducedMotion()) {
      st.lastVisible = true;
      stop();

      if (snap(target)) draw();

      return;
    }

    const box = measure(target);

    if (!box) return;

    if (st.target === target) {
      draw();

      return;
    }

    if (cutByBreak(st.target, target)) {
      stop();
      st.lastVisible = false;
      setBreaking(true);
      window.clearTimeout(breakTimerRef.current);
      breakTimerRef.current = window.setTimeout(
        () => setBreaking(false),
        FADE_DURATION_MS,
      );

      return;
    }

    const center = (st.left + st.right) / 2;
    const movingRight = (box.left + box.right) / 2 >= center;

    st.target = target;
    st.flight = {
      start: performance.now(),
      leadFrom: movingRight ? st.right : st.left,
      leadTo: movingRight ? box.right : box.left,
      trailFrom: movingRight ? st.left : st.right,
      trailTo: movingRight ? box.left : box.right,
      leadingRight: movingRight,
    };

    stop();

    const loop = (now: number) => {
      const flight = st.flight;

      if (!flight) return;

      const elapsed = Math.max(0, (now - flight.start) / 1000);
      const leadProgress = Math.min(1, elapsed / LEADING_DURATION);
      const trailProgress = Math.min(
        1,
        Math.max(0, elapsed - TRAILING_DELAY) / TRAILING_DURATION,
      );
      const lead =
        flight.leadFrom +
        (flight.leadTo - flight.leadFrom) * leadingEase(leadProgress);
      const trail =
        flight.trailFrom +
        (flight.trailTo - flight.trailFrom) * trailingEase(trailProgress);

      if (flight.leadingRight) {
        st.right = lead;
        st.left = trail;
      } else {
        st.left = lead;
        st.right = trail;
      }

      draw();

      if (leadProgress >= 1 && trailProgress >= 1) {
        if (snap(target)) draw();
        st.raf = 0;

        return;
      }

      st.raf = window.requestAnimationFrame(loop);
    };

    st.raf = window.requestAnimationFrame(loop);

    return stop;
  }, [items, target, shown]);

  useEffect(() => {
    const st = stateRef.current;

    return () => {
      if (st.raf) window.cancelAnimationFrame(st.raf);
      window.clearTimeout(breakTimerRef.current);
    };
  }, []);

  return (
    <span
      ref={capsuleRef}
      aria-hidden="true"
      className="nav-glide"
      data-visible={shown ? "" : undefined}
    />
  );
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

  function enter(index: number, event: ReactPointerEvent<HTMLElement>) {
    if (event.pointerType === "touch") return;

    setHoverIndex(index);
  }

  return (
    <div
      className="relative flex items-center"
      onPointerLeave={() => setHoverIndex(null)}
    >
      <GlideCapsule
        items={itemRefs}
        target={hoverIndex ?? 0}
        visible={hoverIndex !== null}
      />

      {LINKS.map((link, index) => (
        <a
          key={link.label}
          href="#"
          ref={(node) => {
            itemRefs.current[index] = node;
          }}
          aria-current={link.current ? "page" : undefined}
          onClick={(event) => event.preventDefault()}
          onPointerEnter={(event) => enter(index, event)}
          className={[
            ITEM_CLASS,
            link.current
              ? "bg-surface-container text-on-surface"
              : "text-on-surface-variant",
          ].join(" ")}
        >
          {link.label}
        </a>
      ))}

      <span
        aria-hidden="true"
        className="mx-6 hidden h-5 w-px bg-outline-variant md:block"
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
