"use client";

import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import type { HoverPeekSettings } from "./hover-peek";
import type { CarouselSettings } from "./carousel-settings";
import { EASE_OPTIONS, easeSpec, parseBezier } from "./carousel-math";
import type { EaseKey } from "./carousel-math";

const PANEL: CSSProperties = {
  position: "fixed",
  right: 16,
  bottom: 16,
  zIndex: 2147483646,
  display: "flex",
  flexDirection: "column",
  gap: 8,
  width: 244,
  maxHeight: "calc(100dvh - 32px)",
  overflowY: "auto",
  padding: 12,
  borderRadius: 14,
  background: "rgba(10, 10, 10, 0.86)",
  color: "rgba(255, 255, 255, 0.7)",
  font: "11px/1.35 system-ui, sans-serif",
  boxShadow:
    "0 0 0 1px rgba(255,255,255,0.08) inset, 0 8px 24px rgba(0,0,0,0.3)",
};

const FIELD: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 2,
};

/* Controls keep the panel's 11px labels, but their own text is 16px: Mobile
   Safari zooms the page when a focused input's text is smaller than that. */
const CONTROL: CSSProperties = {
  fontSize: 16,
  lineHeight: 1.25,
};

type NumberKey =
  | "duration"
  | "edgeWidth"
  | "edgeBlur"
  | keyof Pick<
      HoverPeekSettings,
      | "hoverZone"
      | "hoverOutside"
      | "revealMs"
      | "retractMs"
      | "leaveMs"
      | "peekBlurRamp"
      | "peekBlurMax"
      | "peekFade"
    >;

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
  const [bezierText, setBezierText] = useState(settings.custom.join(", "));
  const timer = useRef<number | null>(null);
  const bezierValid = parseBezier(bezierText) !== null;

  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    },
    [],
  );

  function copy() {
    const resolved = easeSpec(settings.ease, settings.custom).css;
    const values = { ...settings, easing: resolved };

    void navigator.clipboard?.writeText(JSON.stringify(values, null, 2));
    setCopied(true);
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopied(false), 1200);
  }

  const slider = (
    key: NumberKey,
    label: string,
    unit: string,
    min: number,
    max: number,
    step: number,
  ) => (
    <label style={FIELD}>
      <span>
        {label}: {settings[key]}
        {unit}
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={settings[key]}
        onChange={(event) => onChange({ [key]: Number(event.target.value) })}
      />
    </label>
  );

  return (
    <div role="group" aria-label="Carousel tuner" style={PANEL}>
      <strong style={{ color: "#fff", fontSize: 13 }}>Carousel tuner</strong>
      {slider("duration", "Duration", "ms", 200, 2500, 50)}
      <label style={FIELD}>
        <span>Easing</span>
        <select
          value={settings.ease}
          onChange={(event) =>
            onChange({ ease: event.target.value as EaseKey })
          }
          style={CONTROL}
        >
          {EASE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <label style={FIELD}>
        <span>Custom cubic-bezier (x1, y1, x2, y2)</span>
        <input
          type="text"
          value={bezierText}
          aria-invalid={!bezierValid}
          onChange={(event) => {
            setBezierText(event.target.value);
            const parsed = parseBezier(event.target.value);
            if (parsed) onChange({ custom: parsed, ease: "custom" });
          }}
          style={
            bezierValid ? CONTROL : { ...CONTROL, outline: "1px solid #f66" }
          }
        />
      </label>
      <strong style={{ color: "#fff" }}>Edge</strong>
      {slider("edgeWidth", "Edge mask width", "px", 8, 64, 2)}
      {slider("edgeBlur", "Edge blur", "px", 0, 12, 0.5)}
      <strong style={{ color: "#fff" }}>Hover peek (one-column shift)</strong>
      {slider("hoverZone", "Hover zone inside", "px", 8, 120, 2)}
      {slider("hoverOutside", "Hover zone outside", "px", 0, 120, 2)}
      {slider("revealMs", "Reveal", "ms", 100, 600, 10)}
      {slider("retractMs", "Retract", "ms", 100, 600, 10)}
      {slider("leaveMs", "Leave delay", "ms", 0, 400, 10)}
      {slider("peekBlurRamp", "Peek blur width", "%", 10, 100, 5)}
      {slider("peekBlurMax", "Peek blur max", "px", 0, 12, 0.5)}
      {slider("peekFade", "Peek fade width", "%", 10, 60, 5)}
      <button type="button" onClick={copy}>
        {copied ? "Copied" : "Copy values"}
      </button>
    </div>
  );
}
