"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { EntranceVariant } from "@/components/home/entrance-cell";
import { HomeLayout } from "@/components/home/home-layout";
import {
  BUDGET_MS,
  CONTROLS,
  DEFAULT_EASING,
  DEFAULT_SETTINGS,
  DEFAULT_SOFT_METHOD,
  SOFT_METHODS,
  SOFT_METHOD_PATCH,
  EASINGS,
  copyBlock,
  cssVars,
  defaultEasing,
  formatValue,
  patch,
  resetVariant,
  stepsTiming,
  totalMs,
  valueOf,
} from "./settings";
import type { Control, Settings, SoftMethod } from "./settings";
import { PANEL_CSS } from "./panel-css";
import { ClearOverlay } from "./clear-overlay";
import { MistOverlay } from "./mist-overlay";
import { DawnOverlay } from "./dawn-overlay";
import { SoftOverlay } from "./soft-overlay";

const VARIANTS: { id: EntranceVariant; label: string }[] = [
  { id: "scale", label: "Scale + blur" },
  { id: "rise", label: "Rise" },
  { id: "ring", label: "Ring reveal" },
  { id: "sky", label: "Sky first" },
  { id: "clear", label: "Horizon clear" },
  { id: "step", label: "Step cut" },
  { id: "grain", label: "Grain sky" },
  { id: "grow", label: "Horizon grow" },
  { id: "breath", label: "Breath" },
  { id: "mist", label: "Mist lift" },
  { id: "dawn", label: "Dawn bloom" },
  { id: "soft", label: "Soft focus" },
];

/** Input settles for this long before the entrance replays. */
const REPLAY_DEBOUNCE_MS = 250;

/**
 * Module scope survives client-side navigation in the same tab, so coming
 * back to this route after leaving it does not replay the entrance. A reload
 * starts a new module and plays again. This gate is only here — HomeLayout
 * stays a pure component.
 */
let playedThisLoad = false;

