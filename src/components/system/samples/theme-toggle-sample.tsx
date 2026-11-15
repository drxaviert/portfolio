"use client";

import { useEffect, useId, useRef, useState } from "react";
import type {
  JSX,
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
  Ref,
} from "react";
import {
  useSystemActions,
  useSystemSpeed,
} from "@/app/design-system/system-shell";
import {
  LEADING_DURATION_MS,
  TRAILING_DELAY_MS,
  TRAILING_DURATION_MS,
  leadingEase,
  trailingEase,
} from "@/components/theme/theme-toggle";
import type { ForceState } from "@/components/system/component-doc";
import { getActivePhase } from "@/lib/theme";
import type { DayPhase, Mode } from "@/lib/theme";
import { todForPhase } from "@/lib/system/params";
import "@/components/theme/theme-toggle.css";

type Glyph = Mode | "dawn" | "dusk" | "dayclock";

const MODES: ReadonlyArray<{ mode: Mode; label: string; tooltip: string }> = [
  { mode: "day", label: "Day", tooltip: "Day" },
  { mode: "night", label: "Night", tooltip: "Night" },
  { mode: "auto", label: "Auto", tooltip: "Auto · follows your clock" },
];

const PHASES: ReadonlyArray<{
  phase: DayPhase;
  label: string;
  tooltip: string;
}> = [
  { phase: "clock", label: "Clock", tooltip: "Clock · follows the time of day" },
  { phase: "dawn", label: "Dawn", tooltip: "Dawn" },
  { phase: "day", label: "Midday", tooltip: "Midday" },
  { phase: "dusk", label: "Dusk", tooltip: "Dusk" },
];

const SEGMENT_WIDTH = 34;
const TRACK_INSET = 4;
const TRACK_HEIGHT = 32;
const SHAPE_PADDING = 2;
const SHAPE_RADIUS = 6;
const PILL_HEIGHT = 28;

function trackWidth(segments: number): string {
  return `${segments * SEGMENT_WIDTH + TRACK_INSET}px`;
}

function canHover(): boolean {
  return typeof window.matchMedia === "function"
    ? window.matchMedia("(hover: hover)").matches
    : true;
}

