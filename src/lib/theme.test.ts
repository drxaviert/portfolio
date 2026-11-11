import { afterEach, describe, expect, it, vi } from "vitest";
import {
  applyMode,
  applyPhase,
  MODE_STORAGE_KEY,
  parseStoredMode,
  phaseFor,
  phaseForHour,
  readStoredMode,
  writeStoredMode,
} from "@/lib/theme";
import type { Phase } from "@/lib/theme";

afterEach(() => {
  window.localStorage.clear();
  delete document.documentElement.dataset.mode;
  delete document.documentElement.dataset.phase;
  document.documentElement.classList.remove("dark");
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
});
