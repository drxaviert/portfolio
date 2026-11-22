import { act, fireEvent, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { HomeNav } from "./home-nav";

const mocks = vi.hoisted(() => ({ pathname: "/" }));

vi.mock("next/navigation", () => ({
  usePathname: () => mocks.pathname,
}));

beforeEach(() => {
  mocks.pathname = "/";
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

  it("links Work to the work sheet", () => {
    renderNav();

    expect(screen.getByRole("link", { name: "Work" })).toHaveAttribute(
      "href",
      "/work",
    );
  });

  it("keeps Play and About as placeholder buttons", () => {
    renderNav();

    // Only Work routes today; the other labels stay focusable buttons so the
    // Glide run has no dead anchor and nothing navigates to "#".
    expect(screen.getByRole("button", { name: "Play" })).toHaveAttribute(
      "type",
      "button",
    );
    expect(screen.getByRole("button", { name: "About" })).toHaveAttribute(
      "type",
      "button",
    );
  });

  it("keeps a label on one line and exposes its full text", () => {
    renderNav();

    for (const [role, name] of [
      ["link", "Work"],
      ["button", "Play"],
      ["button", "About"],
    ] as const) {
      const control = screen.getByRole(role, { name });

      // No wrap out of the 32px item, and a label that can give way with an
      // ellipsis instead of widening the bar; the name is still the whole
      // string for assistive tech. A label that fits carries no clip, so its
      // resting pixels do not change either.
      expect(control).toHaveClass("min-w-0", "whitespace-nowrap");
      expect(control).toHaveAttribute("aria-label", name);
      expect(control).not.toHaveClass("overflow-hidden");
    }
  });

  it("shows a pointer cursor on the design-system glyph", () => {
    renderNav();

    // The labels get it from their button reset class; the glyph is a button
    // too, so it must not fall back to the UA arrow.
    expect(screen.getByRole("button", { name: "Design system" })).toHaveClass(
      "cursor-pointer",
    );
  });

  it("gives the labels, the glyph and the orb a 44px hit area", () => {
    renderNav();
    // 6px of the bar's padding on each edge: the 32px label and glyph become 44,
    // and the 36px orb 44 too. The pseudo-elements are transparent, so the
    // resting boxes, the capsule and the nav's look are untouched — and every
    // pointer gets them, not only a coarse one.
    const css = readFileSync(
      join(process.cwd(), "src", "components", "home", "nav-items.css"),
      "utf8",
    );

    expect(css).toMatch(/\.nav-item::before \{[^}]*inset: -6px 0;/);
    expect(css).toMatch(/\.nav-glyph::before \{[^}]*inset: -6px;/);
    expect(css).toMatch(/\.nav-logo::before \{[^}]*inset: -4px;/);
    expect(css).not.toMatch(/@media \(pointer: coarse\)/);
    expect(screen.getByRole("link", { name: "Home" })).toHaveClass("nav-logo");
  });

  it("marks Work current only on the work route", () => {
    const home = renderNav();
    const work = () => screen.getByRole("link", { name: "Work" });

    // On the homepage the item must not wear the selected capsule; the `aria`
    // state and the resting fill both belong to /work.
    expect(work()).not.toHaveAttribute("aria-current");
    expect(work()).not.toHaveClass("bg-surface-container");
    home.unmount();

    mocks.pathname = "/work";
    renderNav();
    expect(work()).toHaveAttribute("aria-current", "page");
    expect(work()).toHaveClass("bg-surface-container");
  });

  it("keeps Work current inside a study of the work route", () => {
    mocks.pathname = "/work/systems-in-motion";
    renderNav();

    expect(screen.getByRole("link", { name: "Work" })).toHaveAttribute(
      "aria-current",
      "page",
    );
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

  it("ships the neutral 5% hover fill", () => {
    const itemsCss = readFileSync(
      join(process.cwd(), "src", "components", "home", "nav-items.css"),
      "utf8",
    );

    // The chosen hover: the ink at 5% into the container, revealed at the
    // original 0.55 weight.
    expect(itemsCss).toMatch(
      /\.nav-run \{\s*--nav-hover-fill: color-mix\(\s*in oklab,\s*var\(--on-surface\) 5%,\s*var\(--surface-container\)\s*\);/,
    );
  });
});
