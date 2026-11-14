"use client";

import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { RingLayers } from "@/components/home/ring-hover";
import { PhoneScene, TilesScene, WindowScene } from "./scenes";
import type { Mode } from "./scenes";
import "./faux-ui.css";

export type { Mode } from "./scenes";

export type Scene = "window" | "phone" | "tiles";
export type Phase = "day" | "night";

const SCENES: { value: Scene; label: string }[] = [
  { value: "window", label: "Window" },
  { value: "phone", label: "Phone" },
  { value: "tiles", label: "Tiles" },
];

const MODES: { value: Mode; label: string }[] = [
  { value: "still", label: "Still" },
  { value: "loop", label: "Loop" },
];

const PHASES: { value: Phase; label: string }[] = [
  { value: "day", label: "Day" },
  { value: "night", label: "Night" },
];

const CAPTION: Record<Scene, string> = {
  window: "Desktop window: sidebar, dashboard, cropped at the foot.",
  phone: "Phone: a list screen with the selection walking down.",
  tiles: "Bento: chart, notification toggle and team fragments.",
};

function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  const groupRef = useRef<HTMLDivElement | null>(null);

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let next = index;

    switch (event.key) {
      case "ArrowRight":
      case "ArrowDown":
        next = (index + 1) % options.length;
        break;
      case "ArrowLeft":
      case "ArrowUp":
        next = (index + options.length - 1) % options.length;
        break;
      case "Home":
        next = 0;
        break;
      case "End":
        next = options.length - 1;
        break;
      default:
        return;
    }

    event.preventDefault();
    onChange(options[next].value);
    groupRef.current
      ?.querySelectorAll<HTMLButtonElement>('[role="radio"]')
      [next]?.focus();
  }

  return (
    <div className="fu-field">
      <span className="fu-field__label">{label}</span>
      <div
        ref={groupRef}
        role="radiogroup"
        aria-label={label}
        className="fu-seg"
      >
        {options.map((option, index) => {
          const active = option.value === value;

          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={active}
              tabIndex={active ? 0 : -1}
              className="fu-seg__item"
              data-on={active || undefined}
              onClick={() => onChange(option.value)}
              onKeyDown={(event) => onKeyDown(event, index)}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Dev-only harness for the featured-work product visual: three generic faux
 * scenes at the ProjectCard's Figma size, a still/loop switch, and a Day/Night
 * switch so both token sets can be judged without touching the real theme.
 *
 * The scene is decorative: `aria-hidden` on the stage keeps the placeholder
 * blocks out of the accessibility tree, and the panel is the only control.
 */
export function FauxUiProto({
  initialScene,
  initialMode,
  initialPhase,
}: {
  initialScene: Scene;
  initialMode: Mode;
  initialPhase: Phase;
}) {
  const [scene, setScene] = useState<Scene>(initialScene);
  const [mode, setMode] = useState<Mode>(initialMode);
  const [phase, setPhase] = useState<Phase>(initialPhase);

  // Read on the client only: the CSS media query already holds the static
  // frames before hydration, and this keeps the panel honest afterwards.
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduceMotion(query.matches);

    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  const playing: Mode = reduceMotion ? "still" : mode;

  // Keep the URL pointing at the frame on screen, the same contract as the
  // phase picker in /dev/prototype.
  useEffect(() => {
    const url = new URL(window.location.href);

    url.searchParams.set("scene", scene);
    url.searchParams.set("mode", mode);
    url.searchParams.set("theme", phase);
    window.history.replaceState(window.history.state, "", url);
  }, [scene, mode, phase]);

  return (
    <div data-phase={phase} className="min-h-dvh bg-surface text-on-surface">
      <main className="flex min-h-dvh flex-col items-center justify-center gap-3 px-4 py-16">
        <div className="w-full max-w-[753px]">
          <div className="mb-3 flex items-baseline justify-between gap-4">
            <p className="text-xs font-medium tracking-[0.06em] text-on-surface-variant uppercase">
              Faux UI · featured work card
            </p>
            <p className="text-xs text-on-surface-variant tabular-nums">
              753 × 416
            </p>
          </div>

          <article className="ring-host flex h-[416px] w-full flex-col rounded-lg p-8">
            <RingLayers fill="bg-surface-container-low" />
            <div className="fu-shot" aria-hidden="true">
              {scene === "window" ? <WindowScene mode={playing} /> : null}
              {scene === "phone" ? <PhoneScene mode={playing} /> : null}
              {scene === "tiles" ? <TilesScene mode={playing} /> : null}
            </div>
          </article>

          <p className="mt-3 text-xs text-on-surface-variant">
            {CAPTION[scene]} Generic content, design-system tokens only.
          </p>
        </div>
      </main>

      <aside className="fu-panel" aria-label="Faux UI controls">
        <div className="fu-panel__head">
          <p className="fu-panel__title">Faux UI</p>
          <p className="fu-panel__hint">project card</p>
        </div>

        <Segmented
          label="Scene"
          value={scene}
          options={SCENES}
          onChange={setScene}
        />
        <Segmented
          label="Mode"
          value={mode}
          options={MODES}
          onChange={setMode}
        />
        <Segmented
          label="Theme"
          value={phase}
          options={PHASES}
          onChange={setPhase}
        />

        {reduceMotion ? (
          <p className="fu-panel__hint">
            Reduced motion is on, so the scene stays a still.
          </p>
        ) : null}
      </aside>
    </div>
  );
}
