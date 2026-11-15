import { act, renderHook } from "@testing-library/react";
import { StrictMode } from "react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applyDayPhase, applyMode } from "@/lib/theme";
import type { Params } from "@/lib/system/params";
import { DEFAULT_PARAMS, todForPhase } from "@/lib/system/params";
import { useSystemParams } from "@/lib/system/use-system-params";

type FakeEngine = {
  disposed: boolean;
  lastParams: Params | null;
  set: ReturnType<typeof vi.fn>;
  get: ReturnType<typeof vi.fn>;
  subscribe: ReturnType<typeof vi.fn>;
  spring: ReturnType<typeof vi.fn>;
  dispose: ReturnType<typeof vi.fn>;
};

const engineMock = vi.hoisted(() => ({ engines: [] as FakeEngine[] }));

vi.mock("@/lib/system/engine", () => ({
  SYSTEM_OWNED_ATTR: "data-system-engine",
  createSystemEngine: () => {
    const engine: FakeEngine = {
      disposed: false,
      lastParams: null,
      set: vi.fn(),
      get: vi.fn(() => ({ hue: 0, round: 1, tod: 1 / 3, contrast: 1, speed: 1 })),
      subscribe: vi.fn(() => () => {}),
      spring: vi.fn((base: unknown) => base),
      dispose: vi.fn(),
    };

    engine.set.mockImplementation((next: Params) => {
      engine.lastParams = next;
    });
    engine.dispose.mockImplementation(() => {
      engine.disposed = true;
    });
    engineMock.engines.push(engine);

    return engine;
  },
}));

function setUrl(search: string): void {
  window.history.replaceState(null, "", `/${search}`);
}

let frames: FrameRequestCallback[];

function stubFrames(): void {
  frames = [];
  vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
    frames.push(callback);

    return frames.length;
  });
  vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});
}

function flushFrames(): void {
  const queued = frames.splice(0);

  queued.forEach((callback) => callback(0));
}

function liveEngines(): FakeEngine[] {
  return engineMock.engines.filter((engine) => !engine.disposed);
}

beforeEach(() => {
  engineMock.engines.length = 0;
  window.localStorage.clear();
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 0, 1, 12));
  applyMode("auto", new Date(2026, 0, 1, 12));
  // Drop any Day-phase pin a previous test left behind.
  applyDayPhase("clock");
  applyMode("auto", new Date(2026, 0, 1, 12));
  setUrl("");
  stubFrames();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  window.localStorage.clear();
  setUrl("");
  applyMode("auto", new Date(2026, 0, 1, 12));
  delete document.documentElement.dataset.phase;
  delete document.documentElement.dataset.mode;
  delete document.documentElement.dataset.dayPhase;
  delete document.documentElement.dataset.phasePreview;
  document.documentElement.classList.remove("dark");
});

describe("useSystemParams", () => {
  it("reads and clamps the URL on mount", () => {
    setUrl("?hue=abc&round=NaN&tod=-5&speed=0&hue=1&hue=2");

    const { result } = renderHook(() => useSystemParams());

    expect(result.current.params).toEqual({
      hue: 2,
      round: 1,
      tod: 0,
      contrast: 1,
      speed: 0.25,
    });
    expect(engineMock.engines).toHaveLength(1);
    expect(engineMock.engines[0].lastParams).toEqual(result.current.params);
  });

  it("lets a URL tod win over the site phase", () => {
    applyMode("day", new Date(2026, 0, 1, 12));
    applyDayPhase("dusk");
    setUrl("?tod=0.1");

    const { result } = renderHook(() => useSystemParams());

    expect(result.current.sitePhase).toBe("dusk");
    expect(result.current.params.tod).toBe(0.1);
  });

  it("starts tod at the site phase when the URL has no tod", () => {
    applyMode("day", new Date(2026, 0, 1, 12));
    applyDayPhase("dusk");

    const { result } = renderHook(() => useSystemParams());

    expect(result.current.sitePhase).toBe("dusk");
    expect(result.current.params.tod).toBe(todForPhase("dusk"));
  });

  it("moves tod to the new site phase when the theme changes mid-page", () => {
    applyMode("day", new Date(2026, 0, 1, 12));

    const { result } = renderHook(() => useSystemParams());

    expect(result.current.params.tod).toBe(todForPhase("day"));

    act(() => {
      applyDayPhase("dusk");
    });

    expect(result.current.sitePhase).toBe("dusk");
    expect(result.current.params.tod).toBe(todForPhase("dusk"));
    expect(engineMock.engines[0].lastParams?.tod).toBe(todForPhase("dusk"));
  });

  it("resets to the defaults at the current site phase and clears the query", () => {
    applyMode("day", new Date(2026, 0, 1, 12));
    applyDayPhase("dusk");
    setUrl("?hue=40&contrast=2");

    const { result } = renderHook(() => useSystemParams());

    expect(result.current.params.hue).toBe(40);

    act(() => {
      result.current.reset();
    });

    expect(result.current.params).toEqual({
      ...DEFAULT_PARAMS,
      tod: todForPhase("dusk"),
    });

    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(window.location.search).toBe("");
  });

  it("debounces replaceState and writes only non-default keys", () => {
    const { result } = renderHook(() => useSystemParams());
    const replaceState = vi.spyOn(window.history, "replaceState");

    act(() => {
      for (let hue = 10; hue <= 50; hue += 10) {
        result.current.setParam("hue", hue);
      }
    });

    expect(replaceState).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(199);
    });
    expect(replaceState).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(replaceState).toHaveBeenCalledTimes(1);
    expect(window.location.search).toBe("?hue=50");

    act(() => {
      flushFrames();
    });
    expect(result.current.params.hue).toBe(50);
  });

  it("disposes the engine on unmount", () => {
    const { unmount } = renderHook(() => useSystemParams());
    const engine = engineMock.engines[0];

    unmount();

    expect(engine.dispose).toHaveBeenCalledTimes(1);
  });

  it("keeps exactly one live engine across a StrictMode-style remount", () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <StrictMode>{children}</StrictMode>
    );

    const first = renderHook(() => useSystemParams(), { wrapper });

    expect(engineMock.engines).toHaveLength(1);

    first.unmount();

    expect(engineMock.engines[0].disposed).toBe(true);

    const second = renderHook(() => useSystemParams(), { wrapper });

    expect(engineMock.engines).toHaveLength(2);
    expect(liveEngines()).toHaveLength(1);

    second.unmount();

    expect(liveEngines()).toHaveLength(0);
  });
});