function prefersReducedMotion(): boolean {
  return (
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function dayPhaseGlyph(phase: DayPhase): Glyph {
  if (phase === "clock") return "dayclock";
  if (phase === "day") return "day";

  return phase;
}

/** Copied from theme-toggle.tsx (reference only) so the sample uses the site icons. */
function GlyphIcon({ glyph }: { glyph: Glyph }): JSX.Element {
  const clipId = `sun-clip-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;

  return (
    <svg
      data-glyph={glyph}
      viewBox="0 0 16 16"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      overflow="visible"
      aria-hidden="true"
      focusable="false"
    >
      {glyph === "day" ? (
        <>
          <circle cx="8" cy="8" r="3" />
          <g data-rays>
            <path d="M8 1.5v1.5M8 13v1.5M1.5 8H3M13 8h1.5M3.4 3.4l1.1 1.1M11.5 11.5l1.1 1.1M12.6 3.4l-1.1 1.1M4.5 11.5l-1.1 1.1" />
          </g>
        </>
      ) : glyph === "night" ? (
        <path
          transform="translate(0.65 0)"
          d="M13.2 9.7A5.8 5.8 0 0 1 6.3 2.8a5.9 5.9 0 1 0 6.9 6.9Z"
        />
      ) : glyph === "dawn" ? (
        <>
          <defs>
            <clipPath id={clipId}>
              <rect x="0" y="0" width="16" height="13" />
            </clipPath>
          </defs>
          <path d="M2 12h12" />
          <g clipPath={`url(#${clipId})`}>
            <g data-sun>
              <path d="M5 12a3 3 0 0 1 6 0" />
              <path d="M8 2.5v1.7M4.7 4.4l1.2 1.2M11.3 4.4l-1.2 1.2" />
            </g>
          </g>
        </>
      ) : glyph === "dusk" ? (
        <>
          <defs>
            <clipPath id={clipId}>
              <rect x="0" y="9.6" width="16" height="6.4" />
            </clipPath>
          </defs>
          <path d="M2 10.5h12" />
          <g clipPath={`url(#${clipId})`}>
            <g data-sun>
              <path d="M5 10.5a3 3 0 0 0 6 0" />
            </g>
          </g>
          <g data-rays>
            <path d="M8 2.5v1.5M4.8 4.4l1.1 1.1M11.2 4.4l-1.1 1.1" />
          </g>
        </>
      ) : glyph === "dayclock" ? (
        <>
          <circle cx="8" cy="8" r="3.2" />
          <g data-rays>
            <path d="M8 1.6v1.4M8 13v1.4M1.6 8h1.4M13 8h1.4" />
          </g>
          <g data-hands>
            <path d="M8 6V8l1.6.8" />
          </g>
        </>
      ) : (
        <>
          <circle cx="8" cy="8" r="6" />
          <g data-hands>
            <path d="M8 4.6V8l2.4 1.4" />
          </g>
        </>
      )}
    </svg>
  );
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function pillPath(x: number, width: number): string {
  const w = Math.max(2, width);
  const r = Math.min(SHAPE_RADIUS, PILL_HEIGHT / 2, w / 2);
  const right = x + w;
  const bottom = SHAPE_PADDING + PILL_HEIGHT;

  return [
    `M${round2(x + r)},${SHAPE_PADDING}`,
    `H${round2(right - r)}`,
    `A${r},${r} 0 0 1 ${round2(right)},${SHAPE_PADDING + r}`,
    `V${bottom - r}`,
    `A${r},${r} 0 0 1 ${round2(right - r)},${bottom}`,
    `H${round2(x + r)}`,
    `A${r},${r} 0 0 1 ${round2(x)},${bottom - r}`,
    `V${SHAPE_PADDING + r}`,
    `A${r},${r} 0 0 1 ${round2(x + r)},${SHAPE_PADDING}`,
    "Z",
  ].join("");
}

function segmentLeft(index: number): number {
  return SHAPE_PADDING + index * SEGMENT_WIDTH;
}

type HighlightState = {
  targetIndex: number | null;
  placed: boolean;
  edgeLeft: number;
  edgeRight: number;
  flight: {
    start: number;
    leadFrom: number;
    leadTo: number;
    trailFrom: number;
    trailTo: number;
    leadingRight: boolean;
  } | null;
  raf: number;
};

function createHighlightState(): HighlightState {
  return {
    targetIndex: null,
    placed: false,
    edgeLeft: 0,
    edgeRight: 0,
    flight: null,
    raf: 0,
  };
}

function snapHighlight(st: HighlightState, index: number): void {
  const left = segmentLeft(index);

  st.targetIndex = index;
  st.edgeLeft = left;
  st.edgeRight = left + SEGMENT_WIDTH;
  st.flight = null;
}

function drawHighlight(path: SVGPathElement, st: HighlightState): void {
  const left = Math.min(st.edgeLeft, st.edgeRight);
  const right = Math.max(st.edgeLeft, st.edgeRight);

  path.setAttribute("d", pillPath(left, right - left));
}

/**
 * The toggle's stretch-and-snap selection capsule, mirrored from
 * theme-toggle.tsx. The durations are divided by Motion speed so the docs demo
 * follows the same parameter the rest of this page uses, and reduced motion
 * snaps (the CSS then hides the layer and paints the segment fill).
 */
function StretchHighlight({
  width,
  targetIndex,
  speed,
}: {
  width: number;
  targetIndex: number;
  speed: number;
}): JSX.Element {
  const pathRef = useRef<SVGPathElement>(null);
  const stateRef = useRef<HighlightState>(createHighlightState());
  const speedRef = useRef(speed);

  useEffect(() => {
    speedRef.current = speed;
  }, [speed]);

  useEffect(() => {
    const path = pathRef.current;

    if (!path) return;

    const st = stateRef.current;
    const stop = () => {
      if (st.raf) {
        window.cancelAnimationFrame(st.raf);
        st.raf = 0;
      }
    };

    if (!st.placed) {
      snapHighlight(st, targetIndex);
      st.placed = true;
      drawHighlight(path, st);

      return;
    }

    if (prefersReducedMotion()) {
      stop();
      snapHighlight(st, targetIndex);
      drawHighlight(path, st);

      return;
    }

    if (st.targetIndex === targetIndex) {
      drawHighlight(path, st);

      return;
    }

    const left = segmentLeft(targetIndex);
    const center = (st.edgeLeft + st.edgeRight) / 2;
    const movingRight = left + SEGMENT_WIDTH / 2 >= center;

    st.targetIndex = targetIndex;
    st.flight = {
      start: performance.now(),
      leadFrom: movingRight ? st.edgeRight : st.edgeLeft,
      leadTo: movingRight ? left + SEGMENT_WIDTH : left,
      trailFrom: movingRight ? st.edgeLeft : st.edgeRight,
      trailTo: movingRight ? left : left + SEGMENT_WIDTH,
      leadingRight: movingRight,
    };

    stop();

    const loop = (now: number) => {
      const flight = st.flight;

      if (!flight) return;

      const speedValue = Math.max(0.25, speedRef.current);
      const leadDuration = LEADING_DURATION_MS / 1000 / speedValue;
      const trailDuration = TRAILING_DURATION_MS / 1000 / speedValue;
      const trailDelay = TRAILING_DELAY_MS / 1000 / speedValue;
      const elapsed = Math.max(0, (now - flight.start) / 1000);
      const leadProgress = Math.min(1, elapsed / leadDuration);
      const trailProgress = Math.min(
        1,
        Math.max(0, elapsed - trailDelay) / trailDuration,
      );
      const lead =
        flight.leadFrom +
        (flight.leadTo - flight.leadFrom) * leadingEase(leadProgress);
      const trail =
        flight.trailFrom +
        (flight.trailTo - flight.trailFrom) * trailingEase(trailProgress);

      if (flight.leadingRight) {
        st.edgeRight = lead;
        st.edgeLeft = trail;
      } else {
        st.edgeLeft = lead;
        st.edgeRight = trail;
      }

      drawHighlight(path, st);

      if (leadProgress >= 1 && trailProgress >= 1) {
        snapHighlight(st, targetIndex);
        drawHighlight(path, st);
        st.raf = 0;

        return;
      }

      st.raf = window.requestAnimationFrame(loop);
    };

    st.raf = window.requestAnimationFrame(loop);

    return stop;
  }, [targetIndex, width]);

  useEffect(() => {
    const st = stateRef.current;

    return () => {
      if (st.raf) window.cancelAnimationFrame(st.raf);
    };
  }, []);

  return (
    <span aria-hidden="true" className="shape-layer">
      <svg
        className="highlight-svg"
        viewBox={`0 0 ${width} ${TRACK_HEIGHT}`}
        preserveAspectRatio="none"
        aria-hidden="true"
        focusable="false"
      >
        <path ref={pathRef} />
      </svg>
    </span>
  );
}

function segmentClasses(selected: boolean, forceFocus: boolean): string {
  return [
    "segment group relative flex h-7 flex-1 items-center justify-center rounded-[6px] outline-hidden",
    "active:scale-[0.96]",
    "focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-primary",
    forceFocus
      ? "outline-solid outline-2 outline-offset-0 outline-primary"
      : "",
    selected
      ? "bg-toggle-selected text-on-surface"
      : "text-on-surface-variant hover:text-on-surface",
  ]
    .filter(Boolean)
    .join(" ");
}

function Segment({
  selected,
  label,
  tooltip,
  glyph,
  onClick,
  forceFocus = false,
  buttonRef,
  onPointerEnter,
}: {
  selected: boolean;
  label: string;
  tooltip: string;
  glyph: Glyph;
  onClick: () => void;
  forceFocus?: boolean;
  buttonRef?: Ref<HTMLButtonElement>;
  onPointerEnter?: (event: ReactPointerEvent<HTMLButtonElement>) => void;
}): JSX.Element {
  return (
    <button
      ref={buttonRef}
      type="button"
      role="radio"
      aria-checked={selected}
      aria-label={label}
      tabIndex={selected ? 0 : -1}
      onClick={onClick}
      onPointerEnter={onPointerEnter}
      className={segmentClasses(selected, forceFocus)}
    >
      <GlyphIcon glyph={glyph} />
      <span
        aria-hidden="true"
        className="segment-tooltip pointer-events-none absolute left-1/2 -translate-x-1/2 rounded-md bg-on-surface px-2 py-1 text-xs whitespace-nowrap text-surface -top-9"
      >
        {tooltip}
      </span>
    </button>
  );
}

/**
 * The live theme toggle's behaviour, mirrored: icon-only 106x32 Day/Night/Auto
 * pill with tooltips, and the 140x32 Day-phase row (Clock/Dawn/Midday/Dusk)
 * above it. It never calls the theme provider: mode and phase are local, and
 * the only effect is moving this page's tod through setParam.
 */
export function ThemeToggleSample({
  forceState,
}: {
  forceState?: ForceState;
} = {}): JSX.Element {
  const { setParam } = useSystemActions();
  const speed = useSystemSpeed();
  const [mode, setMode] = useState<Mode>("day");
  const [dayPhase, setDayPhase] = useState<DayPhase>("clock");
  const [rowOpen, setRowOpen] = useState(false);
  const dayButtonRef = useRef<HTMLButtonElement | null>(null);
  const modeIndex = Math.max(
    0,
    MODES.findIndex((option) => option.mode === mode),
  );
  const phaseIndex = Math.max(
    0,
    PHASES.findIndex((option) => option.phase === dayPhase),
  );
  const forceFocus = forceState === "focus-visible";

  const chooseMode = (next: Mode) => {
    setMode(next);

    if (next === "auto") {
      setRowOpen(false);
      setParam("tod", todForPhase(getActivePhase()));

      return;
    }

    // Day and Night both offer the phase row, as on the site.
    setRowOpen(true);

    const phase =
      next === "night"
        ? "night"
        : dayPhase === "clock"
          ? getActivePhase()
          : dayPhase;

    setParam("tod", todForPhase(phase));
  };

  const choosePhase = (phase: DayPhase) => {
    setDayPhase(phase);
    setMode("day");
    setRowOpen(true);
    setParam(
      "tod",
      todForPhase(phase === "clock" ? getActivePhase() : phase),
    );
  };

  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape" && rowOpen) {
      event.preventDefault();
      setRowOpen(false);
      dayButtonRef.current?.focus();
    }
  };

  return (
    <div
      data-theme-toggle
      data-state={forceState}
      className="relative inline-block"
      onKeyDown={onKeyDown}
    >
      {rowOpen ? (
        <div
          role="radiogroup"
          aria-label="Day phase"
          data-phase-row="true"
          data-visible="true"
          style={{ width: trackWidth(PHASES.length) }}
          className="phase-row absolute right-0 bottom-full mb-1 flex h-8 items-center rounded-md bg-toggle-track p-0.5 shadow-card"
        >
          <StretchHighlight
            width={PHASES.length * SEGMENT_WIDTH + TRACK_INSET}
            targetIndex={phaseIndex}
            speed={speed}
          />
          {PHASES.map((option) => (
            <Segment
              key={option.phase}
              selected={option.phase === dayPhase}
              label={option.label}
              tooltip={option.tooltip}
              glyph={dayPhaseGlyph(option.phase)}
              onClick={() => choosePhase(option.phase)}
            />
          ))}
        </div>
      ) : null}

      <div
        role="radiogroup"
        aria-label="Theme"
        data-mode-track="true"
        style={{ width: trackWidth(MODES.length) }}
        className="relative flex h-8 items-center rounded-md bg-toggle-track p-0.5"
      >
        <StretchHighlight
          width={MODES.length * SEGMENT_WIDTH + TRACK_INSET}
          targetIndex={modeIndex}
          speed={speed}
        />
        {MODES.map((option) => (
          <Segment
            key={option.mode}
            selected={option.mode === mode}
            label={option.label}
            tooltip={option.tooltip}
            glyph={option.mode}
            forceFocus={forceFocus && option.mode === mode}
            buttonRef={option.mode === "day" ? dayButtonRef : undefined}
            onClick={() => chooseMode(option.mode)}
            onPointerEnter={() => {
              if (option.mode === "day" && canHover()) setRowOpen(true);
            }}
          />
        ))}
      </div>
    </div>
  );
}
