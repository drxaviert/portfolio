"use client";

import { useCallback, useEffect, useRef } from "react";
import type { JSX } from "react";
import { useSystem } from "@/app/design-system/system-shell";
import type { TokenMap } from "@/lib/system/derive";
import { DURATIONS, EASES } from "@/lib/system/source.generated";

const TRACK_INSET_PX = 8;
const EASE_FOR_DURATION = "--ease-emphasized-standard";
const DURATION_FOR_EASE = "--duration-long-2";

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function parseMs(value: string): number | null {
  const match = /^(-?[\d.]+)(ms|s)$/.exec(value.trim());

  if (!match) return null;

  const amount = Number(match[1]);

  return match[2] === "s" ? amount * 1000 : amount;
}

/**
 * A dot travelling a fixed track. The token side follows the engine (so speed
 * changes it), the other side is a fixed reference token, and Replay restarts
 * on demand. Reduced motion jumps to the end state instead of animating.
 *
 * Only transform moves, so replaying never changes layout.
 */
export function MotionDemo({
  kind,
  token,
}: {
  kind: "ease" | "duration";
  token: string;
}): JSX.Element {
  const { engine } = useSystem();
  const trackRef = useRef<HTMLDivElement | null>(null);
  const dotRef = useRef<HTMLSpanElement | null>(null);
  const durationLabelRef = useRef<HTMLSpanElement | null>(null);
  const easingLabelRef = useRef<HTMLSpanElement | null>(null);
  const initialDuration =
    kind === "duration"
      ? (DURATIONS[token] ?? "0ms")
      : (DURATIONS[DURATION_FOR_EASE] ?? "600ms");
  const initialEasing =
    kind === "ease"
      ? (EASES[token] ?? "linear")
      : (EASES[EASE_FOR_DURATION] ?? "ease-out");
  const durationRef = useRef(initialDuration);
  const easingRef = useRef(initialEasing);

  const update = useCallback(
    (tokens?: TokenMap) => {
      const duration =
        kind === "duration"
          ? (tokens?.[token] ?? DURATIONS[token])
          : (tokens?.[DURATION_FOR_EASE] ?? DURATIONS[DURATION_FOR_EASE]);
      const easing =
        kind === "ease"
          ? (tokens?.[token] ?? EASES[token])
          : (tokens?.[EASE_FOR_DURATION] ?? EASES[EASE_FOR_DURATION]);

      if (duration) durationRef.current = duration;
      if (easing) easingRef.current = easing;

      if (durationLabelRef.current) {
        durationLabelRef.current.textContent = durationRef.current;
      }

      if (easingLabelRef.current) {
        easingLabelRef.current.textContent = easingRef.current;
      }
    },
    [kind, token],
  );

  useEffect(() => {
    update();

    return engine.subscribe((tokens) => update(tokens));
  }, [engine, update]);

  const replay = useCallback(() => {
    const track = trackRef.current;
    const dot = dotRef.current;

    if (!track || !dot) return;

    const distance = Math.max(
      0,
      track.clientWidth - dot.offsetWidth - TRACK_INSET_PX,
    );

    dot.getAnimations?.().forEach((animation) => animation.cancel());

    if (prefersReducedMotion() || typeof dot.animate !== "function") {
      dot.style.transform = `translateX(${distance}px)`;

      return;
    }

    dot.animate(
      [
        { transform: "translateX(0)" },
        { transform: `translateX(${distance}px)` },
      ],
      {
        duration: parseMs(durationRef.current) ?? 0,
        easing: easingRef.current,
        fill: "both",
      },
    );
  }, []);

  return (
    <div className="rounded-md bg-surface-container-low p-3 shadow-card">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <code className="min-w-0 break-all font-mono text-[11px]">
          {token}
        </code>
        <button
          type="button"
          onClick={replay}
          className="h-8 rounded-sm bg-surface-container-high px-2.5 text-[11px] font-medium text-on-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          Replay
        </button>
      </div>

      <p className="mt-1 flex flex-wrap gap-x-2 text-[11px] tabular-nums text-on-surface-variant">
        <span ref={durationLabelRef}>{initialDuration}</span>
        <span aria-hidden="true">·</span>
        <span ref={easingLabelRef} className="min-w-0 break-all">
          {initialEasing}
        </span>
      </p>

      <div
        ref={trackRef}
        className="relative mt-2 h-6 overflow-hidden rounded-full bg-surface-container"
      >
        <span
          ref={dotRef}
          aria-hidden="true"
          data-motion-dot=""
          className="absolute top-1/2 left-1 size-4 -translate-y-1/2 rounded-full bg-primary"
        />
      </div>
    </div>
  );
}
