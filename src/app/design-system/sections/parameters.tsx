import type { JSX } from "react";
import { chainFor } from "@/lib/system/nodes";
import { DEFAULT_PARAMS, PARAM_RANGES } from "@/lib/system/params";
import type { Params } from "@/lib/system/params";
import {
  DURATIONS,
  EASES,
  PALETTE,
  RADII,
  ROLES,
} from "@/lib/system/source.generated";

const TOKENS = [
  ...new Set([
    ...Object.keys(PALETTE),
    ...Object.keys(ROLES.day),
    ...Object.keys(RADII),
    ...Object.keys(DURATIONS),
    ...Object.keys(EASES),
  ]),
];

const PARAMS: ReadonlyArray<{
  key: keyof Params;
  label: string;
  moves: string;
}> = [
  {
    key: "hue",
    label: "Hue",
    moves: "Rotates every chromatic colour; neutrals stay put.",
  },
  {
    key: "round",
    label: "Roundness",
    moves: "Multiplies finite radii; zero and the pill stay fixed.",
  },
  {
    key: "tod",
    label: "Time of day",
    moves: "Blends every phase role between Dawn, Midday, Dusk and Night.",
  },
  {
    key: "contrast",
    label: "Contrast",
    moves: "Scales surface and on-* lightness about the shipped defaults.",
  },
  {
    key: "speed",
    label: "Motion speed",
    moves: "Divides every duration and time-scales the Glide spring.",
  },
];

export function ParametersSection(): JSX.Element {
  return (
    <div className="space-y-3">
      {PARAMS.map(({ key, label, moves }) => {
        const affected = TOKENS.filter((token) =>
          chainFor(token).some((node) => node.id === key),
        );
        const range = PARAM_RANGES[key];

        return (
          <div
            key={key}
            className="rounded-md bg-surface-container-low p-3 shadow-card"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <h3 className="text-sm font-medium">{label}</h3>
              <code className="font-mono text-[11px] tabular-nums text-on-surface-variant">
                {range.min}..{range.max} · step {range.step} · default{" "}
                {DEFAULT_PARAMS[key]}
              </code>
            </div>

            <p className="mt-1 text-xs leading-relaxed text-on-surface-variant">
              {moves}
            </p>

            <p className="mt-1 break-words font-mono text-[10px] leading-relaxed text-on-surface-variant">
              moves {affected.length} tokens
              {affected.length > 0
                ? ` · ${affected.slice(0, 4).join(", ")}`
                : ""}
            </p>
          </div>
        );
      })}
    </div>
  );
}
