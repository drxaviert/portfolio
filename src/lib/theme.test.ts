import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import {
  applyDayPhase,
  applyMode,
  applyPhase,
  DAY_PHASE_STORAGE_KEY,
  getActiveDayPhase,
  MODE_STORAGE_KEY,
  msUntilNextPhaseBoundary,
  parseStoredDayPhase,
  parseStoredMode,
  phaseFor,
  phaseForHour,
  readStoredDayPhase,
  readStoredMode,
  writeStoredDayPhase,
  writeStoredMode,
} from "@/lib/theme";
import type { DayPhase, Phase } from "@/lib/theme";
import { THEME_INIT_SCRIPT } from "@/lib/theme-script";

afterEach(() => {
  // The module remembers the pin in memory as well as in storage; reset both
  // so one test cannot pin a phase for the next.
  applyDayPhase("clock");
  window.localStorage.clear();
  delete document.documentElement.dataset.mode;
  delete document.documentElement.dataset.phase;
  delete document.documentElement.dataset.dayPhase;
  delete document.documentElement.dataset.phaseSwitching;
  document.documentElement.classList.remove("dark");
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function at(hour: number, minute = 0): Date {
  return new Date(2026, 0, 1, hour, minute);
}

describe("phaseFor", () => {
  type Case = { label: string; date: Date; expected: Phase };

  const autoCases: Case[] = [
    { label: "4:59", date: at(4, 59), expected: "night" },
    { label: "5:00", date: at(5, 0), expected: "dawn" },
    { label: "7:59", date: at(7, 59), expected: "dawn" },
    { label: "8:00", date: at(8, 0), expected: "day" },
    { label: "16:59", date: at(16, 59), expected: "day" },
    { label: "17:00", date: at(17, 0), expected: "dusk" },
    { label: "19:59", date: at(19, 59), expected: "dusk" },
    { label: "20:00", date: at(20, 0), expected: "night" },
  ];

  it.each(autoCases)("auto at $label is $expected", ({ date, expected }) => {
    expect(phaseFor(date, "auto")).toBe(expected);
    expect(phaseFor(date)).toBe(expected);
  });

  const dayCases: Case[] = [
    { label: "0:00", date: at(0, 0), expected: "day" },
    { label: "1:00", date: at(1, 0), expected: "day" },
    { label: "2:00", date: at(2, 0), expected: "dawn" },
    { label: "4:00", date: at(4, 0), expected: "dawn" },
    { label: "4:59", date: at(4, 59), expected: "dawn" },
    { label: "5:00", date: at(5, 0), expected: "dawn" },
    { label: "7:59", date: at(7, 59), expected: "dawn" },
    { label: "8:00", date: at(8, 0), expected: "day" },
    { label: "16:59", date: at(16, 59), expected: "day" },
    { label: "17:00", date: at(17, 0), expected: "dusk" },
    { label: "19:00", date: at(19, 0), expected: "dusk" },
    { label: "19:59", date: at(19, 59), expected: "dusk" },
    { label: "20:00", date: at(20, 0), expected: "day" },
    { label: "23:00", date: at(23, 0), expected: "day" },
  ];

  it.each(dayCases)("day at $label is $expected", ({ date, expected }) => {
    expect(phaseFor(date, "day")).toBe(expected);
  });

  it("day never returns night, whatever the hour", () => {
    for (let hour = 0; hour < 24; hour += 1) {
      expect(phaseForHour(hour, "day")).not.toBe("night");
    }
  });

  it("night is always night, whatever the hour", () => {
    for (let hour = 0; hour < 24; hour += 1) {
      expect(phaseFor(at(hour), "night")).toBe("night");
      expect(phaseForHour(hour, "night")).toBe("night");
    }
  });
});

describe("Day phase pin", () => {
  const PINNED: Exclude<DayPhase, "clock">[] = ["dawn", "day", "dusk"];

  it("returns the pinned phase in Day mode, whatever the hour", () => {
    for (const dayPhase of PINNED) {
      for (let hour = 0; hour < 24; hour += 1) {
        expect(phaseForHour(hour, "day", dayPhase)).toBe(dayPhase);
      }
    }
  });

  it("follows the clock in Day mode when the pin is clock", () => {
    expect(phaseForHour(3, "day", "clock")).toBe("dawn");
    expect(phaseForHour(12, "day", "clock")).toBe("day");
    expect(phaseForHour(19, "day", "clock")).toBe("dusk");
    expect(phaseForHour(23, "day", "clock")).toBe("day");
    expect(phaseForHour(3, "day")).toBe("dawn");
  });

  it("ignores the pin in Auto mode", () => {
    expect(phaseForHour(12, "auto", "dusk")).toBe("day");
    expect(phaseForHour(19, "auto", "dawn")).toBe("dusk");
    expect(phaseForHour(23, "auto", "day")).toBe("night");
    expect(phaseForHour(4, "auto", "day")).toBe("night");
  });

  it("ignores the pin in Night mode", () => {
    for (const dayPhase of PINNED) {
      expect(phaseForHour(12, "night", dayPhase)).toBe("night");
      expect(phaseForHour(19, "night", dayPhase)).toBe("night");
    }
  });

  it("resolves a Date through the pin", () => {
    expect(phaseFor(at(12), "day", "dusk")).toBe("dusk");
    expect(phaseFor(at(12), "auto", "dusk")).toBe("day");
  });
});

describe("msUntilNextPhaseBoundary", () => {
  const originalTz = process.env.TZ;

  beforeAll(() => {
    // DST cases below need a zone with a spring-forward and fall-back.
    process.env.TZ = "America/New_York";
  });

  afterAll(() => {
    if (originalTz === undefined) delete process.env.TZ;
    else process.env.TZ = originalTz;
  });

  it("returns the next boundary just before, at and just after it", () => {
    expect(msUntilNextPhaseBoundary(at(4, 59))).toBe(60_000);
    expect(msUntilNextPhaseBoundary(at(5, 0))).toBe(3 * 60 * 60 * 1000);
    expect(msUntilNextPhaseBoundary(new Date(2026, 0, 1, 8, 0, 0, 1))).toBe(
      8 * 60 * 60 * 1000 + 59 * 60 * 1000 + 59 * 1000 + 999,
    );
  });

  it("wraps past midnight", () => {
    expect(msUntilNextPhaseBoundary(at(22, 0))).toBe(7 * 60 * 60 * 1000);
  });

  it("uses Day mode's 2:00 mirror boundary", () => {
    expect(msUntilNextPhaseBoundary(at(1, 0), "day")).toBe(60 * 60 * 1000);
    expect(msUntilNextPhaseBoundary(at(2, 0), "day")).toBe(
      6 * 60 * 60 * 1000,
    );
  });

  it("handles spring-forward", () => {
    // 2026-03-08 02:00 EST jumps to 03:00 EDT, so 05:00 is 2.5h away.
    expect(msUntilNextPhaseBoundary(new Date(2026, 2, 8, 1, 30))).toBe(
      2.5 * 60 * 60 * 1000,
    );
    // Day mode's 02:00 boundary normalizes to 03:00 EDT, 30 real minutes away.
    expect(msUntilNextPhaseBoundary(new Date(2026, 2, 8, 1, 30), "day")).toBe(
      0.5 * 60 * 60 * 1000,
    );
  });

  it("handles fall-back", () => {
    // 2026-11-01 02:00 EDT falls back to 01:00 EST, so 05:00 is 5.5h away.
    expect(msUntilNextPhaseBoundary(new Date(2026, 10, 1, 0, 30))).toBe(
      5.5 * 60 * 60 * 1000,
    );
  });
});

describe("parseStoredMode", () => {
  it("migrates the old light/dark pair", () => {
    expect(parseStoredMode("light")).toBe("day");
    expect(parseStoredMode("dark")).toBe("night");
  });

  it("keeps the current modes", () => {
    expect(parseStoredMode("day")).toBe("day");
    expect(parseStoredMode("night")).toBe("night");
    expect(parseStoredMode("auto")).toBe("auto");
  });

  it("defaults to auto for missing or unknown values", () => {
    expect(parseStoredMode(null)).toBe("auto");
    expect(parseStoredMode(undefined)).toBe("auto");
    expect(parseStoredMode("blue")).toBe("auto");
    expect(parseStoredMode("toString")).toBe("auto");
  });
});

describe("readStoredMode", () => {
  it("reads and migrates the stored value", () => {
    window.localStorage.setItem(MODE_STORAGE_KEY, "dark");

    expect(readStoredMode()).toBe("night");
  });

  it("returns auto when nothing is stored", () => {
    expect(readStoredMode()).toBe("auto");
  });

  it("returns auto when storage access throws", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("storage blocked");
    });

    expect(readStoredMode()).toBe("auto");
  });
});