export function EntranceHarness() {
  const [variant, setVariant] = useState<EntranceVariant>("scale");
  const [playing, setPlaying] = useState<EntranceVariant | null>(() =>
    playedThisLoad ? null : "scale",
  );
  const [take, setTake] = useState(0);
  const [resetToken, setResetToken] = useState(0);
  const [easing, setEasing] = useState<string>(DEFAULT_EASING);
  const [open, setOpen] = useState(true);
  const [softOrder, setSoftOrder] = useState<"horizon" | "reading">("horizon");
  const [softMethod, setSoftMethod] = useState<SoftMethod>(DEFAULT_SOFT_METHOD);
  const [reduced, setReduced] = useState(false);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">(
    "idle",
  );

  // Mutable, not state: a drag must not re-render the React tree. `saved` is
  // the commit-time mirror the inputs mount from (variant switch, reset).
  const settingsRef = useRef<Settings>(DEFAULT_SETTINGS);
  const [saved, setSaved] = useState<Settings>(DEFAULT_SETTINGS);
  const scopeRef = useRef<HTMLDivElement | null>(null);
  const valueRefs = useRef<Record<string, HTMLSpanElement | null>>({});
  const totalRef = useRef<HTMLElement | null>(null);
  const stepsRef = useRef<HTMLElement | null>(null);
  const replayTimer = useRef<number | null>(null);
  const copyTimer = useRef<number | null>(null);

  useEffect(() => {
    playedThisLoad = true;

    return () => {
      if (replayTimer.current !== null)
        window.clearTimeout(replayTimer.current);
      if (copyTimer.current !== null) window.clearTimeout(copyTimer.current);
    };
  }, []);

  // The panel says so when the OS asks for reduced motion; the stylesheet
  // already forces the 120ms fade on its own.
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(query.matches);

    sync();
    query.addEventListener("change", sync);

    return () => query.removeEventListener("change", sync);
  }, []);

  /** Writes the whole variant's tuning to the stable wrapper, in place. */
  const writeVars = useCallback(
    (nextVariant: EntranceVariant, settings: Settings, nextEasing: string) => {
      const root = scopeRef.current;

      if (!root) return;

      for (const [name, value] of Object.entries(
        cssVars(nextVariant, settings, nextEasing),
      )) {
        root.style.setProperty(name, value);
      }
    },
    [],
  );

  function replay(next: EntranceVariant = variant) {
    setPlaying(next);
    // A new key remounts HomeLayout, which restarts the CSS animations.
    setTake((value) => value + 1);
  }

  function scheduleReplay() {
    if (replayTimer.current !== null) window.clearTimeout(replayTimer.current);

    replayTimer.current = window.setTimeout(() => {
      replayTimer.current = null;
      replay();
    }, REPLAY_DEBOUNCE_MS);
  }

  function updateTotal() {
    const readout = totalRef.current;

    if (!readout) return;

    paintTotal(readout);
  }

  /**
   * The total is written straight into a node React renders empty, so a drag
   * never goes through a re-render. A ref callback repaints it on every commit
   * (variant switch, reset), which keeps React from owning the text node.
   */
  function paintTotal(element: HTMLElement) {
    const total = totalMs(variant, settingsRef.current);

    element.textContent = `${total} ms`;

    if (total > BUDGET_MS) element.dataset.over = "true";
    else delete element.dataset.over;

    // The step variant's card timing is `steps(n)`, not the picker's curve; it
    // follows the step-count slider, so it repaints in the same pass.
    const steps = stepsRef.current;

    if (steps)
      steps.textContent = stepsTiming(variant, settingsRef.current) ?? "";
  }

  function handleInput(control: Control, raw: string) {
    const value = Number(raw);

    settingsRef.current = patch(
      settingsRef.current,
      variant,
      control.key,
      value,
    );
    writeVars(variant, settingsRef.current, easing);

    const readout = valueRefs.current[control.key];

    if (readout) readout.textContent = formatValue(control, value);

    updateTotal();
    scheduleReplay();
  }

  function choose(next: EntranceVariant) {
    if (replayTimer.current !== null) {
      window.clearTimeout(replayTimer.current);
      replayTimer.current = null;
    }

    // The calm family ships on the proposed calm curve, so picking one sets it.
    // The original variants keep whatever curve is already selected.
    const curve = defaultEasing(next) ?? easing;

    if (curve !== easing) setEasing(curve);

    // Some variants share a wrapper with the previous one; write this
    // variant's saved tuning before the remount reads it.
    writeVars(next, settingsRef.current, curve);
    setSaved(settingsRef.current);
    setVariant(next);
    replay(next);
  }

  function reset() {
    settingsRef.current = resetVariant(settingsRef.current, variant);

    // Reset to defaults restores the calm curve for the calm family too.
    const curve = defaultEasing(variant) ?? easing;

    if (curve !== easing) setEasing(curve);

    writeVars(variant, settingsRef.current, curve);
    setSaved(settingsRef.current);
    setResetToken((value) => value + 1);
    replay();
  }

  function changeEasing(value: string) {
    setEasing(value);
    writeVars(variant, settingsRef.current, value);
    scheduleReplay();
  }

  /** Soft focus only: swap the per-card delay index, then play it again. */
  function changeSoftOrder(order: "horizon" | "reading") {
    if (order === softOrder) return;

    setSoftOrder(order);
    replay();
  }

  /**
   * Soft focus only: pick the blur mechanism. The lighter method also drops the
   * overlay's radius to its own defaults (the sliders stay live afterwards).
   */
  function changeSoftMethod(method: SoftMethod) {
    if (method === softMethod) return;

    setSoftMethod(method);

    const preset = SOFT_METHOD_PATCH[method];
    settingsRef.current = {
      ...settingsRef.current,
      soft: {
        ...settingsRef.current.soft,
        blur: preset.blur,
        veil: preset.veil,
      },
    };
    writeVars(variant, settingsRef.current, easing);
    setSaved(settingsRef.current);
    setResetToken((value) => value + 1);
    replay();
  }

  async function copyValues() {
    const text = copyBlock(
      variant,
      settingsRef.current,
      easing,
      totalMs(variant, settingsRef.current),
      variant === "soft" ? softMethod : undefined,
    );

    try {
      await navigator.clipboard.writeText(text);
      setCopyState("copied");
    } catch {
      setCopyState("failed");
    }

    if (copyTimer.current !== null) window.clearTimeout(copyTimer.current);

    copyTimer.current = window.setTimeout(() => setCopyState("idle"), 1600);
  }

  const controls = CONTROLS[variant];

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: PANEL_CSS }} />

      {/* Stable wrapper: the panel writes the CSS vars here, so a remount of
          HomeLayout never loses the tuning. */}
      <div
        className="entrance-scope"
        ref={scopeRef}
        data-soft-order={softOrder}
        data-soft-method={softMethod}
      >
        <HomeLayout key={take} entrance={playing ?? undefined} />
        {/* Above the layout, below the panel. Keyed with the layout so the
            mask animation restarts on every replay — but with its own prefix,
            since two siblings sharing one key is a React duplicate. */}
        {playing === "clear" ? <ClearOverlay key={`clear-${take}`} /> : null}
        {playing === "mist" ? <MistOverlay key={`mist-${take}`} /> : null}
        {playing === "dawn" ? <DawnOverlay key={`dawn-${take}`} /> : null}
        {playing === "soft" ? (
          <SoftOverlay key={`soft-${take}`} method={softMethod} />
        ) : null}
      </div>

      <aside
        className="ent-panel"
        data-open={open ? "true" : "false"}
        aria-label="Entrance controls"
      >
        <header className="ent-panel-head">
          <div>
            <p className="ent-panel-title">Home entrance</p>
            <p className="ent-panel-axis">page load · throwaway</p>
          </div>
          <button
            type="button"
            className="ent-panel-toggle"
            aria-expanded={open}
            aria-label={open ? "Hide controls" : "Show controls"}
            onClick={() => setOpen((value) => !value)}
          >
            {open ? "–" : "+"}
          </button>
        </header>

        {open ? (
          <div className="ent-panel-body">
            <div
              className="ent-panel-variants"
              role="group"
              aria-label="Entrance variant"
            >
              {VARIANTS.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  className="ent-panel-variant"
                  data-active={variant === entry.id ? "" : undefined}
                  aria-pressed={variant === entry.id}
                  onClick={() => choose(entry.id)}
                >
                  {entry.label}
                </button>
              ))}
            </div>

            <label className="ent-panel-easing" htmlFor="ent-easing">
              <span>Easing</span>
              <select
                id="ent-easing"
                value={easing}
                onChange={(event) => changeEasing(event.target.value)}
              >
                {EASINGS.map((option) => (
                  <option key={option.id} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            {variant === "step" ? (
              <p className="ent-panel-steps">
                Cards:{" "}
                <strong
                  ref={(element) => {
                    stepsRef.current = element;

                    if (element)
                      element.textContent =
                        stepsTiming(variant, settingsRef.current) ?? "";
                  }}
                />{" "}
                — hard cuts, no ease-out. Deliberately breaks the curve rule;
                the picker is the marker fade.
              </p>
            ) : null}

            <div className="ent-panel-controls">
              {controls.map((control) => {
                const value = valueOf(saved, variant, control.key);
                const id = `ent-${variant}-${control.key}`;

                return (
                  <div
                    className="ent-control"
                    key={`${variant}-${resetToken}-${control.key}`}
                  >
                    <label className="ent-control-label" htmlFor={id}>
                      {control.label}
                    </label>
                    <output className="ent-control-value" htmlFor={id}>
                      <span
                        ref={(element) => {
                          valueRefs.current[control.key] = element;

                          if (element) {
                            element.textContent = formatValue(
                              control,
                              valueOf(
                                settingsRef.current,
                                variant,
                                control.key,
                              ),
                            );
                          }
                        }}
                      />
                    </output>
                    <input
                      id={id}
                      type="range"
                      min={control.min}
                      max={control.max}
                      step={control.step}
                      defaultValue={value}
                      onInput={(event) =>
                        handleInput(control, event.currentTarget.value)
                      }
                      onPointerUp={scheduleReplay}
                      onKeyUp={scheduleReplay}
                    />
                  </div>
                );
              })}
            </div>

            {variant === "soft" ? (
              <div className="ent-panel-easing">
                <span>Card order</span>
                <div
                  className="ent-panel-variants"
                  role="group"
                  aria-label="Card order"
                >
                  <button
                    type="button"
                    className="ent-panel-variant"
                    data-active={softOrder === "horizon" ? "" : undefined}
                    aria-pressed={softOrder === "horizon"}
                    onClick={() => changeSoftOrder("horizon")}
                  >
                    Horizon-up
                  </button>
                  <button
                    type="button"
                    className="ent-panel-variant"
                    data-active={softOrder === "reading" ? "" : undefined}
                    aria-pressed={softOrder === "reading"}
                    onClick={() => changeSoftOrder("reading")}
                  >
                    Reading
                  </button>
                </div>
              </div>
            ) : null}

            {variant === "soft" ? (
              <div className="ent-panel-easing">
                <span>Blur method</span>
                <div
                  className="ent-panel-variants"
                  role="group"
                  aria-label="Blur method"
                >
                  {SOFT_METHODS.map((entry) => (
                    <button
                      key={entry.id}
                      type="button"
                      className="ent-panel-variant"
                      data-active={softMethod === entry.id ? "" : undefined}
                      aria-pressed={softMethod === entry.id}
                      onClick={() => changeSoftMethod(entry.id)}
                    >
                      {entry.label}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            <p className="ent-panel-total">
              <span>Settles by</span>
              <strong
                ref={(element) => {
                  totalRef.current = element;

                  if (element) paintTotal(element);
                }}
              />
              <span className="ent-panel-budget">{BUDGET_MS} ms budget</span>
            </p>

            {reduced ? (
              <p className="ent-panel-note">
                Reduced motion is on: the entrance runs as one 120 ms opacity
                fade, so these values are not applied.
              </p>
            ) : null}

            <div className="ent-panel-actions">
              <button
                type="button"
                className="ent-panel-replay"
                onClick={() => replay()}
              >
                Replay
              </button>
              <button
                type="button"
                className="ent-panel-button"
                onClick={reset}
              >
                Reset to defaults
              </button>
              <button
                type="button"
                className="ent-panel-button"
                onClick={copyValues}
              >
                {copyState === "copied"
                  ? "Copied"
                  : copyState === "failed"
                    ? "Copy failed"
                    : "Copy values"}
              </button>
            </div>

            <p className="ent-panel-hint">
              Drag to tune; the entrance replays 250 ms after you stop. Runs
              once per load.
            </p>
          </div>
        ) : null}
      </aside>
    </>
  );
}
