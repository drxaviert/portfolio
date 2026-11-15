import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_PARAMS } from "@/lib/system/params";
import type { Params } from "@/lib/system/params";
import type { TokenMap } from "@/lib/system/derive";
import type { SystemEngine } from "@/lib/system/engine";
import {
  bindHorizonToEngine,
  uniformsFromTokens,
} from "./horizon-engine-bridge";
import type { HorizonUniforms } from "./horizon-engine-bridge";

type Frames = {
  readonly pending: number;
  frame(timestamp?: number): void;
};

function stubFrames(): Frames {
  const callbacks = new Map<number, FrameRequestCallback>();
  let nextHandle = 0;

  vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
    nextHandle += 1;
    callbacks.set(nextHandle, callback);

    return nextHandle;
  });
  vi.spyOn(window, "cancelAnimationFrame").mockImplementation((handle) => {
    callbacks.delete(handle);
  });

  return {
    get pending() {
      return callbacks.size;
    },
    frame(timestamp = 0) {
      const queued = [...callbacks.values()];

      callbacks.clear();
      queued.forEach((callback) => callback(timestamp));
    },
  };
}

function tokenMap(overrides: TokenMap = {}): TokenMap {
  return {
    "--horizon-base": "#f1f3f6",
    "--horizon-mid": "#00ff00",
    "--horizon-3": "rgb(0, 0, 255)",
    "--horizon-mid-at": "82%",
    "--horizon-1": "#ff0000",
    "--horizon-2": "#000000",
    "--horizon-1-alpha": "0.06",
    "--horizon-2-alpha": "0.03",
    ...overrides,
  };
}

function fakeEngine(): {
  engine: SystemEngine;
  emit(tokens: TokenMap): void;
  readonly listeners: number;
} {
  const listeners = new Set<(tokens: TokenMap, params: Params) => void>();

  return {
    engine: {
      set() {},
      get() {
        return { ...DEFAULT_PARAMS };
      },
      subscribe(listener) {
        listeners.add(listener);

        return () => {
          listeners.delete(listener);
        };
      },
      spring(base) {
        return base;
      },
      dispose() {
        listeners.clear();
      },
    },
    emit(tokens) {
      for (const listener of listeners) listener(tokens, { ...DEFAULT_PARAMS });
    },
    get listeners() {
      return listeners.size;
    },
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("uniformsFromTokens", () => {
  it("converts hex and percent token values to shader channels", () => {
    const uniforms = uniformsFromTokens(
      tokenMap(),
    );

    expect(uniforms.base).toEqual([241 / 255, 243 / 255, 246 / 255]);
    expect(uniforms.mid).toEqual([0, 1, 0]);
    expect(uniforms.horizon3).toEqual([0, 0, 1]);
    expect(uniforms.midAt).toBeCloseTo(0.82, 10);
    expect(uniforms.color1).toEqual([1, 0, 0]);
    expect(uniforms.color2).toEqual([0, 0, 0]);
    expect(uniforms.alpha1).toBeCloseTo(0.06, 10);
    expect(uniforms.alpha2).toBeCloseTo(0.03, 10);
  });

  it("follows tod, hue and contrast token rewrites", () => {
    const uniforms = uniformsFromTokens(
      tokenMap({
        "--horizon-base": "#241d1c",
        "--horizon-mid": "#342220",
        "--horizon-3": "#4b2a25",
        "--horizon-mid-at": "90%",
        "--horizon-1": "#6b352d",
        "--horizon-2": "#9d4739",
        "--horizon-1-alpha": "0.5",
        "--horizon-2-alpha": "0.25",
      }),
    );

    expect(uniforms.base).toEqual([36 / 255, 29 / 255, 28 / 255]);
    expect(uniforms.midAt).toBeCloseTo(0.9, 10);
    expect(uniforms.alpha1).toBeCloseTo(0.5, 10);
    expect(uniforms.alpha2).toBeCloseTo(0.25, 10);
  });
});

describe("bindHorizonToEngine", () => {
  it("coalesces many updates in one frame into one apply", () => {
    const frames = stubFrames();
    const fake = fakeEngine();
    const applied: HorizonUniforms[] = [];

    const unbind = bindHorizonToEngine(fake.engine, (uniforms) => {
      applied.push(uniforms);
    });

    // Never synchronous from subscribe: the first paint is the caller's job.
    expect(applied).toHaveLength(0);

    for (let step = 0; step < 5; step += 1) {
      fake.emit(tokenMap({ "--horizon-mid-at": `${80 + step}%` }));
    }

    expect(applied).toHaveLength(0);
    expect(frames.pending).toBe(1);

    frames.frame();

    expect(applied).toHaveLength(1);
    expect(applied[0].midAt).toBeCloseTo(0.84, 10);

    unbind();
  });

  it("unsubscribes and drops a pending frame", () => {
    const frames = stubFrames();
    const fake = fakeEngine();
    const applied: HorizonUniforms[] = [];

    const unbind = bindHorizonToEngine(fake.engine, (uniforms) => {
      applied.push(uniforms);
    });

    fake.emit(tokenMap());
    expect(frames.pending).toBe(1);

    unbind();

    expect(fake.listeners).toBe(0);
    expect(frames.pending).toBe(0);

    fake.emit(tokenMap({ "--horizon-mid-at": "90%" }));
    frames.frame();

    expect(applied).toHaveLength(0);
  });
});