describe("writeStoredMode", () => {
  it("stores the mode", () => {
    writeStoredMode("night");

    expect(window.localStorage.getItem(MODE_STORAGE_KEY)).toBe("night");
  });

  it("does not throw when storage access throws", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("storage blocked");
    });

    expect(() => writeStoredMode("day")).not.toThrow();
  });
});

describe("parseStoredDayPhase", () => {
  it("keeps the known pins", () => {
    expect(parseStoredDayPhase("clock")).toBe("clock");
    expect(parseStoredDayPhase("dawn")).toBe("dawn");
    expect(parseStoredDayPhase("day")).toBe("day");
    expect(parseStoredDayPhase("dusk")).toBe("dusk");
  });

  it("defaults to the clock for missing or unknown values", () => {
    expect(parseStoredDayPhase(null)).toBe("clock");
    expect(parseStoredDayPhase(undefined)).toBe("clock");
    expect(parseStoredDayPhase("night")).toBe("clock");
    expect(parseStoredDayPhase("toString")).toBe("clock");
  });
});

describe("readStoredDayPhase", () => {
  it("reads the stored pin", () => {
    window.localStorage.setItem(DAY_PHASE_STORAGE_KEY, "dusk");

    expect(readStoredDayPhase()).toBe("dusk");
  });

  it("returns clock when nothing is stored", () => {
    expect(readStoredDayPhase()).toBe("clock");
  });

  it("returns clock when storage access throws", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("storage blocked");
    });

    expect(readStoredDayPhase()).toBe("clock");
  });
});

