import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { HomeNav } from "./home-nav";

beforeEach(() => {
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

function renderNav() {
  return render(
    <ThemeProvider>
      <HomeNav />
    </ThemeProvider>,
  );
}

describe("HomeNav", () => {
  it("links the logo home", () => {
    renderNav();

    expect(screen.getByRole("link", { name: "Home" })).toHaveAttribute(
      "href",
      "/",
    );
  });

  it("links Work home", () => {
    renderNav();

    expect(screen.getByRole("link", { name: "Work" })).toHaveAttribute(
      "href",
      "/",
    );
  });

  it("keeps Play and About as placeholder links", () => {
    renderNav();

    // Main's Glide run needs focusable anchors; only Work routes today.
    expect(screen.getByRole("link", { name: "Play" })).toHaveAttribute(
      "href",
      "#",
    );
    expect(screen.getByRole("link", { name: "About" })).toHaveAttribute(
      "href",
      "#",
    );
  });
});
