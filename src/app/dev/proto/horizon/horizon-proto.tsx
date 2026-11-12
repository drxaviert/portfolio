"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { HomeLayout } from "@/components/home/home-layout";
import { HorizonBackground } from "@/components/horizon/horizon-background";
import {
  HORIZON_HOME_DITHER,
  HORIZON_HOME_DITHER_LSB,
  HORIZON_HOME_DPR_CAP,
  HORIZON_HOME_GRADIENT,
  HORIZON_HOME_MOTION,
} from "@/components/horizon/horizon-preset";
import { HorizonShader } from "@/components/horizon/horizon-shader";
import type { HorizonIntensityPeak } from "@/components/horizon/horizon-intensity";
import type {
  HorizonMotionTuning,
  HorizonMotionVariant,
} from "@/components/horizon/horizon-background";
import { pinPhase, unpinPhase } from "@/lib/theme";

/**
 * Live tuner for the glow's rest strength and the breathe pulse.
 *
 * The real home layout renders on top of the same HorizonBackground /
 * HorizonShader the page ships, so the glow is judged against the actual cards,
 * nav and theme toggle. The panel floats bottom-right and starts closed; it
 * never sits in the content column at 1440.
 *
 * Values persist for the session in localStorage; "Copy values" prints the
 * preset lines to hand back. Nothing in this route ships.
 */

const STORAGE_KEY = "horizon-ambient:v2";

const VARIANTS: { value: HorizonMotionVariant; label: string }[] = [
  { value: "none", label: "Static" },
  { value: "drift", label: "Drift" },
  { value: "breathe", label: "Breathe" },
  { value: "drift-breathe", label: "Drift + Breathe" },
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
};

/**
 * Opens on the shipped preset with the rest strength boosted, because at the
 * Figma alpha the pulse is invisible. Day is the user's "boost glow" ×4; Night
 * is softer at ×2.5. Production keeps 1 until the user picks.
 */
const PROTO_TUNING: Required<HorizonMotionTuning> = {
  ...HORIZON_HOME_MOTION,
  baseIntensity: 4,
  nightBaseIntensity: 2.5,
  /** Visible from first paint so the pulse can be judged against the boost. */
  intensityAmp: 0.3,
};

const DEFAULT_STATE: ProtoState = {
  variant: "drift-breathe",
  tuning: PROTO_TUNING,
  renderer: "css",
  theme: "auto",
};

/** The slider-driven motion fields only; strength and pulse have their own. */
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

