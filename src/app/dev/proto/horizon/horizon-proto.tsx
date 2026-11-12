"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { HorizonBackground } from "@/components/horizon/horizon-background";
import { HORIZON_HOME_MOTION } from "@/components/horizon/horizon-preset";
import { HorizonShader } from "@/components/horizon/horizon-shader";
import type { HorizonIntensityPeak } from "@/components/horizon/horizon-intensity";
import type {
  HorizonDitherBlend,
  HorizonGradientMode,
  HorizonMotionTuning,
  HorizonMotionVariant,
} from "@/components/horizon/horizon-background";
import { pinPhase, unpinPhase } from "@/lib/theme";

/**
 * Live picker for the breathe-locked intensity pulse.
 *
 * Everything here is a viewing aid: the values that matter are written to
 * localStorage so a reload keeps the session, and "Copy values" prints the
 * preset lines to hand back. Nothing in this route ships.
 */

const STORAGE_KEY = "horizon-ambient:v1";

const VARIANTS: { value: HorizonMotionVariant; label: string }[] = [
  { value: "none", label: "Static" },
  { value: "drift", label: "Drift" },
  { value: "breathe", label: "Breathe" },
  { value: "drift-breathe", label: "Drift + Breathe" },
];

const BLENDS: { value: HorizonDitherBlend; label: string }[] = [
  { value: "normal", label: "normal" },
  { value: "overlay", label: "overlay" },
  { value: "soft-light", label: "soft-light" },
];

const GRADIENTS: { value: HorizonGradientMode; label: string }[] = [
  { value: "srgb", label: "sRGB (current)" },
  { value: "oklab", label: "oklab + eased stops" },
];

const INTENSITY_PRESETS: { label: string; amp: number }[] = [
  { label: "Off", amp: 0 },
  { label: "Subtle", amp: 0.15 },
  { label: "Medium", amp: 0.3 },
  { label: "Strong", amp: 0.5 },
];

/**
 * Both ends of the breath are defensible, so both are reachable here.
 * "core" peaks where opacity is 1 (the breathe `from`); "expand" peaks where the
 * blob is largest (the breathe `to`), which offsets the authored opacity dip.
 */
const PEAKS: { value: HorizonIntensityPeak; label: string }[] = [
  { value: "core", label: "Core · B" },
  { value: "expand", label: "Expand · A" },
];

type Renderer = "css" | "webgl";
type ProtoTheme = "day" | "night" | "auto";

const RENDERERS: { value: Renderer; label: string }[] = [
  { value: "css", label: "CSS fallback" },
  { value: "webgl", label: "WebGL" },
];

const THEMES: { value: ProtoTheme; label: string }[] = [
  { value: "day", label: "Day" },
  { value: "night", label: "Night" },
  { value: "auto", label: "Auto" },
];

type ProtoState = {
  variant: HorizonMotionVariant;
  tuning: HorizonMotionTuning;
  renderer: Renderer;
  theme: ProtoTheme;
  ditherStrength: number;
  ditherBlend: HorizonDitherBlend;
  gradient: HorizonGradientMode;
  webglDither: number;
  webglDpr: number;
};

/**
 * The panel opens on the shipped preset, not on the component fallbacks, so
 * whatever is tuned here starts from the picture the home page actually shows.
 */
const DEFAULT_TUNING: Required<HorizonMotionTuning> = HORIZON_HOME_MOTION;

const DEFAULT_STATE: ProtoState = {
  variant: "drift-breathe",
  tuning: DEFAULT_TUNING,
  renderer: "css",
  theme: "auto",
  ditherStrength: 3,
  ditherBlend: "normal",
  gradient: "srgb",
  webglDither: 1.5,
  webglDpr: 1.5,
};

/** The slider-driven motion fields only; intensity has its own controls. */
type SliderKey =
  | "driftPeriod"
  | "driftTravelX"
  | "driftTravelY"
  | "breathePeriod"
  | "breatheScale"
  | "breatheDepth";

/**
 * One source of truth for what the sliders can reach and what a stored value is
 * clamped to. Widen here and both follow: a stale stored value can never come
 * back smaller than the slider allows.
 */
const TUNING_RANGE: Record<SliderKey, { min: number; max: number }> = {
  driftPeriod: { min: 30, max: 480 },
  driftTravelX: { min: 0, max: 15 },
  driftTravelY: { min: 0, max: 10 },
  breathePeriod: { min: 6, max: 80 },
  breatheScale: { min: 0, max: 20 },
  breatheDepth: { min: 0, max: 70 },
};

