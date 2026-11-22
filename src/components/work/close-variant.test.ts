import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CLOSE_VARIANT_STORAGE_KEY,
  getCloseVariant,
  getShowCloseSwitch,
  parseCloseVariant,
  resetCloseVariantForTests,
  setCloseVariant,
  subscribeCloseVariant,
} from "./close-variant";

function url(search: string): void {
  window.history.replaceState({}, "", `/work${search}`);
}

beforeEach(() => {
  window.localStorage.clear();
  url("");
  resetCloseVariantForTests();
});

afterEach(() => {
  window.localStorage.clear();
  url("");
  resetCloseVariantForTests();
});

describe("close variant", () => {
  it("accepts only the five names", () => {
    for (const name of ["nav", "corner", "back", "pill", "below"]) {
      expect(parseCloseVariant(name)).toBe(name);
    }

    expect(parseCloseVariant("home")).toBeNull();
    expect(parseCloseVariant("")).toBeNull();
    expect(parseCloseVariant(null)).toBeNull();
  });

  it("defaults to the shipped below placement", () => {
    expect(getCloseVariant()).toBe("below");
  });

  it("reads ?xv and remembers it", () => {
    url("?xv=corner");

    expect(getCloseVariant()).toBe("corner");
    expect(window.localStorage.getItem(CLOSE_VARIANT_STORAGE_KEY)).toBe(
      "corner",
    );
  });

  it("falls back to the stored choice when the URL is bare", () => {
    window.localStorage.setItem(CLOSE_VARIANT_STORAGE_KEY, "pill");
    url("");

    expect(getCloseVariant()).toBe("pill");
  });

  it("lets the URL win over a stored choice", () => {
    window.localStorage.setItem(CLOSE_VARIANT_STORAGE_KEY, "pill");
    url("?xv=back");

    expect(getCloseVariant()).toBe("back");
  });

  it("ignores an unknown param", () => {
    window.localStorage.setItem(CLOSE_VARIANT_STORAGE_KEY, "nav");
    url("?xv=nope");

    expect(getCloseVariant()).toBe("nav");
  });

  it("persists a live switch, rewrites the URL and notifies", () => {
    const listener = vi.fn();
    subscribeCloseVariant(listener);

    setCloseVariant("pill");

    expect(getCloseVariant()).toBe("pill");
    expect(window.localStorage.getItem(CLOSE_VARIANT_STORAGE_KEY)).toBe("pill");
    expect(new URL(window.location.href).searchParams.get("xv")).toBe("pill");
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("shows the dev switch in development", () => {
    expect(process.env.NODE_ENV).not.toBe("production");
    expect(getShowCloseSwitch()).toBe(true);
  });
});
