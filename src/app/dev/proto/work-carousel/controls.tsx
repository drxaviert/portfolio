"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { PANEL_CSS } from "./panel-css";

export type EaseKey = "stripe" | "quint" | "quart" | "soft" | "inout";

export const EASE_CURVES = {
  stripe: [0.16, 1, 0.3, 1],
  quint: [0.23, 1, 0.32, 1],
  quart: [0.165, 0.84, 0.44, 1],
  soft: [0.32, 0.72, 0, 1],
  inout: [0.77, 0, 0.175, 1],
} satisfies Record<EaseKey, [number, number, number, number]>;

export const EASE_OPTIONS: { value: EaseKey; label: string }[] = [
  { value: "stripe", label: "Stripe easeOutExpo (0.16, 1, 0.3, 1)" },
  { value: "quint", label: "ease-out quint (0.23, 1, 0.32, 1)" },
  { value: "quart", label: "ease-out quart (0.165, 0.84, 0.44, 1)" },
  { value: "soft", label: "soft ease-out (0.32, 0.72, 0, 1)" },
  { value: "inout", label: "ease-in-out quart (0.77, 0, 0.175, 1)" },
];

export type Settings = {
  duration: number;
  ease: EaseKey;
  /** Featured card width as a multiple of the row height (16/9 = 1.778). */
  ratio: number;
  weights: [number, number, number];
  slivers: boolean;
  gap: number;
  /** Mobile stack only: how far each card sits over the one below it. */
  overlap: number;
};

export const DEFAULT_SETTINGS: Settings = {
  duration: 1000,
  ease: "stripe",
  ratio: 1.778,
  weights: [0.61, 0.3, 0.15],
  slivers: true,
  gap: 12,
  overlap: 8,
};

const PHASES = ["dawn", "day", "dusk", "night"] as const;
type Phase = (typeof PHASES)[number];

const PRESETS: { label: string; duration: number }[] = [
  { label: "Stripe 1000ms", duration: 1000 },
  { label: "Subtle 200ms", duration: 200 },
];

function Row({
  id,
  label,
  value,
  children,
}: {
  id: string;
  label: string;
  value: string;
  children: ReactNode;
}) {
  return (
    <div className="wc-panel-row">
      <label className="wc-panel-label" htmlFor={id}>
        {label}
      </label>
      <output className="wc-panel-value" htmlFor={id}>
        {value}
      </output>
      {children}
    </div>
  );
}

