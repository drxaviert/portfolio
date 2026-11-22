import { act, fireEvent, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { registerReaderExit } from "@/components/nav/nav-flight";
import { ThemeProvider } from "@/components/theme/theme-provider";
import {
  resetCloseVariantForTests,
  setCloseVariant,
} from "@/components/work/close-variant";
import { HomeNav } from "./home-nav";

const mocks = vi.hoisted(() => ({ pathname: "/" }));

vi.mock("next/navigation", () => ({
  usePathname: () => mocks.pathname,
}));

beforeEach(() => {
  mocks.pathname = "/";
  window.localStorage.clear();
  window.history.replaceState({}, "", "/");
  resetCloseVariantForTests();
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
  registerReaderExit(null);
  window.localStorage.clear();
  resetCloseVariantForTests();
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

  it("gives the orb a Home tooltip outside the accessibility tree", () => {
    renderNav();

    const logo = screen.getByRole("link", { name: "Home" });
    const tooltip = logo.querySelector(".nav-tooltip");

    // The accessible name stays the short "Home"; the tooltip is the visible
    // label, so a screen reader must not hear it twice.
    expect(tooltip).toHaveTextContent("Home");
    expect(tooltip).toHaveAttribute("aria-hidden", "true");
    expect(logo).toHaveAccessibleName("Home");
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
      /\[data-tooltip-warm="true"\] \.nav-glyph:hover \.nav-tooltip,\s*\[data-tooltip-warm="true"\] \.nav-logo:hover \.nav-tooltip \{\s*transition: none;/,
    );
  });

  it("gives the orb the glyph's tooltip timing", () => {
    const itemsCss = readFileSync(
      join(process.cwd(), "src", "components", "home", "nav-items.css"),
      "utf8",
    );

    // The same 150ms fade in after the group's 300ms delay, and the same
    // release with no transition.
    expect(itemsCss).toMatch(
      /\.nav-glyph:hover \.nav-tooltip,\s*\.nav-logo:hover \.nav-tooltip \{[^}]*var\(--duration-short-3\) var\(--ease-decelerate\)\s*var\(--duration-medium-5\);/,
    );
    expect(itemsCss).toMatch(
      /\.nav-glyph:focus-visible \.nav-tooltip,\s*\.nav-logo:focus-visible \.nav-tooltip \{[^}]*opacity: 1;/,
    );
  });

  it("ships the neutral 5% hover fill", () => {
    const itemsCss = readFileSync(
      join(process.cwd(), "src", "components", "home", "nav-items.css"),
      "utf8",
    );

    // The chosen hover: the ink at 5% into the container, revealed at the
    // original 0.55 weight. It lives on the bar so the orb, outside the glide
    // run, can carry the same fill.
    expect(itemsCss).toMatch(
      /\.nav-bar \{\s*--nav-hover-fill: color-mix\(\s*in oklab,\s*var\(--on-surface\) 5%,\s*var\(--surface-container\)\s*\);/,
    );
    expect(itemsCss).toMatch(
      /\.nav-logo::after \{[^}]*var\(--nav-hover-fill\) 55%/,
    );
  });

  it("keeps the nav close in the bar's layout but hidden on the homepage", () => {
    setCloseVariant("nav");
    renderNav();

    const nav = screen.getByRole("navigation", { name: "Primary" });
    const slot = nav.querySelector(".xv-nav-slot");
    const close = nav.querySelector(".xv-nav-close");
    const toggle = nav.querySelector("[data-mode-track]");

    // The slot is the last item in the right-hand group, after the toggle; it
    // stays in the DOM on `/` so opening the drawer cannot reflow the bar.
    expect(slot).not.toBeNull();
    expect(close).not.toBeNull();
    expect(slot).not.toHaveAttribute("data-shown");
    expect(close).toHaveAttribute("aria-hidden", "true");
    expect(close).toHaveAttribute("tabindex", "-1");
    expect(slot?.parentElement?.lastElementChild).toBe(slot);
    expect(
      toggle!.compareDocumentPosition(close!) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("shows the nav close on the index and runs the drawer's exit", () => {
    mocks.pathname = "/work";
    setCloseVariant("nav");
    const exit = vi.fn();
    registerReaderExit(exit);
    renderNav();

    const slot = document.querySelector(".xv-nav-slot");
    const close = screen.getByRole("button", {
      name: "Close work, back to home",
    });

    expect(slot).toHaveAttribute("data-shown");
    expect(close).not.toHaveAttribute("aria-hidden");
    expect(close.querySelector(".xv-hint")).toHaveTextContent("Close");
    expect(close.querySelector(".xv-hint-key")).toHaveTextContent("Esc");

    fireEvent.click(close);

    expect(exit).toHaveBeenCalledTimes(1);
  });

  it("hides the nav close again on a study", () => {
    mocks.pathname = "/work/systems-in-motion";
    setCloseVariant("nav");
    renderNav();

    expect(document.querySelector(".xv-nav-slot")).not.toHaveAttribute(
      "data-shown",
    );
    expect(document.querySelector(".xv-nav-close")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
  });
});
