import { afterEach, describe, expect, it, vi } from "vitest";
import {
  formatCloseDelayReadout,
  formatIconStrengthReadout,
  formatSpeedReadout,
  parseIconStrength,
  parseRowCloseDelay,
  parseRowIconStrengths,
  parseRowMotion,
  parseRowMotionSpeeds,
  parseRowSpeed,
  readRowCloseDelay,
  readRowIconStrengths,
  readRowMotion,
  readRowMotionSpeeds,
  ROW_CLOSE_STORAGE_KEY,
  ROW_MOTION_ICON_STORAGE_KEY,
  ROW_MOTION_SPEED_STORAGE_KEY,
  ROW_MOTION_STORAGE_KEY,
  writeRowCloseDelay,
  writeRowIconStrengths,
  writeRowMotion,
  writeRowMotionSpeeds,
} from "@/components/theme/row-motion";

afterEach(() => {
  window.localStorage.clear();
  vi.restoreAllMocks();
});

describe("parseRowMotion", () => {
  it("keeps 0-6", () => {
    expect(parseRowMotion(0)).toBe(0);
    expect(parseRowMotion("1")).toBe(1);
    expect(parseRowMotion(6)).toBe(6);
  });

  it("falls back to the current motion for anything else", () => {
    expect(parseRowMotion(null)).toBe(0);
    expect(parseRowMotion(undefined)).toBe(0);
    expect(parseRowMotion(7)).toBe(0);
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
      parseRowMotionSpeeds('{"0":1.5,"2":0.5,"6":3,"9":3,"nope":2}'),
    ).toEqual({ 0: 1.5, 2: 0.5, 6: 3 });
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
    expect(formatSpeedReadout(6, 2)).toBe(
      "2.00x - enter 400ms / exit 240ms",
    );
    expect(formatSpeedReadout(0, 0.25)).toBe(
      "0.25x - enter 45ms / exit 30ms",
    );
  });
});

describe("parseIconStrength", () => {
  it("keeps in-range strengths and quantises to the 0.1 step", () => {
    expect(parseIconStrength(1)).toBe(1);
    expect(parseIconStrength("1.5")).toBe(1.5);
    expect(parseIconStrength(1.24)).toBe(1.2);
    expect(parseIconStrength(3)).toBe(3);
  });

  it("clamps to the slider range and defaults invalid values", () => {
    expect(parseIconStrength(0.1)).toBe(0.5);
    expect(parseIconStrength(9)).toBe(3);
    expect(parseIconStrength("strong")).toBe(1);
    expect(parseIconStrength(null)).toBe(1);
  });
});

describe("parseRowIconStrengths", () => {
  it("reads a per-option map and drops unknown keys", () => {
    expect(
      parseRowIconStrengths('{"6":1.5,"0":2,"9":3,"nope":2}'),
    ).toEqual({ 6: 1.5, 0: 2 });
  });

  it("returns an empty map for malformed values", () => {
    expect(parseRowIconStrengths(null)).toEqual({});
    expect(parseRowIconStrengths("not json")).toEqual({});
    expect(parseRowIconStrengths("[]")).toEqual({});
  });
});

describe("readRowIconStrengths", () => {
  it("reads the stored map", () => {
    window.localStorage.setItem(ROW_MOTION_ICON_STORAGE_KEY, '{"6":2.5}');

    expect(readRowIconStrengths()).toEqual({ 6: 2.5 });
  });

  it("returns an empty map when storage access throws", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("storage blocked");
    });

    expect(readRowIconStrengths()).toEqual({});
  });
});

describe("writeRowIconStrengths", () => {
  it("stores the per-option map", () => {
    writeRowIconStrengths({ 6: 1.5 });

    expect(
      JSON.parse(
        window.localStorage.getItem(ROW_MOTION_ICON_STORAGE_KEY) ?? "{}",
      ),
    ).toEqual({ 6: 1.5 });
  });

  it("does not throw when storage access throws", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("storage blocked");
    });

    expect(() => writeRowIconStrengths({ 6: 2 })).not.toThrow();
  });
});

describe("formatIconStrengthReadout", () => {
  it("shows the scaled rays and rise", () => {
    expect(formatIconStrengthReadout(1)).toBe(
      "1x - rays -45deg / rise 4px",
    );
    expect(formatIconStrengthReadout(1.5)).toBe(
      "1.5x - rays -68deg / rise 6px",
    );
    expect(formatIconStrengthReadout(2)).toBe(
      "2x - rays -90deg / rise 8px",
    );
  });
});

describe("parseRowCloseDelay", () => {
  it("migrates the old select values", () => {
    expect(parseRowCloseDelay("instant")).toBe(0);
    expect(parseRowCloseDelay("700ms")).toBe(700);
    expect(parseRowCloseDelay("700")).toBe(700);
  });

  it("clamps to 0-1000 and quantises to the 25ms step", () => {
    expect(parseRowCloseDelay("300")).toBe(300);
    expect(parseRowCloseDelay(325)).toBe(325);
    expect(parseRowCloseDelay(310)).toBe(300);
    expect(parseRowCloseDelay(-50)).toBe(0);
    expect(parseRowCloseDelay(1200)).toBe(1000);
  });

  it("defaults to 700ms for missing or invalid values", () => {
    expect(parseRowCloseDelay(null)).toBe(700);
    expect(parseRowCloseDelay(undefined)).toBe(700);
    expect(parseRowCloseDelay("soon")).toBe(700);
  });
});

describe("readRowCloseDelay", () => {
  it("reads the stored delay including old values", () => {
    window.localStorage.setItem(ROW_CLOSE_STORAGE_KEY, "300");

    expect(readRowCloseDelay()).toBe(300);

    window.localStorage.setItem(ROW_CLOSE_STORAGE_KEY, "instant");

    expect(readRowCloseDelay()).toBe(0);
  });

  it("returns 700ms when storage access throws", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("storage blocked");
    });

    expect(readRowCloseDelay()).toBe(700);
  });
});

describe("writeRowCloseDelay", () => {
  it("stores the delay as a number string", () => {
    writeRowCloseDelay(300);

    expect(window.localStorage.getItem(ROW_CLOSE_STORAGE_KEY)).toBe("300");
  });

  it("does not throw when storage access throws", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("storage blocked");
    });

    expect(() => writeRowCloseDelay(700)).not.toThrow();
  });
});

describe("formatCloseDelayReadout", () => {
  it("shows the delay in ms", () => {
    expect(formatCloseDelayReadout(300)).toBe("300ms");
    expect(formatCloseDelayReadout(0)).toBe("0ms");
  });
});
