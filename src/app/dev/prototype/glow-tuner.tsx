"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type { Phase } from "@/lib/theme";
import { pinPhase, unpinPhase } from "@/lib/theme";
import { GLOW_TUNER_CSS } from "./glow-tuner-css";

/**
 * Dev-only tuner for the horizon glow. It follows the phase picker's
 * data-phase and writes overrides for the active phase only, as a per-phase
 * CSS block in the page: switching phase shows each phase's own tuned values,
 * and the existing :root transition crossfades between them.
 *
 * Values live in component state and localStorage (best effort; storage can
 * throw). "Copy CSS" prints the active phase's block plus the global :root
 * block (geometry and crossfade) in the globals.css format so it can be
 * pasted back.
 */

const PHASES: Phase[] = ["dawn", "day", "dusk", "night"];

const STORAGE_KEY = "prototype.horizon-glow.v1";

const EASES = [
  { value: "ease", label: "ease" },
  { value: "ease-in-out", label: "ease-in-out" },
  { value: "ease-out", label: "ease-out" },
  { value: "linear", label: "linear" },
  {
    value: "cubic-bezier(0.22, 1, 0.36, 1)",
    label: "soft ease-out (0.22, 1, 0.36, 1)",
  },
  {
    value: "cubic-bezier(0.32, 0.72, 0, 1)",
    label: "strong ease-out (0.32, 0.72, 0, 1)",
  },
] as const;

type Ease = (typeof EASES)[number]["value"];

function isEase(value: unknown): value is Ease {
  return EASES.some((ease) => ease.value === value);
}

type GlowTokens = {
  base: string;
  mid: string;
  midAt: number;
  three: string;
  one: string;
  oneAlpha: number;
  two: string;
  twoAlpha: number;
  blob1Top: number;
  blob1Left: number;
  blob1Width: number;
  blob1Height: number;
  blob2Top: number;
  blob2Left: number;
  blob2Width: number;
  blob2Height: number;
  blur: number;
};

type TunerState = {
  phases: Record<Phase, GlowTokens>;
  duration: number;
  ease: Ease;
  autoDuration: number;
  autoEase: Ease;
  /** Preview interval in seconds. */
  autoInterval: number;
};

const DEFAULT_GEOMETRY = {
  blob1Top: 84,
  blob1Left: -14,
  blob1Width: 63,
  blob1Height: 41,
  blob2Top: 80,
  blob2Left: 49,
  blob2Width: 69,
  blob2Height: 45,
  blur: 180,
} satisfies Omit<
  GlowTokens,
  "base" | "mid" | "midAt" | "three" | "one" | "oneAlpha" | "two" | "twoAlpha"
>;

/** Mirrors the per-phase blocks in src/app/globals.css. */
const DEFAULT_TOKENS: Record<Phase, GlowTokens> = {
  dawn: {
    base: "#f8fafd",
    mid: "#f9f8f7",
    midAt: 82,
    three: "#f9f4ec",
    one: "#ff90b9",
    oneAlpha: 0.06,
    two: "#cb83ff",
    twoAlpha: 0.06,
    ...DEFAULT_GEOMETRY,
  },
  day: {
    base: "#f8fafd",
    mid: "#f3f7fd",
    midAt: 82,
    three: "#ecf4fd",
    one: "#60a8e2",
    oneAlpha: 0.06,
    two: "#0071c1",
    twoAlpha: 0.06,
    ...DEFAULT_GEOMETRY,
  },
  dusk: {
    base: "#f8fafd",
    mid: "#f5f8fd",
    midAt: 80,
    three: "#f9f7f3",
    one: "#b4d8ff",
    oneAlpha: 0.06,
    two: "#ffb451",
    twoAlpha: 0.06,
    ...DEFAULT_GEOMETRY,
  },
  night: {
    base: "#0d0d0d",
    mid: "#0f0f13",
    midAt: 90,
    three: "#111116",
    one: "#6763e4",
    oneAlpha: 0.06,
    two: "#afffea",
    twoAlpha: 0.03,
    ...DEFAULT_GEOMETRY,
  },
};

