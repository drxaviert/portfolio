"use client";

import { useCallback, useEffect, useRef } from "react";
import type {
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
  RefObject,
} from "react";

export type PanPoint = {
  x: number;
  y: number;
};

export type PanHandlers = {
  onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerMove: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerUp: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerCancel: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onLostPointerCapture: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onKeyDown: (event: ReactKeyboardEvent<HTMLDivElement>) => void;
};

export type UsePanResult = {
  containerRef: RefObject<HTMLDivElement | null>;
  panRef: RefObject<PanPoint>;
  handlers: PanHandlers;
  /** Advance inertia or an arrow-key tween. Returns whether motion is active. */
  tick: (now: number) => boolean;
  isActive: () => boolean;
  /** Stop everything, including a capture that is still held. */
  halt: () => void;
  /** Jump the world coordinate, e.g. to centre a new layout. */
  setPan: (x: number, y: number) => void;
};

/** A release under this much travel is a click, not a drag. */
const TAP_SLOP = 6;
/** Velocity is measured over this trailing window. */
const SAMPLE_WINDOW_MS = 80;
/** A sample older than this means the hand had already stopped. */
const STALE_SAMPLE_MS = 45;
/** The task's glide: 0.95x per 16.67ms frame, time-based. */
const GLIDE_DECAY = 0.95;
const FRAME_MS = 1000 / 60;
/** Below this the glide is over, in px/ms. */
const SETTLE_VELOCITY = 0.02;
/** A hard fling should not teleport the world. */
const MAX_VELOCITY = 6;
/** One arrow key: --duration-short-7, with --ease-emphasized-decelerate. */
const KEY_TWEEN_MS = 220;

type Sample = {
  t: number;
  x: number;
  y: number;
};

type Tween = {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  start: number;
  duration: number;
  ease: (progress: number) => number;
};

type DragState = {
  pointerId: number | null;
  dragging: boolean;
  moved: number;
  lastX: number;
  lastY: number;
  downTarget: HTMLElement | null;
  samples: Sample[];
  velocity: PanPoint;
  inertia: boolean;
  tween: Tween | null;
  lastTick: number;
};

/**
 * A cubic-bezier timing function. The arrow-key pan uses the repo's
 * `--ease-emphasized-decelerate`, which has no exact Math equivalent.
 */
function cubicBezier(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): (progress: number) => number {
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;

  const sampleX = (t: number) => ((ax * t + bx) * t + cx) * t;
  const sampleY = (t: number) => ((ay * t + by) * t + cy) * t;
  const derivativeX = (t: number) => (3 * ax * t + 2 * bx) * t + cx;

  const solveX = (x: number): number => {
    let t = x;

    for (let iteration = 0; iteration < 8; iteration += 1) {
      const difference = sampleX(t) - x;
      if (Math.abs(difference) < 1e-6) return t;

      const slope = derivativeX(t);
      if (Math.abs(slope) < 1e-6) break;

      t -= difference / slope;
    }

    let low = 0;
    let high = 1;
    t = x;

    for (let iteration = 0; iteration < 20; iteration += 1) {
      const value = sampleX(t);
      if (Math.abs(value - x) < 1e-6) return t;
      if (value < x) low = t;
      else high = t;
      t = (low + high) / 2;
    }

    return t;
  };

  return (progress: number) => {
    if (progress <= 0) return 0;
    if (progress >= 1) return 1;
    return sampleY(solveX(progress));
  };
}

const KEY_EASE = cubicBezier(0.23, 1, 0.32, 1);

/**
 * Pointer panning with momentum for the canvas surface.
 *
 * Pan lives in a ref, never in React state. The canvas owns the one rAF loop
 * and calls `tick(now)` each frame; the hook only advances the numbers and
 * reports whether there is still something to animate. A new pointerdown
 * clears the glide without touching the pan, so grabbing a moving canvas stops
 * it exactly where it is and the drag continues from that point.
 */
