"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { PlayCard } from "@/components/play/play-card";
import { pinPhase, unpinPhase } from "@/lib/theme";
import {
  createVariantDefaults,
  VARIANTS,
  VARIANT_SLIDERS,
} from "@/components/play/variants/settings";
import type {
  SliderDef,
  VariantId,
  VariantMeta,
  VariantSettings,
} from "@/components/play/variants/settings";

type Phase = "dawn" | "day" | "dusk" | "night";

const PHASES: { phase: Phase; label: string }[] = [
  { phase: "dawn", label: "Dawn" },
  { phase: "day", label: "Day" },
  { phase: "dusk", label: "Dusk" },
  { phase: "night", label: "Night" },
];

function loadFaithful() {
  return import("@/components/play/variants/faithful");
}

function loadFibreLamp() {
  return import("@/components/play/variants/fibre-lamp");
}

function loadDepth() {
  return import("@/components/play/variants/depth");
}

function loadSilkWave() {
  return import("@/components/play/variants/silk-wave");
}

const FaithfulVariant = dynamic(
  () => loadFaithful().then((mod) => mod.FaithfulVariant),
  { ssr: false, loading: () => null },
);

const FibreLampVariant = dynamic(
  () => loadFibreLamp().then((mod) => mod.FibreLampVariant),
  { ssr: false, loading: () => null },
);

const DepthVariant = dynamic(
  () => loadDepth().then((mod) => mod.DepthVariant),
  { ssr: false, loading: () => null },
);

const SilkWaveVariant = dynamic(
  () => loadSilkWave().then((mod) => mod.SilkWaveVariant),
  { ssr: false, loading: () => null },
);

/** Keep key switches instant after the first paint; chunks stay lazy. */
function preloadVariants(): void {
  void Promise.all([
    loadFaithful(),
    loadFibreLamp(),
    loadDepth(),
    loadSilkWave(),
  ]);
}

const PLAY_GRADIENT =
  "linear-gradient(180deg, var(--play-bg-top) 0%, var(--play-bg-mid) 58%, var(--play-bg-mid) 74%, var(--play-base) 100%)";

function formatValue(slider: SliderDef, value: number): string {
  const rounded =
    slider.precision === undefined
      ? String(Math.round(value))
      : value.toFixed(slider.precision);

  return `${rounded}${slider.unit}`;
}

function CardFrame({
  variant,
  children,
}: {
  variant: VariantId;
  children: React.ReactNode;
}) {
  return (
    <div
      className="relative h-[276px] w-[849px] max-w-full overflow-hidden rounded-lg shadow-card"
      style={{
        background: variant === "silk-wave" ? "var(--surface)" : PLAY_GRADIENT,
      }}
    >
      {children}
    </div>
  );
}

function VariantSurface({
  variant,
  settings,
}: {
  variant: VariantId;
  settings: VariantSettings;
}) {
  switch (variant) {
    case "faithful":
      return (
        <FaithfulVariant
          settings={settings.faithful}
          className="absolute inset-0"
        />
      );
    case "fibre-lamp":
      return (
        <FibreLampVariant
          settings={settings["fibre-lamp"]}
          className="absolute inset-0"
        />
      );
    case "depth":
      return (
        <DepthVariant settings={settings.depth} className="absolute inset-0" />
      );
    case "silk-wave":
      return (
        <SilkWaveVariant
          settings={settings["silk-wave"]}
          className="absolute inset-0"
        />
      );
    default:
      return null;
  }
}