function defaultState(): TunerState {
  return {
    phases: {
      dawn: { ...DEFAULT_TOKENS.dawn },
      day: { ...DEFAULT_TOKENS.day },
      dusk: { ...DEFAULT_TOKENS.dusk },
      night: { ...DEFAULT_TOKENS.night },
    },
    duration: 400,
    ease: "ease-in-out",
    autoDuration: 400,
    autoEase: "ease-in-out",
    autoInterval: 4,
  };
}

function isPhase(value: unknown): value is Phase {
  return (
    value === "dawn" || value === "day" || value === "dusk" || value === "night"
  );
}

function formatNumber(value: number, digits = 0): string {
  return digits === 0 ? String(Math.round(value)) : value.toFixed(digits);
}

function numberOr(
  value: unknown,
  fallback: number,
  min: number,
  max: number,
): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(max, Math.max(min, value))
    : fallback;
}

function colorOr(value: unknown, fallback: string): string {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value)
    ? value
    : fallback;
}

function readTokens(phase: Phase, value: unknown): GlowTokens {
  const fallback = DEFAULT_TOKENS[phase];

  if (!value || typeof value !== "object") {
    return { ...fallback };
  }

  const stored = value as Partial<GlowTokens>;

  return {
    base: colorOr(stored.base, fallback.base),
    mid: colorOr(stored.mid, fallback.mid),
    midAt: numberOr(stored.midAt, fallback.midAt, 0, 100),
    three: colorOr(stored.three, fallback.three),
    one: colorOr(stored.one, fallback.one),
    oneAlpha: numberOr(stored.oneAlpha, fallback.oneAlpha, 0, 0.4),
    two: colorOr(stored.two, fallback.two),
    twoAlpha: numberOr(stored.twoAlpha, fallback.twoAlpha, 0, 0.4),
    blob1Top: numberOr(stored.blob1Top, fallback.blob1Top, 0, 120),
    blob1Left: numberOr(stored.blob1Left, fallback.blob1Left, -60, 120),
    blob1Width: numberOr(stored.blob1Width, fallback.blob1Width, 0, 140),
    blob1Height: numberOr(stored.blob1Height, fallback.blob1Height, 0, 120),
    blob2Top: numberOr(stored.blob2Top, fallback.blob2Top, 0, 120),
    blob2Left: numberOr(stored.blob2Left, fallback.blob2Left, -60, 120),
    blob2Width: numberOr(stored.blob2Width, fallback.blob2Width, 0, 140),
    blob2Height: numberOr(stored.blob2Height, fallback.blob2Height, 0, 120),
    blur: numberOr(stored.blur, fallback.blur, 0, 400),
  };
}

function readStoredState(): TunerState | null {
  const raw = window.localStorage.getItem(STORAGE_KEY);

  if (!raw) return null;

  const parsed: unknown = JSON.parse(raw);

  if (!parsed || typeof parsed !== "object") return null;

  const stored = parsed as {
    phases?: Partial<Record<Phase, unknown>>;
    duration?: unknown;
    ease?: unknown;
    autoDuration?: unknown;
    autoEase?: unknown;
    autoInterval?: unknown;
  };
  const base = defaultState();

  for (const phase of PHASES) {
    base.phases[phase] = readTokens(phase, stored.phases?.[phase]);
  }

  return {
    phases: base.phases,
    duration: numberOr(stored.duration, base.duration, 0, 3000),
    ease: isEase(stored.ease) ? stored.ease : base.ease,
    autoDuration: numberOr(stored.autoDuration, base.autoDuration, 0, 10000),
    autoEase: isEase(stored.autoEase) ? stored.autoEase : base.autoEase,
    autoInterval: numberOr(stored.autoInterval, base.autoInterval, 2, 10),
  };
}

function geometryLines(tokens: GlowTokens): string[] {
  return [
    `  --horizon-blob-1-top: ${formatNumber(tokens.blob1Top)}%;`,
    `  --horizon-blob-1-left: ${formatNumber(tokens.blob1Left)}%;`,
    `  --horizon-blob-1-width: ${formatNumber(tokens.blob1Width)}%;`,
    `  --horizon-blob-1-height: ${formatNumber(tokens.blob1Height)}%;`,
    `  --horizon-blob-2-top: ${formatNumber(tokens.blob2Top)}%;`,
    `  --horizon-blob-2-left: ${formatNumber(tokens.blob2Left)}%;`,
    `  --horizon-blob-2-width: ${formatNumber(tokens.blob2Width)}%;`,
    `  --horizon-blob-2-height: ${formatNumber(tokens.blob2Height)}%;`,
    `  --horizon-blob-blur: ${formatNumber(tokens.blur)}px;`,
  ];
}

