"use client";

import { useEffect, useState } from "react";
import type { EntranceVariant } from "@/components/home/entrance-cell";
import { HomeLayout } from "@/components/home/home-layout";
import { PANEL_CSS } from "./panel-css";

const VARIANTS: {
  id: EntranceVariant;
  label: string;
  timing: string;
}[] = [
  {
    id: "scale",
    label: "Scale + blur",
    timing: "0–660ms · 50ms stagger · 360ms each · scale 0.96 · blur 6px",
  },
  {
    id: "rise",
    label: "Rise",
    timing: "0–500ms · rows at 0 / 60 / 120ms · 380ms each · 8px lift",
  },
  {
    id: "ring",
    label: "Ring reveal",
    timing: "0–620ms · 40ms stagger · edge 380ms · fill at +80ms",
  },
  {
    id: "sky",
    label: "Sky first",
    timing: "glow 0–300ms · cards 120–696ms · 36ms stagger · blur 4px",
  },
];

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
  const [open, setOpen] = useState(true);

  useEffect(() => {
    playedThisLoad = true;
  }, []);

  function play(next: EntranceVariant) {
    setVariant(next);
    setPlaying(next);
    // A new key remounts HomeLayout, which restarts the CSS animations.
    setTake((value) => value + 1);
  }

  const active = VARIANTS.find((entry) => entry.id === variant) ?? VARIANTS[0];

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: PANEL_CSS }} />

      <HomeLayout key={take} entrance={playing ?? undefined} />

      <aside
        className="en-panel"
        data-open={open ? "true" : "false"}
        aria-label="Entrance controls"
      >
        <header className="en-panel-head">
          <div>
            <p className="en-panel-title">Home entrance</p>
            <p className="en-panel-axis">page load · throwaway</p>
          </div>
          <button
            type="button"
            className="en-panel-toggle"
            aria-expanded={open}
            aria-label={open ? "Hide controls" : "Show controls"}
            onClick={() => setOpen((value) => !value)}
          >
            {open ? "–" : "+"}
          </button>
        </header>

        {open ? (
          <div className="en-panel-body">
            <div
              className="en-panel-variants"
              role="group"
              aria-label="Entrance variant"
            >
              {VARIANTS.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  className="en-panel-variant"
                  data-active={variant === entry.id ? "" : undefined}
                  aria-pressed={variant === entry.id}
                  onClick={() => play(entry.id)}
                >
                  {entry.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              className="en-panel-replay"
              onClick={() => play(variant)}
            >
              Replay
            </button>

            <p className="en-panel-timing">{active.timing}</p>
            <p className="en-panel-hint">
              Runs once per load; leaving and returning to this route does not
              replay it.
            </p>
          </div>
        ) : null}
      </aside>
    </>
  );
}
