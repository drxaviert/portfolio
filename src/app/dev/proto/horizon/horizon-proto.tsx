"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  HORIZON_MOTION_DEFAULTS,
  HorizonBackground,
} from "@/components/horizon/horizon-background";
import type {
  HorizonMotionTuning,
  HorizonMotionVariant,
} from "@/components/horizon/horizon-background";
import { pinPhase, unpinPhase } from "@/lib/theme";
import type { Phase } from "@/lib/theme";

const STORAGE_KEY = "horizon-ambient:v1";

const VARIANTS: { value: HorizonMotionVariant; label: string }[] = [
  { value: "none", label: "Static" },
  { value: "drift", label: "Drift" },
  { value: "breathe", label: "Breathe" },
  { value: "drift-breathe", label: "Drift + Breathe" },
];

const PHASES: Phase[] = ["dawn", "day", "dusk", "night"];

type ProtoState = {
  variant: HorizonMotionVariant;
  tuning: HorizonMotionTuning;
};

const DEFAULT_STATE: ProtoState = {
  variant: "drift-breathe",
  tuning: HORIZON_MOTION_DEFAULTS,
};

/** Drift keeps the Figma ratio: 1.5% across for every 1% down. */
const DRIFT_TRAVEL_RATIO = 1.5;

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
    };
    const variant = VARIANTS.find(
      (entry) => entry.value === parsed?.variant,
    )?.value;
    const tuning = parsed?.tuning ?? {};

    return {
      variant: variant ?? DEFAULT_STATE.variant,
      tuning: {
        driftPeriod: clamp(
          numberOr(tuning.driftPeriod, HORIZON_MOTION_DEFAULTS.driftPeriod),
          30,
          240,
        ),
        driftTravelX: clamp(
          numberOr(tuning.driftTravelX, HORIZON_MOTION_DEFAULTS.driftTravelX),
          0,
          5,
        ),
        driftTravelY: clamp(
          numberOr(tuning.driftTravelY, HORIZON_MOTION_DEFAULTS.driftTravelY),
          0,
          3.4,
        ),
        breathePeriod: clamp(
          numberOr(tuning.breathePeriod, HORIZON_MOTION_DEFAULTS.breathePeriod),
          6,
          40,
        ),
        breatheScale: clamp(
          numberOr(tuning.breatheScale, HORIZON_MOTION_DEFAULTS.breatheScale),
          0,
          6,
        ),
        breatheDepth: clamp(
          numberOr(tuning.breatheDepth, HORIZON_MOTION_DEFAULTS.breatheDepth),
          0,
          30,
        ),
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
  const [phase, setPhase] = useState<Phase | null>(null);
  const [copied, setCopied] = useState(false);
  const copyTimer = useRef<number | null>(null);

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

  // Pin the phase on <html>; ThemeProvider's clock leaves a pinned phase alone.
  useEffect(() => {
    if (phase) pinPhase(phase);
  }, [phase]);

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
  const breatheOn =
    state.variant === "breathe" || state.variant === "drift-breathe";
  const tuning = { ...HORIZON_MOTION_DEFAULTS, ...state.tuning };
  const variantLabel =
    VARIANTS.find((entry) => entry.value === state.variant)?.label ?? "Static";

  const summary = [
    `/dev/proto/horizon · variant: ${state.variant}`,
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
    setState({ ...DEFAULT_STATE, tuning: HORIZON_MOTION_DEFAULTS });
  }

  return (
    <main className="relative flex min-h-dvh flex-col overflow-hidden bg-surface text-on-surface">
      <HorizonBackground
        position="fixed"
        motion={state.variant}
        tuning={tuning}
      />

      <header className="hz-head">
        <p className="hz-kicker">Dev prototype · not shipped</p>
        <h1 className="hz-title">Horizon ambient</h1>
        <p className="hz-sub" data-hz-variant={state.variant}>
          {variantLabel} · {tuning.driftPeriod}s drift · {tuning.breathePeriod}s
          breathe
        </p>
      </header>

      <aside
        className="hz-panel"
        aria-label="Ambient controls"
        data-open={open}
      >
        <header className="hz-panel-head">
          <div>
            <p className="hz-panel-title">Ambient glow</p>
            <p className="hz-panel-axis">transform + opacity only</p>
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

            <div className="hz-phases" role="group" aria-label="Phase preview">
              {PHASES.map((entry) => (
                <button
                  key={entry}
                  type="button"
                  className="hz-variant hz-phase"
                  data-active={phase === entry ? "" : undefined}
                  aria-pressed={phase === entry}
                  onClick={() => setPhase(entry)}
                >
                  {entry}
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
                min={30}
                max={240}
                step={5}
                value={tuning.driftPeriod}
                onChange={(event) =>
                  patchTuning({ driftPeriod: Number(event.target.value) })
                }
              />
            </Row>

            <Row
              id="hz-drift-travel"
              label="Travel"
              value={`${tuning.driftTravelX}% x · ${tuning.driftTravelY}% y`}
            >
              <input
                id="hz-drift-travel"
                className="hz-range"
                type="range"
                min={0}
                max={5}
                step={0.1}
                value={tuning.driftTravelX}
                onChange={(event) => {
                  const travelX = Number(event.target.value);

                  patchTuning({
                    driftTravelX: travelX,
                    driftTravelY:
                      Math.round((travelX / DRIFT_TRAVEL_RATIO) * 100) / 100,
                  });
                }}
              />
            </Row>

            <p className="hz-group" data-off={breatheOn ? undefined : ""}>
              Breathe <span>{breatheOn ? "on" : "off"}</span>
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
                min={6}
                max={40}
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
              value={`1.0 → ${(1 + tuning.breatheScale / 100).toFixed(2)}`}
            >
              <input
                id="hz-breathe-scale"
                className="hz-range"
                type="range"
                min={0}
                max={6}
                step={0.5}
                value={tuning.breatheScale}
                onChange={(event) =>
                  patchTuning({ breatheScale: Number(event.target.value) })
                }
              />
            </Row>

            <Row
              id="hz-breathe-depth"
              label="Opacity depth"
              value={`1 → ${(1 - tuning.breatheDepth / 100).toFixed(2)}`}
            >
              <input
                id="hz-breathe-depth"
                className="hz-range"
                type="range"
                min={0}
                max={30}
                step={1}
                value={tuning.breatheDepth}
                onChange={(event) =>
                  patchTuning({ breatheDepth: Number(event.target.value) })
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
