"use client";

import { useEffect, useState } from "react";
import {
  SKY_NUMERIC_KEYS,
  SKY_PHASES,
  SKY_TUNING_DEFAULTS,
  SKY_TUNING_RANGES,
} from "./cosmic-sky";
import type { SkyNumericKey, SkyPhaseOverride, SkyTuning } from "./cosmic-sky";
import {
  loadStoredSkyTuning,
  saveStoredSkyTuning,
  setSkyTuning,
} from "./sky-tuning";

const LABELS: Record<SkyNumericKey, string> = {
  starDensity: "Star density",
  starBrightness: "Star brightness",
  auroraOpacity: "Aurora opacity",
  auroraSpeed: "Aurora speed",
  blurMin: "Aurora blur at the hem (px)",
  blurMax: "Aurora blur at the top (px)",
  blurCurve: "Aurora blur curve",
  gainBass: "Bass gain (aurora sway)",
  gainMid: "Mid gain (twinkle, aurora glow)",
  gainHigh: "High gain (shimmer)",
  gainEnergy: "Energy gain (overall lift)",
};

/**
 * The cosmic sky's controls inside the `?tune=1` panel. It writes the live sky
 * store the canvas reads every frame, so dragging never re-renders the sky.
 */
export function SkyTunerSection() {
  const [state, setState] = useState<SkyTuning>(SKY_TUNING_DEFAULTS);

  useEffect(() => {
    // Hydrate after mount so the server and first client render agree.
    const stored = loadStoredSkyTuning();

    setState(stored);
    setSkyTuning(stored);

    return () => setSkyTuning(SKY_TUNING_DEFAULTS);
  }, []);

  const update = (patch: Partial<SkyTuning>) => {
    setState((previous) => {
      const next = { ...previous, ...patch };

      setSkyTuning(next);
      saveStoredSkyTuning(next);
      return next;
    });
  };

  return (
    <details className="rounded-md border border-outline-variant p-3">
      <summary className="cursor-pointer text-base font-medium">
        Cosmic sky (stars / aurora)
      </summary>
      <div className="mt-3 space-y-4">
        <div>
          <label htmlFor="sky-tune-phase" className="text-base">
            Phase override
          </label>
          <select
            id="sky-tune-phase"
            value={state.phaseOverride}
            onChange={(event) =>
              update({ phaseOverride: event.target.value as SkyPhaseOverride })
            }
            className="mt-1 block w-full rounded-md border border-outline-variant bg-surface px-2 py-1 text-base"
          >
            <option value="auto">Follow the page phase</option>
            {SKY_PHASES.map((phase) => (
              <option key={phase} value={phase}>
                {phase}
              </option>
            ))}
          </select>
        </div>

        {SKY_NUMERIC_KEYS.map((key) => {
          const range = SKY_TUNING_RANGES[key];
          const id = `sky-tune-${key}`;

          return (
            <div key={key}>
              <div className="flex items-center justify-between gap-3">
                <label htmlFor={id} className="text-base">
                  {LABELS[key]}
                </label>
                <span className="tabular-nums text-base text-on-surface-variant">
                  {state[key].toFixed(2)}
                </span>
              </div>
              <input
                id={id}
                type="range"
                min={range.min}
                max={range.max}
                step={range.step}
                value={state[key]}
                onChange={(event) =>
                  update({ [key]: Number(event.target.value) })
                }
                className="mt-2 w-full accent-[var(--primary)]"
              />
            </div>
          );
        })}

        <button
          type="button"
          onClick={() => update({ ...SKY_TUNING_DEFAULTS })}
          className="rounded-md border border-outline-variant px-3 py-2 text-base font-medium hover:bg-surface-container-highest"
        >
          Reset sky
        </button>
      </div>
    </details>
  );
}
