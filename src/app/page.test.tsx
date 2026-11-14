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

    expect(
      screen.getByRole("heading", { name: "Systems in motion" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Systems in motion" }),
    ).toHaveAttribute("href", "/work/systems-in-motion");
    // The nav itself is one element in the root layout; the page reserves its
    // slot and nothing else.
    expect(document.querySelector("[data-nav-slot]")).toBeInTheDocument();
    expect(
      screen.queryByRole("navigation", { name: "Primary" }),
    ).not.toBeInTheDocument();
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
