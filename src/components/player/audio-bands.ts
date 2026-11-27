/**
 * Shared audio analyser: smoothed 0..1 bass, mid, high and overall energy for
 * the horizon shader's rAF tick.
 *
 * `getBands()` is a plain getter, not React state. It samples the analyser at
 * most once per ~16ms and returns the same mutable object every call, so a
 * shader reading it each frame allocates nothing. Nothing playing means zeros.
 *
 * The AudioContext is created or resumed in `prepare()`, which the player
 * calls from the user's play gesture (autoplay policy). Under
 * prefers-reduced-motion all four values collapse to one slow-moving energy
 * level, so the picture breathes with the track instead of pulsing with it.
 */

export type AudioBands = {
  bass: number;
  mid: number;
  high: number;
  energy: number;
};

export type AnalyserLike = {
  fftSize: number;
  smoothingTimeConstant: number;
  readonly frequencyBinCount: number;
  getByteFrequencyData: (data: Uint8Array<ArrayBuffer>) => void;
  connect: (destination: unknown) => unknown;
  disconnect: () => void;
};

export type SourceLike = {
  connect: (destination: unknown) => unknown;
  disconnect: () => void;
};

export type AudioContextLike = {
  readonly state: string;
  readonly sampleRate: number;
  readonly destination: unknown;
  resume: () => Promise<void>;
  createAnalyser: () => AnalyserLike;
  createMediaElementSource: (element: HTMLMediaElement) => SourceLike;
  close?: () => Promise<void>;
};

export type AudioBandsDeps = {
  createContext: () => AudioContextLike | null;
  now: () => number;
  reducedMotion: () => boolean;
};

export type AudioBandsStore = {
  /** Call from the play gesture: creates or resumes the AudioContext. */
  prepare: () => void;
  /** Routes the element through the analyser. Safe to call again. */
  attach: (element: HTMLMediaElement) => void;
  detach: (element: HTMLMediaElement) => void;
  /** Whether the track is audibly playing; false decays the values to 0. */
  setPlaying: (playing: boolean) => void;
  /** Current smoothed values. Same object every call; read, do not keep. */
  getBands: () => Readonly<AudioBands>;
};

export const BAND_RANGES_HZ = {
  bass: [20, 250],
  mid: [250, 2000],
  high: [2000, 12000],
} as const;

/** Time constants in seconds: fast attack so beats land, slower release. */
export const ATTACK_S = 0.06;
export const RELEASE_S = 0.35;
export const REDUCED_S = 1.8;
/** Release once playback stops, so a pause reads as 0 within about a second. */
export const STOPPED_S = 0.12;
/** Reduced motion never swings wide. */
export const REDUCED_MAX = 0.5;
const SAMPLE_INTERVAL_MS = 16;
const ZERO_EPSILON = 0.002;
/** Averaged FFT magnitudes sit low; this lifts them into a useful 0..1. */
const BAND_GAIN = { bass: 1.25, mid: 1.9, high: 2.8 } as const;

