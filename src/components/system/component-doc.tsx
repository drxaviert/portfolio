"use client";

import { useState } from "react";
import type { JSX, ReactNode } from "react";
import { TokenRow } from "./token-row";
import { useContentVisibility } from "./use-content-visibility";

export type ForceState =
  | "rest"
  | "hover"
  | "focus-visible"
  | "pressed"
  | "active";

export type ComponentDocProps = {
  name: string;
  description: string;
  states: readonly ForceState[];
  render: (state: ForceState | undefined) => ReactNode;
  use: readonly string[];
  dont: readonly string[];
  tokens: readonly string[];
  notes?: string;
};

const STATE_LABELS: Record<ForceState, string> = {
  rest: "Rest",
  hover: "Hover",
  "focus-visible": "Focus visible",
  pressed: "Pressed",
  active: "Active",
};

function toggleClass(active: boolean): string {
  return `h-8 rounded-sm px-2 text-[11px] font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
    active
      ? "bg-surface-container-high text-on-surface"
      : "text-on-surface-variant hover:text-on-surface"
  }`;
}

export function ComponentDoc({
  name,
  description,
  states,
  render,
  use,
  dont,
  tokens,
  notes,
}: ComponentDocProps): JSX.Element {
  const [forced, setForced] = useState<ForceState | undefined>(undefined);
  const docRef = useContentVisibility<HTMLDivElement>();

  return (
    <div ref={docRef} className="space-y-6">
      <header>
        <h3 className="text-lg font-medium tracking-tight">{name}</h3>
        <p className="mt-1 max-w-2xl text-xs leading-relaxed text-on-surface-variant">
          {description}
        </p>
      </header>

      <div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-on-surface-variant">
            Live sample
          </p>
          <div
            role="group"
            aria-label={`${name} sample state`}
            className="flex flex-wrap gap-1"
          >
            <button
              type="button"
              aria-pressed={forced === undefined}
              onClick={() => setForced(undefined)}
              className={toggleClass(forced === undefined)}
            >
              Live
            </button>
            {states.map((state) => (
              <button
                key={state}
                type="button"
                aria-pressed={forced === state}
                onClick={() => setForced(state)}
                className={toggleClass(forced === state)}
              >
                {STATE_LABELS[state]}
              </button>
            ))}
          </div>
        </div>

        <div
          data-doc-preview
          className="mt-3 h-[416px] w-full max-w-[753px] overflow-clip rounded-lg [overflow-clip-margin:24px]"
        >
          {render(forced)}
        </div>
      </div>

      <div>
        <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-on-surface-variant">
          States
        </p>
        <div className="mt-2 grid gap-3 sm:grid-cols-3">
          {states.map((state) => (
            <div key={state}>
              <p className="text-[10px] font-medium uppercase tracking-wide text-on-surface-variant">
                {STATE_LABELS[state]}
              </p>
              <div
                data-doc-state={state}
                className="mt-1 h-[260px] overflow-clip rounded-lg p-3 [overflow-clip-margin:24px]"
              >
                {render(state)}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <h4 className="text-[10px] font-medium uppercase tracking-[0.14em] text-on-surface-variant">
            Use
          </h4>
          <ul className="mt-2 list-disc space-y-1 pl-4 text-xs leading-relaxed text-on-surface-variant">
            {use.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
        <div>
          <h4 className="text-[10px] font-medium uppercase tracking-[0.14em] text-on-surface-variant">
            Don’t
          </h4>
          <ul className="mt-2 list-disc space-y-1 pl-4 text-xs leading-relaxed text-on-surface-variant">
            {dont.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </div>

      {notes ? (
        <p className="max-w-2xl text-xs leading-relaxed text-on-surface-variant">
          {notes}
        </p>
      ) : null}

      <div>
        <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-on-surface-variant">
          Tokens
        </p>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {tokens.map((token) => (
            <TokenRow
              key={token}
              token={token}
              usage="Token this component consumes."
            />
          ))}
        </div>
      </div>
    </div>
  );
}
