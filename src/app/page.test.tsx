import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ThemeProvider } from "@/components/theme/theme-provider";
import Page from "@/app/page";

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

describe("home page", () => {
  it("renders the promoted prototype layout", () => {
    render(
      <ThemeProvider>
        <Page />
      </ThemeProvider>,
    );

    // Below md the stacked card and from md the carousel card both render
    // (CSS picks one), so the featured study appears twice in the markup.
    expect(
      screen.getAllByRole("heading", { name: "Systems in motion" }).length,
    ).toBeGreaterThan(0);
    for (const link of screen.getAllByRole("link", {
      name: "Systems in motion",
    })) {
      expect(link).toHaveAttribute("href", "/work/systems-in-motion");
    }
    expect(
      screen.getByRole("navigation", { name: "Primary" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: /contribution tracker/i }),
    ).toBeInTheDocument();
  });

  it("does not render dev-only tools", () => {
    render(
      <ThemeProvider>
        <Page />
      </ThemeProvider>,
    );

    expect(
      screen.queryByLabelText("Horizon glow tuner"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("radiogroup", { name: "Preview phase" }),
    ).not.toBeInTheDocument();
  });
});
