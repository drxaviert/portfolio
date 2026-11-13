"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type {
  ComponentPropsWithoutRef,
  CSSProperties,
  FocusEvent,
  KeyboardEvent,
  PointerEvent as ReactPointerEvent,
  ReactNode,
  Ref,
} from "react";
import { useTheme } from "@/components/theme/theme-provider";
import type { DayPhase, Mode } from "@/lib/theme";
import "./theme-toggle.css";

/** How long the phase row lingers after the pointer leaves it and the toggle. */
export const PHASE_ROW_CLOSE_DELAY_MS = 100;

/**
 * Outlives the last icon settle: the final segment's icon starts at 330ms and
 * swings for 600ms, so it lands at 930ms; 990ms adds a 60ms buffer before
 * hover may stack a second animation.
 */
const ROW_ENTER_SETTLE_MS = 990;

/** Fallback for the CSS exit duration if it cannot be read. */
export const PHASE_ROW_EXIT_MS = 240;

type ModeOption = {
  mode: Mode;
  label: string;
  tooltip: string;
};

const OPTIONS: ModeOption[] = [
  { mode: "day", label: "Day", tooltip: "Day" },
  { mode: "night", label: "Night", tooltip: "Night" },
  { mode: "auto", label: "Auto", tooltip: "Auto · follows your clock" },
];

type PhaseOption = {
  phase: DayPhase;
  label: string;
  tooltip: string;
};

const PHASE_OPTIONS: PhaseOption[] = [
  { phase: "clock", label: "Clock", tooltip: "Clock · follows the time of day" },
  { phase: "dawn", label: "Dawn", tooltip: "Dawn" },
  { phase: "day", label: "Midday", tooltip: "Midday" },
  { phase: "dusk", label: "Dusk", tooltip: "Dusk" },
];

type Glyph = Mode | "dawn" | "dusk" | "dayclock";

/** False on touch-first devices, where the row is opened by tapping Day. */
function canHover(): boolean {
  return typeof window.matchMedia === "function"
    ? window.matchMedia("(hover: hover)").matches
    : true;
}

const ICON_SETTLE_DURATION = 600;
const ICON_SETTLE_EASING = "cubic-bezier(0.34, 1.3, 0.64, 1)";
const ICON_SCALE_POSE = "scale(0.745)";

/** The entrance offset each glyph settles out of on hover. */
const ICON_HOVER_POSES: Record<string, { part: string; from: string }[]> = {
  day: [{ part: "[data-rays]", from: "rotate(-76.5deg)" }],
  night: [{ part: "", from: "rotate(-40deg) scale(0.745)" }],
  auto: [{ part: "[data-hands]", from: "rotate(-102deg)" }],
  dawn: [{ part: "[data-sun]", from: "translateY(6.8px)" }],
  dusk: [
    { part: "[data-sun]", from: "translateY(-6.8px)" },
    { part: "[data-rays]", from: "translateY(-6.8px)" },
  ],
  dayclock: [
    { part: "[data-rays]", from: "rotate(-76.5deg)" },
    { part: "[data-hands]", from: "rotate(-102deg)" },
  ],
};

function settleFrom(element: Element, from: string) {
  if (typeof (element as HTMLElement).animate !== "function") {
    return;
  }

  const running =
    typeof element.getAnimations === "function"
      ? element
          .getAnimations()
          .filter((animation) => animation.playState === "running")
      : [];
  const current = window.getComputedStyle(element).transform;
  const start = running.length > 0 && current !== "none" ? current : from;

  running.forEach((animation) => animation.cancel());
  (element as HTMLElement).animate(
    [{ transform: start }, { transform: "none" }],
    {
      duration: ICON_SETTLE_DURATION,
      easing: ICON_SETTLE_EASING,
      fill: "none",
    },
  );
}

/** Plays the entrance settle once for the hovered segment; ends at rest. */
function playIconSettle(segment: HTMLElement) {
  const svg = segment.querySelector<SVGElement>("[data-glyph]");

  if (!svg) {
    return;
  }

  const glyph = svg.dataset.glyph ?? "";

  for (const pose of ICON_HOVER_POSES[glyph] ?? []) {
    if (pose.part === "") {
      settleFrom(svg, pose.from);
    } else {
      const part = svg.querySelector(pose.part);

      if (part) {
        settleFrom(part, pose.from);
      }
    }
  }

  if (glyph !== "night") {
    settleFrom(svg, ICON_SCALE_POSE);
  }
}