describe("writeStoredDayPhase", () => {
  it("stores the pin", () => {
    writeStoredDayPhase("dawn");

    expect(window.localStorage.getItem(DAY_PHASE_STORAGE_KEY)).toBe("dawn");
  });

  it("does not throw when storage access throws", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("storage blocked");
    });

    expect(() => writeStoredDayPhase("dusk")).not.toThrow();
  });
});

describe("applyPhase", () => {
  it("pins the phase and the dark class for night", () => {
    applyPhase("night");

    expect(document.documentElement.dataset.phase).toBe("night");
    expect(document.documentElement).toHaveClass("dark");
  });

  it("leaves the mode and clears the dark class for light phases", () => {
    document.documentElement.dataset.mode = "auto";

    applyPhase("dusk");

    expect(document.documentElement.dataset.phase).toBe("dusk");
    expect(document.documentElement.dataset.mode).toBe("auto");
    expect(document.documentElement).not.toHaveClass("dark");
  });
});

describe("applyMode", () => {
  it("writes data-mode, data-phase and the dark class for night", () => {
    const phase = applyMode("night");

    expect(phase).toBe("night");
    expect(document.documentElement.dataset.mode).toBe("night");
    expect(document.documentElement.dataset.phase).toBe("night");
    expect(document.documentElement).toHaveClass("dark");
  });

  it("keeps light phases out of the dark class", () => {
    const phase = applyMode("day", at(12));

    expect(phase).toBe("day");
    expect(document.documentElement.dataset.mode).toBe("day");
    expect(document.documentElement.dataset.phase).toBe("day");
    expect(document.documentElement).not.toHaveClass("dark");
  });

  it("applies a pinned Day phase at any hour and records it", () => {
    const phase = applyMode("day", at(12), "click", "dusk");

    expect(phase).toBe("dusk");
    expect(document.documentElement.dataset.phase).toBe("dusk");
    expect(document.documentElement.dataset.dayPhase).toBe("dusk");
    expect(getActiveDayPhase()).toBe("dusk");
  });

  it("ignores a pinned phase in Auto and Night", () => {
    applyMode("auto", at(12), "click", "dusk");
    expect(document.documentElement.dataset.phase).toBe("day");

    applyMode("night", at(12), "click", "dusk");
    expect(document.documentElement.dataset.phase).toBe("night");
    // Kept for the next Day selection.
    expect(document.documentElement.dataset.dayPhase).toBe("dusk");
  });
});