export function Controls({
  settings,
  onChange,
}: {
  settings: Settings;
  onChange: (patch: Partial<Settings>) => void;
}) {
  const [phase, setPhase] = useState<Phase | null>(null);
  const [open, setOpen] = useState(true);
  const [copied, setCopied] = useState(false);
  const copyTimer = useRef<number | null>(null);

  // Pin the phase on <html>: same contract as the card-hover harness. The
  // theme provider's clock leaves a pinned phase alone.
  useEffect(() => {
    if (!phase) return;

    const root = document.documentElement;

    root.dataset.phase = phase;
    root.dataset.mode = phase === "night" ? "night" : "day";
    root.dataset.phasePreview = "true";
    root.classList.toggle("dark", phase === "night");
  }, [phase]);

  useEffect(() => {
    return () => {
      if (copyTimer.current !== null) window.clearTimeout(copyTimer.current);
    };
  }, []);

  const config = [
    `duration: ${settings.duration}ms`,
    `ease: cubic-bezier(${EASE_CURVES[settings.ease].join(", ")})`,
    `featured: ${settings.ratio.toFixed(2)}x height`,
    `medium weights: ${settings.weights.map((weight) => weight.toFixed(2)).join("/")}`,
    `slivers: ${settings.slivers ? "on" : "off"}`,
    `gap: ${settings.gap}px`,
    `stack overlap: ${settings.overlap}px`,
  ].join(" · ");

  async function copyConfig() {
    try {
      await navigator.clipboard.writeText(config);
      setCopied(true);

      if (copyTimer.current !== null) window.clearTimeout(copyTimer.current);

      copyTimer.current = window.setTimeout(() => setCopied(false), 1400);
    } catch {
      // Clipboard can be blocked; the values are still on screen.
    }
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: PANEL_CSS }} />

      <aside className="wc-panel" aria-label="Carousel controls">
        <header className="wc-panel-head">
          <div>
            <p className="wc-panel-title">Work carousel</p>
            <p className="wc-panel-axis">squeezy slots · ring hover</p>
          </div>
          <div className="wc-panel-actions">
            {open ? (
              <button
                type="button"
                className="wc-panel-copy"
                onClick={copyConfig}
              >
                {copied ? "Copied" : "Copy"}
              </button>
            ) : null}
            <button
              type="button"
              className="wc-panel-toggle"
              aria-expanded={open}
              aria-label={open ? "Hide controls" : "Show controls"}
              onClick={() => setOpen((value) => !value)}
            >
              {open ? "–" : "+"}
            </button>
          </div>
        </header>

        {open ? (
          <div className="wc-panel-body">
            <div className="wc-panel-phase" role="group" aria-label="Phase">
              {PHASES.map((entry) => (
                <button
                  key={entry}
                  type="button"
                  className="wc-panel-phase-item"
                  data-active={phase === entry ? "" : undefined}
                  aria-pressed={phase === entry}
                  onClick={() => setPhase(entry)}
                >
                  {entry}
                </button>
              ))}
            </div>

            <div
              className="wc-panel-presets"
              role="group"
              aria-label="Duration presets"
            >
              {PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  className="wc-panel-preset"
                  data-active={
                    settings.duration === preset.duration ? "" : undefined
                  }
                  onClick={() => onChange({ duration: preset.duration })}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            <Row
              id="wc-duration"
              label="Duration"
              value={`${settings.duration}ms`}
            >
              <input
                id="wc-duration"
                className="wc-panel-range"
                type="range"
                min={100}
                max={1600}
                step={20}
                value={settings.duration}
                onChange={(event) =>
                  onChange({ duration: Number(event.target.value) })
                }
              />
            </Row>

            <Row id="wc-ease" label="Easing" value={settings.ease}>
              <select
                id="wc-ease"
                className="wc-panel-select"
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
            </Row>

            <Row
              id="wc-ratio"
              label="Featured width"
              value={`${settings.ratio.toFixed(2)}× height`}
            >
              <input
                id="wc-ratio"
                className="wc-panel-range"
                type="range"
                min={1.2}
                max={2.2}
                step={0.01}
                value={settings.ratio}
                onChange={(event) =>
                  onChange({ ratio: Number(event.target.value) })
                }
              />
            </Row>

            <p className="wc-panel-group">Medium weights</p>

            {settings.weights.map((weight, index) => (
              <Row
                key={index}
                id={`wc-weight-${index}`}
                label={`Weight ${index + 1}`}
                value={weight.toFixed(2)}
              >
                <input
                  id={`wc-weight-${index}`}
                  className="wc-panel-range"
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={weight}
                  onChange={(event) => {
                    const next = [...settings.weights] as [
                      number,
                      number,
                      number,
                    ];
                    next[index] = Number(event.target.value);
                    onChange({ weights: next });
                  }}
                />
              </Row>
            ))}

            <label className="wc-panel-check" htmlFor="wc-slivers">
              <input
                id="wc-slivers"
                type="checkbox"
                checked={settings.slivers}
                onChange={(event) =>
                  onChange({ slivers: event.target.checked })
                }
              />
              Sliver hints
            </label>

            <Row id="wc-gap" label="Gap" value={`${settings.gap}px`}>
              <input
                id="wc-gap"
                className="wc-panel-range"
                type="range"
                min={8}
                max={24}
                step={1}
                value={settings.gap}
                onChange={(event) =>
                  onChange({ gap: Number(event.target.value) })
                }
              />
            </Row>

            <Row
              id="wc-overlap"
              label="Stack overlap (<768)"
              value={`${settings.overlap}px`}
            >
              <input
                id="wc-overlap"
                className="wc-panel-range"
                type="range"
                min={0}
                max={16}
                step={1}
                value={settings.overlap}
                onChange={(event) =>
                  onChange({ overlap: Number(event.target.value) })
                }
              />
            </Row>

            <p className="wc-panel-hint">
              ← → rotate · click a card to feature it
            </p>
          </div>
        ) : null}
      </aside>
    </>
  );
}
