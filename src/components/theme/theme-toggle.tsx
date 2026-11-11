"use client";

import { useEffect, useRef, useState } from "react";
import type { FocusEvent, KeyboardEvent } from "react";
import { useTheme } from "@/components/theme/theme-provider";
import type { Mode } from "@/lib/theme";

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

function ModeIcon({ mode }: { mode: Mode }) {
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
      {mode === "day" ? (
        <>
          <circle cx="8" cy="8" r="3" />
          <path d="M8 1.5v1.5M8 13v1.5M1.5 8H3M13 8h1.5M3.4 3.4l1.1 1.1M11.5 11.5l1.1 1.1M12.6 3.4l-1.1 1.1M4.5 11.5l-1.1 1.1" />
        </>
      ) : mode === "night" ? (
        <path d="M13.2 9.7A5.8 5.8 0 0 1 6.3 2.8a5.9 5.9 0 1 0 6.9 6.9Z" />
      ) : (
        <>
          <circle cx="8" cy="8" r="6" />
          <path d="M8 4.6V8l2.4 1.4" />
        </>
      )}
    </svg>
  );
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

export function ThemeToggle() {
  const { mode, setMode } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const currentMode =
    OPTIONS.find((option) => option.mode === mode) ?? OPTIONS[2];

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
      <div
        role="radiogroup"
        aria-label="Theme"
        className="hidden h-8 w-[104px] items-center rounded-md bg-toggle-track p-0.5 md:flex"
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
              <ModeIcon mode={option.mode} />
              <span
                aria-hidden="true"
                className="pointer-events-none absolute -top-9 left-1/2 -translate-x-1/2 rounded-md bg-on-surface px-2 py-1 text-xs whitespace-nowrap text-surface opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100"
              >
                {option.tooltip}
              </span>
            </button>
          );
        })}
      </div>

      {/* Below 768px: a 32x32 button that opens the menu below it. */}
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
          <ModeIcon mode={mode} />
        </button>

        {menuOpen ? (
          <div
            ref={menuRef}
            role="menu"
            aria-label="Theme"
            onKeyDown={onMenuKeyDown}
            onBlur={onMenuBlur}
            className="absolute top-full right-0 z-50 mt-2 w-[168px] rounded-lg bg-surface-container-low p-1 shadow-card"
          >
            {OPTIONS.map((option) => {
              const selected = option.mode === mode;

              return (
                <button
                  key={option.mode}
                  type="button"
                  role="menuitemradio"
                  aria-checked={selected}
                  onClick={() => {
                    setMode(option.mode);
                    setMenuOpen(false);
                    triggerRef.current?.focus();
                  }}
                  className={[
                    "flex h-[42px] w-full items-center gap-3 rounded-md px-3 text-left text-sm outline-hidden",
                    "focus-visible:outline-solid focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary",
                    selected
                      ? "bg-surface-container-high text-on-surface"
                      : "text-on-surface-variant hover:bg-surface-container hover:text-on-surface",
                  ].join(" ")}
                >
                  <ModeIcon mode={option.mode} />
                  <span className="flex-1">{option.label}</span>
                  {selected ? (
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
                  ) : null}
                </button>
              );
            })}
          </div>
        ) : null}
      </div>
    </>
  );
}
