import { useEffect, useRef } from "react";
import type { CSSProperties, RefObject } from "react";
import type { HorizonIntensityPeak } from "./horizon-intensity";
import { HorizonPauseScope } from "./horizon-pause-scope";
import { useLiveListeningTuning } from "./listening-tuning";
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
 * Bottom-corner blob tint: the phase hue at the phase's own alpha, scaled by the
 * preset's rest strength. The strength is a live calc() so it can follow the
 * phase fade to Night without a repaint of its own.
 */
function blobTint(blob: 1 | 2): string {
  return `color-mix(in srgb, var(--horizon-${blob}) calc(var(--horizon-${blob}-alpha) * var(--horizon-base-strength, 1) * 100%), transparent)`;
}

/**
 * The listening layer is additive: it paints only the extra strength, so the
 * base blob underneath keeps its own alpha and the two layers together equal
 * the shader's boosted base. Painting the full boosted alpha on top would
 * double the glow in the fallback.
 */
function listenTint(blob: 1 | 2, boost: number): string {
  const extra = Math.max(0, boost - 1);

  return `color-mix(in srgb, var(--horizon-${blob}) calc(var(--horizon-${blob}-alpha) * var(--horizon-base-strength, 1) * ${extra} * 100%), transparent)`;
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

/**
 * Blur is the 1440 token scaled down at smaller breakpoints. The listening
 * layer multiplies the same radius by its preset factor through
 * --horizon-blob-blur-scale, so the two renderers bake the same extra softness.
 */
const BLOB_CLASS =
  "absolute rounded-full blur-[calc(var(--horizon-blob-blur)*0.45*var(--horizon-blob-blur-scale,1))] md:blur-[calc(var(--horizon-blob-blur)*0.5333*var(--horizon-blob-blur-scale,1))] lg:blur-[calc(var(--horizon-blob-blur)*0.7111*var(--horizon-blob-blur-scale,1))] xl:blur-[calc(var(--horizon-blob-blur)*var(--horizon-blob-blur-scale,1))]";

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
  /**
   * Breathe-locked strength swing, as a fraction of the blob alpha (0.3 = up to
   * +30%). 0 leaves the glow steady, which is what / ships until a value is
   * picked.
   */
  intensityAmp?: number;
  /** Multiplier on intensityAmp while the Night phase is active (0.6 = softer). */
  nightIntensityScale?: number;
  /** Which end of the breath the intensity envelope peaks on. */
  intensityPeak?: HorizonIntensityPeak;
  /**
   * Glow strength at rest, as a multiple of the phase's own blob alpha. This is
   * the knob the user tunes: 1 is the Figma alpha, 4 the tuned "boost".
   */
  baseIntensity?: number;
  /** Rest strength in the Night phase; blends over the existing phase fade. */
  nightBaseIntensity?: number;
};

export const HORIZON_MOTION_DEFAULTS: Required<HorizonMotionTuning> = {
  driftPeriod: 110,
  driftTravelX: 1.5,
  driftTravelY: 1,
  breathePeriod: 16,
  breatheScale: 2,
  breatheDepth: 13,
  intensityAmp: 0,
  nightIntensityScale: 0.6,
  intensityPeak: "core",
  baseIntensity: 1,
  nightBaseIntensity: 1,
};

/**
 * The "listening" swell: the horizon grows, brightens and softens while the
 * ambient track plays.
 *
 * The shader animates every value on its own clock. The CSS fallback paints the
 * listening state as a second, pre-styled blob layer and only crossfades its
 * opacity, so nothing here ever becomes a per-frame CSS transition.
 */
export type HorizonListeningTuning = {
  /** Multiplier on the resting glow strength (1.35 = +35%). */
  intensityBoost: number;
  /** Breathe period while listening, in seconds. */
  breathePeriod: number;
  /** Breathe intensity swing while listening. */
  intensityAmp: number;
  /** Blob scale at full listen (1.25 = 25% wider). */
  blobScale: number;
  /** Upward lift at full listen, percent of the viewport height. */
  blobLift: number;
  /** Extra blur baked into the listening coverage texture (1.3 = 30% softer). */
  blurScale: number;
  /**
   * Peak viewport edge-blur radius at full listen, px at the 1440 base (the
   * CSS applies --edge-blur-fit). The master Immersion slider does not scale
   * this: it stays an absolute readability budget.
   */
  edgeBlurMax: number;
  /** Edge-blur band height at full listen, px before the content-margin clamp. */
  edgeBlurHeight: number;
  /** Seconds to swell in when playback starts. */
  inDuration: number;
  /** Seconds to settle back when playback pauses. */
  outDuration: number;
  /** Crossfade length under prefers-reduced-motion, in seconds. */
  reducedDuration: number;
};

