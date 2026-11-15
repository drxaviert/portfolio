"use client";

import { useEffect, useRef, useState } from "react";
import type { JSX, PointerEvent as ReactPointerEvent } from "react";
import { useSystem } from "@/app/design-system/system-shell";
import {
  GLIDE_LEAD_SPRING,
  GLIDE_TRAIL_SPRING,
  createEdge,
  isEdgeAtRest,
  stepEdge,
} from "@/components/home/glide-spring";
import type { GlideEdge } from "@/components/home/glide-spring";
import { NavGlyphIcon } from "@/components/home/nav-glyph-icon";
import type { ForceState } from "@/components/system/component-doc";
import "@/components/home/nav-items.css";

const LINKS = ["Work", "Play", "About"] as const;
const GLYPH_INDEX = LINKS.length;
const TRAIL_HOLD_MS = 100;

/** The live item and glyph classes, copied from nav-items.tsx. */
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

function prefersReducedMotion(): boolean {
  return (
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

type GlideState = {
  target: number;
  inside: boolean;
  settled: boolean;
  left: GlideEdge;
  right: GlideEdge;
  leadRight: boolean;
  trailHoldUntil: number;
  lastTime: number;
  raf: number;
};

/** A single forced nav item with the shared capsule underneath. */
export function NavItemSample({
  label,
  forceState,
  active = false,
}: {
  label: string;
  forceState?: ForceState;
  active?: boolean;
}): JSX.Element {
  const isCurrent = active || forceState === "active";
  const showCapsule = forceState === "hover" || forceState === "focus-visible";
  const tone = isCurrent
    ? "bg-surface-container text-on-surface"
    : forceState === "hover"
      ? "text-on-surface"
      : "text-on-surface-variant";

  return (
    <div
      data-state={forceState}
      className="relative inline-flex items-center"
    >
      <span
        aria-hidden="true"
        className="nav-glide"
        data-visible={showCapsule ? "" : undefined}
        style={{
          clipPath: "inset(0 round var(--radius-md, 6px))",
          opacity: showCapsule ? 0.55 : 0,
        }}
      />
      <a
        href="#"
        aria-current={isCurrent ? "page" : undefined}
        onClick={(event) => event.preventDefault()}
        className={[
          ITEM_CLASS,
          tone,
          forceState === "focus-visible"
            ? "outline-solid outline-2 outline-offset-0 outline-primary"
            : "",
        ].join(" ")}
      >
        {label}
      </a>
    </div>
  );
}

/**
 * Three labels, the divider and the glyph with one shared capsule. The capsule
 * is a full-run layer clipped between two spring-driven edges: hover or focus
 * only retargets the springs, so a fast sweep keeps its position and velocity
 * instead of restarting from rest. The springs come from engine.spring, so the
 * Motion speed parameter time-scales them, and reduced motion places the
 * capsule instantly.
 */
export function NavGlideDemo(): JSX.Element {
  const { engine } = useSystem();
  const runRef = useRef<HTMLDivElement | null>(null);
  const capsuleRef = useRef<HTMLSpanElement | null>(null);
  const itemRefs = useRef<(HTMLElement | null)[]>([]);
  const [hovered, setHovered] = useState<number | null>(null);
  const [focused, setFocused] = useState<number | null>(null);
  const target = focused ?? hovered;
  const stateRef = useRef<GlideState>({
    target: -1,
    inside: false,
    settled: true,
    left: createEdge(0),
    right: createEdge(0),
    leadRight: true,
    trailHoldUntil: 0,
    lastTime: 0,
    raf: 0,
  });

  useEffect(() => {
    const run = runRef.current;
    const capsule = capsuleRef.current;

    if (!run || !capsule) return;

    const st = stateRef.current;

    const measure = (index: number) => {
      const node = itemRefs.current[index];

      if (!node) return null;

      const box = node.getBoundingClientRect();
      const base = run.getBoundingClientRect();

      if (box.width === 0) return null;

      return { left: box.left - base.left, right: box.right - base.left };
    };

    const draw = () => {
      const left = Math.min(st.left.position, st.right.position);
      const right =
        left + Math.max(2, Math.abs(st.right.position - st.left.position));

      capsule.style.clipPath = `inset(0 calc(100% - ${right}px) 0 ${left}px round var(--radius-md, 6px))`;
    };

    const stop = () => {
      if (st.raf) {
        window.cancelAnimationFrame(st.raf);
        st.raf = 0;
      }
    };

    const frame = (now: number) => {
      st.raf = 0;

      if (st.target < 0) return;

      const box = measure(st.target);

      if (!box) return;

      const dt = Math.max(0, (now - st.lastTime) / 1000);

      st.lastTime = now;

      const holding = st.trailHoldUntil > now;
      const lead = engine.spring(GLIDE_LEAD_SPRING);
      const trail = engine.spring(GLIDE_TRAIL_SPRING);

      if (st.leadRight) {
        st.right = stepEdge(st.right, box.right, dt, lead);

        if (!holding) st.left = stepEdge(st.left, box.left, dt, trail);
      } else {
        st.left = stepEdge(st.left, box.left, dt, lead);

        if (!holding) st.right = stepEdge(st.right, box.right, dt, trail);
      }

      draw();

      if (
        holding ||
        !(
          isEdgeAtRest(st.left, box.left) && isEdgeAtRest(st.right, box.right)
        )
      ) {
        st.raf = window.requestAnimationFrame(frame);

        return;
      }

      st.left = createEdge(box.left);
      st.right = createEdge(box.right);
      st.settled = true;
      st.trailHoldUntil = 0;
      draw();
    };

    const ensureLoop = () => {
      if (st.raf) return;

      st.lastTime = performance.now();
      st.raf = window.requestAnimationFrame(frame);
    };

    if (target === null) {
      capsule.removeAttribute("data-visible");
      st.inside = false;
      st.settled = true;
      stop();

      return;
    }

    const box = measure(target);

    if (!box) return;

    if (prefersReducedMotion()) {
      stop();
      st.left = createEdge(box.left);
      st.right = createEdge(box.right);
      st.target = target;
      st.inside = true;
      st.settled = true;
      st.trailHoldUntil = 0;
      capsule.setAttribute("data-visible", "");
      draw();

      return;
    }

    // A real entry places the capsule exactly; later moves retarget the springs.
    if (!st.inside) {
      st.left = createEdge(box.left);
      st.right = createEdge(box.right);
      st.target = target;
      st.inside = true;
      st.settled = true;
      st.trailHoldUntil = 0;
      capsule.setAttribute("data-visible", "");
      draw();

      return;
    }

    if (st.target === target) {
      if (!st.settled) ensureLoop();

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
      // Hold the trail briefly so the lead stretches away from a resting item.
      st.trailHoldUntil = performance.now() + TRAIL_HOLD_MS;

      const trail = movingRight ? st.left : st.right;

      trail.velocity = 0;
    } else if (turned) {
      st.trailHoldUntil = 0;
    }

    ensureLoop();
  }, [engine, target]);

  useEffect(() => {
    const st = stateRef.current;

    return () => {
      if (st.raf) window.cancelAnimationFrame(st.raf);
    };
  }, []);

  const enter = (index: number, event: ReactPointerEvent<HTMLElement>) => {
    if (event.pointerType === "touch") return;

    setHovered(index);
  };

  return (
    <div
      ref={runRef}
      data-nav-run
      className="relative flex items-center"
      onPointerLeave={() => setHovered(null)}
      onBlur={(event) => {
        if (
          !event.currentTarget.contains(event.relatedTarget as Node | null)
        ) {
          setFocused(null);
        }
      }}
    >
      <span
        ref={capsuleRef}
        aria-hidden="true"
        className="nav-glide"
      />

      {LINKS.map((label, index) => (
        <a
          key={label}
          href="#"
          ref={(node) => {
            itemRefs.current[index] = node;
          }}
          aria-current={index === 0 ? "page" : undefined}
          onClick={(event) => event.preventDefault()}
          onPointerEnter={(event) => enter(index, event)}
          onFocus={() => setFocused(index)}
          className={[
            ITEM_CLASS,
            index === 0
              ? "bg-surface-container text-on-surface"
              : "text-on-surface-variant",
          ].join(" ")}
        >
          {label}
        </a>
      ))}

      <span
        aria-hidden="true"
        className="mx-6 hidden h-5 w-px bg-outline-variant md:block"
      />

      <button
        type="button"
        aria-label="Design system"
        ref={(node) => {
          itemRefs.current[GLYPH_INDEX] = node;
        }}
        onPointerEnter={(event) => enter(GLYPH_INDEX, event)}
        onFocus={() => setFocused(GLYPH_INDEX)}
        className={GLYPH_CLASS}
      >
        <NavGlyphIcon />
      </button>
    </div>
  );
}
