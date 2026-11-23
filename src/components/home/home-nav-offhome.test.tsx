import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { HomeNav } from "@/components/home/home-nav";

const mocks = vi.hoisted(() => ({ pathname: "/" }));

vi.mock("next/navigation", () => ({
  usePathname: () => mocks.pathname,
}));

beforeEach(() => {
  mocks.pathname = "/";
  window.history.replaceState({}, "", "/?offhome=nav");
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
  window.history.replaceState({}, "", "/");
});

describe("HomeNav off-home variant", () => {
  it("renders the hidden nav control for ?offhome=nav", () => {
    const { container } = render(
      <ThemeProvider>
        <HomeNav />
      </ThemeProvider>,
    );

    const control = container.querySelector(".nav-player");

    expect(control).not.toBeNull();
    expect(control).toHaveAttribute("data-visible", "false");
    expect(control).toHaveAttribute("aria-hidden", "true");
  });
});
