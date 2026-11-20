"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import "./edge-blur-tuner.css";

/**
 * Temporary tuning panel for the homepage's edge blur. It writes the two root
 * tokens the bands read (`--edge-blur-height`, `--edge-blur-max`) straight onto
 * `<html>`, so a drag is visible immediately and the value on screen is the one
 * to copy into globals.css.
 *
 * Dev-only by default; `?tune` opts a production build in as well. The
 * `process.env.NODE_ENV` check is inlined at build time, so the server and the
 * first client render agree on it, and the query-string check waits for
 * hydration — no mismatch either way. Normal production visitors get nothing.
 */

const HEIGHT_DEFAULT = 64;
const PEAK_DEFAULT = 8;

const HEIGHT_MIN = 0;
const HEIGHT_MAX = 240;
const HEIGHT_STEP = 4;

const PEAK_MIN = 0;
const PEAK_MAX = 24;
const PEAK_STEP = 1;

/** False during SSR and hydration, true once the page is interactive. */
function subscribeToHydration(): () => void {
  return () => {};
}

function hasTuneParam(): boolean {
  return new URLSearchParams(window.location.search).has("tune");
}

type TunerRowProps = {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
};

function TunerRow({
  id,
  label,
  value,
  min,
  max,
  step,
  onChange,
}: TunerRowProps) {
  return (
    <div className="edge-blur-tuner-row">
      <label className="edge-blur-tuner-label" htmlFor={id}>
        {label}
      </label>
      <output className="edge-blur-tuner-value" htmlFor={id}>
        {value}px
      </output>
      <input
        id={id}
        className="edge-blur-tuner-range"
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

export function EdgeBlurTuner() {
  const dev = process.env.NODE_ENV !== "production";
  const hydrated = useSyncExternalStore(
    subscribeToHydration,
    () => true,
    () => false,
  );
  const [height, setHeight] = useState(HEIGHT_DEFAULT);
  const [peak, setPeak] = useState(PEAK_DEFAULT);

  // Production is opt-in through the URL. The hydration flag keeps the
  // server-rendered output (and the first client pass) empty either way.
  const enabled = dev || (hydrated && hasTuneParam());

  // Also writes the defaults on mount, so the sliders and the CSS can never
  // disagree after a remount. Skipped when the panel is off.
  useEffect(() => {
    if (!enabled) return;

    const root = document.documentElement;

    root.style.setProperty("--edge-blur-height", `${height}px`);
    root.style.setProperty("--edge-blur-max", `${peak}px`);
  }, [enabled, height, peak]);

  if (!enabled) return null;

  return (
    <aside className="edge-blur-tuner" aria-label="Viewport edge blur tuner">
      <p className="edge-blur-tuner-title">Edge blur</p>
      <TunerRow
        id="edge-blur-height"
        label="Band height"
        value={height}
        min={HEIGHT_MIN}
        max={HEIGHT_MAX}
        step={HEIGHT_STEP}
        onChange={setHeight}
      />
      <TunerRow
        id="edge-blur-peak"
        label="Peak blur"
        value={peak}
        min={PEAK_MIN}
        max={PEAK_MAX}
        step={PEAK_STEP}
        onChange={setPeak}
      />
      <p className="edge-blur-tuner-hint">
        Writes --edge-blur-height / --edge-blur-max on :root
      </p>
    </aside>
  );
}
