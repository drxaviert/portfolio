import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MobileGate } from "./mobile-gate";

const { route } = vi.hoisted(() => ({
  route: { current: "/live/human-contact" },
}));

vi.mock("next/navigation", () => ({
  usePathname: () => route.current,
}));

beforeEach(() => {
  route.current = "/live/human-contact";
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("mobile gate", () => {
  it("stays out of the full-screen live route", () => {
    render(<MobileGate />);

    expect(document.querySelector("[data-mobile-gate]")).toBeNull();
  });

  it("still gates the normal site", () => {
    route.current = "/";
    render(<MobileGate />);

    expect(document.querySelector("[data-mobile-gate]")).not.toBeNull();
  });
});
