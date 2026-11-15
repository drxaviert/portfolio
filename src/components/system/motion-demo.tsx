"use client";

import { useCallback, useEffect, useRef } from "react";
import type { JSX } from "react";
import { useSystemEngine } from "@/app/design-system/system-shell";
import type { TokenMap } from "@/lib/system/derive";
import { DURATIONS, EASES } from "@/lib/system/source.generated";
import { useContentVisibility } from "./use-content-visibility";

const EASE_FOR_DURATION = "--ease-emphasized-standard";
const DURATION_FOR_EASE = "--duration-long-2";
// The dot travels the track minus its own width and an 8px inset. Container
// units keep this correct at any viewport instead of freezing a measured px.
const TRAVEL_TRANSFORM = "translateX(calc(100cqw - 100% - 8px))";

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

/** Visible labels round to whole ms; the animation keeps the exact value. */
function formatDuration(value: string): string {
  const ms = parseMs(value);

  return ms === null ? value : `${Math.round(ms)}ms`;
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
  const engine = useSystemEngine();
  const cardRef = useContentVisibility<HTMLDivElement>();
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
        durationLabelRef.current.textContent = formatDuration(
          durationRef.current,
        );
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
    const dot = dotRef.current;

    if (!dot) return;

    dot.getAnimations?.().forEach((animation) => animation.cancel());

    if (prefersReducedMotion() || typeof dot.animate !== "function") {
      dot.style.transform = TRAVEL_TRANSFORM;

      return;
    }

    dot.animate(
      [{ transform: "translateX(0)" }, { transform: TRAVEL_TRANSFORM }],
      {
        duration: parseMs(durationRef.current) ?? 0,
        easing: easingRef.current,
        fill: "both",
      },
    );
  }, []);

  return (
    <div
      ref={cardRef}
      className="rounded-md bg-surface-container-low p-3 shadow-card"
    >
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
        <span ref={durationLabelRef}>{formatDuration(initialDuration)}</span>
        <span aria-hidden="true">·</span>
        <span ref={easingLabelRef} className="min-w-0 break-all">
          {initialEasing}
        </span>
      </p>

      <div
        ref={trackRef}
        className="relative mt-2 h-6 overflow-hidden rounded-full bg-surface-container [container-type:inline-size]"
      >
        <span
          ref={dotRef}
          aria-hidden="true"
          data-motion-dot=""
          className="absolute top-1 left-1 size-4 rounded-full bg-primary"
        />
      </div>
    </div>
  );
}
