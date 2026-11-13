import { afterEach, describe, expect, it, vi } from "vitest";
import {
  appliedHoverVariant,
  HOVER_VARIANT_STORAGE_KEY,
  parseHoverVariant,
  readHoverVariant,
  writeHoverVariant,
} from "@/components/theme/hover-variants";

afterEach(() => {
  window.localStorage.clear();
  delete document.documentElement.dataset.hoverVariant;
  vi.restoreAllMocks();
});

describe("parseHoverVariant", () => {
  it("keeps 0-4", () => {
    expect(parseHoverVariant(0)).toBe(0);
    expect(parseHoverVariant("1")).toBe(1);
    expect(parseHoverVariant(4)).toBe(4);
  });

  it("falls back to the current look for anything else", () => {
    expect(parseHoverVariant(null)).toBe(0);
    expect(parseHoverVariant(undefined)).toBe(0);
    expect(parseHoverVariant(5)).toBe(0);
    expect(parseHoverVariant(-1)).toBe(0);
    expect(parseHoverVariant("springy")).toBe(0);
    expect(parseHoverVariant(1.5)).toBe(0);
  });
});

describe("readHoverVariant", () => {
  it("reads the stored variant", () => {
    window.localStorage.setItem(HOVER_VARIANT_STORAGE_KEY, "3");

    expect(readHoverVariant()).toBe(3);
  });

  it("returns 0 when nothing valid is stored", () => {
    expect(readHoverVariant()).toBe(0);

    window.localStorage.setItem(HOVER_VARIANT_STORAGE_KEY, "nope");

    expect(readHoverVariant()).toBe(0);
  });

  it("returns 0 when storage access throws", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("storage blocked");
    });

    expect(readHoverVariant()).toBe(0);
  });
});

describe("writeHoverVariant", () => {
  it("stores the variant", () => {
    writeHoverVariant(2);

    expect(window.localStorage.getItem(HOVER_VARIANT_STORAGE_KEY)).toBe("2");
  });

  it("does not throw when storage access throws", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("storage blocked");
    });

    expect(() => writeHoverVariant(4)).not.toThrow();
  });
});

describe("appliedHoverVariant", () => {
  it("reads the variant applied to the document", () => {
    expect(appliedHoverVariant()).toBe(0);

    document.documentElement.dataset.hoverVariant = "4";

    expect(appliedHoverVariant()).toBe(4);
  });
});
