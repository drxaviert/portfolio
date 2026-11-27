import { describe, expect, it, vi } from "vitest";
import {
  REDUCED_MAX,
  bandLevel,
  createAudioBands,
  smoothToward,
} from "./audio-bands";
import type { AudioContextLike } from "./audio-bands";

function makeHarness(options: { reduced?: boolean } = {}) {
  let time = 1000;
  const fill = { value: 0, from: 0, to: 512 };
  const connectedSource = { connect: vi.fn(), disconnect: vi.fn() };
  const analyser = {
    fftSize: 0,
    smoothingTimeConstant: 0,
    frequencyBinCount: 512,
    getByteFrequencyData: vi.fn((data: Uint8Array) => {
      data.fill(0);
      data.fill(fill.value, fill.from, fill.to);
    }),
    connect: vi.fn(),
    disconnect: vi.fn(),
  };
  const context: AudioContextLike = {
    state: "suspended",
    sampleRate: 48000,
    destination: {},
    resume: vi.fn(async () => {}),
    createAnalyser: () => analyser,
    createMediaElementSource: vi.fn(() => connectedSource),
  };
  const createContext = vi.fn(() => context);
  const bands = createAudioBands({
    createContext,
    now: () => time,
    reducedMotion: () => options.reduced ?? false,
  });

  return {
    bands,
    analyser,
    context,
    createContext,
    source: connectedSource,
    fill,
    advance(ms: number) {
      time += ms;
    },
    /** Reads the getter once per 16ms step for `ms`. */
    run(ms: number) {
      for (let elapsed = 0; elapsed < ms; elapsed += 16) {
        time += 16;
        bands.getBands();
      }
    },
  };
}

describe("smoothToward", () => {
  it("attacks faster than it releases", () => {
    const up = smoothToward(0, 1, 0.05, 0.06, 0.35);
    const down = 1 - smoothToward(1, 0, 0.05, 0.06, 0.35);

    expect(up).toBeGreaterThan(down);
    expect(up).toBeGreaterThan(0);
    expect(up).toBeLessThan(1);
  });

  it("does not move when no time has passed", () => {
    expect(smoothToward(0.4, 1, 0, 0.06, 0.35)).toBe(0.4);
  });
});

describe("bandLevel", () => {
  it("averages only the bins inside the range", () => {
    const data = new Uint8Array(512);

    data.fill(255, 1, 6);
    expect(bandLevel(data, 48000, 20, 250)).toBeCloseTo(5 / 7, 3);
    expect(bandLevel(data, 48000, 2000, 12000)).toBe(0);
  });
});

describe("createAudioBands", () => {
  it("reads 0 until something plays", () => {
    const h = makeHarness();
    const audio = document.createElement("audio");

    h.bands.prepare();
    h.bands.attach(audio);
    h.fill.value = 255;
    h.run(500);

    expect(h.bands.getBands()).toEqual({
      bass: 0,
      mid: 0,
      high: 0,
      energy: 0,
    });
  });

  it("creates the context and resumes it from prepare", () => {
    const h = makeHarness();

    h.bands.prepare();

    expect(h.createContext).toHaveBeenCalledTimes(1);
    expect(h.context.resume).toHaveBeenCalledTimes(1);
    expect(h.analyser.fftSize).toBe(1024);
  });

  it("routes an element through the analyser once", () => {
    const h = makeHarness();
    const audio = document.createElement("audio");

    h.bands.attach(audio);
    h.bands.attach(audio);

    expect(h.context.createMediaElementSource).toHaveBeenCalledTimes(1);
    expect(h.source.connect).toHaveBeenCalledWith(h.analyser);

    h.bands.detach(audio);
    expect(h.source.disconnect).toHaveBeenCalledTimes(1);
  });

  it("rises toward the spectrum while playing, within 0..1", () => {
    const h = makeHarness();

    h.bands.prepare();
    h.bands.setPlaying(true);
    h.fill.value = 200;
    h.run(1000);

    const value = h.bands.getBands();

    for (const key of ["bass", "mid", "high", "energy"] as const) {
      expect(value[key]).toBeGreaterThan(0.5);
      expect(value[key]).toBeLessThanOrEqual(1);
    }
  });

  it("tracks bass separately from high", () => {
    const h = makeHarness();

    h.bands.prepare();
    h.bands.setPlaying(true);
    h.fill.from = 1;
    h.fill.to = 6;
    h.fill.value = 255;
    h.run(1000);

    const value = h.bands.getBands();

    expect(value.bass).toBeGreaterThan(0.8);
    expect(value.high).toBe(0);
  });

  it("returns to exactly 0 within about a second of a pause", () => {
    const h = makeHarness();

    h.bands.prepare();
    h.bands.setPlaying(true);
    h.fill.value = 255;
    h.run(1000);
    expect(h.bands.getBands().energy).toBeGreaterThan(0.5);

    h.bands.setPlaying(false);
    h.run(1200);

    expect(h.bands.getBands()).toEqual({
      bass: 0,
      mid: 0,
      high: 0,
      energy: 0,
    });
  });

  it("reuses one object so the shader tick allocates nothing", () => {
    const h = makeHarness();

    expect(h.bands.getBands()).toBe(h.bands.getBands());
  });

  it("samples the analyser at most once per frame interval", () => {
    const h = makeHarness();

    h.bands.prepare();
    h.bands.setPlaying(true);
    h.advance(20);
    h.bands.getBands();
    h.bands.getBands();
    h.bands.getBands();

    expect(h.analyser.getByteFrequencyData).toHaveBeenCalledTimes(1);
  });

  it("collapses to one slow, capped energy under reduced motion", () => {
    const h = makeHarness({ reduced: true });

    h.bands.prepare();
    h.bands.setPlaying(true);
    h.fill.from = 1;
    h.fill.to = 6;
    h.fill.value = 255;
    h.run(300);

    const early = h.bands.getBands();

    expect(early.bass).toBe(early.energy);
    expect(early.high).toBe(early.energy);
    // Slow: nowhere near the raw value after 300ms.
    expect(early.energy).toBeLessThan(0.15);

    h.run(15000);

    expect(h.bands.getBands().energy).toBeLessThanOrEqual(REDUCED_MAX);
  });

  it("stays at 0 when no AudioContext exists", () => {
    const bands = createAudioBands({
      createContext: () => null,
      now: () => 0,
      reducedMotion: () => false,
    });

    bands.prepare();
    bands.attach(document.createElement("audio"));
    bands.setPlaying(true);

    expect(bands.getBands().energy).toBe(0);
  });
});
