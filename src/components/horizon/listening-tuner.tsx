"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { HorizonListeningTuning } from "./horizon-background";
import {
  DEFAULT_LISTENING_STATE,
  IMMERSION_DEFAULT,
  IMMERSION_MAX,
  IMMERSION_STEP,
  LISTENING_BASE_DEFAULTS,
  LISTENING_PARAM_KEYS,
  LISTENING_PARAM_RANGES,
  effectiveListening,
  isTuningEnabled,
  listeningSnippet,
  loadStoredTuning,
  saveStoredTuning,
  setLiveListeningTuning,
  setListeningForced,
  useListeningForced,
} from "./listening-tuning";
import type {
  ListeningTuningParams,
  ListeningTuningState,
} from "./listening-tuning";

/**
 * The dev/prototype tuning panel.
 *
 * It is rendered only in dev, or when `?tune=1` is present in production. The
 * panel stores base values at Immersion 1 and shows the master-scaled live
 * value next to each slider; the shader reads the live object every frame, so
 * dragging never causes a React render in the canvas. Blur changes are picked
 * up by the shader and re-baked after a 200ms quiet period.
 */

const PARAM_LABELS: Record<keyof ListeningTuningParams, string> = {
  strength: "Strength boost",
  scale: "Scale",
  lift: "Lift",
  blur: "Blur factor",
  period: "Breathe period",
  amp: "Breathe amp",
  rampIn: "Ramp-in",
};

function formatParam(key: keyof ListeningTuningParams, value: number): string {
  switch (key) {
    case "lift":
      return `${value.toFixed(1)}%`;
    case "period":
    case "rampIn":
      return `${value.toFixed(1)}s`;
    case "blur":
      return `${value.toFixed(2)}x`;
    default:
      return value.toFixed(2);
  }
}

function effectiveParam(
  key: keyof ListeningTuningParams,
  effective: HorizonListeningTuning,
): number {
  switch (key) {
    case "strength":
      return effective.intensityBoost;
    case "scale":
      return effective.blobScale;
    case "lift":
      return effective.blobLift;
    case "blur":
      return effective.blurScale;
    case "period":
      return effective.breathePeriod;
    case "amp":
      return effective.intensityAmp;
    case "rampIn":
      return effective.inDuration;
  }
}

async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // LAN dev previews are not a secure context; use the textarea fallback.
  }

  try {
    const area = document.createElement("textarea");

    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.top = "0";
    area.style.left = "-9999px";
    document.body.appendChild(area);
    area.select();

    const copied = document.execCommand("copy");

    area.remove();
    return copied;
  } catch {
    return false;
  }
}

const subscribeToLocation = () => () => {};