/** One pasteable token block in the globals.css format. */
function phaseBlock(
  phase: Phase,
  tokens: GlowTokens,
  withGeometry = false,
): string {
  return [
    `[data-phase="${phase}"] {`,
    `  --horizon-base: ${tokens.base};`,
    `  --horizon-mid: ${tokens.mid};`,
    `  --horizon-mid-at: ${formatNumber(tokens.midAt)}%;`,
    `  --horizon-3: ${tokens.three};`,
    `  --horizon-1: ${tokens.one};`,
    `  --horizon-1-alpha: ${formatNumber(tokens.oneAlpha, 3)};`,
    `  --horizon-2: ${tokens.two};`,
    `  --horizon-2-alpha: ${formatNumber(tokens.twoAlpha, 3)};`,
    ...(withGeometry ? geometryLines(tokens) : []),
    "}",
  ].join("\n");
}

/**
 * Global tokens in the :root block of globals.css: geometry and the crossfade
 * timing. Copied for the active phase (the values the panel is tuning).
 */
function globalBlock(tokens: GlowTokens, state: TunerState): string {
  return [
    ":root {",
    ...geometryLines(tokens),
    `  --horizon-transition-duration: ${formatNumber(state.duration)}ms;`,
    `  --horizon-transition-ease: ${state.ease};`,
    `  --phase-auto-transition-duration: ${formatNumber(state.autoDuration)}ms;`,
    `  --phase-auto-transition-ease: ${state.autoEase};`,
    "}",
  ].join("\n");
}

function readActivePhase(): Phase {
  const phase = document.documentElement.dataset.phase;

  return isPhase(phase) ? phase : "day";
}

function subscribeToPhase(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange);

  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-phase"],
  });

  return () => observer.disconnect();
}

/** Client-only flag without setState-in-effect: false during SSR/hydration. */
function subscribeToHydration(): () => void {
  return () => {};
}

function readInitialState(): TunerState {
  if (typeof window === "undefined") return defaultState();

  try {
    return readStoredState() ?? defaultState();
  } catch {
    return defaultState();
  }
}

