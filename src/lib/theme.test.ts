import { afterEach, describe, expect, it, vi } from "vitest";
import {
  readStoredTheme,
  resolveTheme,
  writeStoredTheme,
  THEME_STORAGE_KEY,
} from "@/lib/theme";

afterEach(() => {
  window.localStorage.clear();
  vi.restoreAllMocks();
});

describe("resolveTheme", () => {
  it("uses the stored theme when one is set", () => {
    expect(resolveTheme("light", true)).toBe("light");
    expect(resolveTheme("dark", false)).toBe("dark");
  });

  it("falls back to the system preference when nothing is stored", () => {
    expect(resolveTheme(null, true)).toBe("dark");
    expect(resolveTheme(null, false)).toBe("light");
  });
});

describe("readStoredTheme", () => {
  it("returns the stored theme", () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, "dark");

    expect(readStoredTheme()).toBe("dark");
  });

  it("returns null when storage holds an unknown value", () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, "blue");

    expect(readStoredTheme()).toBeNull();
  });

  it("returns null when storage access throws", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("storage blocked");
    });

    expect(readStoredTheme()).toBeNull();
  });
});

describe("writeStoredTheme", () => {
  it("stores the theme", () => {
    writeStoredTheme("dark");

    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
  });

  it("does not throw when storage access throws", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("storage blocked");
    });

    expect(() => writeStoredTheme("dark")).not.toThrow();
  });
});