export function ListeningTuner() {
  // The server renders nothing; after hydration the client snapshot opens the
  // panel in dev or with ?tune=1. useSyncExternalStore handles the hydration
  // hand-off without a mismatch.
  const enabled = useSyncExternalStore(
    subscribeToLocation,
    () =>
      isTuningEnabled(
        window.location.search,
        process.env.NODE_ENV !== "production",
      ),
    () => false,
  );
  const [open, setOpen] = useState(true);
  const [state, setState] = useState<ListeningTuningState>(() => {
    if (typeof window === "undefined") return DEFAULT_LISTENING_STATE;

    return loadStoredTuning() ?? DEFAULT_LISTENING_STATE;
  });
  const [copied, setCopied] = useState("");
  const forced = useListeningForced();
  const copyTimer = useRef<number | null>(null);
  const effective = effectiveListening(state);

  useEffect(() => {
    if (!enabled) return;

    setLiveListeningTuning(effectiveListening(state));
    saveStoredTuning(state);
  }, [enabled, state]);

  useEffect(() => {
    return () => setLiveListeningTuning(null);
  }, []);

  useEffect(() => {
    return () => {
      if (copyTimer.current !== null) window.clearTimeout(copyTimer.current);
    };
  }, []);

  if (!enabled) return null;

  const updateParam = (key: keyof ListeningTuningParams, value: number) => {
    setState((previous) => ({
      ...previous,
      params: { ...previous.params, [key]: value },
    }));
  };

  const onCopy = async () => {
    const ok = await copyText(listeningSnippet(effective));

    setCopied(ok ? "Copied" : "Copy failed");

    if (copyTimer.current !== null) window.clearTimeout(copyTimer.current);

    copyTimer.current = window.setTimeout(() => {
      setCopied("");
      copyTimer.current = null;
    }, 2000);
  };

  const onReset = () => {
    setState({
      immersion: IMMERSION_DEFAULT,
      params: { ...LISTENING_BASE_DEFAULTS },
    });
    setCopied("");
  };

  return (
    <section
      aria-label="Horizon tuning"
      className="fixed bottom-20 z-[80] max-h-[calc(100vh-7rem)] w-[min(360px,calc(100vw-2rem))] overflow-y-auto rounded-xl border border-outline-variant bg-surface-container-high p-4 text-base text-on-surface shadow-2xl"
      style={{ right: "var(--horizon-tuner-right, 1rem)" }}
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold">Horizon tuning</h2>
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-controls="horizon-tune-body"
          className="rounded-md border border-outline-variant px-2 py-1 text-base hover:bg-surface-container-highest"
        >
          {open ? "Hide" : "Show"}
        </button>
      </div>

      {open ? (
        <div id="horizon-tune-body" className="mt-3 space-y-4">
          <div>
            <div className="flex items-center justify-between gap-3">
              <label
                htmlFor="horizon-tune-immersion"
                className="text-base font-medium"
              >
                Immersion
              </label>
              <output
                htmlFor="horizon-tune-immersion"
                className="tabular-nums text-base"
              >
                {state.immersion.toFixed(2)}
              </output>
            </div>
            <input
              id="horizon-tune-immersion"
              type="range"
              min={0}
              max={IMMERSION_MAX}
              step={IMMERSION_STEP}
              value={state.immersion}
              onChange={(event) =>
                setState((previous) => ({
                  ...previous,
                  immersion: Number(event.target.value),
                }))
              }
              aria-valuetext={`${state.immersion.toFixed(2)} of ${IMMERSION_MAX}`}
              className="mt-2 w-full accent-[var(--primary)]"
            />
            <p className="mt-1 text-base text-on-surface-variant">
              Scales every listening delta from the resting horizon. Left
              numbers are the base at Immersion 1; right numbers are live. Blur
              re-bakes 200ms after you stop.
            </p>
          </div>

          <details className="rounded-md border border-outline-variant p-3">
            <summary className="cursor-pointer text-base font-medium">
              Per-parameter sliders
            </summary>
            <div className="mt-3 space-y-4">
              {LISTENING_PARAM_KEYS.map((key) => {
                const range = LISTENING_PARAM_RANGES[key];
                const base = state.params[key];
                const live = effectiveParam(key, effective);
                const id = `horizon-tune-${key}`;
                const label = PARAM_LABELS[key];

                return (
                  <div key={key}>
                    <div className="flex items-center justify-between gap-3">
                      <label htmlFor={id} className="text-base">
                        {label}
                      </label>
                      <span className="tabular-nums text-base text-on-surface-variant">
                        {formatParam(key, base)}{" "}
                        <span aria-hidden="true">→</span>{" "}
                        <span className="text-on-surface">
                          {formatParam(key, live)}
                        </span>
                      </span>
                    </div>
                    <input
                      id={id}
                      type="range"
                      min={range.min}
                      max={range.max}
                      step={range.step}
                      value={base}
                      onChange={(event) =>
                        updateParam(key, Number(event.target.value))
                      }
                      aria-valuetext={`${formatParam(key, live)} live, ${formatParam(key, base)} base`}
                      className="mt-2 w-full accent-[var(--primary)]"
                    />
                  </div>
                );
              })}
            </div>
          </details>

          <label className="flex items-center gap-2 text-base">
            <input
              type="checkbox"
              checked={forced}
              onChange={(event) => setListeningForced(event.target.checked)}
              className="size-4"
            />
            Force listening
          </label>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onCopy}
              className="rounded-md border border-outline-variant px-3 py-2 text-base font-medium hover:bg-surface-container-highest"
            >
              Copy values
            </button>
            <button
              type="button"
              onClick={onReset}
              className="rounded-md border border-outline-variant px-3 py-2 text-base font-medium hover:bg-surface-container-highest"
            >
              Reset
            </button>
          </div>

          <span
            role="status"
            aria-live="polite"
            className="block min-h-6 text-base text-on-surface-variant"
          >
            {copied}
          </span>
        </div>
      ) : null}
    </section>
  );
}