export function usePan({
  step,
  reduceMotion = false,
  disabled = false,
  onTap,
  onWake,
}: {
  step: PanPoint;
  reduceMotion?: boolean;
  disabled?: boolean;
  onTap?: (target: HTMLElement | null) => void;
  onWake?: () => void;
}): UsePanResult {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const panRef = useRef<PanPoint>({ x: 0, y: 0 });
  const stepRef = useRef(step);
  const reduceRef = useRef(reduceMotion);
  const disabledRef = useRef(disabled);
  const onTapRef = useRef(onTap);
  const onWakeRef = useRef(onWake);

  // Keep the handlers current without writing refs during render. The effect
  // runs before a reader can reach any of these callbacks.
  useEffect(() => {
    stepRef.current = step;
    reduceRef.current = reduceMotion;
    disabledRef.current = disabled;
    onTapRef.current = onTap;
    onWakeRef.current = onWake;
  });

  const stateRef = useRef<DragState>({
    pointerId: null,
    dragging: false,
    moved: 0,
    lastX: 0,
    lastY: 0,
    downTarget: null,
    samples: [],
    velocity: { x: 0, y: 0 },
    inertia: false,
    tween: null,
    lastTick: 0,
  });

  const setDraggingAttribute = useCallback((dragging: boolean) => {
    const element = containerRef.current;
    if (!element) return;

    if (dragging) element.dataset.dragging = "true";
    else delete element.dataset.dragging;
  }, []);

  const releaseCapture = useCallback((pointerId: number) => {
    const element = containerRef.current;
    if (!element) return;

    try {
      if (element.hasPointerCapture(pointerId)) {
        element.releasePointerCapture(pointerId);
      }
    } catch {
      // The pointer can already be gone (cancel, lost capture); nothing to do.
    }
  }, []);

  const halt = useCallback(() => {
    const state = stateRef.current;

    state.dragging = false;
    state.inertia = false;
    state.velocity = { x: 0, y: 0 };
    state.tween = null;
    state.samples = [];
    state.downTarget = null;
    state.lastTick = 0;

    if (state.pointerId !== null) {
      releaseCapture(state.pointerId);
      state.pointerId = null;
    }

    setDraggingAttribute(false);
  }, [releaseCapture, setDraggingAttribute]);

  const setPan = useCallback((x: number, y: number) => {
    panRef.current.x = x;
    panRef.current.y = y;
    onWakeRef.current?.();
  }, []);

  const tick = useCallback((now: number) => {
    const state = stateRef.current;
    const pan = panRef.current;

    if (state.tween) {
      const progress = Math.min(
        1,
        Math.max(0, (now - state.tween.start) / state.tween.duration),
      );
      const eased = state.tween.ease(progress);

      pan.x = state.tween.fromX + (state.tween.toX - state.tween.fromX) * eased;
      pan.y = state.tween.fromY + (state.tween.toY - state.tween.fromY) * eased;

      if (progress >= 1) state.tween = null;
    } else if (state.inertia) {
      const delta = state.lastTick
        ? Math.min(48, Math.max(0, now - state.lastTick))
        : FRAME_MS;

      pan.x += state.velocity.x * delta;
      pan.y += state.velocity.y * delta;

      // Time-based, not frame-count-based: a stalled loop must not turn the
      // same 0.95 into a much longer glide.
      const decay = Math.pow(GLIDE_DECAY, delta / FRAME_MS);
      state.velocity.x *= decay;
      state.velocity.y *= decay;

      if (Math.hypot(state.velocity.x, state.velocity.y) < SETTLE_VELOCITY) {
        state.velocity = { x: 0, y: 0 };
        state.inertia = false;
      }
    }

    state.lastTick = now;

    return state.dragging || state.inertia || state.tween !== null;
  }, []);

  const isActive = useCallback(() => {
    const state = stateRef.current;
    return state.dragging || state.inertia || state.tween !== null;
  }, []);

  const onPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (disabledRef.current) return;
      if (event.pointerType === "mouse" && event.button !== 0) return;

      const state = stateRef.current;
      // A second finger is not a second pan.
      if (state.pointerId !== null) return;

      const now = performance.now();
      const target = event.target instanceof HTMLElement ? event.target : null;

      state.pointerId = event.pointerId;
      state.dragging = true;
      state.moved = 0;
      state.lastX = event.clientX;
      state.lastY = event.clientY;
      state.downTarget = target;
      state.samples = [{ t: now, x: event.clientX, y: event.clientY }];
      // Grabbing a gliding canvas is an instant stop, not a pause that resumes
      // and not a jump: the pan stays where the last painted frame left it.
      state.velocity = { x: 0, y: 0 };
      state.inertia = false;
      state.tween = null;
      state.lastTick = now;

      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {
        // Pointer capture is an optimisation for pointers that leave the box;
        // the handlers below still work when the browser refuses it.
      }

      setDraggingAttribute(true);
      onWakeRef.current?.();
    },
    [setDraggingAttribute],
  );

  const onPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const state = stateRef.current;
      if (!state.dragging || state.pointerId !== event.pointerId) return;

      const deltaX = event.clientX - state.lastX;
      const deltaY = event.clientY - state.lastY;

      if (deltaX === 0 && deltaY === 0) return;

      state.lastX = event.clientX;
      state.lastY = event.clientY;
      panRef.current.x += deltaX;
      panRef.current.y += deltaY;
      state.moved += Math.hypot(deltaX, deltaY);

      const now = performance.now();
      state.samples.push({ t: now, x: event.clientX, y: event.clientY });

      while (
        state.samples.length > 2 &&
        now - state.samples[0].t > SAMPLE_WINDOW_MS
      ) {
        state.samples.shift();
      }

      onWakeRef.current?.();
    },
    [],
  );

  const onPointerUp = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const state = stateRef.current;
      if (state.pointerId !== event.pointerId) return;

      const wasDragging = state.dragging;
      const target = state.downTarget;
      const now = performance.now();

      state.pointerId = null;
      state.dragging = false;
      state.downTarget = null;
      releaseCapture(event.pointerId);
      setDraggingAttribute(false);

      if (wasDragging && state.moved < TAP_SLOP) {
        state.samples = [];
        state.inertia = false;
        state.velocity = { x: 0, y: 0 };
        onTapRef.current?.(target);
        onWakeRef.current?.();
        return;
      }

      let velocityX = 0;
      let velocityY = 0;

      if (wasDragging && !reduceRef.current) {
        const cutoff = now - SAMPLE_WINDOW_MS;

        // Drop everything older than the window, then add the release point:
        // the measurement is the hand's last 80ms, not its whole gesture.
        state.samples = state.samples.filter((sample) => sample.t >= cutoff);

        const lastSample = state.samples[state.samples.length - 1];

        // A finger that stopped before lifting has no momentum; its last
        // movement sample is already too old to speak for the release.
        if (lastSample && now - lastSample.t <= STALE_SAMPLE_MS) {
          state.samples.push({ t: now, x: state.lastX, y: state.lastY });

          const firstSample = state.samples[0];
          const elapsed = now - firstSample.t;

          if (state.samples.length >= 2 && elapsed >= 8) {
            velocityX = (state.lastX - firstSample.x) / elapsed;
            velocityY = (state.lastY - firstSample.y) / elapsed;
          }
        }
      }

      state.samples = [];

      const speed = Math.hypot(velocityX, velocityY);
      if (speed > MAX_VELOCITY) {
        const scale = MAX_VELOCITY / speed;
        velocityX *= scale;
        velocityY *= scale;
      }

      if (Math.hypot(velocityX, velocityY) < SETTLE_VELOCITY) {
        velocityX = 0;
        velocityY = 0;
      }

      state.velocity = { x: velocityX, y: velocityY };
      state.inertia = velocityX !== 0 || velocityY !== 0;
      state.tween = null;
      state.lastTick = now;

      onWakeRef.current?.();
    },
    [releaseCapture, setDraggingAttribute],
  );

  const onPointerCancel = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const state = stateRef.current;
      if (state.pointerId !== event.pointerId) return;

      halt();
      onWakeRef.current?.();
    },
    [halt],
  );

  const onLostPointerCapture = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const state = stateRef.current;
      if (state.pointerId !== event.pointerId) return;

      halt();
      onWakeRef.current?.();
    },
    [halt],
  );

  const onKeyDown = useCallback((event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (disabledRef.current) return;
    if (event.altKey || event.ctrlKey || event.metaKey) return;

    let directionX = 0;
    let directionY = 0;

    switch (event.key) {
      case "ArrowLeft":
        directionX = -1;
        break;
      case "ArrowRight":
        directionX = 1;
        break;
      case "ArrowUp":
        directionY = -1;
        break;
      case "ArrowDown":
        directionY = 1;
        break;
      default:
        return;
    }

    event.preventDefault();

    const state = stateRef.current;
    if (state.pointerId !== null) return;

    const pan = panRef.current;
    const now = performance.now();

    state.inertia = false;
    state.velocity = { x: 0, y: 0 };
    state.tween = {
      fromX: pan.x,
      fromY: pan.y,
      toX: pan.x + directionX * stepRef.current.x,
      toY: pan.y + directionY * stepRef.current.y,
      start: now,
      duration: KEY_TWEEN_MS,
      ease: KEY_EASE,
    };
    state.lastTick = now;

    onWakeRef.current?.();
  }, []);

  useEffect(() => {
    if (!disabled) return;
    halt();
  }, [disabled, halt]);

  useEffect(() => {
    if (!reduceMotion) return;

    // The preference can change while a glide is running; a reader who asked
    // for reduced motion should not have to wait it out.
    const state = stateRef.current;
    state.inertia = false;
    state.velocity = { x: 0, y: 0 };
  }, [reduceMotion]);

  useEffect(() => {
    return () => {
      halt();
    };
  }, [halt]);

  return {
    containerRef,
    panRef,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel,
      onLostPointerCapture,
      onKeyDown,
    },
    tick,
    isActive,
    halt,
    setPan,
  };
}