const AMP_RANGE = { min: 0, max: 0.6 };
const NIGHT_SCALE_RANGE = { min: 0.3, max: 1 };

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function numberOr(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

/** Read back what the last session tuned. Storage can be blocked; never throw. */
function readStoredState(): ProtoState | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);

    if (!raw) return null;

    const parsed = JSON.parse(raw) as {
      variant?: unknown;
      tuning?: Record<string, unknown>;
      renderer?: unknown;
      theme?: unknown;
      dither?: unknown;
      ditherStrength?: unknown;
      ditherBlend?: unknown;
      gradient?: unknown;
      webglDither?: unknown;
      webglDpr?: unknown;
    };
    const variant = VARIANTS.find(
      (entry) => entry.value === parsed?.variant,
    )?.value;
    const tuning = parsed?.tuning ?? {};
    const ditherBlend = BLENDS.find(
      (entry) => entry.value === parsed?.ditherBlend,
    )?.value;
    const gradient = GRADIENTS.find(
      (entry) => entry.value === parsed?.gradient,
    )?.value;
    const renderer = RENDERERS.find(
      (entry) => entry.value === parsed?.renderer,
    )?.value;
    const theme = THEMES.find((entry) => entry.value === parsed?.theme)?.value;
    // Older saves always rendered the CSS layer, with a dither checkbox.
    const legacyRenderer = parsed?.dither === false ? "css" : undefined;

    return {
      variant: variant ?? DEFAULT_STATE.variant,
      renderer: renderer ?? legacyRenderer ?? DEFAULT_STATE.renderer,
      theme: theme ?? DEFAULT_STATE.theme,
      ditherStrength: clamp(
        numberOr(parsed?.ditherStrength, DEFAULT_STATE.ditherStrength),
        0,
        8,
      ),
      ditherBlend: ditherBlend ?? DEFAULT_STATE.ditherBlend,
      gradient: gradient ?? DEFAULT_STATE.gradient,
      webglDither: clamp(
        numberOr(parsed?.webglDither, DEFAULT_STATE.webglDither),
        0,
        2,
      ),
      webglDpr: clamp(numberOr(parsed?.webglDpr, DEFAULT_STATE.webglDpr), 1, 2),
      tuning: {
        driftPeriod: clamp(
          numberOr(tuning.driftPeriod, DEFAULT_TUNING.driftPeriod),
          TUNING_RANGE.driftPeriod.min,
          TUNING_RANGE.driftPeriod.max,
        ),
        driftTravelX: clamp(
          numberOr(tuning.driftTravelX, DEFAULT_TUNING.driftTravelX),
          TUNING_RANGE.driftTravelX.min,
          TUNING_RANGE.driftTravelX.max,
        ),
        driftTravelY: clamp(
          numberOr(tuning.driftTravelY, DEFAULT_TUNING.driftTravelY),
          TUNING_RANGE.driftTravelY.min,
          TUNING_RANGE.driftTravelY.max,
        ),
        breathePeriod: clamp(
          numberOr(tuning.breathePeriod, DEFAULT_TUNING.breathePeriod),
          TUNING_RANGE.breathePeriod.min,
          TUNING_RANGE.breathePeriod.max,
        ),
        breatheScale: clamp(
          numberOr(tuning.breatheScale, DEFAULT_TUNING.breatheScale),
          TUNING_RANGE.breatheScale.min,
          TUNING_RANGE.breatheScale.max,
        ),
        breatheDepth: clamp(
          numberOr(tuning.breatheDepth, DEFAULT_TUNING.breatheDepth),
          TUNING_RANGE.breatheDepth.min,
          TUNING_RANGE.breatheDepth.max,
        ),
        intensityAmp: clamp(
          numberOr(tuning.intensityAmp, DEFAULT_TUNING.intensityAmp),
          AMP_RANGE.min,
          AMP_RANGE.max,
        ),
        nightIntensityScale: clamp(
          numberOr(
            tuning.nightIntensityScale,
            DEFAULT_TUNING.nightIntensityScale,
          ),
          NIGHT_SCALE_RANGE.min,
          NIGHT_SCALE_RANGE.max,
        ),
        intensityPeak:
          PEAKS.find((entry) => entry.value === tuning.intensityPeak)?.value ??
          DEFAULT_TUNING.intensityPeak,
      },
    };
  } catch {
    return null;
  }
}

