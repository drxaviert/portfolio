import { act, fireEvent, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
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

  it("takes a 44px touch target for the labels and the orb", () => {
    renderNav();

    // A coarse pointer gets 6px of the bar's padding on each edge, so the 32px
    // label and the 36px orb clear the 44px floor without moving.
    const css = readFileSync(
      join(process.cwd(), "src", "components", "home", "nav-items.css"),
      "utf8",
    );

    expect(css).toMatch(
      /@media \(pointer: coarse\) \{\s*\.nav-item::before \{[^}]*inset: -6px 0;/,
    );
    expect(css).toMatch(
      /\.nav-logo::before,\s*\.nav-glyph::before \{[^}]*inset: -6px;/,
    );
    expect(screen.getByRole("link", { name: "Home" })).toHaveClass("nav-logo");
  });

  it("warms the tooltip group only after the first label has opened", () => {
    vi.useFakeTimers();
    renderNav();

    const nav = screen.getByRole("navigation", { name: "Primary" });
    expect(nav).toHaveAttribute("data-tooltip-warm", "false");

    fireEvent.pointerEnter(nav);
    act(() => vi.advanceTimersByTime(299));
    expect(nav).toHaveAttribute("data-tooltip-warm", "false");

    act(() => vi.advanceTimersByTime(1));
    expect(nav).toHaveAttribute("data-tooltip-warm", "true");

    fireEvent.pointerLeave(nav);
    act(() => vi.advanceTimersByTime(300));
    expect(nav).toHaveAttribute("data-tooltip-warm", "false");
    vi.useRealTimers();
  });

  it("drops the tooltip's delay and fade while the group is warm", () => {
    const toggleCss = readFileSync(
      join(process.cwd(), "src", "components", "theme", "theme-toggle.css"),
      "utf8",
    );
    const itemsCss = readFileSync(
      join(process.cwd(), "src", "components", "home", "nav-items.css"),
      "utf8",
    );

    expect(toggleCss).toMatch(
      /\[data-tooltip-warm="true"\] \.segment:hover \.segment-tooltip \{\s*transition: none;/,
    );
    expect(itemsCss).toMatch(
      /\[data-tooltip-warm="true"\] \.nav-glyph:hover \.nav-tooltip \{\s*transition: none;/,
    );
  });
});
