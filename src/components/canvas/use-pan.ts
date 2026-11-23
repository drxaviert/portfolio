"use client";

import { useCallback, useEffect, useRef } from "react";
import type {
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
  RefObject,
} from "react";
import {
  arrowDirection,
  estimateReleaseVelocity,
  releaseGain,
} from "./pan-physics";
import type { PointerSample, Velocity } from "./pan-physics";

export type ScrollPoint = {
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
  onKeyUp: (event: ReactKeyboardEvent<HTMLDivElement>) => void;
  onBlur: () => void;
};

export type UsePanResult = {
  containerRef: RefObject<HTMLDivElement | null>;
  scrollRef: RefObject<ScrollPoint>;
  handlers: PanHandlers;
  /** Advance momentum or held-key acceleration. Returns whether motion is active. */
  tick: (now: number) => boolean;
  isActive: () => boolean;
  isDragging: () => boolean;
  /** Stop drag/momentum/keys but leave the scroll where it is. */
  halt: () => void;
};

/**
 * Every pan tunable, in scroll units of CSS px per 60fps frame.
 *
 * Total glide after a release is approximately `velocity / (1 - decay)`, so
 * with the .95 decay a 55px/frame release coasts about 1,100px. The release
 * gain ramps with pointer speed: a gentle release keeps the reference's
 * restrained drift, while a hard flick reaches the full gain and coasts.
 */
export const PAN_TUNING = {
  frameMs: 1000 / 60,
  /** Momentum decay per 60fps frame. */
  decay: 0.95,
  /** A glide is over below this speed (px/frame). */
  minVelocity: 0.01,
  /** Hard cap so a violent flick cannot teleport the canvas. */
  maxVelocity: 55,
  click: {
    maxDistancePx: 5,
    maxDurationMs: 300,
    /** Clicks in this window after a drag are ignored. */
    blockAfterDragMs: 100,
  },
  samples: {
    /** The trailing window used for the release estimate. */
    windowMs: 90,
    /** A release after this quiet time gets no fling. */
    staleMs: 80,
    /** Two positions closer than this cannot make a stable velocity. */
    minGapMs: 8,
  },
  drag: {
    /** Pointer speed (px/ms) where the release gain starts/stops ramping. */
    slowPxPerMs: 0.35,
    fastPxPerMs: 2.2,
    /** Gain at a gentle release and at a hard flick. */
    minGain: 0.2,
    maxGain: 1.6,
  },
  touch: {
    /** A touch flick is slightly stronger than a mouse flick. */
    gainScale: 1.25,
  },
  wheel: {
    /** Wheel delta (px) to velocity (px/frame). */
    multiplier: 0.05,
  },
  keys: {
    /**
     * Held-key acceleration in px/frame per 60fps frame. 3.4 reaches the
     * 25px/frame cruise in roughly 160ms, so a tap stays a small nudge.
     */
    acceleration: 3.4,
    /**
     * Held-key cruise: 25px/frame is 1.5px/ms (≈1,400px in the first second),
     * between a normal mouse drag and the 2.4px/ms hard-flick reference.
     */
    maxVelocity: 25,
    /** Reduced motion: one direct step per key press, no glide. */
    reducedStep: 120,
  },
} as const;

const GAIN_OPTIONS = {
  minGain: PAN_TUNING.drag.minGain,
  maxGain: PAN_TUNING.drag.maxGain,
  slowPxPerMs: PAN_TUNING.drag.slowPxPerMs,
  fastPxPerMs: PAN_TUNING.drag.fastPxPerMs,
  touchScale: PAN_TUNING.touch.gainScale,
};

type DragState = {
  pointerId: number | null;
  dragging: boolean;
  pointerType: string;
  moved: number;
  lastX: number;
  lastY: number;
  downTime: number;
  samples: PointerSample[];
  velocity: Velocity;
  lastTick: number;
  blockClickUntil: number;
};

function clampSpeed(velocity: Velocity, max: number): void {
  const speed = Math.hypot(velocity.x, velocity.y);
  if (speed <= max) return;

  const scale = max / speed;
  velocity.x *= scale;
  velocity.y *= scale;
}

function isArrowKey(key: string): boolean {
  return (
    key === "ArrowLeft" ||
    key === "ArrowRight" ||
    key === "ArrowUp" ||
    key === "ArrowDown"
  );
}

/**
 * Pointer, wheel and held-arrow panning for the WebGL plane grid.
 *
 * Dragging moves the offset one-to-one. On release the last ~90ms of hand
 * movement becomes a speed-sensitive glide. Arrow keys add acceleration in a
 * normalized direction while held, so two keys make a diagonal at the same
 * speed as one; releasing them lets the same decay carry the motion out.
 */
