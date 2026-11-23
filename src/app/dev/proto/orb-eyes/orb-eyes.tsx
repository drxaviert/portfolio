"use client";

import { useId, useState } from "react";
import { HorizonBackground } from "@/components/horizon/horizon-background";
import { RingHoverPointer } from "@/components/home/ring-pointer";
import { GazeNav } from "./gaze-nav";
import { GazeOrb, LOOK_DISTANCE } from "./gaze-orb";
import "./orb-eyes.css";

const DEFAULT_STRENGTH = 1;

/**
 * Throwaway prototype: the nav orb's eyes track the pointer.
 *
 * The page keeps the shipped home frame and the real nav parts, and puts a 4×
 * head above the fold so the gaze is readable at a glance. The panel only
 * tunes the two numbers that decide the feel: how far the eyes travel and how
 * much pointer distance earns a full look.
 */
export function OrbEyesProto() {
  const [strength, setStrength] = useState(DEFAULT_STRENGTH);
  const [lookDistance, setLookDistance] = useState(LOOK_DISTANCE);
  const strengthId = useId();
  const reachId = useId();

  const reset = () => {
    setStrength(DEFAULT_STRENGTH);
    setLookDistance(LOOK_DISTANCE);
  };

  return (
    <>
      <main className="relative flex min-h-dvh flex-col overflow-hidden bg-surface text-on-surface">
        <HorizonBackground />
        <RingHoverPointer />

        <div className="relative mx-auto flex w-full max-w-[1200px] flex-1 flex-col px-4 py-4 md:px-8 md:py-12 xl:py-16">
          <div className="relative mx-auto flex w-full max-w-[1136px] flex-1 flex-col gap-3">
            <div className="orb-eyes-stage">
              <div className="orb-eyes-preview">
                <GazeOrb
                  size={144}
                  strength={strength}
                  lookDistance={lookDistance}
                />
              </div>

              <div className="orb-eyes-copy">
                <h1 className="orb-eyes-kicker">Prototype · orb gaze</h1>
                <p className="orb-eyes-lede">
                  Move your cursor. The <strong>4× head</strong> above and the{" "}
                  <strong>orb in the nav</strong> below both look toward it.
                </p>
              </div>
            </div>

            <GazeNav strength={strength} lookDistance={lookDistance} />
          </div>
        </div>
      </main>

      <aside className="orb-panel" aria-label="Orb gaze controls">
        <header className="orb-panel-head">
          <div>
            <p className="orb-panel-title">Orb gaze</p>
            <p className="orb-panel-axis">nav eyes · 4× inspect</p>
          </div>
          <button type="button" className="orb-panel-reset" onClick={reset}>
            Reset
          </button>
        </header>

        <div className="orb-panel-row">
          <div className="orb-panel-label-row">
            <label className="orb-panel-label" htmlFor={strengthId}>
              Look strength
            </label>
            <span className="orb-panel-value" aria-hidden="true">
              {Math.round(strength * 100)}%
            </span>
          </div>
          <input
            id={strengthId}
            className="orb-panel-range"
            type="range"
            min={0}
            max={1.5}
            step={0.05}
            value={strength}
            onChange={(event) => setStrength(Number(event.target.value))}
          />
        </div>

        <div className="orb-panel-row">
          <div className="orb-panel-label-row">
            <label className="orb-panel-label" htmlFor={reachId}>
              Full look at
            </label>
            <span className="orb-panel-value" aria-hidden="true">
              {lookDistance}px
            </span>
          </div>
          <input
            id={reachId}
            className="orb-panel-range"
            type="range"
            min={60}
            max={320}
            step={10}
            value={lookDistance}
            onChange={(event) => setLookDistance(Number(event.target.value))}
          />
        </div>

        <p className="orb-panel-hint">
          The eyes rest when the pointer is on the head, and look fully once it
          is a reach away.
        </p>

        <p className="orb-panel-foot">
          <span>Fine pointer only</span>
          <span>Reduced motion rests</span>
        </p>
      </aside>
    </>
  );
}