function ColorRow({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="glow-tuner-row">
      <label className="glow-tuner-label" htmlFor={id}>
        {label}
      </label>
      <output className="glow-tuner-value" htmlFor={id}>
        {value}
      </output>
      <input
        id={id}
        className="glow-tuner-color"
        type="color"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

function SliderRow({
  id,
  label,
  value,
  min,
  max,
  step,
  display,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  display: string;
  onChange: (value: number) => void;
}) {
  return (
    <div className="glow-tuner-row">
      <label className="glow-tuner-label" htmlFor={id}>
        {label}
      </label>
      <output className="glow-tuner-value" htmlFor={id}>
        {display}
      </output>
      <input
        id={id}
        className="glow-tuner-range"
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </div>
  );
}

export function GlowTuner() {
  const [state, setState] = useState<TunerState>(readInitialState);
  const [open, setOpen] = useState(true);
  const [autoPreview, setAutoPreview] = useState(false);
  const [copied, setCopied] = useState(false);
  const copyTimer = useRef<number | null>(null);
  const previewStartPin = useRef<Phase | null>(null);
  const hydrated = useSyncExternalStore(
    subscribeToHydration,
    () => true,
    () => false,
  );
  const phase = useSyncExternalStore(
    subscribeToPhase,
    readActivePhase,
    () => "day" as Phase,
  );
  const tokens = state.phases[phase];
  const phaseLabel = phase.charAt(0).toUpperCase() + phase.slice(1);

  // Persist after hydration; defaults can never overwrite a saved setup because
  // the first client render already read the saved state.
  useEffect(() => {
    if (!hydrated) return;

    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Storage can be blocked; tuning still works for the session.
    }
  }, [state, hydrated]);

  useEffect(() => {
    return () => {
      if (copyTimer.current !== null) window.clearTimeout(copyTimer.current);
    };
  }, []);

  // While a panel control is held down, let edits land instantly instead of
  // crossfading every slider step; the phase-switch transition is unaffected.
  useEffect(() => {
    function stopTuning() {
      delete document.documentElement.dataset.horizonTuning;
    }

    window.addEventListener("pointerup", stopTuning);
    window.addEventListener("pointercancel", stopTuning);
    // A release outside the window never reaches pointerup; blur, the document
    // leaving, and capture loss all end the tuning flag so it cannot stick.
    window.addEventListener("blur", stopTuning);
    document.addEventListener("pointerleave", stopTuning);
    window.addEventListener("lostpointercapture", stopTuning, true);

    return () => {
      window.removeEventListener("pointerup", stopTuning);
      window.removeEventListener("pointercancel", stopTuning);
      window.removeEventListener("blur", stopTuning);
      document.removeEventListener("pointerleave", stopTuning);
      window.removeEventListener("lostpointercapture", stopTuning, true);
      stopTuning();
    };
  }, []);

  // G toggles the panel. Ignore typing targets and modifier combos.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      const target = event.target as HTMLElement | null;

      if (
        target?.isContentEditable ||
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.tagName === "SELECT"
      ) {
        return;
      }

      if (event.key.toLowerCase() === "g") {
        event.preventDefault();
        setOpen((value) => !value);
      }
    }

    window.addEventListener("keydown", onKeyDown);

    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // Preview auto switch: step through the phases in clock order, pinning each
  // one with the auto tokens so it fades like a real clock boundary.
  useEffect(() => {
    if (!autoPreview) return;

    const timer = window.setInterval(() => {
      const current = readActivePhase();
      const next = PHASES[(PHASES.indexOf(current) + 1) % PHASES.length];

      pinPhase(next, "auto");
    }, state.autoInterval * 1000);

    return () => window.clearInterval(timer);
  }, [autoPreview, state.autoInterval]);

  // Leaving the preview (or the page) restores the pin/clock it started from.
  useEffect(() => {
    if (!autoPreview) return;

    return () => {
      const start = previewStartPin.current;
      previewStartPin.current = null;

      if (start) {
        pinPhase(start);
      } else {
        unpinPhase();
      }
    };
  }, [autoPreview]);

  const liveCss = useMemo(
    () =>
      [
        ":root {",
        `  --horizon-transition-duration: ${formatNumber(state.duration)}ms;`,
        `  --horizon-transition-ease: ${state.ease};`,
        `  --phase-auto-transition-duration: ${formatNumber(state.autoDuration)}ms;`,
        `  --phase-auto-transition-ease: ${state.autoEase};`,
        "}",
        ...PHASES.map((entry) =>
          phaseBlock(entry, state.phases[entry], true),
        ),
      ].join("\n\n"),
    [state],
  );

  // Client-only panel: no hydration mismatch from values read out of storage.
  if (!hydrated) return null;

  function update<K extends keyof GlowTokens>(key: K, value: GlowTokens[K]) {
    setState((current) => ({
      ...current,
      phases: {
        ...current.phases,
        [phase]: { ...current.phases[phase], [key]: value },
      },
    }));
  }

  function resetPhase() {
    setState((current) => ({
      ...current,
      phases: { ...current.phases, [phase]: { ...DEFAULT_TOKENS[phase] } },
    }));
  }

  function resetAll() {
    setState(defaultState());
  }

  async function copyCss() {
    try {
      const css = [
        phaseBlock(phase, tokens),
        globalBlock(tokens, state),
      ].join("\n\n");

      await navigator.clipboard.writeText(css);
      setCopied(true);

      if (copyTimer.current !== null) window.clearTimeout(copyTimer.current);

      copyTimer.current = window.setTimeout(() => setCopied(false), 1400);
    } catch {
      // Clipboard can be blocked; the block is still in the panel's CSS.
    }
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: GLOW_TUNER_CSS }} />
      <style dangerouslySetInnerHTML={{ __html: liveCss }} />

      <aside
        className="glow-tuner"
        aria-label="Horizon glow tuner"
        onPointerDown={() => {
          document.documentElement.dataset.horizonTuning = "true";
        }}
      >
        {open ? (
          <div className="glow-tuner-open">
            <header className="glow-tuner-head">
              <h2 className="glow-tuner-title">Glow tuner</h2>
              <span className="glow-tuner-phase">Editing {phaseLabel}</span>
              <button
                type="button"
                className="glow-tuner-toggle"
                aria-expanded={true}
                aria-label="Hide glow tuner"
                title="Hide (G)"
                onClick={() => setOpen(false)}
              >
                –
              </button>
            </header>

            <div className="glow-tuner-body">
              <p className="glow-tuner-group">Colours</p>
              <ColorRow
                id="glow-base"
                label="Base"
                value={tokens.base}
                onChange={(value) => update("base", value)}
              />
              <ColorRow
                id="glow-mid"
                label="Mid tint"
                value={tokens.mid}
                onChange={(value) => update("mid", value)}
              />
              <ColorRow
                id="glow-one"
                label="Blob 1 hue"
                value={tokens.one}
                onChange={(value) => update("one", value)}
              />
              <ColorRow
                id="glow-two"
                label="Blob 2 hue"
                value={tokens.two}
                onChange={(value) => update("two", value)}
              />
              <ColorRow
                id="glow-three"
                label="Bottom edge"
                value={tokens.three}
                onChange={(value) => update("three", value)}
              />

              <p className="glow-tuner-group">Falloff</p>
              <SliderRow
                id="glow-mid-at"
                label="Mid stop"
                value={tokens.midAt}
                min={0}
                max={100}
                step={1}
                display={`${formatNumber(tokens.midAt)}%`}
                onChange={(value) => update("midAt", value)}
              />
              <SliderRow
                id="glow-one-alpha"
                label="Blob 1 alpha"
                value={tokens.oneAlpha}
                min={0}
                max={0.4}
                step={0.005}
                display={formatNumber(tokens.oneAlpha, 3)}
                onChange={(value) => update("oneAlpha", value)}
              />
              <SliderRow
                id="glow-two-alpha"
                label="Blob 2 alpha"
                value={tokens.twoAlpha}
                min={0}
                max={0.4}
                step={0.005}
                display={formatNumber(tokens.twoAlpha, 3)}
                onChange={(value) => update("twoAlpha", value)}
              />

              <details className="glow-tuner-details">
                <summary className="glow-tuner-summary">
                  Blob geometry
                </summary>
                <div className="glow-tuner-stack">
                  <p className="glow-tuner-group">Blob 1</p>
                  <SliderRow
                    id="glow-b1-top"
                    label="Top"
                    value={tokens.blob1Top}
                    min={0}
                    max={120}
                    step={1}
                    display={`${formatNumber(tokens.blob1Top)}%`}
                    onChange={(value) => update("blob1Top", value)}
                  />
                  <SliderRow
                    id="glow-b1-left"
                    label="Left"
                    value={tokens.blob1Left}
                    min={-60}
                    max={120}
                    step={1}
                    display={`${formatNumber(tokens.blob1Left)}%`}
                    onChange={(value) => update("blob1Left", value)}
                  />
                  <SliderRow
                    id="glow-b1-width"
                    label="Width"
                    value={tokens.blob1Width}
                    min={0}
                    max={140}
                    step={1}
                    display={`${formatNumber(tokens.blob1Width)}%`}
                    onChange={(value) => update("blob1Width", value)}
                  />
                  <SliderRow
                    id="glow-b1-height"
                    label="Height"
                    value={tokens.blob1Height}
                    min={0}
                    max={120}
                    step={1}
                    display={`${formatNumber(tokens.blob1Height)}%`}
                    onChange={(value) => update("blob1Height", value)}
                  />

                  <p className="glow-tuner-group">Blob 2</p>
                  <SliderRow
                    id="glow-b2-top"
                    label="Top"
                    value={tokens.blob2Top}
                    min={0}
                    max={120}
                    step={1}
                    display={`${formatNumber(tokens.blob2Top)}%`}
                    onChange={(value) => update("blob2Top", value)}
                  />
                  <SliderRow
                    id="glow-b2-left"
                    label="Left"
                    value={tokens.blob2Left}
                    min={-60}
                    max={120}
                    step={1}
                    display={`${formatNumber(tokens.blob2Left)}%`}
                    onChange={(value) => update("blob2Left", value)}
                  />
                  <SliderRow
                    id="glow-b2-width"
                    label="Width"
                    value={tokens.blob2Width}
                    min={0}
                    max={140}
                    step={1}
                    display={`${formatNumber(tokens.blob2Width)}%`}
                    onChange={(value) => update("blob2Width", value)}
                  />
                  <SliderRow
                    id="glow-b2-height"
                    label="Height"
                    value={tokens.blob2Height}
                    min={0}
                    max={120}
                    step={1}
                    display={`${formatNumber(tokens.blob2Height)}%`}
                    onChange={(value) => update("blob2Height", value)}
                  />

                  <SliderRow
                    id="glow-blur"
                    label="Blur (1440)"
                    value={tokens.blur}
                    min={0}
                    max={400}
                    step={1}
                    display={`${formatNumber(tokens.blur)}px`}
                    onChange={(value) => update("blur", value)}
                  />
                </div>
              </details>

              <p className="glow-tuner-group">Crossfade</p>
              <SliderRow
                id="glow-duration"
                label="Duration"
                value={state.duration}
                min={0}
                max={3000}
                step={10}
                display={`${formatNumber(state.duration)}ms`}
                onChange={(value) =>
                  setState((current) => ({ ...current, duration: value }))
                }
              />
              <div className="glow-tuner-row">
                <label className="glow-tuner-label" htmlFor="glow-ease">
                  Easing
                </label>
                <select
                  id="glow-ease"
                  className="glow-tuner-select"
                  value={state.ease}
                  onChange={(event) =>
                    setState((current) => ({
                      ...current,
                      ease: event.target.value as Ease,
                    }))
                  }
                >
                  {EASES.map((ease) => (
                    <option key={ease.value} value={ease.value}>
                      {ease.label}
                    </option>
                  ))}
                </select>
              </div>

              <p className="glow-tuner-group">Auto switch</p>
              <label className="glow-tuner-check" htmlFor="glow-auto-preview">
                <input
                  id="glow-auto-preview"
                  type="checkbox"
                  checked={autoPreview}
                  onChange={(event) => {
                    const next = event.target.checked;

                    if (next) {
                      previewStartPin.current =
                        document.documentElement.dataset.phasePreview ===
                        "true"
                          ? readActivePhase()
                          : null;
                    }

                    setAutoPreview(next);
                  }}
                />
                Preview auto switch
              </label>
              <SliderRow
                id="glow-auto-interval"
                label="Interval"
                value={state.autoInterval}
                min={2}
                max={10}
                step={1}
                display={`${formatNumber(state.autoInterval)}s`}
                onChange={(value) =>
                  setState((current) => ({ ...current, autoInterval: value }))
                }
              />
              <SliderRow
                id="glow-auto-duration"
                label="Auto duration"
                value={state.autoDuration}
                min={0}
                max={10000}
                step={50}
                display={`${formatNumber(state.autoDuration)}ms`}
                onChange={(value) =>
                  setState((current) => ({ ...current, autoDuration: value }))
                }
              />
              <div className="glow-tuner-row">
                <label className="glow-tuner-label" htmlFor="glow-auto-ease">
                  Auto easing
                </label>
                <select
                  id="glow-auto-ease"
                  className="glow-tuner-select"
                  value={state.autoEase}
                  onChange={(event) =>
                    setState((current) => ({
                      ...current,
                      autoEase: event.target.value as Ease,
                    }))
                  }
                >
                  {EASES.map((ease) => (
                    <option key={ease.value} value={ease.value}>
                      {ease.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="glow-tuner-actions">
                <button
                  type="button"
                  className="glow-tuner-button"
                  onClick={resetPhase}
                >
                  Reset phase
                </button>
                <button
                  type="button"
                  className="glow-tuner-button"
                  onClick={resetAll}
                >
                  Reset all
                </button>
                <button
                  type="button"
                  className="glow-tuner-button"
                  onClick={copyCss}
                >
                  {copied ? "Copied" : "Copy CSS"}
                </button>
              </div>

              <p className="glow-tuner-hint">
                G toggles · colours save per phase
              </p>
            </div>
          </div>
        ) : (
          <button
            type="button"
            className="glow-tuner-launch"
            aria-expanded={false}
            onClick={() => setOpen(true)}
            title="Show glow tuner (G)"
          >
            Glow · {phaseLabel}
          </button>
        )}
      </aside>
    </>
  );
}
