import { afterEach, describe, expect, it, vi } from "vitest";
import {
  formatSpeedReadout,
  parseRowMotion,
  parseRowMotionSpeeds,
  parseRowSpeed,
  readRowMotion,
  readRowMotionSpeeds,
  ROW_MOTION_SPEED_STORAGE_KEY,
  ROW_MOTION_STORAGE_KEY,
  writeRowMotion,
  writeRowMotionSpeeds,
} from "@/components/theme/row-motion";

afterEach(() => {
  window.localStorage.clear();
  vi.restoreAllMocks();
});

describe("parseRowMotion", () => {
  it("keeps 0-5", () => {
    expect(parseRowMotion(0)).toBe(0);
    expect(parseRowMotion("1")).toBe(1);
    expect(parseRowMotion(5)).toBe(5);
  });

  it("falls back to the current motion for anything else", () => {
    expect(parseRowMotion(null)).toBe(0);
    expect(parseRowMotion(undefined)).toBe(0);
    expect(parseRowMotion(6)).toBe(0);
    expect(parseRowMotion(-1)).toBe(0);
    expect(parseRowMotion("blur")).toBe(0);
    expect(parseRowMotion(2.5)).toBe(0);
  });
});

describe("readRowMotion", () => {
  it("reads the stored motion", () => {
    window.localStorage.setItem(ROW_MOTION_STORAGE_KEY, "4");

    expect(readRowMotion()).toBe(4);
  });

  it("returns 0 when nothing valid is stored", () => {
    expect(readRowMotion()).toBe(0);

    window.localStorage.setItem(ROW_MOTION_STORAGE_KEY, "nope");

    expect(readRowMotion()).toBe(0);
  });

  it("returns 0 when storage access throws", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("storage blocked");
    });

    expect(readRowMotion()).toBe(0);
  });
});

describe("writeRowMotion", () => {
  it("stores the motion", () => {
    writeRowMotion(3);

    expect(window.localStorage.getItem(ROW_MOTION_STORAGE_KEY)).toBe("3");
  });

  it("does not throw when storage access throws", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("storage blocked");
    });

    expect(() => writeRowMotion(5)).not.toThrow();
  });
});

describe("parseRowSpeed", () => {
  it("keeps in-range speeds and quantises to the 0.05 step", () => {
    expect(parseRowSpeed(1)).toBe(1);
    expect(parseRowSpeed("1.5")).toBe(1.5);
    expect(parseRowSpeed(0.33)).toBe(0.35);
    expect(parseRowSpeed(4)).toBe(4);
  });

  it("clamps to the slider range and defaults invalid values", () => {
    expect(parseRowSpeed(0.1)).toBe(0.25);
    expect(parseRowSpeed(8)).toBe(4);
    expect(parseRowSpeed("fast")).toBe(1);
    expect(parseRowSpeed(null)).toBe(1);
  });
});

describe("parseRowMotionSpeeds", () => {
  it("reads a per-option map and drops unknown keys", () => {
    expect(
      parseRowMotionSpeeds('{"0":1.5,"2":0.5,"9":3,"nope":2}'),
    ).toEqual({ 0: 1.5, 2: 0.5 });
  });

  it("returns an empty map for malformed values", () => {
    expect(parseRowMotionSpeeds(null)).toEqual({});
    expect(parseRowMotionSpeeds("not json")).toEqual({});
    expect(parseRowMotionSpeeds("[]")).toEqual({});
  });
});

describe("readRowMotionSpeeds", () => {
  it("reads the stored map", () => {
    window.localStorage.setItem(
      ROW_MOTION_SPEED_STORAGE_KEY,
      '{"1":2,"4":0.5}',
    );

    expect(readRowMotionSpeeds()).toEqual({ 1: 2, 4: 0.5 });
  });

  it("returns an empty map when nothing valid is stored", () => {
    expect(readRowMotionSpeeds()).toEqual({});

    window.localStorage.setItem(ROW_MOTION_SPEED_STORAGE_KEY, "nope");

    expect(readRowMotionSpeeds()).toEqual({});
  });

  it("returns an empty map when storage access throws", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("storage blocked");
    });

    expect(readRowMotionSpeeds()).toEqual({});
  });
});

describe("writeRowMotionSpeeds", () => {
  it("stores the per-option map", () => {
    writeRowMotionSpeeds({ 1: 1.5, 5: 4 });

    expect(
      JSON.parse(
        window.localStorage.getItem(ROW_MOTION_SPEED_STORAGE_KEY) ?? "{}",
      ),
    ).toEqual({ 1: 1.5, 5: 4 });
  });

  it("does not throw when storage access throws", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("storage blocked");
    });

    expect(() => writeRowMotionSpeeds({ 2: 0.5 })).not.toThrow();
  });
});

describe("formatSpeedReadout", () => {
  it("shows the speed and the option's scaled enter and exit", () => {
    expect(formatSpeedReadout(2, 1.5)).toBe(
      "1.50x - enter 300ms / exit 210ms",
    );
    expect(formatSpeedReadout(0, 0.25)).toBe(
      "0.25x - enter 45ms / exit 30ms",
    );
  });
});
