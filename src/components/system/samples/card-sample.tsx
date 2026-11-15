import type { JSX, ReactNode } from "react";
import { RingLayers } from "@/components/home/ring-hover";
import type { ForceState } from "@/components/system/component-doc";
import "@/components/home/ring-hover.css";
import "../force-state.css";

/**
 * The documented Card. It mirrors the live ProjectCard markup (ring-host,
 * RingLayers, shadow-card from the host, the ring-title transform) so the doc
 * can force a state with data-state without touching the home files.
 */
export function CardSample({
  forceState,
  children,
}: {
  forceState?: ForceState;
  children?: ReactNode;
}): JSX.Element {
  return (
    <article
      data-state={forceState}
      className="ring-host flex h-full flex-col justify-end rounded-lg p-5 shadow-card md:p-8"
    >
      <RingLayers fill="bg-surface-container-low" />
      <p className="ring-title text-balance text-title-sm font-semibold md:text-title">
        {children ?? "Project name"}
      </p>
    </article>
  );
}
