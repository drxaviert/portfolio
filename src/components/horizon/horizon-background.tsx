import type { CSSProperties } from "react";

/**
 * "Horizon glow" page background.
 *
 * Mirrors the bg / stripe gradient in the Figma 1440 frames (Day 121:2004,
 * Night 121:3244, Dawn 121:4483, Dusk 121:5722): a flat surface that holds to
 * 70%, then lifts into a phase tint at the bottom edge, with two blurred
 * ellipses tucked below the fold. Every colour and the blob geometry come from
 * per-phase --horizon-* tokens (globals.css), so data-phase alone recolours
 * every layer and the dev glow panel can tune the current phase.
 *
 * `fixed` covers the viewport on the home page; `absolute` fills the sized
 * container it sits in (the prototype). Both are decorative and stay behind
 * the content: the caller places the content in a positioned element after
 * this one, so no stacking hack is needed.
 *
 * Bottom-corner blob tint: the phase hue at the phase's own alpha.
 */
function blobTint(blob: 1 | 2): string {
  return `color-mix(in srgb, var(--horizon-${blob}) calc(var(--horizon-${blob}-alpha) * 100%), transparent)`;
}

/** 900x420 at -200/860 and 1000x460 at 700/820 in the 1440 frame. */
function blobBox(blob: 1 | 2): CSSProperties {
  return {
    top: `var(--horizon-blob-${blob}-top)`,
    left: `var(--horizon-blob-${blob}-left)`,
    width: `var(--horizon-blob-${blob}-width)`,
    height: `var(--horizon-blob-${blob}-height)`,
  };
}

export function HorizonBackground({
  position = "absolute",
}: {
  position?: "absolute" | "fixed";
}) {
  const placement = position === "fixed" ? "fixed" : "absolute";

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none ${placement} inset-0 overflow-hidden`}
    >
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(180deg, var(--horizon-base) 0%, var(--horizon-base) 70%, var(--horizon-mid) var(--horizon-mid-at), var(--horizon-3) 100%)",
        }}
      />

      {/* Blur is the 1440 token scaled down at smaller breakpoints. */}
      <div
        className="absolute rounded-full blur-[calc(var(--horizon-blob-blur)*0.45)] md:blur-[calc(var(--horizon-blob-blur)*0.5333)] lg:blur-[calc(var(--horizon-blob-blur)*0.7111)] xl:blur-[var(--horizon-blob-blur)]"
        style={{ ...blobBox(1), backgroundColor: blobTint(1) }}
      />
      <div
        className="absolute rounded-full blur-[calc(var(--horizon-blob-blur)*0.45)] md:blur-[calc(var(--horizon-blob-blur)*0.5333)] lg:blur-[calc(var(--horizon-blob-blur)*0.7111)] xl:blur-[var(--horizon-blob-blur)]"
        style={{ ...blobBox(2), backgroundColor: blobTint(2) }}
      />
    </div>
  );
}
