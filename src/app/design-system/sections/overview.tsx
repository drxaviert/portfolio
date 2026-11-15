import type { JSX } from "react";
import { MotionDemo } from "@/components/system/motion-demo";
import { chainFor, consumersOf } from "@/lib/system/nodes";

export function OverviewSection(): JSX.Element {
  const chain = chainFor("--primary");
  const consumers = consumersOf("--primary");

  return (
    <div className="space-y-6">
      <p className="max-w-2xl text-xs leading-relaxed text-on-surface-variant">
        A small set of source parameters derives every colour, radius, duration
        and component state on this page. Nothing is hand-typed: the engine
        writes the values, the components read them, and this page documents the
        same graph the engine runs.
      </p>

      <div>
        <h3 className="text-sm font-medium">How a value is made</h3>
        <p className="mt-1 text-xs text-on-surface-variant">
          The chain for <code className="font-mono">--primary</code>, from its
          parameters to the components that consume it.
        </p>
        <ol className="mt-3 flex flex-wrap items-center gap-2">
          {chain.map((node, index) => (
            <li key={node.id} className="flex items-center gap-2">
              {index > 0 ? (
                <span aria-hidden="true" className="text-on-surface-variant">
                  →
                </span>
              ) : null}
              <span className="rounded-sm bg-surface-container px-2 py-1 font-mono text-[11px]">
                {node.id}
              </span>
            </li>
          ))}
          {consumers.map((consumer) => (
            <li key={consumer} className="flex items-center gap-2">
              <span aria-hidden="true" className="text-on-surface-variant">
                →
              </span>
              <span className="rounded-sm bg-surface-container-high px-2 py-1 text-[11px] font-medium">
                {consumer}
              </span>
            </li>
          ))}
        </ol>
      </div>

      <div className="rounded-lg bg-surface-container-low p-4 shadow-card">
        <p className="text-xs font-medium">Live demo</p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            type="button"
            className="h-11 rounded-md bg-primary px-4 text-sm font-medium text-on-primary"
          >
            Primary action
          </button>
          <span
            aria-hidden="true"
            className="block size-10 rounded-lg bg-surface-container-high shadow-card"
          />
          <span
            aria-hidden="true"
            className="block h-10 w-20 rounded-full bg-secondary"
          />
        </div>
        <div className="mt-4">
          <MotionDemo kind="duration" token="--duration-medium-5" />
        </div>
      </div>
    </div>
  );
}
