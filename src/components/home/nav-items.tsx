"use client";

import type { PointerEvent as ReactPointerEvent, RefObject } from "react";
import { useEffect, useRef, useState } from "react";
import {
  GLIDE_LEAD_SPRING,
  GLIDE_TRAIL_SPRING,
  createEdge,
  isEdgeAtRest,
  stepEdge,
  type GlideEdge,
} from "./glide-spring";
import { isPhaseSwitching } from "@/lib/theme";
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

/* ---------- Glide: two spring-driven edges ---------- */

// Mirrors the layer's 150ms opacity fade in nav-items.css: a move across a
// group break fades out, re-places while invisible, then fades back in.
const FADE_DURATION_MS = 150;

// How long the trailing edge holds its position when a move starts from rest,
// so the leading edge stretches away first. A retarget mid-flight never re-arms
// it, so a fast sweep cannot freeze the trail.
const TRAIL_HOLD_MS = 100;

type GlideState = {
  /** Item the pill is heading for; -1 until it has been placed once. */
  target: number;
  /** True while the pointer is inside the run (or the layer is still fading). */
  inside: boolean;
  /** True between a break's fade-out and its re-place. */
  breaking: boolean;
  /** True when both edges have arrived and the loop has stopped. */
  settled: boolean;
  left: GlideEdge;
  right: GlideEdge;
  /** True when the pill travels right, so the right edge is the leading one. */
  leadRight: boolean;
  /** Timestamp (ms) until which the trail holds; 0 when it is free. */
  trailHoldUntil: number;
  /** Timestamp of the previous frame, for the dt the springs step by. */
  lastTime: number;
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
 * glyph. Each edge is its own damped spring, so the motion is state-driven:
 * a new target only moves the springs' destinations and both edges keep their
 * current position and velocity, exactly like a CSS transition being
 * retargeted mid-flight. Nothing restarts from a stored start point.
 *
 * The leading edge is the stiff spring, the trailing edge the soft one, and a
 * move from rest holds the trail for 100ms first, so the capsule still
 * stretches out of the old item and closes onto the new one with roughly the
 * toggle's 180ms lead and 220ms + delay trail.
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
  const stateRef = useRef<GlideState>({
    target: -1,
    inside: false,
    breaking: false,
    settled: true,
    left: createEdge(0),
    right: createEdge(0),
    leadRight: true,
    trailHoldUntil: 0,
    lastTime: 0,
    raf: 0,
  });

  useEffect(() => {
    const el = capsuleRef.current;

    if (!el) return;

    const st = stateRef.current;
    const nodes = items.current;

    // An item flagged with `data-glide-break` starts a new group: the capsule
    // never stretches across it, so a move over the break fades out, re-places
    // and fades back in instead of gliding.
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
      const left = Math.min(st.left.position, st.right.position);
      const right =
        left + Math.max(2, Math.abs(st.right.position - st.left.position));

      el.style.clipPath = `inset(0 calc(100% - ${right}px) 0 ${left}px round var(--radius-md, 6px))`;
    };

    const stop = () => {
      if (st.raf) {
        window.cancelAnimationFrame(st.raf);
        st.raf = 0;
      }
    };

    // Places the pill exactly on an item: the only paths that skip the springs
    // are a real entry into the run and a break's re-place.
    const place = (index: number) => {
      const box = measure(index);

      if (!box) return false;

      st.target = index;
      st.left = createEdge(box.left);
      st.right = createEdge(box.right);
      st.settled = true;
      st.trailHoldUntil = 0;

      return true;
    };

    const frame = (now: number) => {
      st.raf = 0;

      if (!st.inside || st.breaking || st.target < 0) return;

      const box = measure(st.target);

      if (!box) return;

      // dt comes from rAF and is clamped inside stepEdge, so a janky or
      // backgrounded frame continues the motion instead of snapping it.
      const dt = Math.max(0, (now - st.lastTime) / 1000);

      st.lastTime = now;

      const holding = st.trailHoldUntil > now;

      if (st.leadRight) {
        st.right = stepEdge(st.right, box.right, dt, GLIDE_LEAD_SPRING);

        if (!holding) {
          st.left = stepEdge(st.left, box.left, dt, GLIDE_TRAIL_SPRING);
        }
      } else {
        st.left = stepEdge(st.left, box.left, dt, GLIDE_LEAD_SPRING);

        if (!holding) {
          st.right = stepEdge(st.right, box.right, dt, GLIDE_TRAIL_SPRING);
        }
      }

      draw();

      if (holding) {
        st.raf = window.requestAnimationFrame(frame);

        return;
      }

      if (
        isEdgeAtRest(st.left, box.left) &&
        isEdgeAtRest(st.right, box.right)
      ) {
        st.left = createEdge(box.left);
        st.right = createEdge(box.right);
        st.settled = true;
        st.trailHoldUntil = 0;
        draw();

        return;
      }

      st.raf = window.requestAnimationFrame(frame);
    };

    // The loop is one long-lived run: a retarget only moves the springs'
    // destinations, so it never cancels and restarts the frame clock.
    const ensureLoop = () => {
      if (st.raf) return;

      st.lastTime = performance.now();
      st.raf = window.requestAnimationFrame(frame);
    };

    const startBreak = (index: number) => {
      stop();
      // The pointer is still in the run, so `data-visible` stays: only the
      // crossfade blanks the capsule while it is re-placed across the divider.
      el.setAttribute("data-fading", "");
      st.breaking = true;
      st.target = index;

      window.clearTimeout(breakTimerRef.current);
      breakTimerRef.current = window.setTimeout(() => {
        breakTimerRef.current = 0;
        st.breaking = false;

        // The pointer may have left the run while the capsule was fading; the
        // next real entry re-places it, so do not place it over nothing.
        if (!st.inside) return;

        if (place(st.target)) draw();

        el.removeAttribute("data-fading");
      }, FADE_DURATION_MS);
    };

    // Outside the run: the layer fades itself out on `data-visible`. The clip
    // is left where the edges stopped, so the fade never jumps; the next real
    // entry re-places the pill under the pointer.
    if (!visible) {
      st.inside = false;
      st.breaking = false;
      window.clearTimeout(breakTimerRef.current);
      breakTimerRef.current = 0;
      stop();
      el.removeAttribute("data-visible");
      el.removeAttribute("data-fading");

      return;
    }

    const box = measure(target);

    // A hidden item (the glyph below md) is never a destination.
    if (!box) return;

    // Reduced motion: the layer is display:none and the hovered item carries
    // the fill, but the edges stay exact so leaving this mode never animates
    // from a stale position.
    if (prefersReducedMotion()) {
      st.inside = true;
      st.breaking = false;
      stop();
      el.removeAttribute("data-fading");

      if (place(target)) draw();

      return;
    }

    // A real entry into the run. Everything that happens between items keeps
    // `inside` true, so moving fast within the nav can never snap.
    if (!st.inside) {
      if (!place(target)) return;

      st.inside = true;
      st.breaking = false;
      stop();
      draw();
      el.removeAttribute("data-fading");
      el.setAttribute("data-visible", "");

      return;
    }

    // A break owns the placement until its timer fires: it has already faded
    // out where it was, so the latest target is only recorded here. The timer
    // is never restarted, so a sweep cannot leave the capsule hidden.
    if (st.breaking) {
      st.target = target;

      return;
    }

    if (st.target === target) {
      // Same destination (a re-render, or the pointer settling on one item):
      // keep the current motion instead of starting it over.
      if (!st.settled) ensureLoop();

      return;
    }

    if (cutByBreak(st.target, target)) {
      startBreak(target);

      return;
    }

    const center = (st.left.position + st.right.position) / 2;
    const movingRight = (box.left + box.right) / 2 >= center;
    const turned = st.leadRight !== movingRight;
    const wasSettled = st.settled;

    st.target = target;
    st.leadRight = movingRight;
    st.settled = false;

    if (wasSettled) {
      // A move from rest: hold the trail so the lead stretches away first. The
      // held edge is at rest, so dropping its residual velocity is invisible.
      st.trailHoldUntil = performance.now() + TRAIL_HOLD_MS;

      const trail = movingRight ? st.left : st.right;

      trail.velocity = 0;
    } else if (turned) {
      // Reversing mid-flight swaps which edge leads, so an armed hold would
      // freeze the edge that just became the leader. Let the trail go now.
      st.trailHoldUntil = 0;
    }

    ensureLoop();
  }, [items, target, visible]);

  useEffect(() => {
    const st = stateRef.current;

    return () => {
      if (st.raf) window.cancelAnimationFrame(st.raf);
      window.clearTimeout(breakTimerRef.current);
    };
  }, []);

  return <span ref={capsuleRef} aria-hidden="true" className="nav-glide" />;
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
