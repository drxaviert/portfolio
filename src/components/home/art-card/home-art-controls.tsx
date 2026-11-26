"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { KeyboardEvent as ReactKeyboardEvent, ReactNode } from "react";
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
 *
 * Each row is a radiogroup of pill buttons. The roving tab stop moves with the
 * arrow keys, while the pill face stays smaller than the 44px hit area.
 */

export const PANEL_SHORTCUT = "Shift+F";

type PillOption<T> = { value: T; label: string };

const FRAME_OPTIONS: readonly PillOption<FrameEra | null>[] = [
  { value: null, label: "Auto" },
  { value: "gilt-ornate", label: "Gilt" },
  { value: "gilt-carved", label: "Carved" },
  { value: "walnut", label: "Walnut" },
  { value: "modern", label: "Modern" },
  { value: "scroll", label: "Scroll" },
];

const FRAMES_OPTIONS: readonly PillOption<boolean>[] = [
  { value: false, label: "New" },
  { value: true, label: "Current" },
];

const PHASE_OPTIONS: readonly PillOption<Phase | null>[] = [
  { value: null, label: "Auto" },
  { value: "day", label: "Day" },
  { value: "dawn", label: "Dawn" },
  { value: "dusk", label: "Dusk" },
  { value: "night", label: "Night" },
];

const SAMPLE_IDS = new Set([512, 2169, 4887, 8900]);

const PAINTING_OPTIONS: readonly PillOption<string>[] = [
  { value: "today", label: "Today" },
  { value: "512", label: "512" },
  { value: "2169", label: "2169" },
  { value: "4887", label: "4887" },
  { value: "8900", label: "8900" },
];

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

function PillGroup<T extends string | number | boolean | null>({
  label,
  options,
  value,
  onChange,
  trailing,
}: {
  label: string;
  options: readonly PillOption<T>[];
  value: T;
  onChange: (value: T) => void;
  trailing?: ReactNode;
}) {
  const selectedIndex = options.findIndex((option) => option.value === value);
  // With a custom painting no pill is checked; keep the row tabbable anyway.
  const focusIndex = selectedIndex === -1 ? 0 : selectedIndex;

  function onKeyDown(
    event: ReactKeyboardEvent<HTMLButtonElement>,
    index: number,
  ) {
    let nextIndex: number;

    switch (event.key) {
      case "ArrowRight":
      case "ArrowDown":
        nextIndex = (index + 1) % options.length;
        break;
      case "ArrowLeft":
      case "ArrowUp":
        nextIndex = (index + options.length - 1) % options.length;
        break;
      case "Home":
        nextIndex = 0;
        break;
      case "End":
        nextIndex = options.length - 1;
        break;
      default:
        return;
    }

    event.preventDefault();
    onChange(options[nextIndex].value);
    event.currentTarget
      .closest('[role="radiogroup"]')
      ?.querySelectorAll<HTMLButtonElement>('[role="radio"]')
      [nextIndex]?.focus();
  }

  return (
    <div className="home-art-field">
      <span className="home-art-label">{label}</span>
      <div className="home-art-row">
        <div className="home-art-pills" role="radiogroup" aria-label={label}>
          {options.map((option, index) => {
            const selected = option.value === value;

            return (
              <button
                key={String(option.value)}
                type="button"
                role="radio"
                aria-checked={selected}
                tabIndex={index === focusIndex ? 0 : -1}
                className="home-art-pill"
                onClick={() => onChange(option.value)}
                onKeyDown={(event) => onKeyDown(event, index)}
              >
                <span className="home-art-pill-face">{option.label}</span>
              </button>
            );
          })}
        </div>
        {trailing}
      </div>
    </div>
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
  const [customDraft, setCustomDraft] = useState<string | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
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
    override.artId === null
      ? "today"
      : SAMPLE_IDS.has(override.artId)
        ? String(override.artId)
        : "custom";

  function choosePainting(value: string) {
    setCustomDraft(null);
    onChange({
      ...override,
      artId: value === "today" ? null : Number(value),
    });
  }

  function applyCustom() {
    if (!customValid || customId === null) return;

    setCustomDraft(SAMPLE_IDS.has(customId) ? null : String(customId));
    onChange({ ...override, artId: customId });
  }

  const customForm = (
    <form
      className="home-art-custom"
      onSubmit={(event) => {
        event.preventDefault();
        applyCustom();
      }}
    >
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete="off"
        spellCheck={false}
        aria-label="AIC id"
        placeholder="AIC id"
        value={customValue}
        aria-invalid={!customValid && customValue !== ""}
        onChange={(event) =>
          setCustomDraft(event.target.value.replace(/\D/g, "").slice(0, 9))
        }
      />
      <button type="submit" disabled={!customValid}>
        Apply
      </button>
    </form>
  );

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
        <PillGroup
          label="Frame"
          options={FRAME_OPTIONS}
          value={override.era}
          onChange={(era) => onChange({ ...override, era })}
        />

        <PillGroup
          label="Frames"
          options={FRAMES_OPTIONS}
          value={override.frames}
          onChange={(frames) => onChange({ ...override, frames })}
        />

        <PillGroup
          label="Phase"
          options={PHASE_OPTIONS}
          value={override.phase}
          onChange={(phase) => onChange({ ...override, phase })}
        />

        <PillGroup
          label="Painting"
          options={PAINTING_OPTIONS}
          value={paintingValue}
          onChange={choosePainting}
          trailing={customForm}
        />
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