describe("applyDayPhase", () => {
  it("persists the pin and re-applies it in Day mode", () => {
    document.documentElement.dataset.mode = "day";

    applyDayPhase("dawn", at(19));

    expect(document.documentElement.dataset.phase).toBe("dawn");
    expect(document.documentElement.dataset.dayPhase).toBe("dawn");
    expect(window.localStorage.getItem(DAY_PHASE_STORAGE_KEY)).toBe("dawn");
  });

  it("keeps the pin while Night is active", () => {
    document.documentElement.dataset.mode = "night";

    applyDayPhase("dusk", at(12));

    expect(document.documentElement.dataset.mode).toBe("night");
    expect(document.documentElement.dataset.phase).toBe("night");
    expect(document.documentElement.dataset.dayPhase).toBe("dusk");
  });

  it("applies the pin on the next Day selection", () => {
    applyMode("day", at(12), "click", "dusk");
    applyMode("night", at(12));

    expect(document.documentElement.dataset.phase).toBe("night");

    applyMode("day", at(12));

    expect(document.documentElement.dataset.phase).toBe("dusk");
  });
});

describe("THEME_INIT_SCRIPT", () => {
  function runInitScript() {
    new Function(THEME_INIT_SCRIPT)();
  }

  it("applies a pinned Day phase before React runs", () => {
    vi.useFakeTimers();
    vi.setSystemTime(at(12));
    window.localStorage.setItem(MODE_STORAGE_KEY, "day");
    window.localStorage.setItem(DAY_PHASE_STORAGE_KEY, "dusk");

    runInitScript();

    expect(document.documentElement.dataset.mode).toBe("day");
    expect(document.documentElement.dataset.phase).toBe("dusk");
    expect(document.documentElement.dataset.dayPhase).toBe("dusk");
  });

  it("follows the clock when the pin is clock", () => {
    vi.useFakeTimers();
    vi.setSystemTime(at(19));
    window.localStorage.setItem(MODE_STORAGE_KEY, "day");
    window.localStorage.setItem(DAY_PHASE_STORAGE_KEY, "clock");

    runInitScript();

    expect(document.documentElement.dataset.phase).toBe("dusk");
  });

  it("ignores the pin in Auto and Night", () => {
    vi.useFakeTimers();
    vi.setSystemTime(at(12));
    window.localStorage.setItem(DAY_PHASE_STORAGE_KEY, "dusk");

    runInitScript();

    expect(document.documentElement.dataset.mode).toBe("auto");
    expect(document.documentElement.dataset.phase).toBe("day");

    window.localStorage.setItem(MODE_STORAGE_KEY, "night");
    runInitScript();

    expect(document.documentElement.dataset.phase).toBe("night");
  });

  it("falls back to Auto with the clock phase when storage throws", () => {
    vi.useFakeTimers();
    vi.setSystemTime(at(19));
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("storage blocked");
    });

    runInitScript();

    expect(document.documentElement.dataset.mode).toBe("auto");
    expect(document.documentElement.dataset.phase).toBe("dusk");
    expect(document.documentElement.dataset.dayPhase).toBe("clock");
  });
});