const BASE_RANGE = { min: 1, max: 8 };
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
    };
    const variant = VARIANTS.find(
      (entry) => entry.value === parsed?.variant,
    )?.value;
    const tuning = parsed?.tuning ?? {};
    const renderer = RENDERERS.find(
      (entry) => entry.value === parsed?.renderer,
    )?.value;
    const theme = THEMES.find((entry) => entry.value === parsed?.theme)?.value;
    const motion = (key: SliderKey) =>
      clamp(
        numberOr(tuning[key], PROTO_TUNING[key]),
        TUNING_RANGE[key].min,
        TUNING_RANGE[key].max,
      );

    return {
      variant: variant ?? DEFAULT_STATE.variant,
      renderer: renderer ?? DEFAULT_STATE.renderer,
      theme: theme ?? DEFAULT_STATE.theme,
      tuning: {
        driftPeriod: motion("driftPeriod"),
        driftTravelX: motion("driftTravelX"),
        driftTravelY: motion("driftTravelY"),
        breathePeriod: motion("breathePeriod"),
        breatheScale: motion("breatheScale"),
        breatheDepth: motion("breatheDepth"),
        baseIntensity: clamp(
          numberOr(tuning.baseIntensity, PROTO_TUNING.baseIntensity),
          BASE_RANGE.min,
          BASE_RANGE.max,
        ),
        nightBaseIntensity: clamp(
          numberOr(tuning.nightBaseIntensity, PROTO_TUNING.nightBaseIntensity),
          BASE_RANGE.min,
          BASE_RANGE.max,
        ),
        intensityAmp: clamp(
          numberOr(tuning.intensityAmp, PROTO_TUNING.intensityAmp),
          AMP_RANGE.min,
          AMP_RANGE.max,
        ),
        nightIntensityScale: clamp(
          numberOr(tuning.nightIntensityScale, PROTO_TUNING.nightIntensityScale),
          NIGHT_SCALE_RANGE.min,
          NIGHT_SCALE_RANGE.max,
        ),
        intensityPeak:
          PEAKS.find((entry) => entry.value === tuning.intensityPeak)?.value ??
          PROTO_TUNING.intensityPeak,
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
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [webglFailed, setWebglFailed] = useState(false);
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

  const tuning = { ...PROTO_TUNING, ...state.tuning };
  const driftOn =
    state.variant === "drift" || state.variant === "drift-breathe";
  const breathes = state.variant === "breathe" || state.variant === "drift-breathe";
  const pulseOn = breathes && tuning.intensityAmp > 0;

  const summary = [
    `/dev/proto/horizon · renderer: ${state.renderer} · variant: ${state.variant} · theme: ${state.theme}${resolvedPhase ? ` (${resolvedPhase})` : ""}`,
    `base: day ×${tuning.baseIntensity.toFixed(2)} · night ×${tuning.nightBaseIntensity.toFixed(2)}`,
    `pulse: amp ${tuning.intensityAmp.toFixed(2)} · night scale ×${tuning.nightIntensityScale.toFixed(2)} · peak ${tuning.intensityPeak}`,
    `drift: ${tuning.driftPeriod}s · travel ${tuning.driftTravelX}% x / ${tuning.driftTravelY}% y`,
    `breathe: ${tuning.breathePeriod}s · scale ${(1 + tuning.breatheScale / 100).toFixed(2)} · opacity 1 → ${(1 - tuning.breatheDepth / 100).toFixed(2)}`,
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
    setState({ ...DEFAULT_STATE, tuning: PROTO_TUNING });
    setWebglFailed(false);
  }

  const glow = (
    <>
      <HorizonBackground
        position="fixed"
        motion={state.variant}
        tuning={tuning}
        dither={HORIZON_HOME_DITHER}
        gradient={HORIZON_HOME_GRADIENT}
      />
      {state.renderer === "webgl" ? (
        <HorizonShader
          motion={state.variant}
          tuning={tuning}
          ditherLsb={HORIZON_HOME_DITHER_LSB}
          dprCap={HORIZON_HOME_DPR_CAP}
          onFallback={() => {
            setWebglFailed(true);
            patch({ renderer: "css" });
          }}
        />
      ) : null}
    </>
  );

  return (
    <>
      <HomeLayout horizon={glow} />

      {open ? (
        <aside className="hz-panel" aria-label="Glow controls">
          <header className="hz-panel-head">
            <div>
              <p className="hz-panel-title">Horizon glow</p>
              <p className="hz-panel-axis">
                strength · pulse · {resolvedPhase ?? "…"} phase
              </p>
            </div>
            <div className="hz-panel-actions">
              <button
                type="button"
                className="hz-chip"
                onClick={copyValues}
                title={summary}
              >
                {copied ? "Copied" : "Copy values"}
              </button>
              <button
                type="button"
                className="hz-icon"
                aria-expanded={true}
                aria-label="Hide controls"
                onClick={() => setOpen(false)}
              >
                –
              </button>
            </div>
          </header>

          <div className="hz-panel-body">
            <p className="hz-group">
              Base strength <span>rest alpha</span>
            </p>

            <Row
              id="hz-base-intensity"
              label="Day"
              value={`×${tuning.baseIntensity.toFixed(2)}`}
            >
              <input
                id="hz-base-intensity"
                className="hz-range"
                type="range"
                {...BASE_RANGE}
                step={0.25}
                value={tuning.baseIntensity}
                onChange={(event) =>
                  patchTuning({ baseIntensity: Number(event.target.value) })
                }
              />
            </Row>

            <Row
              id="hz-night-base-intensity"
              label="Night"
              value={`×${tuning.nightBaseIntensity.toFixed(2)}`}
            >
              <input
                id="hz-night-base-intensity"
                className="hz-range"
                type="range"
                {...BASE_RANGE}
                step={0.25}
                value={tuning.nightBaseIntensity}
                onChange={(event) =>
                  patchTuning({
                    nightBaseIntensity: Number(event.target.value),
                  })
                }
              />
            </Row>

            <p className="hz-group" data-off={breathes ? undefined : ""}>
              Pulse <span>{pulseOn ? `${tuning.intensityAmp.toFixed(2)} amp` : "off"}</span>
            </p>

            <div
              className="hz-variants hz-presets"
              role="group"
              aria-label="Pulse preset"
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
              aria-label="Pulse peak"
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
              swells.
            </p>

            <p className="hz-group">Motion</p>

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

            <p className="hz-group" data-off={breathes ? undefined : ""}>
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
              </p>
            ) : null}

            <div className="hz-footer">
              <button type="button" className="hz-chip" onClick={reset}>
                Reset
              </button>
              <span className="hz-note">
                Tab hidden pauses · reduced motion → static
              </span>
            </div>
          </div>
        </aside>
      ) : (
        <button
          type="button"
          className="hz-fab"
          aria-expanded={false}
          aria-label="Open glow controls"
          onClick={() => setOpen(true)}
        >
          <span className="hz-fab-label">Glow</span>
          <span className="hz-fab-value">
            ×{tuning.baseIntensity.toFixed(2)} / ×
            {tuning.nightBaseIntensity.toFixed(2)}
          </span>
          <span className="hz-fab-note">
            amp {tuning.intensityAmp.toFixed(2)} · {state.renderer}
          </span>
        </button>
      )}
    </>
  );
}
