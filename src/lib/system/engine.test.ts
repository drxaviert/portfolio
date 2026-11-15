import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GLIDE_LEAD_SPRING } from "@/components/home/glide-spring";
import { applyDayPhase, applyMode } from "@/lib/theme";
import { derive, phaseAtTod } from "@/lib/system/derive";
import type { TokenMap } from "@/lib/system/derive";
import { createSystemEngine, SYSTEM_OWNED_ATTR } from "@/lib/system/engine";
import { DEFAULT_PARAMS } from "@/lib/system/params";
import type { Params } from "@/lib/system/params";

type Frames = {
  readonly pending: number;
  frame(timestamp?: number): void;
};

function stubFrames(): Frames {
  if (typeof window.requestAnimationFrame !== "function") {
    Object.defineProperty(window, "requestAnimationFrame", {
      configurable: true,
      writable: true,
      value: () => 0,
    });
  }

  if (typeof window.cancelAnimationFrame !== "function") {
    Object.defineProperty(window, "cancelAnimationFrame", {
      configurable: true,
      writable: true,
      value: () => {},
    });
  }

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

function setReducedMotion(matches: boolean): void {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      matches: query.includes("prefers-reduced-motion") ? matches : false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}

function params(overrides: Partial<Params> = {}): Params {
  return { ...DEFAULT_PARAMS, ...overrides };
}

function durationTokens(tokens: TokenMap): Array<[string, string]> {
  return Object.entries(tokens).filter(([name]) =>
    name.startsWith("--duration-"),
  );
}

let root: HTMLElement;

beforeEach(() => {
  root = document.createElement("div");
  document.body.append(root);
});

afterEach(() => {
  root.remove();
  // Reset the module's live theme state so one test cannot pin the next.
  applyMode("auto", new Date(2026, 0, 1, 12));
  window.localStorage.clear();
  delete document.documentElement.dataset.phase;
  delete document.documentElement.dataset.mode;
  delete document.documentElement.dataset.dayPhase;
  delete document.documentElement.dataset.phasePreview;
  document.documentElement.classList.remove("dark");
  Reflect.deleteProperty(window, "matchMedia");
  vi.restoreAllMocks();
});

describe("engine writes", () => {
  it("coalesces several set() calls into a single write of the last params", () => {
    const frames = stubFrames();
    const setProperty = vi.spyOn(root.style, "setProperty");
    const engine = createSystemEngine(root);

    for (let hue = 10; hue <= 50; hue += 10) {
      engine.set(params({ hue }));
    }

    expect(frames.pending).toBe(1);
    expect(setProperty).not.toHaveBeenCalled();

    frames.frame();

    const expected = derive(params({ hue: 50 }), params({ hue: 50 }).tod);

    expect(root.style.getPropertyValue("--palette-blue-600")).toBe(
      expected["--palette-blue-600"],
    );
    expect(
      setProperty.mock.calls.filter(([name]) => name === "--palette-blue-600"),
    ).toHaveLength(1);
    expect(engine.get()).toEqual(params({ hue: 50 }));
  });

  it("notifies subscribers once per frame after the write", () => {
    const frames = stubFrames();
    const engine = createSystemEngine(root);
    const listener = vi.fn();

    engine.subscribe(listener);
    engine.set(params({ hue: 20 }));

    expect(listener).not.toHaveBeenCalled();

    frames.frame();

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(
      derive(params({ hue: 20 }), params({ hue: 20 }).tod),
      params({ hue: 20 }),
    );
  });

  it("unsubscribes and keeps later frames quiet", () => {
    const frames = stubFrames();
    const engine = createSystemEngine(root);
    const listener = vi.fn();
    const unsubscribe = engine.subscribe(listener);

    engine.set(params());
    frames.frame();
    unsubscribe();
    engine.set(params({ hue: 40 }));
    frames.frame();

    expect(listener).toHaveBeenCalledTimes(1);
  });
});

describe("engine attributes", () => {
  it("flips data-phase, color-scheme and .dark from the tod", () => {
    const frames = stubFrames();
    const engine = createSystemEngine(root);

    expect(root.hasAttribute(SYSTEM_OWNED_ATTR)).toBe(true);

    engine.set(params({ tod: 0.5 }));
    frames.frame();

    expect(root.dataset.phase).toBe("day");
    expect(root.style.getPropertyValue("color-scheme")).toBe("light");
    expect(root.classList.contains("dark")).toBe(false);

    engine.set(params({ tod: 0.84 }));
    frames.frame();

    expect(phaseAtTod(0.84)).toBe("night");
    expect(root.dataset.phase).toBe("night");
    expect(root.style.getPropertyValue("color-scheme")).toBe("dark");
    expect(root.classList.contains("dark")).toBe(true);

    engine.set(params({ tod: 5 / 6 }));
    frames.frame();

    expect(root.dataset.phase).toBe("dusk");
    expect(root.style.getPropertyValue("color-scheme")).toBe("light");
    expect(root.classList.contains("dark")).toBe(false);

    engine.dispose();
  });
});

describe("engine disposal", () => {
  it("removes every variable and restores the attributes it changed", () => {
    const frames = stubFrames();
    const baseline = root.getAttribute("style");

    root.setAttribute("data-phase", "dawn");
    root.classList.remove("dark");

    const engine = createSystemEngine(root);

    engine.set(params({ tod: 1, hue: 45, speed: 2 }));
    frames.frame();

    expect(root.style.getPropertyValue("--palette-blue-600")).not.toBe("");

    engine.dispose();

    expect(root.getAttribute("style")).toBe(baseline);
    expect(root.hasAttribute(SYSTEM_OWNED_ATTR)).toBe(false);
    expect(root.getAttribute("data-phase")).toBe("dawn");
    expect(root.style.getPropertyValue("color-scheme")).toBe("");
    expect(root.classList.contains("dark")).toBe(false);
  });

  it("leaves <html> inline style exactly as it was across StrictMode-style remounts", () => {
    const frames = stubFrames();
    const html = document.documentElement;

    // Pin a deterministic live site phase (Day · Dawn) so dispose can restore
    // it without depending on the wall clock.
    applyMode("day", new Date(2026, 0, 1, 12));
    applyDayPhase("dawn");

    const baselineStyle = html.getAttribute("style");
    const baselinePhase = html.getAttribute("data-phase");
    const baselineDark = html.classList.contains("dark");

    expect(baselinePhase).toBe("dawn");

    for (let mount = 0; mount < 2; mount += 1) {
      const engine = createSystemEngine(html);

      engine.set(params({ tod: 1, hue: 30, speed: 2 }));
      frames.frame();

      expect(html.style.getPropertyValue("--palette-blue-600")).not.toBe("");

      engine.dispose();

      expect(html.getAttribute("style")).toBe(baselineStyle);
      expect(html.hasAttribute(SYSTEM_OWNED_ATTR)).toBe(false);
      expect(html.getAttribute("data-phase")).toBe(baselinePhase);
      expect(html.classList.contains("dark")).toBe(baselineDark);
    }
  });

  it("restores the live site phase when the theme changes while mounted", () => {
    const frames = stubFrames();
    const html = document.documentElement;

    applyMode("day", new Date(2026, 0, 1, 12));

    const engine = createSystemEngine(html);

    engine.set(params({ tod: 0 }));
    frames.frame();

    expect(html.dataset.phase).toBe("dawn");

    // The visitor flips the site theme to Night; the engine keeps overriding
    // data-phase from its own tod until it unmounts.
    applyMode("night");
    engine.set(params({ tod: 0 }));
    frames.frame();

    expect(html.dataset.phase).toBe("dawn");
    expect(html.classList.contains("dark")).toBe(false);

    engine.dispose();

    expect(html.dataset.phase).toBe("night");
    expect(html.classList.contains("dark")).toBe(true);
    expect(html.style.getPropertyValue("color-scheme")).toBe("");
  });

  it("cancels a pending frame and never writes after dispose", () => {
    const frames = stubFrames();
    const engine = createSystemEngine(root);
    const setProperty = vi.spyOn(root.style, "setProperty");

    engine.set(params());
    expect(frames.pending).toBe(1);

    engine.dispose();
    expect(frames.pending).toBe(0);

    frames.frame();
    expect(setProperty).not.toHaveBeenCalled();
  });

  it("is idempotent and ignores set() after dispose", () => {
    const frames = stubFrames();
    const engine = createSystemEngine(root);
    const setProperty = vi.spyOn(root.style, "setProperty");

    engine.dispose();
    engine.dispose();

    expect(() => {
      engine.set(params({ hue: 90 }));
      frames.frame();
    }).not.toThrow();
    expect(setProperty).not.toHaveBeenCalled();
    expect(engine.get()).toEqual(DEFAULT_PARAMS);
  });
});

describe("reduced motion", () => {
  it("keeps every duration at the speed-1 value whatever the speed", () => {
    setReducedMotion(true);

    const frames = stubFrames();
    const engine = createSystemEngine(root);

    engine.set(params({ speed: 2, tod: 1 / 3 }));
    frames.frame();

    const expected = derive(params({ speed: 1 }), params({ speed: 1 }).tod);

    for (const [name, value] of durationTokens(expected)) {
      expect(root.style.getPropertyValue(name), name).toBe(value);
    }

    engine.dispose();
  });

  it("returns the base spring unchanged", () => {
    setReducedMotion(true);

    const engine = createSystemEngine(root);

    engine.set(params({ speed: 0.25 }));

    expect(engine.spring(GLIDE_LEAD_SPRING)).toBe(GLIDE_LEAD_SPRING);

    engine.dispose();
  });
});

describe("spring scaling", () => {
  it("speeds the spring up by speed squared and keeps the damping ratio", () => {
    setReducedMotion(false);

    const engine = createSystemEngine(root);

    engine.set(params({ speed: 2 }));

    const scaled = engine.spring(GLIDE_LEAD_SPRING);

    expect(scaled.stiffness).toBe(GLIDE_LEAD_SPRING.stiffness * 4);
    expect(scaled.dampingRatio).toBe(GLIDE_LEAD_SPRING.dampingRatio);
    expect(Number.isFinite(scaled.stiffness)).toBe(true);

    engine.dispose();
  });

  it("slows the spring to a quarter stiffness at 0.5x", () => {
    setReducedMotion(false);

    const engine = createSystemEngine(root);

    engine.set(params({ speed: 0.5 }));

    expect(engine.spring(GLIDE_LEAD_SPRING).stiffness).toBe(
      GLIDE_LEAD_SPRING.stiffness * 0.25,
    );

    engine.dispose();
  });

  it("stays finite at the speed floor", () => {
    setReducedMotion(false);

    const engine = createSystemEngine(root);

    // Below the floor clamps to 0.25, so stiffness is base × 0.0625, never 0
    // or Infinity.
    engine.set(params({ speed: 0 }));

    const scaled = engine.spring(GLIDE_LEAD_SPRING);

    expect(scaled.stiffness).toBe(
      GLIDE_LEAD_SPRING.stiffness * 0.25 * 0.25,
    );
    expect(Number.isFinite(scaled.stiffness)).toBe(true);
    expect(scaled.stiffness).toBeGreaterThan(0);

    engine.dispose();
  });
});
