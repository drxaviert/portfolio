"use client";

import { useEffect, useRef } from "react";
import type { CSSProperties } from "react";
import { isPhaseSwitching } from "@/lib/theme";
import { createEdge, isEdgeAtRest, stepEdge } from "./glide-spring";
import type { GlideSpring } from "./glide-spring";
import { rectZoom } from "./layout-zoom";

/**
 * The nav's orb head, with eyes that look at the pointer.
 *
 * Geometry is the shipped 36px head: two matte white bars, 3.4 × 8 at
 * (13.5, 10.5) and (20.6, 10.5). The dev prototype scales the same face to 4×
 * by passing a larger `size`, so the tuning there reads the real thing.
 *
 * A fine pointer aims the pair; reduced motion and coarse pointers keep it
 * still. A theme crossfade reports a synthetic pointerleave (the live document
 * stops receiving hit tests for its length), so that is ignored the same way
 * the nav's hover state ignores it; a real leave still rests the face.
 *
 * The spring is the home's own glide-spring oscillator, not Motion: the nav
 * lives in the root layout, and PR #41 keeps Motion out of every route's
 * first-load JS.
 */

const BASE = 36;
const EYE_LEFT = [13.5, 20.6] as const;
const EYE_TOP = 10.5;
const EYE_WIDTH = 3.4;
const EYE_HEIGHT = 8;

/** Full eye travel at 36px. Kept well inside the ball so it stays a face. */
const LOOK_X = 4.5;
const LOOK_Y = 2.8;

/** The reach Dat chose in the prototype: the most responsive look. */
export const LOOK_DISTANCE = 60;

/**
 * The approved Motion tuning, converted to the unit-mass oscillator that
 * glide-spring.ts solves: k=340, c=26, m=0.6 → ω² = 340/0.6, ζ = 26/(2√(340·0.6)).
 */
const GAZE_SPRING: GlideSpring = {
  stiffness: 340 / 0.6,
  dampingRatio: 26 / (2 * Math.sqrt(340 * 0.6)),
};

type GazeOrbProps = {
  size?: number;
  /** Multiplier on eye travel: 0 rests, 1 is the shipped default. */
  strength?: number;
  /** Distance for a full look at 36px; scales with the head. */
  lookDistance?: number;
  className?: string;
};