export function PlayLab() {
  const [phase, setPhase] = useState<Phase>("day");
  const [variant, setVariant] = useState<VariantId>("faithful");
  const [settings, setSettings] = useState<VariantSettings>(() =>
    createVariantDefaults(),
  );

  const active = VARIANTS.find((entry) => entry.id === variant) ?? VARIANTS[0];
  const sliders = VARIANT_SLIDERS[variant];

  // Pin the previewed phase on <html>; the theme provider yields while
  // data-phase-preview is set, so the clock cannot fight the picker.
  useEffect(() => {
    pinPhase(phase);
  }, [phase]);

  useEffect(() => {
    return () => {
      unpinPhase();
    };
  }, []);

  useEffect(() => {
    preloadVariants();
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      if (event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }

      const target = event.target as HTMLElement | null;

      if (
        target?.isContentEditable ||
        target?.tagName === "TEXTAREA" ||
        target?.tagName === "SELECT"
      ) {
        return;
      }

      if (target instanceof HTMLInputElement && target.type !== "range") {
        return;
      }

      const next = VARIANTS[Number(event.key) - 1];

      if (next) {
        event.preventDefault();
        setVariant(next.id);
      }
    }

    window.addEventListener("keydown", onKeyDown);

    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  function update(variantId: VariantId, key: string, value: number): void {
    setSettings((current) => {
      const values = current[variantId] as unknown as Record<string, number>;

      return {
        ...current,
        [variantId]: { ...values, [key]: value },
      } as VariantSettings;
    });
  }

  function reset(): void {
    const defaults = createVariantDefaults();

    setSettings(
      (current) =>
        ({
          ...current,
          [variant]: defaults[variant],
        }) as VariantSettings,
    );
  }

  return (
    <main className="min-h-screen bg-surface px-6 py-8 text-on-surface">
      <div className="mx-auto max-w-[1740px]">
        <header className="mb-6">
          <h1 className="text-2xl font-medium">Play card · fibre-optic fan</h1>
          <p className="mt-1 max-w-[70ch] text-sm text-on-surface-variant">
            Five takes on the same card. Keys 1–5 switch variants; the phase
            picker pins the clock so colours stay put. Three.js is lazy-loaded
            per variant.
          </p>

          <div className="mt-4 flex flex-wrap items-start gap-8">
            <section aria-label="Variant">
              <h2 className="mb-2 text-xs font-medium tracking-wide text-on-surface-variant uppercase">
                Variant
              </h2>
              <div className="inline-flex flex-wrap gap-1 rounded-md bg-surface-container-low p-1 shadow-card">
                {VARIANTS.map((entry: VariantMeta) => {
                  const selected = entry.id === variant;

                  return (
                    <button
                      key={entry.id}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => setVariant(entry.id)}
                      className={[
                        "h-8 rounded-sm px-3 text-sm outline-none",
                        "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary",
                        selected
                          ? "bg-primary text-on-primary"
                          : "text-on-surface hover:bg-surface-container",
                      ].join(" ")}
                    >
                      {entry.label}
                    </button>
                  );
                })}
              </div>
            </section>

            <section aria-label="Phase preview">
              <h2 className="mb-2 text-xs font-medium tracking-wide text-on-surface-variant uppercase">
                Phase
              </h2>
              <div className="inline-flex flex-wrap gap-1 rounded-md bg-surface-container-low p-1 shadow-card">
                {PHASES.map((entry) => {
                  const selected = entry.phase === phase;

                  return (
                    <button
                      key={entry.phase}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => setPhase(entry.phase)}
                      className={[
                        "h-8 rounded-sm px-3 text-sm outline-none",
                        "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary",
                        selected
                          ? "bg-primary text-on-primary"
                          : "text-on-surface hover:bg-surface-container",
                      ].join(" ")}
                    >
                      {entry.label}
                    </button>
                  );
                })}
              </div>
            </section>
          </div>
        </header>

        <section
          aria-label="Preview"
          className="flex flex-wrap items-start gap-6"
        >
          <figure>
            <figcaption className="mb-2 text-xs text-on-surface-variant">
              <span className="font-medium text-on-surface">
                {active.label}
              </span>{" "}
              · {phase} · {active.note}
            </figcaption>
            {variant === "current" ? (
              <div onClick={(event) => event.preventDefault()}>
                <PlayCard settings={settings.current} />
              </div>
            ) : (
              <CardFrame variant={variant}>
                <VariantSurface variant={variant} settings={settings} />
              </CardFrame>
            )}
          </figure>

          <figure>
            <figcaption className="mb-2 text-xs text-on-surface-variant">
              <span className="font-medium text-on-surface">Current</span> ·
              reference for comparison
            </figcaption>
            <div onClick={(event) => event.preventDefault()}>
              <PlayCard settings={settings.current} />
            </div>
          </figure>
        </section>

        <section className="mt-8 max-w-[849px]" aria-label="Fan settings">
          <div className="mb-2 flex items-baseline justify-between gap-4">
            <h2 className="text-xs font-medium tracking-wide text-on-surface-variant uppercase">
              {active.label} settings
            </h2>
            <button
              type="button"
              onClick={reset}
              className="text-xs text-on-surface-variant underline underline-offset-2 hover:text-on-surface"
            >
              Reset to defaults
            </button>
          </div>

          <div className="grid gap-x-8 gap-y-4 rounded-lg bg-surface-container-low p-4 shadow-card sm:grid-cols-2">
            {sliders.map((slider) => {
              const value =
                (settings[variant] as unknown as Record<string, number>)[
                  slider.key
                ] ?? 0;

              return (
                <label key={slider.key} className="block">
                  <span className="flex items-baseline justify-between gap-3 text-sm">
                    <span>{slider.label}</span>
                    <output className="font-mono text-xs text-on-surface-variant">
                      {formatValue(slider, value)}
                    </output>
                  </span>
                  <input
                    type="range"
                    min={slider.min}
                    max={slider.max}
                    step={slider.step}
                    value={value}
                    onChange={(event) =>
                      update(variant, slider.key, Number(event.target.value))
                    }
                    className="mt-1 w-full accent-primary"
                  />
                </label>
              );
            })}
          </div>
        </section>

        <section className="mt-6 max-w-[849px]" aria-label="Current values">
          <h2 className="mb-2 text-xs font-medium tracking-wide text-on-surface-variant uppercase">
            Current values
          </h2>
          <pre className="overflow-x-auto rounded-lg bg-surface-container-low p-4 font-mono text-xs shadow-card">
            {JSON.stringify(
              { variant, phase, settings: settings[variant] },
              null,
              2,
            )}
          </pre>
        </section>
      </div>
    </main>
  );
}
