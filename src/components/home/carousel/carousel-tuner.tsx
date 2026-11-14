"use client";

import { useEffect, useRef, useState } from "react";
import { EASE_OPTIONS } from "./carousel-math";
import type { EaseKey } from "./carousel-math";

export type CarouselSettings = {
  duration: number;
  ease: EaseKey;
  titleDuration: number;
  titleDelay: number;
};

export const DEFAULT_SETTINGS: CarouselSettings = {
  duration: 1000,
  ease: "expo",
  titleDuration: 260,
  titleDelay: 420,
};

const PANEL: React.CSSProperties = {
  position: "fixed",
  right: 16,
  bottom: 16,
  zIndex: 2147483646,
  display: "flex",
  flexDirection: "column",
  gap: 8,
  width: 232,
  padding: 12,
  borderRadius: 14,
  background: "rgba(10, 10, 10, 0.86)",
  color: "rgba(255, 255, 255, 0.7)",
  font: "11px/1.35 system-ui, sans-serif",
  boxShadow:
    "0 0 0 1px rgba(255,255,255,0.08) inset, 0 8px 24px rgba(0,0,0,0.3)",
};

const FIELD: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 2,
};

/**
 * Dev tuner, mounted only at `/?tune=1`. Values apply to the next step; Copy
 * puts them on the clipboard as JSON for the decision.
 */
export function CarouselTuner({
  settings,
  onChange,
}: {
  settings: CarouselSettings;
  onChange: (patch: Partial<CarouselSettings>) => void;
}) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    },
    [],
  );

  function copy() {
    void navigator.clipboard?.writeText(JSON.stringify(settings, null, 2));
    setCopied(true);
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopied(false), 1200);
  }

  const number = (
    key: "duration" | "titleDuration" | "titleDelay",
    label: string,
    max: number,
  ) => (
    <label style={FIELD}>
      <span>
        {label}: {settings[key]}ms
      </span>
      <input
        type="range"
        min={0}
        max={max}
        step={10}
        value={settings[key]}
        onChange={(event) => onChange({ [key]: Number(event.target.value) })}
      />
    </label>
  );

  return (
    <div role="group" aria-label="Carousel tuner" style={PANEL}>
      <strong style={{ color: "#fff", fontSize: 13 }}>Carousel tuner</strong>
      {number("duration", "Duration", 2500)}
      <label style={FIELD}>
        <span>Easing</span>
        <select
          value={settings.ease}
          onChange={(event) =>
            onChange({ ease: event.target.value as EaseKey })
          }
        >
          {EASE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      {number("titleDuration", "Title fade", 1000)}
      {number("titleDelay", "Title delay", 1500)}
      <button type="button" onClick={copy}>
        {copied ? "Copied" : "Copy values"}
      </button>
    </div>
  );
}