function writeStoredState(state: ProtoState): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Private mode and quota errors are fine: the panel still works this visit.
  }
}

/** The phase the document resolved to, so "Auto" can say what it landed on. */
function useResolvedPhase(): string | null {
  const [phase, setPhase] = useState<string | null>(null);

  useEffect(() => {
    const read = () =>
      setPhase(document.documentElement.dataset.phase ?? "day");

    read();

    const observer = new MutationObserver(read);

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-phase"],
    });

    return () => observer.disconnect();
  }, []);

  return phase;
}

function Row({
  id,
  label,
  value,
  children,
}: {
  id: string;
  label: string;
  value: string;
  children: React.ReactNode;
}) {
  return (
    <div className="hz-row">
      <label className="hz-row-label" htmlFor={id}>
        {label}
      </label>
      <output className="hz-row-value" htmlFor={id}>
        {value}
      </output>
      {children}
    </div>
  );
}

export function HorizonProto() {
  const [state, setState] = useState<ProtoState>(DEFAULT_STATE);
  const [hydrated, setHydrated] = useState(false);
  const [open, setOpen] = useState(true);
  const [copied, setCopied] = useState(false);
  const [webglFailed, setWebglFailed] = useState(false);
  const [webglError, setWebglError] = useState<string | null>(null);
  // Viewing aid, deliberately outside ProtoState: never stored, never copied.
  const [boost, setBoost] = useState(false);
  const [boostFactor, setBoostFactor] = useState(4);
  const copyTimer = useRef<number | null>(null);
  const resolvedPhase = useResolvedPhase();

  // Stored values are read after mount so server and client markup match: a
  // useState initializer would render the stored values on the client only and
  // trip hydration. This is the one-time read from a browser-only store.
  useEffect(() => {
    const stored = readStoredState();

    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (stored) setState(stored);

    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) writeStoredState(state);
  }, [state, hydrated]);

  // Day/Night pin the phase on <html>; Auto hands it back to the clock.
  useEffect(() => {
    if (state.theme === "auto") unpinPhase();
    else pinPhase(state.theme);
  }, [state.theme]);

  useEffect(() => {
    return () => unpinPhase();
  }, []);

  useEffect(() => {
    return () => {
      if (copyTimer.current !== null) window.clearTimeout(copyTimer.current);
    };
  }, []);

  const patch = useCallback((next: Partial<ProtoState>) => {
    setState((current) => ({ ...current, ...next }));
  }, []);

  const patchTuning = useCallback((next: Partial<HorizonMotionTuning>) => {
    setState((current) => ({
      ...current,
      tuning: { ...current.tuning, ...next },
    }));
  }, []);

  const driftOn =
    state.variant === "drift" || state.variant === "drift-breathe";
  const breathes = state.variant === "breathe" || state.variant === "drift-breathe";
  const tuning = { ...DEFAULT_TUNING, ...state.tuning };
  const variantLabel =
    VARIANTS.find((entry) => entry.value === state.variant)?.label ?? "Static";
  const intensityOn = breathes && tuning.intensityAmp > 0;

  const summary = [
    `/dev/proto/horizon · renderer: ${state.renderer} · variant: ${state.variant} · theme: ${state.theme}${resolvedPhase ? ` (${resolvedPhase})` : ""}`,
    `intensity: amp ${tuning.intensityAmp.toFixed(2)} · night ×${tuning.nightIntensityScale.toFixed(2)} · peak ${tuning.intensityPeak}`,
    `drift: ${tuning.driftPeriod}s · travel ${tuning.driftTravelX}% x / ${tuning.driftTravelY}% y`,
    `breathe: ${tuning.breathePeriod}s · scale ${(1 + tuning.breatheScale / 100).toFixed(2)} · opacity 1 → ${(1 - tuning.breatheDepth / 100).toFixed(2)}`,
    `css deband: dither ${state.ditherStrength}% ${state.ditherBlend} · gradient ${state.gradient}`,
    `webgl: dither ${state.webglDither} LSB · dpr cap ${state.webglDpr}${webglFailed ? " · unavailable, CSS fallback" : ""}`,
  ].join("\n");

  async function copyValues() {
    try {
      await navigator.clipboard.writeText(summary);
      setCopied(true);

      if (copyTimer.current !== null) window.clearTimeout(copyTimer.current);

      copyTimer.current = window.setTimeout(() => setCopied(false), 1400);
    } catch {
      // Clipboard can be blocked; the values are still on screen.
    }
  }

  function reset() {
    setState({ ...DEFAULT_STATE, tuning: DEFAULT_TUNING });
    setBoost(false);
    setBoostFactor(4);
  }

  const intensity = boost ? boostFactor : 1;

  return (
    <main className="relative flex min-h-dvh flex-col overflow-hidden bg-surface text-on-surface">
      {state.renderer === "webgl" ? (
        <HorizonShader
          motion={state.variant}
          tuning={tuning}
          ditherLsb={state.webglDither}
          dprCap={state.webglDpr}
          intensity={intensity}
          fadeIn={false}
          onFallback={(reason) => {
            setWebglError(reason);
            setWebglFailed(true);
            patch({ renderer: "css" });
          }}
        />
      ) : (
        <HorizonBackground
          position="fixed"
          motion={state.variant}
          tuning={tuning}
          dither={{
            enabled: state.ditherStrength > 0,
            strength: state.ditherStrength,
            blend: state.ditherBlend,
          }}
          gradient={state.gradient}
          intensity={intensity}
        />
      )}

      <header className="hz-head">
        <p className="hz-kicker">Dev prototype · not shipped</p>
        <h1 className="hz-title">Horizon intensity</h1>
        <p className="hz-sub" data-hz-variant={state.variant}>
          {variantLabel} · {tuning.breathePeriod}s breathe ·{" "}
          {intensityOn ? `amp ${tuning.intensityAmp.toFixed(2)}` : "no pulse"} ·{" "}
          {resolvedPhase ?? "…"} phase
        </p>
      </header>

      <aside
        className="hz-panel"
        aria-label="Intensity controls"
        data-open={open}
      >
        <header className="hz-panel-head">
          <div>
            <p className="hz-panel-title">Breathe intensity</p>
            <p className="hz-panel-axis">strength · night · peak · renderer</p>
          </div>
          <div className="hz-panel-actions">
            {open ? (
              <button
                type="button"
                className="hz-chip"
                onClick={copyValues}
                title={summary}
              >
                {copied ? "Copied" : "Copy values"}
              </button>
            ) : null}
            <button
              type="button"
              className="hz-icon"
              aria-expanded={open}
              aria-label={open ? "Hide controls" : "Show controls"}
              onClick={() => setOpen((value) => !value)}
            >
              {open ? "–" : "+"}
            </button>
          </div>
        </header>

        {open ? (
          <div className="hz-panel-body">
            <div
              className="hz-variants"
              role="group"
              aria-label="Motion variant"
            >
              {VARIANTS.map((entry) => (
                <button
                  key={entry.value}
                  type="button"
                  className="hz-variant"
                  data-active={state.variant === entry.value ? "" : undefined}
                  aria-pressed={state.variant === entry.value}
                  onClick={() => patch({ variant: entry.value })}
                >
                  {entry.label}
                </button>
              ))}
            </div>

            <p className="hz-group" data-off={breathes ? undefined : ""}>
              Intensity{" "}
              <span>{breathes ? `${tuning.intensityAmp.toFixed(2)} amp` : "needs breathe"}</span>
            </p>

            <div
              className="hz-variants hz-presets"
              role="group"
              aria-label="Intensity preset"
            >
              {INTENSITY_PRESETS.map((entry) => (
                <button
                  key={entry.label}
                  type="button"
                  className="hz-variant"
                  data-active={
                    tuning.intensityAmp === entry.amp ? "" : undefined
                  }
                  aria-pressed={tuning.intensityAmp === entry.amp}
                  onClick={() => patchTuning({ intensityAmp: entry.amp })}
                >
                  {entry.label}
                </button>
              ))}
            </div>

            <Row
              id="hz-intensity-amp"
              label="Amplitude"
              value={`+${tuning.intensityAmp.toFixed(2)}`}
            >
              <input
                id="hz-intensity-amp"
                className="hz-range"
                type="range"
                {...AMP_RANGE}
                step={0.01}
                value={tuning.intensityAmp}
                onChange={(event) =>
                  patchTuning({ intensityAmp: Number(event.target.value) })
                }
              />
            </Row>

            <Row
              id="hz-night-scale"
              label="Night scale"
              value={`×${tuning.nightIntensityScale.toFixed(2)}`}
            >
              <input
                id="hz-night-scale"
                className="hz-range"
                type="range"
                {...NIGHT_SCALE_RANGE}
                step={0.05}
                value={tuning.nightIntensityScale}
                onChange={(event) =>
                  patchTuning({
                    nightIntensityScale: Number(event.target.value),
                  })
                }
              />
            </Row>

            <div
              className="hz-variants hz-peaks"
              role="group"
              aria-label="Intensity peak"
            >
              {PEAKS.map((entry) => (
                <button
                  key={entry.value}
                  type="button"
                  className="hz-variant"
                  data-active={
                    tuning.intensityPeak === entry.value ? "" : undefined
                  }
                  aria-pressed={tuning.intensityPeak === entry.value}
                  onClick={() => patchTuning({ intensityPeak: entry.value })}
                >
                  {entry.label}
                </button>
              ))}
            </div>

            <p className="hz-note">
              Core peaks while the blob is tight and opaque; Expand peaks as it
              swells, offsetting the authored opacity dip.
            </p>

            <p className="hz-group">
              Theme <span>{state.theme}</span>
            </p>

            <div className="hz-variants hz-themes" role="group" aria-label="Theme">
              {THEMES.map((entry) => (
                <button
                  key={entry.value}
                  type="button"
                  className="hz-variant hz-phase"
                  data-active={state.theme === entry.value ? "" : undefined}
                  aria-pressed={state.theme === entry.value}
                  onClick={() => patch({ theme: entry.value })}
                >
                  {entry.label}
                </button>
              ))}
            </div>

            <p className="hz-group" data-off={driftOn ? undefined : ""}>
              Drift <span>{driftOn ? "on" : "off"}</span>
            </p>

            <Row
              id="hz-drift-period"
              label="Drift period"
              value={`${tuning.driftPeriod}s`}
            >
              <input
                id="hz-drift-period"
                className="hz-range"
                type="range"
                {...TUNING_RANGE.driftPeriod}
                step={5}
                value={tuning.driftPeriod}
                onChange={(event) =>
                  patchTuning({ driftPeriod: Number(event.target.value) })
                }
              />
            </Row>

            <Row
              id="hz-drift-travel-x"
              label="Travel X"
              value={`${tuning.driftTravelX}%`}
            >
              <input
                id="hz-drift-travel-x"
                className="hz-range"
                type="range"
                {...TUNING_RANGE.driftTravelX}
                step={0.25}
                value={tuning.driftTravelX}
                onChange={(event) =>
                  patchTuning({ driftTravelX: Number(event.target.value) })
                }
              />
            </Row>

            <Row
              id="hz-drift-travel-y"
              label="Travel Y"
              value={`${tuning.driftTravelY}%`}
            >
              <input
                id="hz-drift-travel-y"
                className="hz-range"
                type="range"
                {...TUNING_RANGE.driftTravelY}
                step={0.25}
                value={tuning.driftTravelY}
                onChange={(event) =>
                  patchTuning({ driftTravelY: Number(event.target.value) })
                }
              />
            </Row>

            <p className="hz-group">
              Breathe <span>{breathes ? "on" : "off"}</span>
            </p>

            <Row
              id="hz-breathe-period"
              label="Breathe period"
              value={`${tuning.breathePeriod}s`}
            >
              <input
                id="hz-breathe-period"
                className="hz-range"
                type="range"
                {...TUNING_RANGE.breathePeriod}
                step={1}
                value={tuning.breathePeriod}
                onChange={(event) =>
                  patchTuning({ breathePeriod: Number(event.target.value) })
                }
              />
            </Row>

            <Row
              id="hz-breathe-scale"
              label="Scale"
              value={`1.00 → ${(1 + tuning.breatheScale / 100).toFixed(2)}`}
            >
              <input
                id="hz-breathe-scale"
                className="hz-range"
                type="range"
                {...TUNING_RANGE.breatheScale}
                step={1}
                value={tuning.breatheScale}
                onChange={(event) =>
                  patchTuning({ breatheScale: Number(event.target.value) })
                }
              />
            </Row>

            <Row
              id="hz-breathe-depth"
              label="Opacity depth"
              value={`1.00 → ${(1 - tuning.breatheDepth / 100).toFixed(2)}`}
            >
              <input
                id="hz-breathe-depth"
                className="hz-range"
                type="range"
                {...TUNING_RANGE.breatheDepth}
                step={1}
                value={tuning.breatheDepth}
                onChange={(event) =>
                  patchTuning({ breatheDepth: Number(event.target.value) })
                }
              />
            </Row>

            <p className="hz-group">
              Viewing aid <span>display only</span>
            </p>

            <label className="hz-toggle" htmlFor="hz-boost">
              <input
                id="hz-boost"
                type="checkbox"
                checked={boost}
                onChange={(event) => setBoost(event.target.checked)}
              />
              <span>Boost glow</span>
              <span className="hz-toggle-value">
                {boost ? `×${boostFactor}` : "off"}
              </span>
            </label>

            {boost ? (
              <Row
                id="hz-boost-factor"
                label="Glow boost"
                value={`×${boostFactor}`}
              >
                <input
                  id="hz-boost-factor"
                  className="hz-range"
                  type="range"
                  min={1}
                  max={8}
                  step={0.5}
                  value={boostFactor}
                  onChange={(event) =>
                    setBoostFactor(Number(event.target.value))
                  }
                />
                <p className="hz-note hz-boost-note">
                  Glow alpha ×{boostFactor} for judging motion. Motion, dither
                  and copied values are untouched.
                </p>
              </Row>
            ) : null}

            <p className="hz-group">Renderer</p>

            <div className="hz-renderers" role="group" aria-label="Renderer">
              {RENDERERS.map((entry) => (
                <button
                  key={entry.value}
                  type="button"
                  className="hz-variant"
                  data-active={state.renderer === entry.value ? "" : undefined}
                  aria-pressed={state.renderer === entry.value}
                  onClick={() => patch({ renderer: entry.value })}
                >
                  {entry.label}
                </button>
              ))}
            </div>

            {webglFailed ? (
              <p className="hz-warn">
                WebGL unavailable — the CSS renderer took over.
                {webglError ? ` (${webglError})` : ""}
              </p>
            ) : null}

            <p className="hz-group">Debanding · CSS</p>

            <Row
              id="hz-dither-strength"
              label="Strength"
              value={`${state.ditherStrength}%`}
            >
              <input
                id="hz-dither-strength"
                className="hz-range"
                type="range"
                min={0}
                max={8}
                step={0.5}
                value={state.ditherStrength}
                onChange={(event) =>
                  patch({ ditherStrength: Number(event.target.value) })
                }
              />
            </Row>

            <Row id="hz-dither-blend" label="Blend" value={state.ditherBlend}>
              <select
                id="hz-dither-blend"
                className="hz-select"
                value={state.ditherBlend}
                onChange={(event) =>
                  patch({
                    ditherBlend: event.target.value as HorizonDitherBlend,
                  })
                }
              >
                {BLENDS.map((entry) => (
                  <option key={entry.value} value={entry.value}>
                    {entry.label}
                  </option>
                ))}
              </select>
            </Row>

            <Row id="hz-gradient" label="Gradient" value={state.gradient}>
              <select
                id="hz-gradient"
                className="hz-select"
                value={state.gradient}
                onChange={(event) =>
                  patch({
                    gradient: event.target.value as HorizonGradientMode,
                  })
                }
              >
                {GRADIENTS.map((entry) => (
                  <option key={entry.value} value={entry.value}>
                    {entry.label}
                  </option>
                ))}
              </select>
            </Row>

            <p className="hz-group">Debanding · WebGL</p>

            <Row
              id="hz-webgl-dither"
              label="Dither"
              value={`${state.webglDither} LSB`}
            >
              <input
                id="hz-webgl-dither"
                className="hz-range"
                type="range"
                min={0}
                max={2}
                step={0.1}
                value={state.webglDither}
                onChange={(event) =>
                  patch({ webglDither: Number(event.target.value) })
                }
              />
            </Row>

            <Row id="hz-webgl-dpr" label="DPR cap" value={`${state.webglDpr}×`}>
              <input
                id="hz-webgl-dpr"
                className="hz-range"
                type="range"
                min={1}
                max={2}
                step={0.25}
                value={state.webglDpr}
                onChange={(event) =>
                  patch({ webglDpr: Number(event.target.value) })
                }
              />
            </Row>

            <div className="hz-footer">
              <button type="button" className="hz-chip" onClick={reset}>
                Reset
              </button>
              <span className="hz-note">
                Tab hidden pauses · reduced motion → static
              </span>
            </div>
          </div>
        ) : null}
      </aside>
    </main>
  );
}
