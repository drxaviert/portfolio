"use client";

import { useEffect, useId, useRef } from "react";
import type { JSX, ReactNode } from "react";
import { useSystem } from "@/app/design-system/system-shell";
import { PARAM_RANGES } from "@/lib/system/params";
import type { Params } from "@/lib/system/params";

const LABELS: Record<keyof Params, string> = {
  hue: "Hue",
  round: "Roundness",
  tod: "Time of day",
  contrast: "Contrast",
  speed: "Motion speed",
};

const FORMATS: Record<keyof Params, (value: number) => string> = {
  hue: (value) => `${Math.round(value)}°`,
  round: (value) => `${value.toFixed(2)}×`,
  tod: (value) => `${Math.round(value * 100)}%`,
  contrast: (value) => `${value.toFixed(2)}×`,
  speed: (value) => `${value.toFixed(2)}×`,
};

const TOD_TICKS = ["Dawn", "Midday", "Dusk", "Night"] as const;

const FIELD_CLASS =
  "h-11 w-full cursor-pointer text-base accent-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

function nextValue(
  key: string,
  value: number,
  min: number,
  max: number,
  step: number,
): number | null {
  switch (key) {
    case "ArrowRight":
    case "ArrowUp":
      return Math.min(max, value + step);
    case "ArrowLeft":
    case "ArrowDown":
      return Math.max(min, value - step);
    case "PageUp":
      return Math.min(max, value + step * 10);
    case "PageDown":
      return Math.max(min, value - step * 10);
    case "Home":
      return min;
    case "End":
      return max;
    default:
      return null;
  }
}

function ParamSlider({
  paramKey,
  children,
}: {
  paramKey: keyof Params;
  children?: ReactNode;
}) {
  const { params, setParam } = useSystem();
  const id = useId();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const value = params[paramKey];
  const { min, max, step } = PARAM_RANGES[paramKey];

  // The input stays uncontrolled so a drag never fights React's controlled
  // value restoration between frames; reset and theme changes sync it here.
  useEffect(() => {
    const input = inputRef.current;

    if (input && Number(input.value) !== value) {
      input.value = String(value);
    }
  }, [value]);

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-sm font-medium">
          {LABELS[paramKey]}
        </label>
        <output
          htmlFor={id}
          className="font-mono text-xs tabular-nums text-on-surface-variant"
        >
          {FORMATS[paramKey](value)}
        </output>
      </div>

      <input
        ref={inputRef}
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        defaultValue={value}
        aria-valuetext={FORMATS[paramKey](value)}
        onInput={(event) => {
          const next = event.currentTarget.valueAsNumber;

          if (Number.isFinite(next)) setParam(paramKey, next);
        }}
        onKeyDown={(event) => {
          const next = nextValue(event.key, value, min, max, step);

          if (next === null) return;

          // jsdom does not implement range keyboard stepping; doing it here
          // also keeps arrow behaviour identical across browsers.
          event.preventDefault();

          const stepped = Number(next.toFixed(4));

          if (inputRef.current) inputRef.current.value = String(stepped);

          setParam(paramKey, stepped);
        }}
        className={`mt-1 ${FIELD_CLASS}`}
      />

      {children}
    </div>
  );
}

export function ControlsPanel(): JSX.Element {
  const { reset } = useSystem();

  return (
    <section aria-label="Controls" className="rounded-lg bg-surface-container-low p-4 shadow-card">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-medium">Controls</h2>
        <p className="text-xs text-on-surface-variant">Live parameters</p>
      </div>

      <div className="mt-4 space-y-4">
        <ParamSlider paramKey="hue" />
        <ParamSlider paramKey="round" />
        <ParamSlider paramKey="tod">
          <div className="mt-1 flex justify-between text-[10px] font-medium uppercase tracking-wide text-on-surface-variant">
            {TOD_TICKS.map((tick) => (
              <span key={tick}>{tick}</span>
            ))}
          </div>
        </ParamSlider>
        <ParamSlider paramKey="contrast" />
        <ParamSlider paramKey="speed" />
      </div>

      <button
        type="button"
        onClick={reset}
        className="mt-5 h-11 w-full rounded-md bg-surface-container-high px-4 text-sm font-medium text-on-surface transition-colors hover:bg-surface-container-highest focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        Reset
      </button>
    </section>
  );
}
