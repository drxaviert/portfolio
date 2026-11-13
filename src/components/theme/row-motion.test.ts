import { afterEach, describe, expect, it, vi } from "vitest";
import {
  parseRowMotion,
  readRowMotion,
  ROW_MOTION_STORAGE_KEY,
  writeRowMotion,
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
