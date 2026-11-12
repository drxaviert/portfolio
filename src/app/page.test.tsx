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
      screen.getByRole("heading", { name: "Project name" }),
    ).toBeInTheDocument();
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
