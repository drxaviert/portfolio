"use client";

import { useCallback, useEffect, useRef } from "react";
import type {
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
  RefObject,
} from "react";

export type ScrollPoint = {
  x: number;
  y: number;
};

export type ArrowDirection = {
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
  scrollRef: RefObject<ScrollPoint>;
  handlers: PanHandlers;
  /** Advance momentum or the arrow tween. Returns whether motion is active. */
  tick: (now: number) => boolean;
  isActive: () => boolean;
  isDragging: () => boolean;
  /** Stop drag/momentum but leave the scroll where it is. */
  halt: () => void;
  setScroll: (x: number, y: number) => void;
  tweenTo: (x: number, y: number, duration?: number) => void;
};

/**
 * The reference's physics, with the hand driving the offset directly:
 * dragMultiplier shapes the release fling, touchMultiplier makes a touch fling
 * stronger, wheel speedMultiplier becomes momentum, and decay is applied per
 * 60fps frame. Reduced motion applies wheel deltas directly, drops the fling
 * and sets decay to zero.
 */
const DRAG_MULTIPLIER = 0.1;
const TOUCH_MULTIPLIER = 0.3;
const WHEEL_MULTIPLIER = 0.05;
const DECAY = 0.95;
const FRAME_MS = 1000 / 60;
const MIN_VELOCITY = 0.01;
const MAX_VELOCITY = 32;
const TAP_DISTANCE = 5;
const TAP_MS = 300;
const CLICK_BLOCK_MS = 100;
const SAMPLE_WINDOW_MS = 80;
/** A release more than one sample window after the last move has no fling. */
const STALE_SAMPLE_MS = 80;
const ARROW_TWEEN_MS = 320;

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
};

type DragState = {
  pointerId: number | null;
  dragging: boolean;
  pointerType: string;
  moved: number;
  lastX: number;
  lastY: number;
  downTime: number;
  samples: Sample[];
  velocity: ScrollPoint;
  tween: Tween | null;
  lastTick: number;
  blockClickUntil: number;
};

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

const ARROW_EASE = cubicBezier(0.32, 0.72, 0, 1);

function clampVelocity(velocity: ScrollPoint): void {
  const speed = Math.hypot(velocity.x, velocity.y);
  if (speed <= MAX_VELOCITY) return;

  const scale = MAX_VELOCITY / speed;
  velocity.x *= scale;
  velocity.y *= scale;
}

/**
 * Pointer, wheel and arrow-key panning for the WebGL plane grid.
 *
 * Scroll is a screen-space offset in CSS pixels: x right, y down. Dragging
 * moves it one-to-one; a release turns the last 80ms of hand velocity into the
 * fling; a wheel notch becomes momentum; an arrow key eases the nearest
 * neighbour to the viewport centre.
 */
