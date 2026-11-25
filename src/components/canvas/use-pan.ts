"use client";

import { useCallback, useEffect, useRef } from "react";
import type {
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
  RefObject,
} from "react";
import {
  arrowDirection,
  decayFactor,
  glideStepFactor,
} from "./pan-physics";
import type { Velocity } from "./pan-physics";

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
  /** Advance the velocity integrator. Returns whether motion is active. */
  tick: (now: number) => boolean;
  isActive: () => boolean;
  isDragging: () => boolean;
  /** Current glide speed in px per 60fps frame. */
  speed: () => number;
  /** Stop drag/momentum/keys but leave the scroll where it is. */
  halt: () => void;
};

/**
 * The reference's pan model: pointer deltas add velocity, never position.
 *
 * Each frame the velocity moves the scroll by the geometric sum of its 60fps
 * steps, then decays. Dragging therefore trails the hand and eases into place;
 * the release adds 2x the last pointer delta. Wheel and held arrows feed the
 * same velocity. Reduced motion bypasses the integrator for direct movement.
 */
export const PAN_TUNING = {
  frameMs: 1000 / 60,
  /** Momentum decay per 60fps frame. */
  decay: 0.95,
  /** A glide is over below this speed (px/frame). */
  minVelocity: 0.01,
  /** Pointer delta to velocity. Touch gets the reference's stronger value. */
  dragMultiplier: 0.1,
  touchMultiplier: 0.3,
  /** Normalized wheel pixels to velocity. */
  wheelMultiplier: 0.05,
  click: {
    maxDistancePx: 5,
    maxDurationMs: 300,
    /** Clicks in this window after a drag are ignored. */
    blockAfterDragMs: 100,
  },
  keys: {
    /** Held-key acceleration in px/frame per 60fps frame. */
    acceleration: 3.4,
    /** Cruise: 25px/frame = 1.5px/ms, about 1,400px in the first second. */
    maxVelocity: 25,
    /** Reduced motion: one direct step per key press, no glide. */
    reducedStep: 120,
  },
} as const;

type DragState = {
  pointerId: number | null;
  dragging: boolean;
  /** Capture only starts once a drag passes the click threshold. */
  captured: boolean;
  pointerType: string;
  moved: number;
  lastX: number;
  lastY: number;
  lastDeltaX: number;
  lastDeltaY: number;
  downTime: number;
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
    captured: false,
    pointerType: "",
    moved: 0,
    lastX: 0,
    lastY: 0,
    lastDeltaX: 0,
    lastDeltaY: 0,
    downTime: 0,
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
    arrowKeysRef.current.clear();

    if (state.pointerId !== null) {
      if (state.captured) releaseCapture(state.pointerId);
      state.captured = false;
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
        const step = glideStepFactor(PAN_TUNING.decay, dt);
        const decay = decayFactor(PAN_TUNING.decay, dt);

        scroll.x += state.velocity.x * step;
        scroll.y += state.velocity.y * step;
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

  const speed = useCallback(() => {
    const velocity = stateRef.current.velocity;

    return Math.hypot(velocity.x, velocity.y);
  }, []);

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
      state.captured = false;
      state.pointerType = event.pointerType;
      state.moved = 0;
      state.lastX = event.clientX;
      state.lastY = event.clientY;
      state.lastDeltaX = 0;
      state.lastDeltaY = 0;
      state.downTime = now;
      // Grabbing a glide stops it where it is; the hand then adds velocity.
      state.velocity = { x: 0, y: 0 };
      state.lastTick = now;

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
      state.lastDeltaX = deltaX;
      state.lastDeltaY = deltaY;
      state.moved += Math.hypot(deltaX, deltaY);

      // A tap must not take pointer capture: releasing it was a measurable
      // compositor stall on the tile-open path.
      if (!state.captured && state.moved > PAN_TUNING.click.maxDistancePx) {
        state.captured = true;
        try {
          event.currentTarget.setPointerCapture(event.pointerId);
        } catch {
          // Capture is best-effort.
        }
      }

      if (reduceRef.current) {
        scrollRef.current.x += deltaX;
        scrollRef.current.y += deltaY;
      } else {
        const multiplier =
          state.pointerType === "touch"
            ? PAN_TUNING.touchMultiplier
            : PAN_TUNING.dragMultiplier;

        state.velocity.x += deltaX * multiplier;
        state.velocity.y += deltaY * multiplier;
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
      if (state.captured) releaseCapture(event.pointerId);
      state.captured = false;
      setDraggingAttribute(false);

      if (wasDrag) {
        if (!reduceRef.current) {
          const multiplier =
            state.pointerType === "touch"
              ? PAN_TUNING.touchMultiplier
              : PAN_TUNING.dragMultiplier;

          // The reference's extra fling: twice the last pointer delta.
          state.velocity.x += state.lastDeltaX * multiplier * 2;
          state.velocity.y += state.lastDeltaY * multiplier * 2;
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

  const onKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
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
          scrollRef.current.x +=
            direction.x * PAN_TUNING.keys.reducedStep;
          scrollRef.current.y +=
            direction.y * PAN_TUNING.keys.reducedStep;
          onWakeRef.current?.();
        }
        return;
      }

      stateRef.current.lastTick = performance.now();
      onWakeRef.current?.();
    },
    [],
  );

  const onKeyUp = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      if (!isArrowKey(event.key)) return;

      event.preventDefault();
      arrowKeysRef.current.delete(event.key);

      if (!disabledRef.current) onWakeRef.current?.();
    },
    [],
  );

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
        state.velocity.x -= deltaX * PAN_TUNING.wheelMultiplier;
        state.velocity.y -= deltaY * PAN_TUNING.wheelMultiplier;
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
    speed,
    halt,
  };
}