export function usePan({
  reduceMotion = false,
  disabled = false,
  onTap,
  onActivate,
  onWake,
}: {
  reduceMotion?: boolean;
  disabled?: boolean;
  onTap?: (x: number, y: number) => void;
  onActivate?: () => void;
  onWake?: () => void;
}): UsePanResult {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const scrollRef = useRef<ScrollPoint>({ x: 0, y: 0 });
  const arrowKeysRef = useRef<Set<string>>(new Set());
  const reduceRef = useRef(reduceMotion);
  const disabledRef = useRef(disabled);
  const onTapRef = useRef(onTap);
  const onActivateRef = useRef(onActivate);
  const onWakeRef = useRef(onWake);

  useEffect(() => {
    reduceRef.current = reduceMotion;
    disabledRef.current = disabled;
    onTapRef.current = onTap;
    onActivateRef.current = onActivate;
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
    state.samples = [];
    arrowKeysRef.current.clear();

    if (state.pointerId !== null) {
      releaseCapture(state.pointerId);
      state.pointerId = null;
    }

    setDraggingAttribute(false);
  }, [releaseCapture, setDraggingAttribute]);

  const tick = useCallback((now: number) => {
    const state = stateRef.current;
    const scroll = scrollRef.current;
    const deltaMs = state.lastTick
      ? Math.min(48, Math.max(0, now - state.lastTick))
      : PAN_TUNING.frameMs;
    const dt = deltaMs / PAN_TUNING.frameMs;
    const direction = arrowDirection(arrowKeysRef.current);
    const keysActive = direction.x !== 0 || direction.y !== 0;

    if (!state.dragging) {
      if (reduceRef.current) {
        state.velocity = { x: 0, y: 0 };
      } else {
        if (keysActive) {
          state.velocity.x += direction.x * PAN_TUNING.keys.acceleration * dt;
          state.velocity.y += direction.y * PAN_TUNING.keys.acceleration * dt;
          clampSpeed(state.velocity, PAN_TUNING.keys.maxVelocity);
        }

        if (
          Math.abs(state.velocity.x) > 0.0001 ||
          Math.abs(state.velocity.y) > 0.0001
        ) {
          scroll.x += state.velocity.x * dt;
          scroll.y += state.velocity.y * dt;

          const decay = Math.pow(PAN_TUNING.decay, dt);
          state.velocity.x *= decay;
          state.velocity.y *= decay;

          if (
            Math.hypot(state.velocity.x, state.velocity.y) <
            PAN_TUNING.minVelocity
          ) {
            state.velocity = { x: 0, y: 0 };
          }
        }
      }
    }

    state.lastTick = now;

    return (
      state.dragging ||
      (keysActive && !reduceRef.current) ||
      state.velocity.x !== 0 ||
      state.velocity.y !== 0
    );
  }, []);

  const isActive = useCallback(() => {
    const state = stateRef.current;
    const direction = arrowDirection(arrowKeysRef.current);
    const keysActive = direction.x !== 0 || direction.y !== 0;

    return (
      state.dragging ||
      (keysActive && !reduceRef.current) ||
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
        now - state.samples[0].t > PAN_TUNING.samples.windowMs
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
      const wasDrag = state.moved > PAN_TUNING.click.maxDistancePx;

      state.pointerId = null;
      state.dragging = false;
      releaseCapture(event.pointerId);
      setDraggingAttribute(false);

      if (wasDrag) {
        state.velocity = { x: 0, y: 0 };

        if (!reduceRef.current) {
          const pointerVelocity = estimateReleaseVelocity(
            state.samples,
            now,
            PAN_TUNING.samples,
          );

          if (pointerVelocity) {
            const pointerSpeed = Math.hypot(
              pointerVelocity.x,
              pointerVelocity.y,
            );
            const gain = releaseGain(
              pointerSpeed,
              state.pointerType === "touch",
              GAIN_OPTIONS,
            );

            state.velocity = {
              x: pointerVelocity.x * PAN_TUNING.frameMs * gain,
              y: pointerVelocity.y * PAN_TUNING.frameMs * gain,
            };
            clampSpeed(state.velocity, PAN_TUNING.maxVelocity);
          }
        }

        state.blockClickUntil = now + PAN_TUNING.click.blockAfterDragMs;
      } else if (
        duration < PAN_TUNING.click.maxDurationMs &&
        state.moved <= PAN_TUNING.click.maxDistancePx &&
        now >= state.blockClickUntil
      ) {
        state.velocity = { x: 0, y: 0 };
        onTapRef.current?.(event.clientX, event.clientY);
      } else {
        state.velocity = { x: 0, y: 0 };
      }

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

    if (!isArrowKey(event.key)) return;

    event.preventDefault();
    arrowKeysRef.current.add(event.key);

    if (reduceRef.current) {
      // Reduced motion: one direct step per physical press, no glide.
      if (!event.repeat) {
        const direction = arrowDirection(arrowKeysRef.current);
        scrollRef.current.x += direction.x * PAN_TUNING.keys.reducedStep;
        scrollRef.current.y += direction.y * PAN_TUNING.keys.reducedStep;
        onWakeRef.current?.();
      }
      return;
    }

    stateRef.current.lastTick = performance.now();
    onWakeRef.current?.();
  }, []);

  const onKeyUp = useCallback((event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (!isArrowKey(event.key)) return;

    event.preventDefault();
    arrowKeysRef.current.delete(event.key);

    if (!disabledRef.current) onWakeRef.current?.();
  }, []);

  const onBlur = useCallback(() => {
    arrowKeysRef.current.clear();
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
      const state = stateRef.current;

      if (reduceRef.current) {
        scrollRef.current.x -= deltaX;
        scrollRef.current.y -= deltaY;
      } else {
        // A notch becomes velocity; the decay turns a 100px wheel delta into
        // roughly 100px of travel.
        state.velocity.x -= deltaX * PAN_TUNING.wheel.multiplier;
        state.velocity.y -= deltaY * PAN_TUNING.wheel.multiplier;
        clampSpeed(state.velocity, PAN_TUNING.maxVelocity);
        state.lastTick = performance.now();
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
    arrowKeysRef.current.clear();
  }, [reduceMotion]);

  useEffect(() => {
    const clearKeys = () => arrowKeysRef.current.clear();
    window.addEventListener("blur", clearKeys);

    return () => window.removeEventListener("blur", clearKeys);
  }, []);

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
      onKeyUp,
      onBlur,
    },
    tick,
    isActive,
    isDragging,
    halt,
  };
}
