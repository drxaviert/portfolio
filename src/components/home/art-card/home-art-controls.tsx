"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import type { ArtOverride } from "@/lib/art-override";
import type { Phase } from "@/lib/theme";
import type { FrameEra } from "./frame-style";
import "./home-art-controls.css";

/**
 * The dev-only floating frame lab.
 *
 * It is rendered only from home-art-card-dev.tsx, which `page.tsx` imports in
 * development only. The URL remains the source of truth: every control calls
 * the same `writeArtOverride` the dev overrides already read, so changes apply
 * live, survive a refresh and are shareable.
 */

export const PANEL_SHORTCUT = "Shift+F";

const ERA_OPTIONS: { value: FrameEra | "auto"; label: string }[] = [
  { value: "auto", label: "Auto (artwork era)" },
  { value: "gilt-ornate", label: "Gilt ornate" },
  { value: "gilt-carved", label: "Gilt carved" },
  { value: "walnut", label: "Walnut" },
  { value: "modern", label: "Modern float" },
  { value: "scroll", label: "Silk scroll" },
];

const PHASE_OPTIONS: { value: Phase | "auto"; label: string }[] = [
  { value: "auto", label: "Auto (clock)" },
  { value: "day", label: "Day" },
  { value: "dawn", label: "Dawn" },
  { value: "dusk", label: "Dusk" },
  { value: "night", label: "Night" },
];

const SAMPLE_IDS = new Set([512, 2169, 4887, 8900]);

const PAINTING_OPTIONS = [
  { value: "today", label: "Today’s painting" },
  { value: "512", label: "512 · The Music Lesson" },
  { value: "2169", label: "2169 · John Thomlinson and His Family" },
  { value: "4887", label: "4887 · Irises" },
  { value: "8900", label: "8900 · Beauty Beneath a Willow Tree" },
  { value: "custom", label: "Custom AIC id…" },
] as const;

/** True only after hydration, so the portal never runs on the server. */
function subscribeToMount() {
  return () => {};
}

function isMounted() {
  return true;
}

function isServer() {
  return false;
}

function isEditable(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    Boolean(target.closest("input, textarea, select, [contenteditable='true']"))
  );
}

export function HomeArtControls({
  override,
  onChange,
}: {
  override: ArtOverride;
  onChange: (next: ArtOverride) => void;
}) {
  const mounted = useSyncExternalStore(subscribeToMount, isMounted, isServer);
  const [open, setOpen] = useState(true);
  const [customOpen, setCustomOpen] = useState(false);
  const [customDraft, setCustomDraft] = useState<string | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const firstOpen = useRef(true);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.repeat) return;

      if (event.key === "Escape") {
        setOpen(false);
        return;
      }

      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (!event.shiftKey || event.key.toLowerCase() !== "f") return;
      if (isEditable(event.target)) return;

      event.preventDefault();
      setOpen((value) => !value);
    };

    window.addEventListener("keydown", onKeyDown);

    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (firstOpen.current) {
      firstOpen.current = false;
      return;
    }

    if (open) closeRef.current?.focus();
    else toggleRef.current?.focus();
  }, [open]);

  const activeCustomId =
    override.artId !== null && !SAMPLE_IDS.has(override.artId)
      ? String(override.artId)
      : "";
  const customValue = customDraft ?? activeCustomId;
  const customId = customValue === "" ? null : Number(customValue);
  const customValid =
    customId !== null &&
    Number.isSafeInteger(customId) &&
    customId > 0 &&
    /^\d{1,9}$/.test(customValue);

  const paintingValue =
    customOpen || (override.artId !== null && !SAMPLE_IDS.has(override.artId))
      ? "custom"
      : override.artId === null
        ? "today"
        : String(override.artId);

  function choosePainting(value: string) {
    if (value === "custom") {
      setCustomOpen(true);
      setCustomDraft(activeCustomId);
      requestAnimationFrame(() => inputRef.current?.focus());
      return;
    }

    setCustomOpen(false);
    setCustomDraft(null);
    onChange({
      ...override,
      artId: value === "today" ? null : Number(value),
    });
  }

  function applyCustom() {
    if (!customValid || customId === null) return;

    setCustomOpen(!SAMPLE_IDS.has(customId));
    setCustomDraft(String(customId));
    onChange({ ...override, artId: customId });
  }

  const panel = open ? (
    <aside
      className="home-art-panel"
      aria-label="Frame lab"
      aria-keyshortcuts={PANEL_SHORTCUT}
    >
      <header className="home-art-panel-head">
        <div>
          <p className="home-art-panel-kicker">Dev only</p>
          <h2 className="home-art-panel-title">Frame lab</h2>
        </div>
        <button
          ref={closeRef}
          type="button"
          className="home-art-icon-button"
          aria-label="Collapse frame lab"
          aria-expanded="true"
          aria-controls="home-art-panel-body"
          aria-keyshortcuts={PANEL_SHORTCUT}
          onClick={() => setOpen(false)}
        >
          <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
            <path
              d="M5 12.5 10 7.5l5 5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </header>

      <p className="home-art-panel-shortcut">
        Toggle panel <kbd>Shift</kbd>+<kbd>F</kbd>
      </p>

      <div id="home-art-panel-body" className="home-art-panel-body">
        <label className="home-art-field">
          <span>Frame style</span>
          <select
            aria-label="Frame style"
            value={override.era ?? "auto"}
            onChange={(event) => {
              const value = event.target.value;

              onChange({
                ...override,
                era: value === "auto" ? null : (value as FrameEra),
              });
            }}
          >
            {ERA_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="home-art-field">
          <span>Frames</span>
          <select
            aria-label="Frames"
            value={override.frames ? "current" : "new"}
            onChange={(event) =>
              onChange({
                ...override,
                frames: event.target.value === "current",
              })
            }
          >
            <option value="new">New shades</option>
            <option value="current">Current (origin/main)</option>
          </select>
        </label>

        <label className="home-art-field">
          <span>Phase</span>
          <select
            aria-label="Phase"
            value={override.phase ?? "auto"}
            onChange={(event) => {
              const value = event.target.value;

              onChange({
                ...override,
                phase: value === "auto" ? null : (value as Phase),
              });
            }}
          >
            {PHASE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="home-art-field">
          <span>Painting</span>
          <select
            aria-label="Painting"
            value={paintingValue}
            onChange={(event) => choosePainting(event.target.value)}
          >
            {PAINTING_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        {paintingValue === "custom" ? (
          <form
            className="home-art-custom"
            onSubmit={(event) => {
              event.preventDefault();
              applyCustom();
            }}
          >
            <label className="home-art-field" htmlFor="home-art-custom-id">
              <span>AIC id</span>
              <input
                ref={inputRef}
                id="home-art-custom-id"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete="off"
                spellCheck={false}
                value={customValue}
                aria-invalid={!customValid && customValue !== ""}
                onChange={(event) =>
                  setCustomDraft(
                    event.target.value.replace(/\D/g, "").slice(0, 9),
                  )
                }
              />
            </label>
            <button type="submit" disabled={!customValid}>
              Apply
            </button>
          </form>
        ) : null}
      </div>
    </aside>
  ) : (
    <button
      ref={toggleRef}
      type="button"
      className="home-art-panel-toggle"
      aria-expanded="false"
      aria-controls="home-art-panel-body"
      aria-keyshortcuts={PANEL_SHORTCUT}
      onClick={() => setOpen(true)}
    >
      <span>Frame lab</span>
      <kbd>Shift</kbd>+<kbd>F</kbd>
    </button>
  );

  return mounted ? createPortal(panel, document.body) : null;
}
