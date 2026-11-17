import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useReducedMotion } from "./use-reduced-motion";

function stubMatchMedia(matches: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useReducedMotion", () => {
  it("is false when the user has no reduced-motion preference", () => {
    stubMatchMedia(false);

    expect(renderHook(() => useReducedMotion()).result.current).toBe(false);
  });

  it("is true when the user asks for reduced motion", () => {
    stubMatchMedia(true);

    expect(renderHook(() => useReducedMotion()).result.current).toBe(true);
  });
});