function clamp01(value: number) {
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

/** Exponential smoothing step: reaches ~63% of the gap after `tau` seconds. */
export function smoothToward(
  previous: number,
  target: number,
  dt: number,
  attackS: number,
  releaseS: number,
): number {
  const tau = target > previous ? attackS : releaseS;
  const factor = 1 - Math.exp(-Math.max(0, dt) / Math.max(1e-4, tau));

  return previous + (target - previous) * factor;
}

/** Mean magnitude (0..1) of the FFT bins between two frequencies. */
export function bandLevel(
  data: ArrayLike<number>,
  sampleRate: number,
  low: number,
  high: number,
): number {
  const binHz = sampleRate / 2 / data.length;
  const first = Math.max(0, Math.floor(low / binHz));
  const last = Math.min(data.length - 1, Math.ceil(high / binHz));

  if (last < first) return 0;

  let sum = 0;

  for (let i = first; i <= last; i += 1) sum += data[i] ?? 0;

  return sum / (last - first + 1) / 255;
}

export function createAudioBands(
  deps: Partial<AudioBandsDeps> = {},
): AudioBandsStore {
  const createContext =
    deps.createContext ??
    (() => {
      if (typeof window === "undefined") return null;

      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;

      return Ctor ? (new Ctor() as unknown as AudioContextLike) : null;
    });
  const now = deps.now ?? (() => performance.now());
  const reducedMotion =
    deps.reducedMotion ??
    (() =>
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches);

  const bands: AudioBands = { bass: 0, mid: 0, high: 0, energy: 0 };
  let context: AudioContextLike | null = null;
  let analyser: AnalyserLike | null = null;
  let data: Uint8Array<ArrayBuffer> | null = null;
  const sources = new Map<HTMLMediaElement, SourceLike>();
  let playing = false;
  let reduced = false;
  let lastSample = now();

  function ensureContext() {
    if (!context) {
      try {
        context = createContext();
      } catch {
        context = null;
      }

      if (context) {
        analyser = context.createAnalyser();
        analyser.fftSize = 1024;
        analyser.smoothingTimeConstant = 0.6;
        analyser.connect(context.destination);
        data = new Uint8Array(analyser.frequencyBinCount);
      }
    }

    return context;
  }

  function prepare() {
    reduced = reducedMotion();

    const ctx = ensureContext();

    if (ctx && ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }
  }

  function attach(element: HTMLMediaElement) {
    const ctx = ensureContext();

    if (!ctx || !analyser || sources.has(element)) return;

    // An element can be wrapped only once, and wrapping reroutes its output
    // through the graph: it must reach the destination via the analyser.
    const source = ctx.createMediaElementSource(element);

    source.connect(analyser);
    sources.set(element, source);
  }

  function detach(element: HTMLMediaElement) {
    const source = sources.get(element);

    if (!source) return;

    source.disconnect();
    sources.delete(element);
  }

  function setPlaying(next: boolean) {
    playing = next;
    lastSample = now();
  }

  function sample() {
    const time = now();
    const dt = (time - lastSample) / 1000;

    if (dt * 1000 < SAMPLE_INTERVAL_MS) return;

    lastSample = time;

    let rawBass = 0;
    let rawMid = 0;
    let rawHigh = 0;

    if (playing && analyser && data && context) {
      analyser.getByteFrequencyData(data);

      const rate = context.sampleRate;

      rawBass = clamp01(
        bandLevel(data, rate, ...BAND_RANGES_HZ.bass) * BAND_GAIN.bass,
      );
      rawMid = clamp01(
        bandLevel(data, rate, ...BAND_RANGES_HZ.mid) * BAND_GAIN.mid,
      );
      rawHigh = clamp01(
        bandLevel(data, rate, ...BAND_RANGES_HZ.high) * BAND_GAIN.high,
      );
    }

    const rawEnergy = clamp01(rawBass * 0.45 + rawMid * 0.35 + rawHigh * 0.2);
    const release = playing ? RELEASE_S : STOPPED_S;

    if (reduced) {
      const slow = smoothToward(
        bands.energy,
        Math.min(REDUCED_MAX, rawEnergy),
        dt,
        REDUCED_S,
        playing ? REDUCED_S : STOPPED_S,
      );

      bands.energy = bands.bass = bands.mid = bands.high = slow;
    } else {
      bands.bass = smoothToward(bands.bass, rawBass, dt, ATTACK_S, release);
      bands.mid = smoothToward(bands.mid, rawMid, dt, ATTACK_S, release);
      bands.high = smoothToward(bands.high, rawHigh, dt, ATTACK_S, release);
      bands.energy = smoothToward(
        bands.energy,
        rawEnergy,
        dt,
        ATTACK_S,
        release,
      );
    }

    if (!playing) {
      for (const key of ["bass", "mid", "high", "energy"] as const) {
        if (bands[key] < ZERO_EPSILON) bands[key] = 0;
      }
    }
  }

  return {
    prepare,
    attach,
    detach,
    setPlaying,
    getBands() {
      sample();
      return bands;
    },
  };
}

/** The app-wide analyser, shared by the player and the horizon shader. */
export const audioBands = createAudioBands();
