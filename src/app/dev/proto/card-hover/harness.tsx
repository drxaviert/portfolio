"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { ring } from "./variants/ring";
import { ringHorizon } from "./variants/ring-horizon";
import { ringNavBar } from "./variants/ring-nav-bar";
import { ringNavItems } from "./variants/ring-nav-items";
import type { Control, Values, Variant } from "./variants/types";
import { pinPhase, unpinPhase } from "@/lib/theme";

/**
 * Round 2 (riff on Ring): Lift, Spotlight, Focus and Ring·subtle are out of the
 * picker — their files stay in variants/ for reference.
 */
const VARIANTS: Variant[] = [ring, ringHorizon, ringNavItems, ringNavBar];

const PHASES = ["dawn", "day", "dusk", "night"] as const;
type Phase = (typeof PHASES)[number];

/** Picker chrome, copied verbatim from the emil-prototype spec. */
const PICKER_CSS = `
.proto-picker {
  position: fixed;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 2147483647;
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 4px;
  border-radius: 999px;
  background: rgba(10, 10, 10, 0.82);
  -webkit-backdrop-filter: blur(12px) saturate(1.4);
  backdrop-filter: blur(12px) saturate(1.4);
  box-shadow:
    0 0 0 1px rgba(255, 255, 255, 0.08) inset,
    0 8px 24px rgba(0, 0, 0, 0.24),
    0 2px 6px rgba(0, 0, 0, 0.12);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  font-size: 13px;
  line-height: 1;
  -webkit-font-smoothing: antialiased;
  user-select: none;
  -webkit-user-select: none;
}

.proto-picker-highlight {
  position: absolute;
  top: 4px;
  left: 0;
  height: 28px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.12);
  will-change: transform;
}

.proto-picker[data-ready] .proto-picker-highlight {
  transition:
    transform 250ms cubic-bezier(0.23, 1, 0.32, 1),
    width 250ms cubic-bezier(0.23, 1, 0.32, 1);
}

@media (prefers-reduced-motion: reduce) {
  .proto-picker[data-ready] .proto-picker-highlight { transition: none; }
}

.proto-picker-item {
  position: relative;
  display: flex;
  align-items: center;
  height: 28px;
  padding: 0 12px;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: rgba(255, 255, 255, 0.55);
  font: inherit;
  cursor: pointer;
  transition: color 150ms ease-out;
}

.proto-picker-item:hover {
  color: rgba(255, 255, 255, 0.85);
}

.proto-picker-item:active {
  transform: scale(0.97);
}

.proto-picker-item:focus-visible {
  outline: 2px solid rgba(255, 255, 255, 0.4);
  outline-offset: 2px;
}

.proto-picker-item[data-active] {
  color: #fff;
}

.proto-picker-divider {
  width: 1px;
  height: 16px;
  margin: 0 4px;
  background: rgba(255, 255, 255, 0.12);
}

.proto-picker-replay {
  padding: 0 10px;
  font-size: 14px;
}

.proto-picker[data-position="top"] {
  bottom: auto;
  top: 24px;
}

/* Harness adaptation: the spec's left:50% caps the pill at half the viewport,
   which cannot hold four names below ~720px. Size to content, stay centred. */
@media (max-width: 720px) {
  .proto-picker {
    width: max-content;
    max-width: calc(100vw - 16px);
  }
}
`;

/**
 * Control panel chrome. Same posture as the picker — neutral dark glass, no
 * project tokens, top-right and clear of the bottom-centre pill.
 */