export function usePan({
  reduceMotion = false,
  disabled = false,
  onTap,
  onActivate,
  onArrow,
  onWake,
}: {
  reduceMotion?: boolean;
  disabled?: boolean;
  onTap?: (x: number, y: number) => void;
  onActivate?: () => void;
  onArrow?: (direction: ArrowDirection) => void;
  onWake?: () => void;
}): UsePanResult {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const scrollRef = useRef<ScrollPoint>({ x: 0, y: 0 });
  const reduceRef = useRef(reduceMotion);
  const disabledRef = useRef(disabled);
  const onTapRef = useRef(onTap);
  const onActivateRef = useRef(onActivate);
  const onArrowRef = useRef(onArrow);
  const onWakeRef = useRef(onWake);

  useEffect(() => {
    reduceRef.current = reduceMotion;
    disabledRef.current = disabled;
    onTapRef.current = onTap;
    onActivateRef.current = onActivate;
    onArrowRef.current = onArrow;
    onWakeRef.current = onWake;
  });

  const stateRef = useRef<DragState>({
    pointerId: null,
    dragging: false,
    pointerType: "",
    moved: 0,
    lastX: 0,
    lastY: 0,
    downTime: 0,
    samples: [],
    velocity: { x: 0, y: 0 },
    tween: null,
    lastTick: 0,
    blockClickUntil: 0,
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
      // The pointer can already be gone.
    }
  }, []);

  const halt = useCallback(() => {
    const state = stateRef.current;

    state.dragging = false;
    state.velocity = { x: 0, y: 0 };
    state.tween = null;
    state.samples = [];

    if (state.pointerId !== null) {
      releaseCapture(state.pointerId);
      state.pointerId = null;
    }

    setDraggingAttribute(false);
  }, [releaseCapture, setDraggingAttribute]);

  const setScroll = useCallback((x: number, y: number) => {
    scrollRef.current.x = x;
    scrollRef.current.y = y;

    const state = stateRef.current;
    state.velocity = { x: 0, y: 0 };
    state.tween = null;

    onWakeRef.current?.();
  }, []);

  const tweenTo = useCallback(
    (x: number, y: number, duration = ARROW_TWEEN_MS) => {
      if (reduceRef.current || duration <= 0) {
        setScroll(x, y);
        return;
      }

      const state = stateRef.current;
      const scroll = scrollRef.current;

      state.velocity = { x: 0, y: 0 };
      state.tween = {
        fromX: scroll.x,
        fromY: scroll.y,
        toX: x,
        toY: y,
        start: performance.now(),
        duration,
      };
      state.lastTick = 0;

      onWakeRef.current?.();
    },
    [setScroll],
  );

  const tick = useCallback((now: number) => {
    const state = stateRef.current;
    const scroll = scrollRef.current;
    const deltaMs = state.lastTick
      ? Math.min(48, Math.max(0, now - state.lastTick))
      : FRAME_MS;
    const dt = deltaMs / FRAME_MS;

    if (state.tween) {
      const progress = Math.min(
        1,
        Math.max(0, (now - state.tween.start) / state.tween.duration),
      );
      const eased = ARROW_EASE(progress);

      scroll.x =
        state.tween.fromX + (state.tween.toX - state.tween.fromX) * eased;
      scroll.y =
        state.tween.fromY + (state.tween.toY - state.tween.fromY) * eased;

      if (progress >= 1) state.tween = null;
    } else if (!state.dragging) {
      if (reduceRef.current) {
        state.velocity = { x: 0, y: 0 };
      } else if (
        Math.abs(state.velocity.x) > 0.0001 ||
        Math.abs(state.velocity.y) > 0.0001
      ) {
        scroll.x += state.velocity.x * dt;
        scroll.y += state.velocity.y * dt;

        const decay = Math.pow(DECAY, dt);
        state.velocity.x *= decay;
        state.velocity.y *= decay;

        if (Math.hypot(state.velocity.x, state.velocity.y) < MIN_VELOCITY) {
          state.velocity = { x: 0, y: 0 };
        }
      }
    }

    state.lastTick = now;

    return (
      state.dragging ||
      state.tween !== null ||
      state.velocity.x !== 0 ||
      state.velocity.y !== 0
    );
  }, []);

  const isActive = useCallback(() => {
    const state = stateRef.current;
    return (
      state.dragging ||
      state.tween !== null ||
      Math.abs(state.velocity.x) > 0.0001 ||
      Math.abs(state.velocity.y) > 0.0001
    );
  }, []);

  const isDragging = useCallback(() => stateRef.current.dragging, []);

  const onPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (disabledRef.current) return;
      if (event.pointerType === "mouse" && event.button !== 0) return;
      if (!event.isPrimary) return;

      const state = stateRef.current;
      if (state.pointerId !== null) return;

      const now = performance.now();

      state.pointerId = event.pointerId;
      state.dragging = true;
      state.pointerType = event.pointerType;
      state.moved = 0;
      state.lastX = event.clientX;
      state.lastY = event.clientY;
      state.downTime = now;
      state.samples = [{ t: now, x: event.clientX, y: event.clientY }];
      state.velocity = { x: 0, y: 0 };
      state.tween = null;
      state.lastTick = now;

      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {
        // Capture is best-effort.
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
      state.moved += Math.hypot(deltaX, deltaY);

      scrollRef.current.x += deltaX;
      scrollRef.current.y += deltaY;

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

      const now = performance.now();
      const duration = now - state.downTime;
      const wasDrag = state.moved > TAP_DISTANCE;

      state.pointerId = null;
      state.dragging = false;
      releaseCapture(event.pointerId);
      setDraggingAttribute(false);

      if (wasDrag) {
        let velocityX = 0;
        let velocityY = 0;

        if (!reduceRef.current) {
          // The samples array holds the two most recent moves. Use that pair
          // rather than filtering to a rigid 80ms window: at low event rates
          // (a synthetic drag, a slow machine) the window can collapse to one
          // sample and lose a real fling. The last sample itself must be
          // recent, so a hand that stopped before lifting still has no glide.
          const samples = state.samples;
          const lastSample = samples[samples.length - 1];
          const previousSample = samples[samples.length - 2];

          if (
            lastSample &&
            previousSample &&
            now - lastSample.t <= STALE_SAMPLE_MS
          ) {
            const elapsed = lastSample.t - previousSample.t;

            if (elapsed >= 8) {
              const multiplier =
                state.pointerType === "touch"
                  ? TOUCH_MULTIPLIER
                  : DRAG_MULTIPLIER;

              // Pointer velocity is px/ms; the engine works in px per 60fps
              // frame. The x2 is the reference's release impulse.
              velocityX =
                ((lastSample.x - previousSample.x) / elapsed) *
                FRAME_MS *
                multiplier *
                2;
              velocityY =
                ((lastSample.y - previousSample.y) / elapsed) *
                FRAME_MS *
                multiplier *
                2;
            }
          }
        }

        state.velocity = { x: velocityX, y: velocityY };
        clampVelocity(state.velocity);
        state.blockClickUntil = now + CLICK_BLOCK_MS;
      } else if (
        duration < TAP_MS &&
        state.moved <= TAP_DISTANCE &&
        now >= state.blockClickUntil
      ) {
        state.velocity = { x: 0, y: 0 };
        onTapRef.current?.(event.clientX, event.clientY);
      } else {
        state.velocity = { x: 0, y: 0 };
      }

      state.tween = null;
      state.samples = [];
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

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onActivateRef.current?.();
      return;
    }

    let x = 0;
    let y = 0;

    switch (event.key) {
      case "ArrowLeft":
        x = -1;
        break;
      case "ArrowRight":
        x = 1;
        break;
      case "ArrowUp":
        y = -1;
        break;
      case "ArrowDown":
        y = 1;
        break;
      default:
        return;
    }

    event.preventDefault();
    onArrowRef.current?.({ x, y });
  }, []);

  // Wheel needs a non-passive native listener so a full-viewport canvas can
  // stop the page from scrolling underneath it.
  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const onWheel = (event: WheelEvent) => {
      if (disabledRef.current) return;
      if (event.ctrlKey || event.metaKey) return;

      event.preventDefault();

      const scale =
        event.deltaMode === 1
          ? 16
          : event.deltaMode === 2
            ? window.innerHeight
            : 1;
      const deltaX = event.deltaX * scale;
      const deltaY = event.deltaY * scale;

      if (reduceRef.current) {
        scrollRef.current.x -= deltaX;
        scrollRef.current.y -= deltaY;
      } else {
        const state = stateRef.current;
        // A notch becomes velocity; the 0.95 decay turns a 100px wheel delta
        // into roughly 100px of travel instead of a 5px nudge.
        state.velocity.x -= deltaX * WHEEL_MULTIPLIER;
        state.velocity.y -= deltaY * WHEEL_MULTIPLIER;
        clampVelocity(state.velocity);
      }

      onWakeRef.current?.();
    };

    element.addEventListener("wheel", onWheel, { passive: false });

    return () => element.removeEventListener("wheel", onWheel);
  }, []);

  useEffect(() => {
    if (!disabled) return;
    halt();
  }, [disabled, halt]);

  useEffect(() => {
    if (!reduceMotion) return;

    const state = stateRef.current;
    state.velocity = { x: 0, y: 0 };
  }, [reduceMotion]);

  useEffect(() => {
    return () => {
      halt();
    };
  }, [halt]);

  return {
    containerRef,
    scrollRef,
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
    isDragging,
    halt,
    setScroll,
    tweenTo,
  };
}