/** How the static grain layer composites over the glow. */
export type HorizonDitherBlend = "normal" | "overlay" | "soft-light";

/**
 * Static grain that breaks up 8-bit banding in the dark, low-alpha glow.
 * Off by default so / keeps the untouched gradient.
 */
export type HorizonDither = {
  enabled?: boolean;
  /** Overlay opacity in percent (0-8). */
  strength?: number;
  blend?: HorizonDitherBlend;
};

/** Backdrop gradient interpolation; "oklab" adds eased intermediate stops. */
export type HorizonGradientMode = "srgb" | "oklab";

export const HORIZON_DITHER_DEFAULTS: Required<HorizonDither> = {
  enabled: false,
  strength: 3,
  blend: "normal",
};

/**
 * A tiled fractal-noise SVG, rasterised once by the browser and repeated. It
 * never animates, so it costs one paint at mount and nothing per frame.
 */
const NOISE_TILE_PX = 220;
const NOISE_URI = `url("data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="${NOISE_TILE_PX}" height="${NOISE_TILE_PX}"><filter id="n" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="3" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/></filter><rect width="${NOISE_TILE_PX}" height="${NOISE_TILE_PX}" filter="url(#n)"/></svg>`,
)}")`;

/** Smoothstep positions for the eased stops; denser at both ends. */
const EASED_STOPS = [0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875].map((t) => ({
  t,
  eased: Number((t * t * (3 - 2 * t)).toFixed(4)),
}));

function mix(from: string, to: string, percent: number): string {
  return `color-mix(in oklab, ${from} ${percent}%, ${to})`;
}

function easedRamp(
  from: string,
  to: string,
  start: string,
  span: string,
): string {
  return EASED_STOPS.map(
    ({ t, eased }) =>
      `${mix(from, to, t * 100)} calc(${start} + (${span}) * ${eased})`,
  ).join(", ");
}

const SRGB_BACKDROP =
  "linear-gradient(180deg, var(--horizon-base) 0%, var(--horizon-base) 70%, var(--horizon-mid) var(--horizon-mid-at), var(--horizon-3) 100%)";

/*
 * The banding is the gradient's own quantisation: over the 70% -> 100% ramp the
 * channel values move a few steps, so each step reads as a ring. Oklab makes
 * the ramp perceptually even and the extra stops keep long straight segments
 * from concentrating the steps.
 */
const OKLAB_BACKDROP = `linear-gradient(in oklab 180deg, var(--horizon-base) 0%, var(--horizon-base) 70%, ${easedRamp(
  "var(--horizon-base)",
  "var(--horizon-mid)",
  "70%",
  "var(--horizon-mid-at) - 70%",
)}, var(--horizon-mid) var(--horizon-mid-at), ${easedRamp(
  "var(--horizon-mid)",
  "var(--horizon-3)",
  "var(--horizon-mid-at)",
  "100% - var(--horizon-mid-at)",
)}, var(--horizon-3) 100%)`;

export function backdropGradient(mode: HorizonGradientMode): string {
  return mode === "oklab" ? OKLAB_BACKDROP : SRGB_BACKDROP;
}

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

/**
 * A CSS animation starts when its element first renders, so a pulse switched on
 * later than its breathe wrapper would run beside the breath at a random
 * offset. Copy the wrapper's start time, and the two share one clock.
 */
function useBreatheClock(
  ref: RefObject<HTMLDivElement | null>,
  attached: boolean,
): void {
  useEffect(() => {
    const element = ref.current;

    if (!element || typeof element.getAnimations !== "function") return;

    const pulse = element.getAnimations()[0];
    const breathe = element
      .closest<HTMLElement>(".horizon-motion-breathe")
      ?.getAnimations()[0];

    if (!pulse || !breathe || breathe.startTime === null) return;

    pulse.startTime = breathe.startTime;
  }, [ref, attached]);
}