export function GazeOrb({
  size = BASE,
  strength = 1,
  lookDistance = LOOK_DISTANCE,
  className = "",
}: GazeOrbProps) {
  const ballRef = useRef<HTMLDivElement>(null);
  const eyesRef = useRef<HTMLDivElement>(null);
  // Kept outside the effect so a tuning change re-aims the eyes at the last
  // known pointer without waiting for the mouse to move again.
  const pointerRef = useRef<PointerEvent | null>(null);
  const targetRef = useRef({ x: 0, y: 0 });
  const edgesRef = useRef({ x: createEdge(0), y: createEdge(0) });
  const frameRef = useRef(0);
  const aimFrameRef = useRef(0);
  const lastTimeRef = useRef(0);
  const tuningRef = useRef({ strength, lookDistance });
  const aimRef = useRef<() => void>(() => undefined);

  useEffect(() => {
    const ball = ballRef.current;
    const eyes = eyesRef.current;
    if (!ball || !eyes) return;

    const fine = window.matchMedia("(hover: hover) and (pointer: fine)");
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)");

    const write = (x: number, y: number) => {
      eyes.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    };

    const tick = (now: number) => {
      frameRef.current = 0;
      const target = targetRef.current;
      const dt = lastTimeRef.current
        ? (now - lastTimeRef.current) / 1000
        : 1 / 60;
      lastTimeRef.current = now;

      const x = stepEdge(edgesRef.current.x, target.x, dt, GAZE_SPRING);
      const y = stepEdge(edgesRef.current.y, target.y, dt, GAZE_SPRING);
      edgesRef.current = { x, y };
      write(x.position, y.position);

      if (isEdgeAtRest(x, target.x) && isEdgeAtRest(y, target.y)) {
        edgesRef.current = {
          x: createEdge(target.x),
          y: createEdge(target.y),
        };
        write(target.x, target.y);
        lastTimeRef.current = 0;
        return;
      }

      frameRef.current = requestAnimationFrame(tick);
    };

    const kick = () => {
      if (!frameRef.current) frameRef.current = requestAnimationFrame(tick);
    };

    const aim = () => {
      aimFrameRef.current = 0;
      const pointer = pointerRef.current;
      const tuning = tuningRef.current;

      if (!pointer) {
        targetRef.current = { x: 0, y: 0 };
        kick();
        return;
      }

      const box = ball.getBoundingClientRect();
      const dx = pointer.clientX - (box.left + box.width / 2);
      const dy = pointer.clientY - (box.top + box.height / 2);
      const distance = Math.hypot(dx, dy);

      // The pointer is on the head: both eyes meet the viewer.
      if (distance < 0.5) {
        targetRef.current = { x: 0, y: 0 };
        kick();
        return;
      }

      // Reach and the pointer distance are painted (post-zoom) pixels, while
      // the transform below is written inside the zoomed frame. The travel is
      // scaled once for the painted head, then divided back into frame px so
      // the frame zoom does not apply a second time.
      const scale = box.width / BASE;
      const zoom = rectZoom(ball, box);
      const reach = tuning.lookDistance * scale;
      const amount = Math.min(distance / reach, 1) * tuning.strength;

      targetRef.current = {
        x: (dx / distance) * LOOK_X * (scale / zoom) * amount,
        y: (dy / distance) * LOOK_Y * (scale / zoom) * amount,
      };
      kick();
    };
    aimRef.current = aim;

    const requestAim = () => {
      if (!aimFrameRef.current) {
        aimFrameRef.current = requestAnimationFrame(aim);
      }
    };

    const onMove = (event: PointerEvent) => {
      // Touch has no hover pointer; the media query is the main gate, this
      // catches a touch on a fine-pointer hybrid.
      if (event.pointerType === "touch") return;

      pointerRef.current = event;
      requestAim();
    };

    const onLeave = () => {
      // A theme crossfade paints snapshots and the live document stops
      // receiving hit tests, which reports a pointerleave that is not a real
      // leave. The nav's own hover state ignores it the same way; a genuine
      // leave is corrected by the next real pointer event.
      if (isPhaseSwitching()) return;

      pointerRef.current = null;
      requestAim();
    };

    // The head can move under a still pointer (scroll, resize); re-aim so the
    // gaze stays attached to the cursor rather than the old box.
    const onReflow = () => {
      if (pointerRef.current) requestAim();
    };

    let listening = false;

    const listen = () => {
      if (listening) return;

      listening = true;
      window.addEventListener("pointermove", onMove, { passive: true });
      window.addEventListener("scroll", onReflow, { passive: true });
      window.addEventListener("resize", onReflow);
      document.documentElement.addEventListener("pointerleave", onLeave);
      window.addEventListener("blur", onLeave);
    };

    const unlisten = () => {
      listening = false;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("scroll", onReflow);
      window.removeEventListener("resize", onReflow);
      document.documentElement.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("blur", onLeave);
    };

    const sync = () => {
      // Reduced motion and a coarse pointer both keep the face still; the nav
      // link itself still works. Listening to the queries (rather than reading
      // a hook value) means a live preference change is honoured too.
      if (fine.matches && !calm.matches) {
        listen();
        if (pointerRef.current) requestAim();
      } else {
        pointerRef.current = null;
        unlisten();
        if (aimFrameRef.current) {
          cancelAnimationFrame(aimFrameRef.current);
          aimFrameRef.current = 0;
        }
        targetRef.current = { x: 0, y: 0 };
        kick();
      }
    };

    fine.addEventListener("change", sync);
    calm.addEventListener("change", sync);
    sync();

    return () => {
      fine.removeEventListener("change", sync);
      calm.removeEventListener("change", sync);
      unlisten();
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
      if (aimFrameRef.current) cancelAnimationFrame(aimFrameRef.current);
      frameRef.current = 0;
      aimFrameRef.current = 0;
      lastTimeRef.current = 0;
    };
  }, []);

  // Tuning changes while the pointer is still re-aim at once, so a panel drag
  // updates the face without waiting for the next move.
  useEffect(() => {
    tuningRef.current = { strength, lookDistance };
    if (pointerRef.current) aimRef.current();
  }, [lookDistance, strength]);

  const scale = size / BASE;

  const eye = (left: number): CSSProperties => ({
    left: left * scale,
    top: EYE_TOP * scale,
    width: EYE_WIDTH * scale,
    height: EYE_HEIGHT * scale,
  });

  return (
    <div
      ref={ballRef}
      aria-hidden="true"
      className={`relative shrink-0 overflow-hidden rounded-full ${className}`}
      style={{
        width: size,
        height: size,
        backgroundImage: "var(--orb-gradient)",
      }}
    >
      <div ref={eyesRef} className="absolute inset-0">
        <span
          className="absolute rounded-full bg-white"
          style={eye(EYE_LEFT[0])}
        />
        <span
          className="absolute rounded-full bg-white"
          style={eye(EYE_LEFT[1])}
        />
      </div>
    </div>
  );
}