describe("phase switching", () => {
  it("marks a changed phase and clears it after the fade", () => {
    vi.useFakeTimers();

    applyPhase("day");
    applyPhase("night");

    expect(document.documentElement.dataset.phaseSwitching).toBe("click");

    vi.advanceTimersByTime(500);

    expect(document.documentElement.dataset.phaseSwitching).toBeUndefined();
  });

  it("does not mark a switch when the phase is unchanged", () => {
    vi.useFakeTimers();

    applyPhase("day");
    vi.advanceTimersByTime(500);
    applyPhase("day");

    expect(document.documentElement.dataset.phaseSwitching).toBeUndefined();
  });

  it("marks clock-driven switches as auto", () => {
    vi.useFakeTimers();

    applyMode("night", at(12), "auto");

    expect(document.documentElement.dataset.phaseSwitching).toBe("auto");

    vi.advanceTimersByTime(500);

    expect(document.documentElement.dataset.phaseSwitching).toBeUndefined();
  });

  it("reads the duration token before the phase attribute changes", () => {
    let phaseAtRead: string | undefined;

    vi.spyOn(window, "getComputedStyle").mockImplementation(() => {
      phaseAtRead = document.documentElement.dataset.phase;

      return {
        getPropertyValue: () => "0ms",
      } as unknown as CSSStyleDeclaration;
    });

    document.documentElement.dataset.phase = "day";

    applyPhase("night");

    // A flush after the phase write would commit the new colours before the
    // switch rule exists, so the page would snap instead of fading.
    expect(phaseAtRead).toBe("day");
  });

  it("keeps the switch attribute for the live tuned duration", () => {
    vi.useFakeTimers();
    vi.spyOn(window, "getComputedStyle").mockReturnValue({
      getPropertyValue: (name: string) =>
        name === "--horizon-transition-duration" ? "3000ms" : "",
    } as CSSStyleDeclaration);

    applyPhase("night");

    vi.advanceTimersByTime(2900);
    expect(document.documentElement.dataset.phaseSwitching).toBe("click");

    vi.advanceTimersByTime(200);
    expect(document.documentElement.dataset.phaseSwitching).toBeUndefined();
  });

  it("restarts the removal window on a mid-fade switch", () => {
    vi.useFakeTimers();
    vi.spyOn(window, "getComputedStyle").mockReturnValue({
      getPropertyValue: (name: string) =>
        name === "--horizon-transition-duration" ? "3000ms" : "",
    } as CSSStyleDeclaration);

    applyPhase("day");
    vi.advanceTimersByTime(1000);
    applyPhase("night");

    vi.advanceTimersByTime(2500);
    expect(document.documentElement.dataset.phaseSwitching).toBe("click");

    vi.advanceTimersByTime(600);
    expect(document.documentElement.dataset.phaseSwitching).toBeUndefined();
  });

  it("reads the auto token for clock-driven removal timing", () => {
    vi.useFakeTimers();
    vi.spyOn(window, "getComputedStyle").mockReturnValue({
      getPropertyValue: (name: string) =>
        name === "--phase-auto-transition-duration" ? "0.5s" : "",
    } as CSSStyleDeclaration);

    applyMode("night", at(12), "auto");

    vi.advanceTimersByTime(450);
    expect(document.documentElement.dataset.phaseSwitching).toBe("auto");

    vi.advanceTimersByTime(120);
    expect(document.documentElement.dataset.phaseSwitching).toBeUndefined();
  });

  it("keeps the switch attribute until the colour transitions finish", () => {
    const frames: FrameRequestCallback[] = [];
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      frames.push(callback);
      return frames.length;
    });

    const animation = { transitionProperty: "color", playState: "running" };

    Object.defineProperty(document, "getAnimations", {
      configurable: true,
      value: () => [animation],
    });

    try {
      applyPhase("day");
      applyPhase("night");

      expect(document.documentElement.dataset.phaseSwitching).toBe("click");
      expect(frames.length).toBeGreaterThan(0);

      // A renderer that has not painted yet must not cut the fade.
      frames.pop()?.(0);
      expect(document.documentElement.dataset.phaseSwitching).toBe("click");

      animation.playState = "finished";
      frames.pop()?.(0);
      expect(document.documentElement.dataset.phaseSwitching).toBeUndefined();
    } finally {
      Reflect.deleteProperty(document, "getAnimations");
    }
  });

  it("removes the switch attribute at the hard cap even if a transition never ends", () => {
    vi.useFakeTimers();
    vi.spyOn(window, "requestAnimationFrame").mockImplementation(() => 1);

    const animation = { transitionProperty: "color", playState: "running" };

    Object.defineProperty(document, "getAnimations", {
      configurable: true,
      value: () => [animation],
    });

    try {
      applyPhase("day");
      applyPhase("night");

      expect(document.documentElement.dataset.phaseSwitching).toBe("click");

      // A 400ms token caps at max(4 * duration, 2000ms).
      vi.advanceTimersByTime(1900);
      expect(document.documentElement.dataset.phaseSwitching).toBe("click");

      vi.advanceTimersByTime(200);
      expect(document.documentElement.dataset.phaseSwitching).toBeUndefined();
    } finally {
      Reflect.deleteProperty(document, "getAnimations");
    }
  });
});