function HorizonBlob({
  blob,
  motion,
  tuning,
  listening,
}: {
  blob: 1 | 2;
  motion: HorizonMotionVariant;
  tuning?: HorizonMotionTuning;
  listening?: HorizonListeningTuning;
}) {
  const pulseRef = useRef<HTMLDivElement | null>(null);
  const visual = (
    <div
      data-horizon-blob=""
      className={BLOB_CLASS}
      style={{ ...blobBox(blob), backgroundColor: blobTint(blob) }}
    />
  );

  const { intensityAmp, nightIntensityScale, intensityPeak } =
    withDefaults(tuning);
  const breathes = motion === "breathe" || motion === "drift-breathe";
  const pulseOn = motion !== "none" && breathes && intensityAmp > 0;

  useBreatheClock(pulseRef, pulseOn);

  /*
   * The CSS fallback's listening state: the same blob, with the preset's extra
   * strength, blur and geometry, painted once and crossfaded by opacity under
   * :root[data-listening]. It sits inside the drift/breathe wrappers, so it
   * keeps the ambient motion; only opacity transitions (horizon-motion.css).
   */
  const listenLayer = listening ? (
    <div
      aria-hidden="true"
      className="horizon-listen-layer absolute inset-0"
      style={
        {
          "--horizon-listen-scale": `${listening.blobScale}`,
          "--horizon-listen-lift": `${listening.blobLift}%`,
          "--horizon-listen-in": `${listening.inDuration}s`,
          "--horizon-listen-out": `${listening.outDuration}s`,
          "--horizon-listen-reduced": `${listening.reducedDuration}s`,
        } as CSSProperties
      }
    >
      <div
        data-horizon-blob=""
        className={BLOB_CLASS}
        style={
          {
            ...blobBox(blob),
            backgroundColor: listenTint(blob, listening.intensityBoost),
            "--horizon-blob-blur-scale": `${listening.blurScale}`,
          } as CSSProperties
        }
      />
    </div>
  ) : null;

  if (motion === "none") {
    return (
      <>
        {visual}
        {listenLayer}
      </>
    );
  }

  /*
   * A second copy of the blob, on the breathe wrapper, whose opacity carries the
   * intensity envelope. Stacking the same tint twice raises the colour strength
   * exactly as the shader's alpha multiplier does, and opacity is the one
   * property that stays on the compositor over an already-rasterised blur.
   * Not rendered at amp 0, so / adds no layer.
   */
  const pulse = pulseOn ? (
    <div
      ref={pulseRef}
      aria-hidden="true"
      data-horizon-blob=""
      data-peak={intensityPeak}
      className={`${BLOB_CLASS} horizon-motion-intensity`}
      style={
        {
          ...blobBox(blob),
          backgroundColor: blobTint(blob),
          "--horizon-intensity-amp": `${intensityAmp}`,
          "--horizon-intensity-night": `${nightIntensityScale}`,
          /* The pulse layer's own rest alpha, for the stacking correction. */
          "--horizon-blob-alpha": `var(--horizon-${blob}-alpha)`,
        } as CSSProperties
      }
    />
  ) : null;

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
        {pulse}
        {listenLayer}
      </div>
    </div>
  );
}

export function HorizonBackground({
  position = "absolute",
  motion = "none",
  tuning,
  dither,
  gradient = "srgb",
  listening,
}: {
  position?: "absolute" | "fixed";
  motion?: HorizonMotionVariant;
  tuning?: HorizonMotionTuning;
  dither?: HorizonDither;
  gradient?: HorizonGradientMode;
  listening?: HorizonListeningTuning;
}) {
  const placement = position === "fixed" ? "fixed" : "absolute";
  const grain = { ...HORIZON_DITHER_DEFAULTS, ...dither };
  const { baseIntensity, nightBaseIntensity } = withDefaults(tuning);
  // The dev tuner's live values beat the static preset; null in production.
  const liveListening = useLiveListeningTuning() ?? listening;

  const blobs = (
    <>
      <HorizonBlob
        blob={1}
        motion={motion}
        tuning={tuning}
        listening={liveListening}
      />
      <HorizonBlob
        blob={2}
        motion={motion}
        tuning={tuning}
        listening={liveListening}
      />
    </>
  );

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none ${placement} inset-0 overflow-hidden horizon-night-scope${
        grain.enabled ? " isolate" : ""
      }`}
      style={
        {
          "--horizon-base-intensity": `${baseIntensity}`,
          "--horizon-night-base-intensity": `${nightBaseIntensity}`,
        } as CSSProperties
      }
    >
      <div
        className="absolute inset-0"
        style={{ backgroundImage: backdropGradient(gradient) }}
      />

      {motion === "none" ? (
        blobs
      ) : (
        <HorizonPauseScope motion={motion}>{blobs}</HorizonPauseScope>
      )}

      {/* Static, tiled grain: breaks the 8-bit steps without moving a pixel. */}
      {grain.enabled && grain.strength > 0 ? (
        <div
          className="horizon-grain absolute inset-0"
          style={{
            backgroundImage: NOISE_URI,
            backgroundSize: `${NOISE_TILE_PX}px ${NOISE_TILE_PX}px`,
            backgroundRepeat: "repeat",
            opacity: grain.strength / 100,
            mixBlendMode: grain.blend,
          }}
        />
      ) : null}
    </div>
  );
}
