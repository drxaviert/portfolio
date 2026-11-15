"use client";

import { useEffect, useRef } from "react";
import type { JSX } from "react";
import { useSystemEngine } from "@/app/design-system/system-shell";
import {
  GLIDE_LEAD_SPRING,
  GLIDE_TRAIL_SPRING,
} from "@/components/home/glide-spring";
import type { GlideSpring } from "@/components/home/glide-spring";
import { MotionDemo } from "@/components/system/motion-demo";
import { TokenRow } from "@/components/system/token-row";
import { M3_DURATIONS } from "@/lib/system/m3-scale";
import { DURATIONS, EASES } from "@/lib/system/source.generated";

const DURATION_TOKENS = Object.keys(DURATIONS);
const EASE_TOKENS = Object.keys(EASES);

function msFromToken(value: string): number | null {
  const match = /^(-?[\d.]+)(ms|s)$/.exec(value.trim());

  if (!match) return null;

  const amount = Number(match[1]);

  return match[2] === "s" ? amount * 1000 : amount;
}

const TODAY = DURATION_TOKENS.map((token) => ({
  token,
  ms: msFromToken(DURATIONS[token]) ?? Number.POSITIVE_INFINITY,
}));

function nearestToday(ms: number): { token: string; ms: number } {
  return TODAY.reduce((nearest, entry) =>
    Math.abs(entry.ms - ms) < Math.abs(nearest.ms - ms) ? entry : nearest,
  );
}

function SpringRow({
  label,
  spring,
}: {
  label: string;
  spring: GlideSpring;
}): JSX.Element {
  const engine = useSystemEngine();
  const stiffnessRef = useRef<HTMLSpanElement | null>(null);
  const dampingRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    const update = () => {
      const scaled = engine.spring(spring);

      if (stiffnessRef.current) {
        stiffnessRef.current.textContent = `${scaled.stiffness}`;
      }

      if (dampingRef.current) {
        dampingRef.current.textContent = `${scaled.dampingRatio}`;
      }
    };

    update();

    return engine.subscribe(() => update());
  }, [engine, spring]);

  return (
    <div className="rounded-md bg-surface-container-low p-3 shadow-card">
      <p className="text-xs font-medium">{label}</p>
      <dl className="mt-2 grid grid-cols-2 gap-2 font-mono text-[11px] tabular-nums">
        <div>
          <dt className="text-on-surface-variant">stiffness</dt>
          <dd ref={stiffnessRef}>{spring.stiffness}</dd>
        </div>
        <div>
          <dt className="text-on-surface-variant">dampingRatio</dt>
          <dd ref={dampingRef}>{spring.dampingRatio}</dd>
        </div>
      </dl>
    </div>
  );
}

export function MotionSection(): JSX.Element {
  return (
    <div className="space-y-8">
      <p className="max-w-2xl text-xs leading-relaxed text-on-surface-variant">
        Durations are multiplied by Motion speed; easings never change. Replay
        runs one demo on demand, reduce motion jumps to the end state, and the
        Glide capsule is documented as the spring it is.
      </p>

      <div>
        <h3 className="text-sm font-medium">Durations</h3>
        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          {DURATION_TOKENS.map((token) => (
            <div key={token} className="space-y-2">
              <TokenRow
                token={token}
                usage="Duration token. Motion speed divides it."
              />
              <MotionDemo kind="duration" token={token} />
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-medium">Easings</h3>
        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          {EASE_TOKENS.map((token) => (
            <div key={token} className="space-y-2">
              <TokenRow
                token={token}
                usage="Easing token. Motion speed does not change it."
              />
              <MotionDemo kind="ease" token={token} />
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-medium">Glide spring</h3>
        <p className="mt-1 max-w-2xl text-xs leading-relaxed text-on-surface-variant">
          Two damped springs, not a duration. Speed scales stiffness by s² and
          leaves dampingRatio alone, which is already scale-invariant.
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <SpringRow label="Lead edge" spring={GLIDE_LEAD_SPRING} />
          <SpringRow label="Trail edge" spring={GLIDE_TRAIL_SPRING} />
        </div>
      </div>

      <div>
        <h3 className="text-sm font-medium">
          Today’s durations vs an M3-style scale
        </h3>
        <p className="mt-1 max-w-2xl text-xs leading-relaxed text-on-surface-variant">
          Comparison only. No token changes until Dat decides; the right column
          is today’s nearest value for each M3 step.
        </p>

        <div className="mt-3 overflow-x-auto rounded-lg bg-surface-container-low shadow-card">
          <table aria-label="Duration comparison" className="w-full min-w-[30rem] text-left text-xs">
            <thead>
              <tr className="text-[10px] uppercase tracking-wide text-on-surface-variant">
                <th scope="col" className="px-3 py-2 font-medium">
                  M3-style
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  Nearest today
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  Today’s value
                </th>
              </tr>
            </thead>
            <tbody>
              {M3_DURATIONS.map((entry) => {
                const nearest = nearestToday(entry.ms);

                return (
                  <tr key={entry.token}>
                    <td className="px-3 py-1.5 font-mono tabular-nums">
                      {entry.ms}ms
                    </td>
                    <td className="px-3 py-1.5">
                      <code className="font-mono text-[11px]">
                        {nearest.token}
                      </code>
                    </td>
                    <td className="px-3 py-1.5 font-mono tabular-nums text-on-surface-variant">
                      {nearest.ms}ms
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