const PANEL_CSS = `
.proto-panel {
  position: fixed;
  top: 16px;
  right: 16px;
  z-index: 2147483646;
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 232px;
  max-height: calc(100dvh - 32px);
  overflow-y: auto;
  padding: 10px;
  border-radius: 14px;
  background: rgba(10, 10, 10, 0.82);
  -webkit-backdrop-filter: blur(12px) saturate(1.4);
  backdrop-filter: blur(12px) saturate(1.4);
  box-shadow:
    0 0 0 1px rgba(255, 255, 255, 0.08) inset,
    0 8px 24px rgba(0, 0, 0, 0.24);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  font-size: 11px;
  line-height: 1.35;
  color: rgba(255, 255, 255, 0.55);
  -webkit-font-smoothing: antialiased;
  user-select: none;
  -webkit-user-select: none;
}

.proto-panel-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
}

.proto-panel-title {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
  color: #fff;
}

.proto-panel-axis {
  margin: 1px 0 0;
  font-size: 10px;
  color: rgba(255, 255, 255, 0.45);
}

.proto-panel-copy {
  flex-shrink: 0;
  padding: 3px 7px;
  border: 0;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.8);
  font: inherit;
  font-size: 10px;
  cursor: pointer;
}

.proto-panel-copy:hover { background: rgba(255, 255, 255, 0.16); }
.proto-panel-copy:focus-visible { outline: 2px solid rgba(255, 255, 255, 0.4); outline-offset: 2px; }

.proto-panel-actions {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 4px;
}

.proto-panel-toggle {
  width: 20px;
  height: 20px;
  padding: 0;
  border: 0;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.8);
  font: inherit;
  font-size: 12px;
  line-height: 1;
  cursor: pointer;
}

.proto-panel-toggle:hover { background: rgba(255, 255, 255, 0.16); }
.proto-panel-toggle:focus-visible { outline: 2px solid rgba(255, 255, 255, 0.4); outline-offset: 2px; }

.proto-panel-body {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.proto-panel-phase {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 2px;
  padding: 2px;
  border-radius: 7px;
  background: rgba(255, 255, 255, 0.06);
}

.proto-panel-phase-item {
  padding: 4px 0;
  border: 0;
  border-radius: 5px;
  background: transparent;
  color: rgba(255, 255, 255, 0.5);
  font: inherit;
  font-size: 10px;
  text-transform: capitalize;
  cursor: pointer;
}

.proto-panel-phase-item:hover { color: rgba(255, 255, 255, 0.85); }
.proto-panel-phase-item[data-active] { background: rgba(255, 255, 255, 0.14); color: #fff; }
.proto-panel-phase-item:focus-visible { outline: 2px solid rgba(255, 255, 255, 0.4); outline-offset: 1px; }

.proto-panel-row {
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;
  gap: 1px 8px;
}

.proto-panel-label { color: rgba(255, 255, 255, 0.6); }
.proto-panel-value { color: #fff; font-variant-numeric: tabular-nums; }

.proto-panel-range {
  grid-column: 1 / -1;
  width: 100%;
  height: 14px;
  margin: 0;
  accent-color: rgba(255, 255, 255, 0.8);
  cursor: pointer;
}

.proto-panel-select {
  grid-column: 1 / -1;
  width: 100%;
  padding: 3px 4px;
  border: 0;
  border-radius: 5px;
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
  font: inherit;
  font-size: 10px;
  cursor: pointer;
}

.proto-panel-select:focus-visible { outline: 2px solid rgba(255, 255, 255, 0.4); outline-offset: 2px; }

.proto-panel-hint {
  margin: 0;
  padding-top: 6px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  font-size: 10px;
  color: rgba(255, 255, 255, 0.35);
}

/* Narrow screens: the picker spans the top, so the panel drops below it. */
@media (max-width: 720px) {
  .proto-panel {
    top: 68px;
  }
}
`;

function configLine(variant: Variant, values: Values) {
  const parts = variant.controls.map(
    (control) => `${control.key}: ${control.toCss(values[control.key], values)}`,
  );

  return `${variant.name} — ${parts.join(" · ")}`;
}

