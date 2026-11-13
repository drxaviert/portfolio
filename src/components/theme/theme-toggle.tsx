"use client";

import { useEffect, useRef, useState } from "react";
import type { FocusEvent, KeyboardEvent, ReactNode } from "react";
import { useTheme } from "@/components/theme/theme-provider";
import type { DayPhase, Mode } from "@/lib/theme";
import "./theme-toggle.css";

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

type Glyph = Mode | "dawn" | "dusk";

function GlyphIcon({ glyph }: { glyph: Glyph }) {
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
      {glyph === "day" ? (
        <>
          <circle cx="8" cy="8" r="3" />
          <path d="M8 1.5v1.5M8 13v1.5M1.5 8H3M13 8h1.5M3.4 3.4l1.1 1.1M11.5 11.5l1.1 1.1M12.6 3.4l-1.1 1.1M4.5 11.5l-1.1 1.1" />
        </>
      ) : glyph === "night" ? (
        <path d="M13.2 9.7A5.8 5.8 0 0 1 6.3 2.8a5.9 5.9 0 1 0 6.9 6.9Z" />
      ) : glyph === "dawn" ? (
        <>
          <path d="M2 12h12" />
          <path d="M5 12a3 3 0 0 1 6 0" />
          <path d="M8 2.5v1.7M4.7 4.4l1.2 1.2M11.3 4.4l-1.2 1.2" />
        </>
      ) : glyph === "dusk" ? (
        <>
          <path d="M2 10.5h12" />
          <path d="M5 10.5a3 3 0 0 0 6 0" />
          <path d="M8 2.5v1.5M4.8 4.4l1.1 1.1M11.2 4.4l-1.1 1.1" />
        </>
      ) : (
        <>
          <circle cx="8" cy="8" r="6" />
          <path d="M8 4.6V8l2.4 1.4" />
        </>
      )}
    </svg>
  );
}

/** Maps a pin to the glyph that reads as it: Clock reuses the Auto clock. */
function dayPhaseGlyph(phase: DayPhase): Glyph {
  if (phase === "clock") return "auto";
  if (phase === "day") return "day";
  return phase;
}

function segmentClasses(selected: boolean): string {
  return [
    // Figma 126:8942: segments are 33.3x28, radius 6, inside a 104x32 track
    // with a 2px inset (the track's p-0.5).
    "group relative flex h-7 flex-1 items-center justify-center rounded-[6px] outline-hidden transition-colors",
    "focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
    selected
      ? "bg-toggle-selected text-on-surface"
      : "text-on-surface-variant hover:text-on-surface",
  ].join(" ");
}

function Tooltip({ children }: { children: ReactNode }) {
  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute -top-9 left-1/2 -translate-x-1/2 rounded-md bg-on-surface px-2 py-1 text-xs whitespace-nowrap text-surface opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100"
    >
      {children}
    </span>
  );
}

export function ThemeToggle() {
  const { mode, dayPhase, setMode, setDayPhase } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const [rowReady, setRowReady] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const currentMode =
    OPTIONS.find((option) => option.mode === mode) ?? OPTIONS[2];
  const dayActive = mode === "day";

  // Let the first paint land without an entrance: the row is already in its
  // resting place when the page loads on Day, and only later changes animate.
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setRowReady(true));

    return () => window.cancelAnimationFrame(frame);
  }, []);

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
    setMode(OPTIONS[nextIndex].mode);
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

  return (
    <>
      {/* 768px and up: icon-only 3-segment pill, 104x32, 2px inset. */}
      <div className="relative hidden md:block">
        <div
          role="radiogroup"
          aria-label="Theme"
          className="flex h-8 w-[104px] items-center rounded-md bg-toggle-track p-0.5"
        >
          {OPTIONS.map((option, index) => {
            const selected = option.mode === mode;

            return (
              <button
                key={option.mode}
                type="button"
                role="radio"
                aria-checked={selected}
                aria-label={option.label}
                tabIndex={selected ? 0 : -1}
                onClick={() => setMode(option.mode)}
                onKeyDown={(event) => onSegmentKeyDown(event, index)}
                className={segmentClasses(selected)}
              >
                <GlyphIcon glyph={option.mode} />
                <Tooltip>{option.tooltip}</Tooltip>
              </button>
            );
          })}
        </div>

        {/*
         * Day-only phase row. It hangs under the toggle in the page's bottom
         * padding and overlays nothing, so nothing else moves when it appears.
         */}
        <div
          role="radiogroup"
          aria-label="Day phase"
          aria-hidden={!dayActive}
          inert={!dayActive}
          data-phase-row="true"
          data-visible={dayActive}
          data-ready={rowReady}
          className="phase-row absolute top-full right-0 mt-5 flex h-8 w-[132px] items-center rounded-[6px] bg-toggle-track p-0.5 shadow-card"
        >
          {PHASE_OPTIONS.map((option, index) => {
            const selected = option.phase === dayPhase;

            return (
              <button
                key={option.phase}
                type="button"
                role="radio"
                aria-checked={selected}
                aria-label={option.label}
                tabIndex={selected ? 0 : -1}
                onClick={() => setDayPhase(option.phase)}
                onKeyDown={(event) => onPhaseKeyDown(event, index)}
                className={[
                  segmentClasses(selected),
                  // The 28px pill keeps the toggle's size; this extends its hit
                  // area into the 2px track inset, for a full 32px target.
                  "before:absolute before:inset-x-0 before:-top-0.5 before:-bottom-0.5 before:content-['']",
                ].join(" ")}
              >
                <GlyphIcon glyph={dayPhaseGlyph(option.phase)} />
                <Tooltip>{option.tooltip}</Tooltip>
              </button>
            );
          })}
        </div>
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
          className="flex size-8 items-center justify-center rounded-md bg-toggle-track text-on-surface shadow-card outline-hidden focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
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
