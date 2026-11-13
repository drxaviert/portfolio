"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import type {
  ComponentPropsWithoutRef,
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

function segmentClasses(selected: boolean): string {
  return [
    // Figma 126:8942, rounded to 34x28 so both tracks share integer centers:
    // segments sit inside a 106x32 / 140x32 track with a 2px inset.
    "segment group relative flex h-7 flex-1 items-center justify-center rounded-[6px] outline-hidden transition-[color,background-color,transform,scale] duration-150 ease-out",
    "active:scale-[0.94]",
    "focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
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
  trackRef?: Ref<HTMLDivElement>;
} & ComponentPropsWithoutRef<"div">;

/** Shared track shell: same height, inset, radius and fill for every count. */
function SegmentTrack({
  label,
  segments,
  trackRef,
  className,
  children,
  onPointerLeave,
  ...rest
}: SegmentTrackProps) {
  const pillRef = useRef<HTMLSpanElement>(null);
  const hoveredIndex = useRef<number | null>(null);

  function hidePill() {
    hoveredIndex.current = null;

    const pill = pillRef.current;

    if (pill) {
      pill.classList.remove("is-visible");
    }
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

    if (previous === null) {
      // First entry fades in where the pointer already is: commit the
      // geometry with transitions off, then restore them and reveal on the
      // next frame so opacity actually has a 0 start to fade from.
      pill.classList.remove("is-visible");
      pill.style.transition = "none";
      pill.style.width = `${target.offsetWidth}px`;
      pill.style.height = `${target.offsetHeight}px`;
      pill.style.transform = `translateX(${target.offsetLeft}px)`;
      void pill.offsetWidth;

      window.requestAnimationFrame(() => {
        pill.style.transition = "";

        if (hoveredIndex.current === index) {
          pill.classList.add("is-visible");
        }
      });
    } else {
      pill.style.transform = `translateX(${target.offsetLeft}px)`;
    }

    hoveredIndex.current = index;
  }

  return (
    <div
      {...rest}
      ref={trackRef}
      role="radiogroup"
      aria-label={label}
      style={{ width: trackWidth(segments) }}
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
        "pointer-events-none absolute left-1/2 -translate-x-1/2 rounded-md bg-on-surface px-2 py-1 text-xs whitespace-nowrap text-surface opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100",
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
  const closeTimer = useRef<number | null>(null);
  const exitTimer = useRef<number | null>(null);
  const enterTimer = useRef<number | null>(null);
  const focusInside = useRef(false);
  /** True while the pointer is over Day, the gap bridge, or the row. */
  const hoverRegion = useRef(false);
  const suppressFocusOpen = useRef(false);
  /** Only keyboard focus may hold the row open; pointer focus may not. */
  const inputModality = useRef<"pointer" | "keyboard">("pointer");

  const currentMode =
    OPTIONS.find((option) => option.mode === mode) ?? OPTIONS[2];
  const dayActive = mode === "day";
  // The row belongs to Day: leaving Day hides it without a state effect.
  const rowVisible = rowOpen && dayActive;

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

  function onSegmentKeyDown(
    event: KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) {
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
          className="relative"
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
          trackRef={rowRef}
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
            className="absolute right-0 bottom-full z-50 mb-2 flex max-h-[calc(100dvh-4rem)] w-[168px] flex-col gap-0.5 overflow-y-auto overscroll-contain rounded-lg bg-surface-container-low p-1 shadow-card"
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
    </>
  );
}

/**
 * Dev-only switcher for the Day row's enter/exit motion and speed. The motion
 * and speed are applied to <html> so the CSS can switch transitions, and both
 * are remembered in localStorage. Production renders nothing at all.
 */
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