function ControlRow({
  control,
  variantId,
  values,
  onChange,
}: {
  control: Control;
  variantId: string;
  values: Values;
  onChange: (key: string, value: string | number) => void;
}) {
  const id = `ch-${variantId}-${control.key}`;

  return (
    <div className="proto-panel-row">
      <label className="proto-panel-label" htmlFor={id}>
        {control.label}
      </label>
      <output className="proto-panel-value" htmlFor={id}>
        {control.format(values[control.key], values)}
      </output>

      {control.kind === "range" ? (
        <input
          id={id}
          className="proto-panel-range"
          type="range"
          min={control.min}
          max={control.max}
          step={control.step}
          value={values[control.key]}
          onChange={(event) => onChange(control.key, Number(event.target.value))}
        />
      ) : (
        <select
          id={id}
          className="proto-panel-select"
          value={values[control.key]}
          onChange={(event) => onChange(control.key, event.target.value)}
        >
          {control.options?.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}

function isPhase(value: string | null): value is Phase {
  return Boolean(value) && (PHASES as readonly string[]).includes(value as Phase);
}

/** `?v=` is 1-based; anything out of range falls back to the first variant. */
function variantIndex(value: string | null) {
  const parsed = Number.parseInt(value ?? "1", 10);

  if (!parsed || parsed < 1 || parsed > VARIANTS.length) return 0;

  return parsed - 1;
}

/**
 * The query string is the store: the picker writes it with replaceState and
 * pings subscribers, the same pattern ThemeProvider uses for data-phase. It
 * keeps ?v= / ?p= across a reload without a state-in-effect restore.
 */
const URL_EVENT = "card-hover:url";

function subscribeToUrl(onChange: () => void) {
  window.addEventListener(URL_EVENT, onChange);
  window.addEventListener("popstate", onChange);

  return () => {
    window.removeEventListener(URL_EVENT, onChange);
    window.removeEventListener("popstate", onChange);
  };
}

function readSearch() {
  return window.location.search;
}

function readServerSearch() {
  return "";
}

function writeSearch(mutate: (params: URLSearchParams) => void) {
  const url = new URL(window.location.href);

  mutate(url.searchParams);
  window.history.replaceState(null, "", url);
  window.dispatchEvent(new Event(URL_EVENT));
}

export function CardHoverHarness() {
  const search = useSyncExternalStore(
    subscribeToUrl,
    readSearch,
    readServerSearch,
  );
  const params = new URLSearchParams(search);
  const index = variantIndex(params.get("v"));
  const pinnedPhase = params.get("p");
  const phase: Phase | null = isPhase(pinnedPhase) ? pinnedPhase : null;

  const [runId, setRunId] = useState(0);
  // Per-variant values, so switching away and back keeps a tuned number.
  const [valuesByVariant, setValuesByVariant] = useState<Record<string, Values>>(
    {},
  );
  const [copied, setCopied] = useState(false);
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(true);

  const variant = VARIANTS[index];
  const values = valuesByVariant[variant.id] ?? variant.defaults;

  const stageRef = useRef<HTMLDivElement>(null);
  const highlightRef = useRef<HTMLSpanElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const copyTimer = useRef<number | null>(null);
  const appliedVars = useRef<string[]>([]);

  const moveHighlight = useCallback(() => {
    const item = itemRefs.current[index];
    const highlight = highlightRef.current;

    if (!item || !highlight) return;

    highlight.style.width = `${item.offsetWidth}px`;
    highlight.style.transform = `translateX(${item.offsetLeft}px)`;
  }, [index]);

  const setActive = useCallback((next: number) => {
    if (next < 0 || next >= VARIANTS.length) return;

    setRunId((id) => id + 1);
    writeSearch((query) => query.set("v", String(next + 1)));
  }, []);

  const applyPhase = useCallback((next: Phase) => {
    writeSearch((query) => query.set("p", next));
  }, []);

  // Pin the phase on <html>: tokens are pure CSS, so no React state is needed.
  useEffect(() => {
    if (!phase) return;

    pinPhase(phase);
  }, [phase]);

  // Leaving the route must not carry the pin to another page.
  useEffect(() => {
    return () => {
      unpinPhase();
    };
  }, []);

  // Controls write CSS variables on the stage root, never React state alone.
  // Clear the previous variant's vars first: a stale --ch-glow-image from the
  // nav variants would otherwise override a fixed-source variant's sheet.
  useLayoutEffect(() => {
    const root = stageRef.current;

    if (!root) return;

    for (const name of appliedVars.current) root.style.removeProperty(name);

    appliedVars.current = [];

    for (const control of variant.controls) {
      if (!control.cssVar) continue;

      root.style.setProperty(
        control.cssVar,
        control.toCss(values[control.key], values),
      );
      appliedVars.current.push(control.cssVar);
    }
  }, [variant, values]);

  useLayoutEffect(() => {
    moveHighlight();
  }, [moveHighlight]);

  useEffect(() => {
    const onResize = () => moveHighlight();

    window.addEventListener("resize", onResize);

    return () => window.removeEventListener("resize", onResize);
  }, [moveHighlight]);

  // Enable the highlight slide only after first paint, so load doesn't animate.
  useEffect(() => {
    const frame = requestAnimationFrame(() =>
      requestAnimationFrame(() => setReady(true)),
    );

    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;

      if (
        target &&
        (/^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName) ||
          target.isContentEditable)
      ) {
        return;
      }

      if (event.metaKey || event.ctrlKey || event.altKey) return;

      const number = Number.parseInt(event.key, 10);

      if (number >= 1 && number <= VARIANTS.length) setActive(number - 1);
      else if (event.key === "ArrowRight")
        setActive((index + 1) % VARIANTS.length);
      else if (event.key === "ArrowLeft")
        setActive((index - 1 + VARIANTS.length) % VARIANTS.length);
      else if (event.key === "r" || event.key === "R")
        setRunId((id) => id + 1);
    }

    document.addEventListener("keydown", onKeyDown);

    return () => document.removeEventListener("keydown", onKeyDown);
  }, [index, setActive]);

  useEffect(() => {
    return () => {
      if (copyTimer.current !== null) window.clearTimeout(copyTimer.current);
    };
  }, []);

  function updateValue(key: string, value: string | number) {
    setValuesByVariant((previous) => ({
      ...previous,
      [variant.id]: { ...values, [key]: value },
    }));
  }

  async function copyConfig() {
    try {
      await navigator.clipboard.writeText(configLine(variant, values));
      setCopied(true);

      if (copyTimer.current !== null) window.clearTimeout(copyTimer.current);

      copyTimer.current = window.setTimeout(() => setCopied(false), 1400);
    } catch {
      // Clipboard can be blocked; the values are still on screen.
    }
  }

  const Stage = variant.Stage;

  return (
    <div ref={stageRef} data-variant={variant.id}>
      <style dangerouslySetInnerHTML={{ __html: PICKER_CSS }} />
      <style dangerouslySetInnerHTML={{ __html: PANEL_CSS }} />
      <style dangerouslySetInnerHTML={{ __html: variant.css }} />

      <div key={runId}>
        <Stage />
      </div>

      <nav
        className="proto-picker"
        aria-label="Prototype variants"
        data-position="top"
        data-ready={ready ? "" : undefined}
      >
        <span
          ref={highlightRef}
          className="proto-picker-highlight"
          aria-hidden="true"
        />

        {VARIANTS.map((entry, entryIndex) => (
          <button
            key={entry.id}
            ref={(element) => {
              itemRefs.current[entryIndex] = element;
            }}
            type="button"
            className="proto-picker-item"
            data-active={entryIndex === index ? "" : undefined}
            aria-current={entryIndex === index ? "true" : undefined}
            onClick={() => setActive(entryIndex)}
          >
            {entry.name}
          </button>
        ))}
      </nav>

      <aside className="proto-panel" aria-label="Variant controls">
        <header className="proto-panel-head">
          <div>
            <p className="proto-panel-title">{variant.name}</p>
            <p className="proto-panel-axis">{variant.axis}</p>
          </div>
          <div className="proto-panel-actions">
            {open ? (
              <button
                type="button"
                className="proto-panel-copy"
                onClick={copyConfig}
              >
                {copied ? "Copied" : "Copy"}
              </button>
            ) : null}
            <button
              type="button"
              className="proto-panel-toggle"
              aria-expanded={open}
              aria-label={open ? "Hide controls" : "Show controls"}
              onClick={() => setOpen((value) => !value)}
            >
              {open ? "–" : "+"}
            </button>
          </div>
        </header>

        {open ? (
          <div className="proto-panel-body">
            <div className="proto-panel-phase" role="group" aria-label="Phase">
              {PHASES.map((entry) => (
                <button
                  key={entry}
                  type="button"
                  className="proto-panel-phase-item"
                  data-active={phase === entry ? "" : undefined}
                  aria-pressed={phase === entry}
                  onClick={() => applyPhase(entry)}
                >
                  {entry}
                </button>
              ))}
            </div>

            {variant.controls.map((control) => (
              <ControlRow
                key={control.key}
                control={control}
                variantId={variant.id}
                values={values}
                onChange={updateValue}
              />
            ))}

            <p className="proto-panel-hint">
          1–{VARIANTS.length} · ← → switch · R remount
        </p>
          </div>
        ) : null}
      </aside>
    </div>
  );
}
