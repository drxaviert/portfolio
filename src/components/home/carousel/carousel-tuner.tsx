"use client";

import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { DEFAULT_BLUR } from "./blur-mode";
import { DEFAULT_HOVER_PEEK } from "./hover-peek";
import type { HoverPeekSettings } from "./hover-peek";
import type { BlurMode, BlurSettings } from "./blur-mode";
import { EASE_OPTIONS, easeSpec, parseBezier } from "./carousel-math";
import type { Bezier, EaseKey } from "./carousel-math";

export type CarouselSettings = BlurSettings &
  HoverPeekSettings & {
    duration: number;
    ease: EaseKey;
    /** Free cubic-bezier, used when `ease` is "custom". */
    custom: Bezier;
    /** Eased progress at which the title starts fading in, and how long it takes. */
    titleStart: number;
    titleSpan: number;
  };

export const DEFAULT_SETTINGS: CarouselSettings = {
  duration: 900,
  ease: "smooth",
  custom: [0.5, 0, 0.1, 1],
  titleStart: 0.75,
  titleSpan: 0.2,
  ...DEFAULT_BLUR,
  ...DEFAULT_HOVER_PEEK,
};

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

type NumberKey =
  | "duration"
  | "titleStart"
  | "titleSpan"
  | "edgeWidth"
  | "edgeBlur"
  | "motionPeak"
  | keyof HoverPeekSettings;

/**
 * Dev tuner, mounted only at `/?tune=1`. Values apply to the next step; Copy
 * puts them on the clipboard as JSON for the decision.
 */
export function CarouselTuner({
  settings,
  blurMode,
  onChange,
}: {
  settings: CarouselSettings;
  blurMode: BlurMode;
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
    const values = { ...settings, easing: resolved, blur: blurMode };

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
          style={bezierValid ? undefined : { outline: "1px solid #f66" }}
        />
      </label>
      {slider("titleStart", "Title in at", " of step", 0, 1, 0.05)}
      {slider("titleSpan", "Title fade span", "", 0.05, 0.6, 0.05)}
      <strong style={{ color: "#fff" }}>Blur: ?blur={blurMode}</strong>
      {slider("edgeWidth", "Edge width", "px", 8, 64, 2)}
      {slider("edgeBlur", "Edge blur", "px", 0, 12, 0.5)}
      {slider("motionPeak", "Motion blur peak", "px", 0, 8, 0.5)}
      <strong style={{ color: "#fff" }}>Hover peek (whole row)</strong>
      {slider("hoverPeek", "Peek width", "px", 8, 40, 1)}
      {slider("hoverGap", "Peek gap", "px", 4, 24, 1)}
      {slider("hoverZone", "Hover zone", "px", 20, 120, 2)}
      {slider("revealMs", "Reveal", "ms", 100, 600, 10)}
      {slider("retractMs", "Retract", "ms", 100, 600, 10)}
      {slider("leaveMs", "Leave delay", "ms", 0, 400, 10)}
      {slider("hoverBlur", "Peek blur", "px", 0, 12, 0.5)}
      {slider("hoverFade", "Peek edge fade", "", 0, 1, 0.05)}
      {slider("hoverBlurOn", "Peek blur on hover", "px", 0, 12, 0.5)}
      <button type="button" onClick={copy}>
        {copied ? "Copied" : "Copy values"}
      </button>
    </div>
  );
}