function GlyphIcon({ glyph }: { glyph: Glyph }) {
  // The dusk rays lift above the box at the entrance pose; overflow visible
  // keeps the viewBox from slicing them while they settle.
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
        // The crescent's painted bbox is 0.65px left of the icon box; nudge it
        // so its optical center lines up with the sun above.
        <path
          transform="translate(0.65 0)"
          d="M13.2 9.7A5.8 5.8 0 0 1 6.3 2.8a5.9 5.9 0 1 0 6.9 6.9Z"
        />
      ) : glyph === "dawn" ? (
        <>
          <defs>
            {/*
             * Sunrise: hide the sun below the horizon while it rises. The
             * edge clears the 1.4px horizon stroke (11.3-12.7), so clipping
             * never touches the resting dome.
             */}
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
            {/*
             * Sunset is the mirror image: the disk sits below the horizon at
             * rest, so hide the part that would show above it while the sun
             * sinks. The edge clears the horizon stroke (9.8-11.2), leaving
             * the resting glyph pixel-identical.
             */}
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
          {/*
           * The dusk rays sit above the horizon, so they are never
           * horizon-clipped.
           */}
          <g data-rays>
            <path d="M8 2.5v1.5M4.8 4.4l1.1 1.1M11.2 4.4l-1.1 1.1" />
          </g>
        </>
      ) : glyph === "dayclock" ? (
        // A sun with clock hands: the day's time rather than a clock alone,
        // which is what Auto keeps.
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

/** Maps a pin to the glyph that reads as it. */
function dayPhaseGlyph(phase: DayPhase): Glyph {
  if (phase === "clock") return "dayclock";
  if (phase === "day") return "day";
  return phase;
}

/** The exit duration the CSS actually uses, so the fallback cannot drift. */
function readRowExitMs(row: HTMLElement | null): number {
  if (!row) {
    return PHASE_ROW_EXIT_MS;
  }

  const value = Number.parseFloat(
    window
      .getComputedStyle(row)
      .getPropertyValue("--phase-row-exit-ms")
      .trim(),
  );

  return Number.isFinite(value) ? value : PHASE_ROW_EXIT_MS;
}

/**
 * Whole-pixel segment width shared by every track. The Figma toggle is 104px
 * with 3 × 33.33px segments; rounding to 34px keeps every segment center on an
 * integer so the row and toggle columns line up exactly (106px and 140px
 * tracks, right edges aligned).
 */
const SEGMENT_WIDTH = 34;
const TRACK_INSET = 4;

function trackWidth(segments: number): string {
  return `${segments * SEGMENT_WIDTH + TRACK_INSET}px`;
}

/* ---------- Metaball highlight (dev prototype) ---------- */

type HighlightMode = "current" | "metaball";

const HIGHLIGHT_MODES: readonly { value: HighlightMode; label: string }[] = [
  { value: "current", label: "Current" },
  { value: "metaball", label: "Metaball" },
];

type HighlightConfig = {
  mode: HighlightMode;
  goo: number;
  neck: number;
  hoverGoos: boolean;
  /** False when the browser cannot apply an SVG filter to an HTML layer. */
  filterOk: boolean;
};

const GOO_STORAGE_KEY = "theme-toggle-highlight";
const GOO_DEFAULT = 35;
const NECK_DEFAULT = 70;

/** True only in `next dev`, so the comparison panel never ships. */
const DEV_PANEL = process.env.NODE_ENV === "development";

/**
 * Dev-only settings for the comparison panel. A tiny external store keeps the
 * localStorage read out of render effects; the server snapshot is the default
 * and the client snapshot picks up storage after hydration.
 */
type GooSettings = {
  mode: HighlightMode;
  goo: number;
  neck: number;
  hoverGoos: boolean;
};

const GOO_DEFAULTS: GooSettings = {
  mode: "metaball",
  goo: GOO_DEFAULT,
  neck: NECK_DEFAULT,
  hoverGoos: false,
};

const gooListeners = new Set<() => void>();
let gooSnapshot: GooSettings | null = null;

/** Clamps a stored slider value; `fallback` is the default for that slider. */
function normalizeStop(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(100, Math.max(0, Math.round(value)))
    : fallback;
}

function readGooSettings(): GooSettings {
  try {
    const stored = window.localStorage.getItem(GOO_STORAGE_KEY);

    if (!stored) {
      return GOO_DEFAULTS;
    }

    const parsed = JSON.parse(stored) as Partial<GooSettings>;

    return {
      mode:
        parsed.mode === "current" || parsed.mode === "metaball"
          ? parsed.mode
          : GOO_DEFAULTS.mode,
      goo: normalizeStop(parsed.goo, GOO_DEFAULTS.goo),
      neck: normalizeStop(parsed.neck, GOO_DEFAULTS.neck),
      hoverGoos:
        typeof parsed.hoverGoos === "boolean"
          ? parsed.hoverGoos
          : GOO_DEFAULTS.hoverGoos,
    };
  } catch {
    return GOO_DEFAULTS;
  }
}

function getGooSettings(): GooSettings {
  gooSnapshot ??= readGooSettings();

  return gooSnapshot;
}

function getServerGooSettings(): GooSettings {
  return GOO_DEFAULTS;
}

function subscribeGoo(listener: () => void): () => void {
  gooListeners.add(listener);

  return () => {
    gooListeners.delete(listener);
  };
}

function setGooSettings(patch: Partial<GooSettings>): void {
  gooSnapshot = { ...getGooSettings(), ...patch };

  try {
    window.localStorage.setItem(GOO_STORAGE_KEY, JSON.stringify(gooSnapshot));
  } catch {
    // Storage can be blocked; the panel still works for this page load.
  }

  gooListeners.forEach((listener) => listener());
}

const BLOB_HEIGHT = 28;

/** The rest box of a segment: 34x28 inside a 2px track inset. */
type BlobRect = { x: number; y: number; w: number; h: number };

function restBlob(index: number): BlobRect {
  return {
    x: TRACK_INSET / 2 + index * SEGMENT_WIDTH,
    y: (32 - BLOB_HEIGHT) / 2,
    w: SEGMENT_WIDTH,
    h: BLOB_HEIGHT,
  };
}

type GooParams = {
  duration: number;
  blur: number;
  /** Alpha contrast multiplier of the goo filter. */
  alphaScale: number;
  /** Alpha offset of the goo filter, negated in the matrix. */
  alphaOffset: number;
  stretch: number;
  lag: number;
  wobble: number;
  /** Cross-axis pinch at mid-flight; 0 leaves the neck exactly as it was. */
  pinch: number;
  /** Slight uniform shrink that travels with the pinch. */
  shrink: number;
};

/**
 * Goo is the amount of effect; Neck narrows the contact point. Neck 0 keeps the
 * original matrix, lag and full-height blobs, so today's neck width is the
 * start of the range. Higher stops pull the twin back until only a narrow
 * overlap (and then a small gap) is left between the two lobes, pinch both
 * blobs' height at mid-flight, and steepen the alpha threshold, so the joint
 * thins and then snaps instead of reading as a wide band. Rest is untouched:
 * the pinch and the offset are both zero at progress 0 and 1.
 */
function gooParams(goo: number, neck: number): GooParams {
  const t = Math.min(100, Math.max(0, goo)) / 100;
  const n = Math.min(100, Math.max(0, neck)) / 100;
  // 0 is today's threshold; the neck only nudges it denser so the bridge
  // thins without breaking. The steeper curve is what makes the pinch crisp.
  const threshold = (6 + 2 * t) / 18 + 0.06 * n;
  const blur = 2 + 6 * t;
  const stretch = 0.04 + 0.18 * t;
  const baseLag = 3 + 7 * t;
  // The twin travels behind the lead by its own width plus a gap. Today (neck
  // 0) the two overlap by ~30px, which is why the highlight reads as one wide
  // band; the slider removes that overlap until the edges just touch, then
  // opens a small real gap that the goo bridges as a thin neck.
  const trailWidth = SEGMENT_WIDTH * (1 + stretch * 0.5);
  const overlapAtZero = baseLag - trailWidth;
  // 70 is the reference thin neck: a small real gap the goo can still bridge.
  // 100 opens it as far as the blur allows before the bridge would snap.
  const gapAtSeventy = 0.9 * blur;
  const gapMax = 1.2 * blur;
  const gap =
    n <= 0.7
      ? overlapAtZero + (gapAtSeventy - overlapAtZero) * (n / 0.7)
      : gapAtSeventy + (gapMax - gapAtSeventy) * ((n - 0.7) / 0.3);

  return {
    duration: Math.round(260 + 220 * t),
    blur,
    alphaScale: 18 + 14 * n,
    alphaOffset: (18 + 14 * n) * threshold,
    stretch,
    lag: trailWidth + gap,
    wobble: 0.05 * t,
    pinch: 0.55 * n,
    shrink: 0.035 * n,
  };
}

function prefersReducedMotion(): boolean {
  return (
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/** Safari can accept the syntax and still paint nothing; this is the cheap gate. */
function supportsGooFilter(): boolean {
  return (
    typeof CSS !== "undefined" &&
    typeof CSS.supports === "function" &&
    CSS.supports("filter", 'url("#goo")')
  );
}

function subscribeToEnvironment(): () => void {
  return () => {};
}

/** The server cannot know; the first client render upgrades to the real answer. */
function serverGooSupport(): boolean {
  return false;
}

function measureSegment(track: HTMLElement, index: number): BlobRect | null {
  const segment = track.querySelectorAll<HTMLElement>('[role="radio"]')[index];

  if (!segment || segment.offsetWidth === 0) {
    return null;
  }

  // Layout units, not rects: the phase row can be mid-scale on its entrance,
  // and a scaled measurement would shrink the pill. offset* is transform-free.
  return {
    x: segment.offsetLeft,
    y: segment.offsetTop,
    w: segment.offsetWidth,
    h: segment.offsetHeight,
  };
}

/** Reads the translate/scale we last wrote, so a retarget starts mid-air. */
function readBlobTransform(element: HTMLElement): {
  x: number;
  scaleX: number;
  scaleY: number;
} {
  const value = window.getComputedStyle(element).transform;

  if (!value || value === "none") {
    return { x: 0, scaleX: 1, scaleY: 1 };
  }

  const parts = value
    .slice(value.indexOf("(") + 1, value.lastIndexOf(")"))
    .split(",")
    .map(Number);

  if (value.startsWith("matrix3d")) {
    return {
      x: parts[12] ?? 0,
      scaleX: parts[0] ?? 1,
      scaleY: parts[5] ?? 1,
    };
  }

  return {
    x: parts[4] ?? 0,
    scaleX: parts[0] ?? 1,
    scaleY: parts[3] ?? 1,
  };
}

function placeBlob(element: HTMLElement, rect: BlobRect): void {
  element.style.width = `${rect.w}px`;
  element.style.height = `${rect.h}px`;
  element.style.transform = `translate3d(${rect.x}px, ${rect.y}px, 0)`;
}

/**
 * The rest place is a custom property on the layer, never an inline transform
 * on a blob: React re-rendering must not overwrite a flight in progress.
 */
type GooVars = CSSProperties & { "--goo-x": string };

function blobVars(rect: BlobRect): GooVars {
  return { "--goo-x": `${rect.x}px` };
}

/**
 * Sends the lead blob to `rect` and drags a lagging twin behind it; the goo
 * filter turns the gap into a neck, and the neck snaps when the twin catches up
 * and both are a round pill again. rAF rather than WAAPI because the twin is a
 * function of the lead's position and both must retarget from their current
 * computed transform, so a new selection never restarts from zero.
 */
function flyBlobs(
  lead: HTMLElement,
  trail: HTMLElement | null,
  rect: BlobRect,
  params: GooParams,
): () => void {
  const leadStart = readBlobTransform(lead);
  const trailStart = trail
    ? readBlobTransform(trail)
    : { x: 0, scaleX: 1, scaleY: 1 };
  const to = rect.x;
  const direction = Math.sign(to - leadStart.x) || 1;
  // The first frame's timestamp is the clock, not the moment the effect ran:
  // rAF timestamps can predate a long render, which would start mid-flight.
  let startedAt = 0;
  // Fake timers can freeze performance.now(); a frame cap still ends the flight.
  const maxFrames = Math.ceil(params.duration / 8) + 2;
  let frames = 0;
  let raf = 0;
  let cancelled = false;

  lead.style.width = `${rect.w}px`;
  lead.style.height = `${rect.h}px`;

  if (trail) {
    trail.style.width = `${rect.w}px`;
    trail.style.height = `${rect.h}px`;
  }

  function frame(now: number) {
    if (cancelled) {
      return;
    }

    frames += 1;

    if (startedAt === 0) {
      startedAt = now;
    }

    const progress = Math.min(
      1,
      Math.max(0, (now - startedAt) / params.duration),
    );
    const eased = 1 - (1 - progress) ** 3;
    const wave = Math.sin(Math.PI * progress);
    // Squared wave: the pinch peaks briefly at mid-flight, then is gone well
    // before landing so the pill returns to its exact rest height.
    const pinch = Math.sin(Math.PI * progress) ** 2;
    const x = leadStart.x + (to - leadStart.x) * eased;

    // Scale eases in from wherever the blob was caught mid-flight.
    const scaleBlend = Math.min(1, progress * 4);
    let scaleX =
      leadStart.scaleX +
      (1 +
        params.stretch * wave -
        params.shrink * pinch -
        leadStart.scaleX) *
        scaleBlend;
    const scaleY =
      leadStart.scaleY +
      (1 - params.pinch * pinch - leadStart.scaleY) * scaleBlend;

    // Landing wobble is scale-only, so the pill can never overshoot the track.
    if (params.wobble > 0 && progress > 0.72) {
      const q = (progress - 0.72) / 0.28;

      scaleX += params.wobble * Math.sin(q * Math.PI * 2.5) * (1 - q);
    }

    lead.style.transform = `translate3d(${x}px, ${rect.y}px, 0) scale(${scaleX}, ${scaleY})`;

    if (trail) {
      // The twin keeps a bounded gap behind the lead (the neck), and an
      // existing gap from an interrupted flight decays instead of jumping.
      const catchUp = 1 - (1 - progress) ** 3;
      // The twin pinches with the lead so the joint itself is thin; its start
      // scales blend in too, or an interruption would pop it back to size.
      const trailScaleX =
        trailStart.scaleX +
        (1 +
          params.stretch * 0.5 * wave -
          params.shrink * pinch -
          trailStart.scaleX) *
          scaleBlend;
      const trailScaleY =
        trailStart.scaleY +
        (1 - params.pinch * pinch - trailStart.scaleY) * scaleBlend;
      const trailX =
        x -
        direction * params.lag * wave +
        (trailStart.x - leadStart.x) * (1 - catchUp);

      trail.style.transform = `translate3d(${trailX}px, ${rect.y}px, 0) scale(${trailScaleX}, ${trailScaleY})`;
    }

    if (progress < 1 && frames < maxFrames) {
      raf = window.requestAnimationFrame(frame);
      return;
    }

    lead.style.transform = `translate3d(${to}px, ${rect.y}px, 0)`;

    if (trail) {
      trail.style.transform = `translate3d(${to}px, ${rect.y}px, 0)`;
    }
  }

  raf = window.requestAnimationFrame(frame);

  return () => {
    cancelled = true;
    window.cancelAnimationFrame(raf);
  };
}

function segmentClasses(selected: boolean): string {
  return [
    // Figma 126:8942, rounded to 34x28 so both tracks share integer centers:
    // segments sit inside a 106x32 / 140x32 track with a 2px inset. The
    // transitions live in theme-toggle.css so the selected fill can be
    // enter-only.
    "segment group relative flex h-7 flex-1 items-center justify-center rounded-[6px] outline-hidden",
    "active:scale-[0.96]",
    "focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-primary",
    selected
      ? "bg-toggle-selected text-on-surface"
      : "text-on-surface-variant hover:text-on-surface",
  ].join(" ");
}

/** Extends the 28px pill into the track inset, for a full 32px hit target. */
const EXPANDED_HIT_AREA =
  "before:absolute before:inset-x-0 before:-top-0.5 before:-bottom-0.5 before:content-['']";

/**
 * Fingers get no use out of the 2px inset the fine-pointer pill relies on, so a
 * coarse pointer widens each md+ segment to 34x40 (see theme-toggle.css). The
 * 32px track keeps its Figma size either way.
 */
const COARSE_HIT_AREA = "segment-coarse-hit-area";

const HIT_AREA_CLASS = {
  track: EXPANDED_HIT_AREA,
  finger: COARSE_HIT_AREA,
} as const;

type SegmentTrackProps = {
  label: string;
  segments: number;
  /** Index of the checked segment; the metaball blobs rest on it. */
  selectedIndex: number;
  highlight: HighlightConfig;
  /** False while the track is hidden (the phase row before it opens). */
  active?: boolean;
  /** The parent needs the root node; a callback keeps React refs out of props. */
  trackRef?: (node: HTMLDivElement | null) => void;
} & ComponentPropsWithoutRef<"div">;

/** Shared track shell: same height, inset, radius and fill for every count. */
function SegmentTrack({
  label,
  segments,
  selectedIndex,
  highlight,
  active = true,
  trackRef,
  className,
  children,
  onPointerLeave,
  ...rest
}: SegmentTrackProps) {
  const pillRef = useRef<HTMLSpanElement>(null);
  const hoveredIndex = useRef<number | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const selectionLead = useRef<HTMLSpanElement>(null);
  const selectionTrail = useRef<HTMLSpanElement>(null);
  const hoverGoo = useRef<HTMLSpanElement>(null);
  const hoverLead = useRef<HTMLSpanElement>(null);
  const hoverTrail = useRef<HTMLSpanElement>(null);
  const selectionFlight = useRef<(() => void) | null>(null);
  const hoverFlight = useRef<(() => void) | null>(null);
  /** The selection the blobs were last placed for, and whether they painted. */
  const placed = useRef<{ index: number; active: boolean } | null>(null);
  const metaball = highlight.mode === "metaball";
  const params = gooParams(highlight.goo, highlight.neck);
  const filterId = `goo-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const restBox = restBlob(selectedIndex);
  const filterStyle = highlight.filterOk
    ? { filter: `url(#${filterId})` }
    : undefined;
  const gooHover = metaball && highlight.hoverGoos;

  const setRoot = useCallback(
    (node: HTMLDivElement | null) => {
      rootRef.current = node;
      trackRef?.(node);
    },
    [trackRef],
  );

  // Any flight still running when the track unmounts must not touch dead nodes.
  useEffect(() => {
    return () => {
      selectionFlight.current?.();
      hoverFlight.current?.();
    };
  }, []);

  /**
   * A selection change retargets the blobs from their computed transform, so a
   * fast arrow sequence keeps one highlight moving toward the newest segment
   * instead of stacking flights. Opening the row, switching the dev variant and
   * reduced motion all place the blobs at rest with no travel.
   */
  useEffect(() => {
    const root = rootRef.current;
    const lead = selectionLead.current;
    const trail = selectionTrail.current;
    const previous = placed.current;
    placed.current = { index: selectedIndex, active };

    if (!root || !lead || !metaball) {
      return;
    }

    const rect = measureSegment(root, selectedIndex);

    if (!rect) {
      return;
    }

    selectionFlight.current?.();
    selectionFlight.current = null;

    const retarget =
      previous !== null &&
      previous.active &&
      active &&
      previous.index !== selectedIndex &&
      !prefersReducedMotion();

    if (!retarget) {
      placeBlob(lead, rect);

      if (trail) {
        placeBlob(trail, rect);
      }

      return;
    }

    selectionFlight.current = flyBlobs(
      lead,
      trail,
      rect,
      gooParams(highlight.goo, highlight.neck),
    );
  }, [
    selectedIndex,
    active,
    metaball,
    highlight.filterOk,
    highlight.goo,
    highlight.neck,
  ]);

  // A resize can move the segments without changing the selection.
  useEffect(() => {
    if (!metaball) {
      return;
    }

    function onResize() {
      const root = rootRef.current;
      const lead = selectionLead.current;
      const rect = root ? measureSegment(root, selectedIndex) : null;

      if (!lead || !rect) {
        return;
      }

      selectionFlight.current?.();
      selectionFlight.current = null;
      placeBlob(lead, rect);

      if (selectionTrail.current) {
        placeBlob(selectionTrail.current, rect);
      }
    }

    window.addEventListener("resize", onResize);

    return () => window.removeEventListener("resize", onResize);
  }, [metaball, selectedIndex]);

  function hidePill() {
    hoveredIndex.current = null;
    pillRef.current?.classList.remove("is-visible");
    hoverGoo.current?.classList.remove("is-visible");
  }

  /** Positions the single shared pill under the segment the pointer is on. */
  function showPill(event: ReactPointerEvent<HTMLDivElement>) {
    if (!canHover()) {
      return;
    }

    const target = (event.target as Element).closest<HTMLElement>(
      '[role="radio"]',
    );

    if (!target || !event.currentTarget.contains(target)) {
      return;
    }

    const buttons = Array.from(
      event.currentTarget.querySelectorAll<HTMLElement>('[role="radio"]'),
    );
    const index = buttons.indexOf(target);
    const pill = pillRef.current;

    if (index < 0 || !pill) {
      return;
    }

    const previous = hoveredIndex.current;

    if (previous === index) {
      return;
    }

    // The hovered icon replays the entrance settle once. The row skips this
    // while its own entrance is still running so the CSS settle continues
    // without a second animation.
    const isRow = event.currentTarget.hasAttribute("data-phase-row");
    const entering =
      event.currentTarget.getAttribute("data-entering") === "true";
    const reduced = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    if (!reduced && !(isRow && entering)) {
      playIconSettle(target);
    }

    const rect = {
      x: target.offsetLeft,
      y: target.offsetTop,
      w: target.offsetWidth,
      h: target.offsetHeight,
    };

    if (previous === null) {
      // First entry fades in where the pointer already is: commit the
      // geometry with transitions off, then restore them and reveal on the
      // next frame so opacity actually has a 0 start to fade from.
      pill.classList.remove("is-visible");
      pill.style.transition = "none";
      pill.style.width = `${rect.w}px`;
      pill.style.height = `${rect.h}px`;
      pill.style.transform = `translateX(${rect.x}px)`;
      void pill.offsetWidth;

      window.requestAnimationFrame(() => {
        pill.style.transition = "";

        if (hoveredIndex.current === index) {
          pill.classList.add("is-visible");
        }
      });
    } else {
      pill.style.transform = `translateX(${rect.x}px)`;
    }

    // With "Hover goos too" on, the faint pill gets the same lead/twin goo.
    // CSS hides the plain pill while the goo layer is in charge.
    const layer = hoverGoo.current;
    const lead = hoverLead.current;
    const trail = hoverTrail.current;

    if (layer && lead && gooHover) {
      hoverFlight.current?.();
      hoverFlight.current = null;

      if (previous === null) {
        placeBlob(lead, rect);

        if (trail) {
          placeBlob(trail, rect);
        }
      } else {
        hoverFlight.current = flyBlobs(
          lead,
          trail,
          rect,
          gooParams(highlight.goo, highlight.neck),
        );
      }

      layer.classList.add("is-visible");
    }

    hoveredIndex.current = index;
  }

  return (
    <div
      {...rest}
      ref={setRoot}
      role="radiogroup"
      aria-label={label}
      style={{ width: trackWidth(segments) }}
      data-metaball={metaball ? "true" : undefined}
      data-goo-hover={gooHover ? "true" : undefined}
      onPointerOver={showPill}
      onPointerLeave={(event) => {
        hidePill();
        onPointerLeave?.(event);
      }}
      className={[
        "flex h-8 items-center rounded-md bg-toggle-track p-0.5",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {metaball ? (
        <svg
          className="absolute size-0"
          aria-hidden="true"
          focusable="false"
          width="0"
          height="0"
        >
          <defs>
            {/*
             * Static per Goo value: blur, then an alpha contrast that keeps
             * only the merged core, then the source on top so the resting pill
             * keeps its exact radius and size.
             */}
            <filter
              id={filterId}
              x="-20%"
              y="-20%"
              width="140%"
              height="140%"
              colorInterpolationFilters="sRGB"
            >
              <feGaussianBlur
                in="SourceGraphic"
                stdDeviation={params.blur}
                result="blur"
              />
              <feColorMatrix
                in="blur"
                type="matrix"
                values={`1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 ${params.alphaScale} -${params.alphaOffset}`}
                result="goo"
              />
              <feComposite in="SourceGraphic" in2="goo" operator="atop" />
            </filter>
          </defs>
        </svg>
      ) : null}

      {/* Hover goo sits under the selection goo and under the icons. */}
      {gooHover ? (
        <span
          ref={hoverGoo}
          aria-hidden="true"
          className="goo-layer goo-layer--hover"
          style={blobVars(restBox)}
        >
          <span className="goo-layer-filter" style={filterStyle}>
            <span ref={hoverLead} className="goo-blob" />
            {highlight.filterOk ? (
              <span ref={hoverTrail} className="goo-blob" />
            ) : null}
          </span>
        </span>
      ) : null}

      {metaball ? (
        <span
          aria-hidden="true"
          className="goo-layer"
          style={blobVars(restBox)}
        >
          <span className="goo-layer-filter" style={filterStyle}>
            <span ref={selectionLead} className="goo-blob" />
            {highlight.filterOk ? (
              <span ref={selectionTrail} className="goo-blob" />
            ) : null}
          </span>
        </span>
      ) : null}

      <span
        ref={pillRef}
        aria-hidden="true"
        className="hover-pill pointer-events-none absolute top-0.5 left-0 h-7 rounded-[6px] bg-toggle-selected"
      />
      {children}
    </div>
  );
}

type SegmentProps = {
  selected: boolean;
  label: string;
  tooltip: string;
  glyph: Glyph;
  onClick: () => void;
  onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void;
  buttonRef?: Ref<HTMLButtonElement>;
  onPointerEnter?: () => void;
  onPointerLeave?: () => void;
  onFocus?: () => void;
  hitArea?: "track" | "finger";
  tooltipBelow?: boolean;
};

/** Shared segment button: same classes, icon size and tooltip everywhere. */
function Segment({
  selected,
  label,
  tooltip,
  glyph,
  onClick,
  onKeyDown,
  buttonRef,
  onPointerEnter,
  onPointerLeave,
  onFocus,
  hitArea,
  tooltipBelow = false,
}: SegmentProps) {
  return (
    <button
      ref={buttonRef}
      type="button"
      role="radio"
      aria-checked={selected}
      aria-label={label}
      tabIndex={selected ? 0 : -1}
      onClick={onClick}
      onKeyDown={onKeyDown}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
      onFocus={onFocus}
      className={[
        segmentClasses(selected),
        hitArea ? HIT_AREA_CLASS[hitArea] : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <GlyphIcon glyph={glyph} />
      <Tooltip below={tooltipBelow}>{tooltip}</Tooltip>
    </button>
  );
}

function Tooltip({
  children,
  below = false,
}: {
  children: ReactNode;
  below?: boolean;
}) {
  return (
    <span
      aria-hidden="true"
      className={[
        "segment-tooltip pointer-events-none absolute left-1/2 -translate-x-1/2 rounded-md bg-on-surface px-2 py-1 text-xs whitespace-nowrap text-surface",
        below ? "top-full mt-2" : "-top-9",
      ].join(" ")}
    >
      {children}
    </span>
  );
}

export function ThemeToggle() {
  const { mode, dayPhase, setMode, setDayPhase } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const [rowOpen, setRowOpen] = useState(false);
  const [rowExiting, setRowExiting] = useState(false);
  const [rowEntering, setRowEntering] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const desktopRef = useRef<HTMLDivElement>(null);
  const dayRef = useRef<HTMLButtonElement>(null);
  const rowRef = useRef<HTMLDivElement>(null);
  /** Reports the phase row's root node without handing the child a ref object. */
  const setRowRef = useCallback((node: HTMLDivElement | null) => {
    rowRef.current = node;
  }, []);
  const closeTimer = useRef<number | null>(null);
  const exitTimer = useRef<number | null>(null);
  const enterTimer = useRef<number | null>(null);
  /** True when the row is closing while one of its options has focus. */
  const rowHadFocus = useRef(false);
  const focusInside = useRef(false);
  /** True while the pointer is over Day, the gap bridge, or the row. */
  const hoverRegion = useRef(false);
  const suppressFocusOpen = useRef(false);
  /** Only keyboard focus may hold the row open; pointer focus may not. */
  const inputModality = useRef<"pointer" | "keyboard">("pointer");
  /** Dev-only comparison: the metaball highlight and its knobs. */
  const {
    mode: highlightMode,
    goo,
    neck,
    hoverGoos,
  } = useSyncExternalStore(subscribeGoo, getGooSettings, getServerGooSettings);
  const filterOk = useSyncExternalStore(
    subscribeToEnvironment,
    supportsGooFilter,
    serverGooSupport,
  );

  const currentMode =
    OPTIONS.find((option) => option.mode === mode) ?? OPTIONS[2];
  const dayActive = mode === "day";
  // The row belongs to Day: leaving Day hides it without a state effect.
  const rowVisible = rowOpen && dayActive;
  // Production always runs the shipped highlight; only the dev panel can
  // switch, and without it the metaball layer never renders.
  const highlight: HighlightConfig = {
    mode: DEV_PANEL ? highlightMode : "current",
    goo,
    neck,
    hoverGoos: DEV_PANEL && hoverGoos,
    filterOk,
  };
  const modeIndex = Math.max(
    0,
    OPTIONS.findIndex((option) => option.mode === mode),
  );
  const phaseIndex = Math.max(
    0,
    PHASE_OPTIONS.findIndex((option) => option.phase === dayPhase),
  );

  const clearCloseTimer = useCallback(() => {
    if (closeTimer.current !== null) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }, []);

  const clearExit = useCallback(() => {
    if (exitTimer.current !== null) {
      window.clearTimeout(exitTimer.current);
      exitTimer.current = null;
    }

    setRowExiting(false);
  }, []);

  const startExit = useCallback(() => {
    const exitMs = readRowExitMs(rowRef.current);

    if (exitMs <= 0) {
      clearExit();
      return;
    }

    setRowExiting(true);

    if (exitTimer.current !== null) {
      window.clearTimeout(exitTimer.current);
    }

    // transitionend normally clears this; the timer covers a missed event.
    exitTimer.current = window.setTimeout(() => {
      exitTimer.current = null;
      setRowExiting(false);
    }, exitMs + 50);
  }, [clearExit]);

  const clearEnter = useCallback(() => {
    if (enterTimer.current !== null) {
      window.clearTimeout(enterTimer.current);
      enterTimer.current = null;
    }

    setRowEntering(false);
  }, []);

  /**
   * Keeps the entering flag alive long enough for the last icon settle
   * (330ms segment delay + 600ms swing), so hover can bypass the delay while
   * the icons are still arriving.
   */
  const startEnter = useCallback(() => {
    clearEnter();
    setRowEntering(true);
    enterTimer.current = window.setTimeout(() => {
      enterTimer.current = null;
      setRowEntering(false);
    }, ROW_ENTER_SETTLE_MS);
  }, [clearEnter]);

  const openRow = useCallback(() => {
    clearCloseTimer();
    clearExit();
    startEnter();
    setRowOpen(true);
  }, [clearCloseTimer, clearExit, startEnter]);

  const closeRow = useCallback(() => {
    clearCloseTimer();
    clearEnter();
    // The row goes inert on this commit, which would drop focus to <body>;
    // remember that focus was inside so it can be handed back to Day.
    rowHadFocus.current = Boolean(
      rowRef.current?.contains(document.activeElement),
    );
    // data-visible flips false now, but the row keeps painting for the exit
    // fade; hold the nav raise until that finishes.
    if (rowVisible) {
      startExit();
    }
    setRowOpen(false);
  }, [clearCloseTimer, clearEnter, rowVisible, startExit]);

  const scheduleClose = useCallback(() => {
    clearCloseTimer();

    const holdsOpen = () =>
      focusInside.current && inputModality.current === "keyboard";

    if (holdsOpen()) {
      return;
    }

    // The bridge keeps travel between the toggle and the row inside the same
    // hover region; this timer only starts once the pointer leaves both.
    closeTimer.current = window.setTimeout(() => {
      closeTimer.current = null;

      if (!holdsOpen()) {
        closeRow();
      }
    }, PHASE_ROW_CLOSE_DELAY_MS);
  }, [clearCloseTimer, closeRow]);

  // Track the input modality independently of focus: a pointerdown marks the
  // interaction as pointer before focus moves, and a keydown marks it as
  // keyboard before Tab moves focus.
  useEffect(() => {
    const onPointerDown = () => {
      inputModality.current = "pointer";
    };
    const onKeyDown = () => {
      inputModality.current = "keyboard";
    };

    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown, true);

    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown, true);
    };
  }, []);

  // A pinned row only belongs to Day; leaving Day closes it immediately.
  useEffect(() => {
    if (!rowVisible && closeTimer.current !== null) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }, [rowVisible]);

  /**
   * A row that closes while one of its options has focus must not strand the
   * user: the row becomes inert, so focus returns to Day instead of falling
   * back to <body> (which would restart Tab at the top of the page).
   */
  useEffect(() => {
    if (rowVisible || !rowHadFocus.current) {
      return;
    }

    rowHadFocus.current = false;
    suppressFocusOpen.current = true;
    dayRef.current?.focus();
    suppressFocusOpen.current = false;
  }, [rowVisible]);

  useEffect(() => {
    return () => {
      if (closeTimer.current !== null) {
        window.clearTimeout(closeTimer.current);
      }

      if (exitTimer.current !== null) {
        window.clearTimeout(exitTimer.current);
      }

      if (enterTimer.current !== null) {
        window.clearTimeout(enterTimer.current);
      }
    };
  }, []);

  // Escape closes the row from anywhere and hands focus back to Day.
  useEffect(() => {
    if (!rowVisible) {
      return;
    }

    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      // Keyboard use inside the row holds it open, even if a pointer-leave
      // timer was already running.
      if (focusInside.current) {
        if (closeTimer.current !== null) {
          window.clearTimeout(closeTimer.current);
          closeTimer.current = null;
        }
      }

      if (event.key !== "Escape") {
        return;
      }

      closeRow();

      // Restoring focus to Day must not count as "focus entered Day" and
      // reopen the row it just closed.
      suppressFocusOpen.current = true;
      dayRef.current?.focus();
      suppressFocusOpen.current = false;
    };

    document.addEventListener("keydown", onKeyDown);

    return () => document.removeEventListener("keydown", onKeyDown);
  }, [rowVisible, closeRow]);

  // Touch has no pointer-leave, so a tap outside is the close gesture.
  useEffect(() => {
    if (!rowVisible || canHover()) {
      return;
    }

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;

      if (target && !desktopRef.current?.contains(target)) {
        closeRow();
      }
    };

    document.addEventListener("pointerdown", onPointerDown);

    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [rowVisible, closeRow]);

  useEffect(() => {
    if (!menuOpen) {
      return;
    }

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;

      if (
        target &&
        !menuRef.current?.contains(target) &&
        !triggerRef.current?.contains(target)
      ) {
        setMenuOpen(false);
      }
    };

    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
        triggerRef.current?.focus();
      }
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  useEffect(() => {
    if (!menuOpen) {
      return;
    }

    const selected =
      menuRef.current?.querySelector<HTMLElement>('[aria-checked="true"]') ??
      menuRef.current?.querySelector<HTMLElement>('[role="menuitemradio"]');

    selected?.focus();
  }, [menuOpen]);

  /*
   * `K` flips the variant unless focus is in a field or a modifier is held.
   * The settings themselves live in the external store above.
   */
  useEffect(() => {
    if (!DEV_PANEL) {
      return;
    }

    function onKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key !== "k" && event.key !== "K") {
        return;
      }

      if (event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }

      const target =
        (document.activeElement as HTMLElement | null) ??
        (event.target as HTMLElement | null);

      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return;
      }

      setGooSettings({
        mode: getGooSettings().mode === "metaball" ? "current" : "metaball",
      });
    }

    document.addEventListener("keydown", onKeyDown);

    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  function onSegmentKeyDown(
    event: KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) {
    const option = OPTIONS[index];

    /*
     * A forward Tab from Day has to reach the phase group even when the row
     * was closed while Day kept focus (Escape, or the pointer leaving after a
     * click). Opening during keydown runs before the browser picks the next
     * focusable, so this same Tab lands inside the row.
     */
    if (
      event.key === "Tab" &&
      !event.shiftKey &&
      option.mode === "day" &&
      dayActive &&
      !rowVisible
    ) {
      openRow();
      return;
    }

    let nextIndex: number;

    switch (event.key) {
      case "ArrowRight":
      case "ArrowDown":
        nextIndex = (index + 1) % OPTIONS.length;
        break;
      case "ArrowLeft":
      case "ArrowUp":
        nextIndex = (index + OPTIONS.length - 1) % OPTIONS.length;
        break;
      case "Home":
        nextIndex = 0;
        break;
      case "End":
        nextIndex = OPTIONS.length - 1;
        break;
      default:
        return;
    }

    event.preventDefault();

    const next = OPTIONS[nextIndex];

    setMode(next.mode);

    if (next.mode === "day") {
      openRow();
    } else {
      closeRow();
    }

    event.currentTarget
      .closest('[role="radiogroup"]')
      ?.querySelectorAll<HTMLElement>('[role="radio"]')
      [nextIndex]?.focus();
  }

  function onPhaseKeyDown(
    event: KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) {
    let nextIndex: number;

    switch (event.key) {
      case "ArrowRight":
      case "ArrowDown":
        nextIndex = (index + 1) % PHASE_OPTIONS.length;
        break;
      case "ArrowLeft":
      case "ArrowUp":
        nextIndex = (index + PHASE_OPTIONS.length - 1) % PHASE_OPTIONS.length;
        break;
      case "Home":
        nextIndex = 0;
        break;
      case "End":
        nextIndex = PHASE_OPTIONS.length - 1;
        break;
      default:
        return;
    }

    event.preventDefault();
    setDayPhase(PHASE_OPTIONS[nextIndex].phase);
    event.currentTarget
      .closest('[role="radiogroup"]')
      ?.querySelectorAll<HTMLElement>('[role="radio"]')
      [nextIndex]?.focus();
  }

  function onMenuKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const items = Array.from(
      menuRef.current?.querySelectorAll<HTMLElement>(
        '[role="menuitemradio"]',
      ) ?? [],
    );

    switch (event.key) {
      case "Home":
        event.preventDefault();
        items[0]?.focus();
        return;
      case "End":
        event.preventDefault();
        items[items.length - 1]?.focus();
        return;
      case "ArrowDown":
      case "ArrowUp": {
        event.preventDefault();

        const current = items.indexOf(document.activeElement as HTMLElement);

        if (current === -1) {
          return;
        }

        const step = event.key === "ArrowDown" ? 1 : -1;
        items[(current + step + items.length) % items.length]?.focus();
        return;
      }
      default:
        return;
    }
  }

  /** Tabbing out of the menu closes it; the trigger still counts as inside. */
  function onMenuBlur(event: FocusEvent<HTMLDivElement>) {
    const next = event.relatedTarget as Node | null;

    if (
      next &&
      (menuRef.current?.contains(next) || triggerRef.current?.contains(next))
    ) {
      return;
    }

    setMenuOpen(false);
  }

  /**
   * The desktop host only tracks the pointer for blur/leave bookkeeping. The
   * hover region that holds the row open is Day plus the gap bridge plus the
   * row; entering any other segment must not cancel a pending close.
   */
  function enterHoverRegion() {
    hoverRegion.current = true;
    clearCloseTimer();
  }

  function leaveHoverRegion() {
    hoverRegion.current = false;
    scheduleClose();
  }

  function onDesktopPointerLeave() {
    hoverRegion.current = false;

    if (canHover()) {
      scheduleClose();
    }
  }

  function onDesktopFocus() {
    focusInside.current = true;

    if (inputModality.current === "keyboard") {
      clearCloseTimer();
    }
  }

  function onDesktopBlur(event: FocusEvent<HTMLDivElement>) {
    const next = event.relatedTarget as Node | null;

    if (next && desktopRef.current?.contains(next)) {
      return;
    }

    focusInside.current = false;

    if (!hoverRegion.current) {
      scheduleClose();
    }
  }

  return (
    <>
      {/* 768px and up: icon-only 3-segment pill, 104x32, 2px inset. */}
      <div
        ref={desktopRef}
        className="relative hidden md:block"
        onPointerLeave={onDesktopPointerLeave}
        onFocus={onDesktopFocus}
        onBlur={onDesktopBlur}
      >
        <SegmentTrack
          label="Theme"
          segments={OPTIONS.length}
          selectedIndex={modeIndex}
          highlight={highlight}
          className="relative"
          data-mode-track="true"
        >
          {OPTIONS.map((option, index) => {
            const selected = option.mode === mode;

            return (
              <Segment
                key={option.mode}
                selected={selected}
                label={option.label}
                tooltip={option.tooltip}
                glyph={option.mode}
                tooltipBelow={dayActive}
                hitArea="finger"
                buttonRef={option.mode === "day" ? dayRef : undefined}
                onClick={() => {
                  setMode(option.mode);

                  if (option.mode === "day") {
                    openRow();
                  } else {
                    closeRow();
                  }
                }}
                onPointerEnter={() => {
                  if (option.mode !== "day") {
                    return;
                  }

                  enterHoverRegion();

                  if (dayActive) {
                    openRow();
                  }
                }}
                onPointerLeave={
                  option.mode === "day" ? leaveHoverRegion : undefined
                }
                onFocus={() => {
                  if (suppressFocusOpen.current) {
                    return;
                  }

                  if (
                    option.mode === "day" &&
                    dayActive &&
                    inputModality.current === "keyboard"
                  ) {
                    openRow();
                  }
                }}
                onKeyDown={(event) => onSegmentKeyDown(event, index)}
              />
            );
          })}
        </SegmentTrack>

        {/* Bridges the 4px gap so moving from the toggle to the row keeps
            hovering, and keeps the whole journey one hover target. */}
        {rowVisible ? (
          <span
            aria-hidden="true"
            className="absolute inset-x-0 -top-1 h-1"
            onPointerEnter={enterHoverRegion}
            onPointerLeave={leaveHoverRegion}
          />
        ) : null}

        {/*
         * Day-only phase row. It opens above the toggle in the gap below the
         * cards; absolute positioning keeps the page from moving.
         */}
        <SegmentTrack
          label="Day phase"
          segments={PHASE_OPTIONS.length}
          selectedIndex={phaseIndex}
          highlight={highlight}
          active={rowVisible}
          trackRef={setRowRef}
          aria-hidden={!rowVisible}
          inert={!rowVisible}
          data-phase-row="true"
          data-visible={rowVisible}
          data-exiting={rowExiting}
          data-entering={rowEntering}
          onPointerEnter={enterHoverRegion}
          onPointerLeave={leaveHoverRegion}
          onTransitionEnd={(event) => {
            if (event.target !== event.currentTarget) {
              return;
            }

            if (event.propertyName === "opacity" && !rowVisible) {
              clearExit();
            }
          }}
          className="phase-row absolute right-0 bottom-full mb-1 shadow-card"
        >
          {PHASE_OPTIONS.map((option, index) => {
            const selected = option.phase === dayPhase;

            return (
              <Segment
                key={option.phase}
                selected={selected}
                label={option.label}
                tooltip={option.tooltip}
                glyph={dayPhaseGlyph(option.phase)}
                hitArea="track"
                onClick={() => setDayPhase(option.phase)}
                onKeyDown={(event) => onPhaseKeyDown(event, index)}
              />
            );
          })}
        </SegmentTrack>
      </div>

      {/* Below 768px: a 32x32 button that opens the menu above it. */}
      <div className="relative md:hidden">
        <button
          ref={triggerRef}
          type="button"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          aria-label={`Choose theme, currently ${currentMode.label}`}
          onClick={() => setMenuOpen((open) => !open)}
          className="relative flex size-8 items-center justify-center rounded-md bg-toggle-track text-on-surface shadow-card outline-hidden before:absolute before:-inset-1.5 before:content-[''] focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <GlyphIcon glyph={mode} />
        </button>

        {menuOpen ? (
          <div
            ref={menuRef}
            role="menu"
            aria-label="Theme"
            onKeyDown={onMenuKeyDown}
            onBlur={onMenuBlur}
            className="absolute right-0 bottom-full z-[3] mb-2 flex max-h-[calc(100dvh-4rem)] w-[168px] flex-col gap-0.5 overflow-y-auto overscroll-contain rounded-lg bg-surface-container-low p-1 shadow-card"
          >
            {OPTIONS.map((option) => {
              const selected = option.mode === mode;

              return (
                <div key={option.mode} role="none">
                  <button
                    type="button"
                    role="menuitemradio"
                    aria-checked={selected}
                    onClick={() => {
                      setMode(option.mode);
                      setMenuOpen(false);
                      triggerRef.current?.focus();
                    }}
                    className={[
                      "flex h-10 w-full items-center gap-2 rounded-md px-3 text-left text-base leading-5 font-medium outline-hidden",
                      "focus-visible:outline-solid focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary",
                      selected
                        ? "bg-surface-container-high text-on-surface"
                        : "text-on-surface-variant hover:bg-surface-container hover:text-on-surface",
                    ].join(" ")}
                  >
                    <GlyphIcon glyph={option.mode} />
                    <span className="flex-1">{option.label}</span>
                    {selected ? <CheckIcon /> : null}
                  </button>

                  {option.mode === "day" && dayActive ? (
                    <div role="group" aria-label="Day phase">
                      {PHASE_OPTIONS.map((phaseOption) => {
                        const phaseSelected =
                          phaseOption.phase === dayPhase;

                        return (
                          <button
                            key={phaseOption.phase}
                            type="button"
                            role="menuitemradio"
                            aria-checked={phaseSelected}
                            onClick={() => {
                              setDayPhase(phaseOption.phase);
                              setMenuOpen(false);
                              triggerRef.current?.focus();
                            }}
                            className={[
                              "flex h-11 w-full items-center gap-2 rounded-md pr-3 pl-8 text-left text-base leading-5 font-medium outline-hidden",
                              "focus-visible:outline-solid focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary",
                              phaseSelected
                                ? "bg-surface-container-high text-on-surface"
                                : "text-on-surface-variant hover:bg-surface-container hover:text-on-surface",
                            ].join(" ")}
                          >
                            <GlyphIcon
                              glyph={dayPhaseGlyph(phaseOption.phase)}
                            />
                            <span className="flex-1">
                              {phaseOption.label}
                            </span>
                            {phaseSelected ? <CheckIcon /> : null}
                          </button>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : null}
      </div>

      {DEV_PANEL ? (
        <GooPanel
          mode={highlightMode}
          goo={goo}
          neck={neck}
          hoverGoos={hoverGoos}
          filterOk={filterOk}
          onMode={(mode) => setGooSettings({ mode })}
          onGoo={(goo) => setGooSettings({ goo })}
          onNeck={(neck) => setGooSettings({ neck })}
          onHoverGoos={(hoverGoos) => setGooSettings({ hoverGoos })}
        />
      ) : null}
    </>
  );
}

/**
 * Dev-only comparison panel for the selection highlight: Current is the shipped
 * fill, Metaball is the goo prototype with its Goo and Neck sliders and hover
 * switch. The choice, both sliders and the hover flag are remembered in
 * localStorage; the panel renders only in development.
 */
function GooPanel({
  mode,
  goo,
  neck,
  hoverGoos,
  filterOk,
  onMode,
  onGoo,
  onNeck,
  onHoverGoos,
}: {
  mode: HighlightMode;
  goo: number;
  neck: number;
  hoverGoos: boolean;
  filterOk: boolean;
  onMode: (mode: HighlightMode) => void;
  onGoo: (goo: number) => void;
  onNeck: (neck: number) => void;
  onHoverGoos: (enabled: boolean) => void;
}) {
  const { duration } = gooParams(goo, neck);

  return (
    <div
      role="group"
      aria-label="Theme toggle highlight"
      className="fixed bottom-3 left-[62px] z-[60] flex w-[220px] flex-col gap-2 rounded-lg bg-surface-container-low p-2.5 text-xs text-on-surface shadow-card"
    >
      <div className="flex items-center justify-between">
        <span className="font-medium">Highlight</span>
        <span className="text-[10px] text-on-surface-variant">K</span>
      </div>

      <div
        role="group"
        aria-label="Highlight variant"
        className="flex items-center rounded-md bg-toggle-track p-0.5"
      >
        {HIGHLIGHT_MODES.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={mode === option.value}
            onClick={() => onMode(option.value)}
            className={[
              "h-5 flex-1 rounded-[6px] px-1.5 text-[11px] leading-none outline-hidden focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary",
              mode === option.value
                ? "bg-toggle-selected text-on-surface"
                : "text-on-surface-variant",
            ].join(" ")}
          >
            {option.label}
          </button>
        ))}
      </div>

      {mode === "metaball" ? (
        <>
          <label className="flex flex-col gap-1">
            <span className="flex items-baseline justify-between gap-2">
              <span>Goo</span>
              <span className="tabular-nums text-on-surface-variant">
                {goo} · {duration}ms
              </span>
            </span>
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={goo}
              onChange={(event) => onGoo(Number(event.target.value))}
              className="w-full accent-primary"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="flex items-baseline justify-between gap-2">
              <span>Neck</span>
              <span className="tabular-nums text-on-surface-variant">
                {neck}
              </span>
            </span>
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={neck}
              onChange={(event) => onNeck(Number(event.target.value))}
              className="w-full accent-primary"
            />
          </label>

          <label className="flex items-center justify-between gap-2">
            <span>Hover goos too</span>
            <input
              type="checkbox"
              checked={hoverGoos}
              onChange={(event) => onHoverGoos(event.target.checked)}
              className="size-3.5 accent-primary"
            />
          </label>

          {!filterOk ? (
            <span className="text-[10px] leading-tight text-on-surface-variant">
              SVG filter unavailable: plain stretch fallback.
            </span>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

function CheckIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M3.5 8.5 6.5 11.5 12.5 5" />
    </svg>
  );
}
