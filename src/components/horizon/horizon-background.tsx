import type { CSSProperties } from "react";
import { HorizonPauseScope } from "./horizon-pause-scope";
import "./horizon-motion.css";

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
 * Motion is opt-in. With the default "none" the DOM is the static gradient and
 * two blobs, exactly as before; the ambient wrappers and the visibility
 * listener only exist when a prototype asks for them.
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

/** Blur is the 1440 token scaled down at smaller breakpoints. */
const BLOB_CLASS =
  "absolute rounded-full blur-[calc(var(--horizon-blob-blur)*0.45)] md:blur-[calc(var(--horizon-blob-blur)*0.5333)] lg:blur-[calc(var(--horizon-blob-blur)*0.7111)] xl:blur-[var(--horizon-blob-blur)]";

export type HorizonMotionVariant =
  "none" | "drift" | "breathe" | "drift-breathe";

/** Prototype tuning. All values are plain numbers so sliders can drive them. */
export type HorizonMotionTuning = {
  /** Seconds for blob 1's drift loop; blob 2 runs ~18% faster. */
  driftPeriod?: number;
  /** Horizontal drift travel, percent of the viewport. */
  driftTravelX?: number;
  /** Vertical drift travel, percent of the viewport. */
  driftTravelY?: number;
  /** Seconds for one breathe cycle. */
  breathePeriod?: number;
  /** Scale at the top of the breath, in percent (2 = 1.02). */
  breatheScale?: number;
  /** Opacity drop at the bottom of the breath, in percent (13 = 0.87). */
  breatheDepth?: number;
};

export const HORIZON_MOTION_DEFAULTS: Required<HorizonMotionTuning> = {
  driftPeriod: 110,
  driftTravelX: 1.5,
  driftTravelY: 1,
  breathePeriod: 16,
  breatheScale: 2,
  breatheDepth: 13,
};

/** Blob 2's loop is deliberately a different length, so the pair never syncs. */
const SECOND_BLOB_PERIOD_RATIO = 0.82;
/** Start blob 2 partway round, not at zero, for the same reason. */
const SECOND_BLOB_DELAY_RATIO = 0.37;

function withDefaults(tuning?: HorizonMotionTuning) {
  return { ...HORIZON_MOTION_DEFAULTS, ...tuning };
}

function driftStyle(blob: 1 | 2, tuning?: HorizonMotionTuning): CSSProperties {
  const { driftPeriod, driftTravelX, driftTravelY } = withDefaults(tuning);
  const period =
    blob === 1 ? driftPeriod : driftPeriod * SECOND_BLOB_PERIOD_RATIO;
  const delay = blob === 1 ? 0 : -period * SECOND_BLOB_DELAY_RATIO;

  return {
    "--horizon-drift-period": `${period}s`,
    "--horizon-drift-delay": `${delay}s`,
    "--horizon-drift-x": `${driftTravelX}%`,
    "--horizon-drift-y": `${driftTravelY}%`,
  } as CSSProperties;
}

function breatheStyle(
  blob: 1 | 2,
  tuning?: HorizonMotionTuning,
): CSSProperties {
  const { breathePeriod, breatheScale, breatheDepth } = withDefaults(tuning);

  return {
    "--horizon-breathe-period": `${breathePeriod}s`,
    // Half a cycle apart, so one blob inhales while the other exhales.
    "--horizon-breathe-delay": `${blob === 1 ? 0 : -breathePeriod / 2}s`,
    "--horizon-breathe-scale": `${1 + breatheScale / 100}`,
    "--horizon-breathe-depth": `${breatheDepth / 100}`,
  } as CSSProperties;
}

function HorizonBlob({
  blob,
  motion,
  tuning,
}: {
  blob: 1 | 2;
  motion: HorizonMotionVariant;
  tuning?: HorizonMotionTuning;
}) {
  const visual = (
    <div
      className={BLOB_CLASS}
      style={{ ...blobBox(blob), backgroundColor: blobTint(blob) }}
    />
  );

  if (motion === "none") return visual;

  return (
    <div
      className="horizon-motion-drift"
      data-blob={blob}
      style={driftStyle(blob, tuning)}
    >
      <div
        className="horizon-motion-breathe"
        data-blob={blob}
        style={breatheStyle(blob, tuning)}
      >
        {visual}
      </div>
    </div>
  );
}

export function HorizonBackground({
  position = "absolute",
  motion = "none",
  tuning,
}: {
  position?: "absolute" | "fixed";
  motion?: HorizonMotionVariant;
  tuning?: HorizonMotionTuning;
}) {
  const placement = position === "fixed" ? "fixed" : "absolute";

  const blobs = (
    <>
      <HorizonBlob blob={1} motion={motion} tuning={tuning} />
      <HorizonBlob blob={2} motion={motion} tuning={tuning} />
    </>
  );

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

      {motion === "none" ? (
        blobs
      ) : (
        <HorizonPauseScope motion={motion}>{blobs}</HorizonPauseScope>
      )}
    </div>
  );
}
