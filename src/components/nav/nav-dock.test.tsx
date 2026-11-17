import {
  createEvent,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { NavDock } from "./nav-dock";
import type { DockAnimate } from "./nav-flight";
import {
  hasReaderClose,
  moveNav,
  registerDockAnimate,
  registerReaderClose,
  requestReaderClose,
} from "./nav-flight";

const mocks = vi.hoisted(() => ({
  animate: vi.fn(),
  pathname: "/",
}));

vi.mock("next/navigation", () => ({
  usePathname: () => mocks.pathname,
}));

function animation() {
  return {
    finished: Promise.resolve(),
    stop: vi.fn(),
    complete: vi.fn(),
  };
}

beforeEach(() => {
  mocks.pathname = "/";
  mocks.animate.mockReset();
  mocks.animate.mockImplementation(animation);
  // The reader lends the dock motion's animate; the dock itself does not
  // bundle it (that is what keeps motion out of the home route's first load).
  registerDockAnimate(mocks.animate as unknown as DockAnimate);

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
  registerReaderClose(null);
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

function renderDock() {
  return render(
    <ThemeProvider>
      <NavDock />
    </ThemeProvider>,
  );
}

function dock() {
  return document.querySelector<HTMLElement>("[data-nav-dock]")!;
}

describe("NavDock", () => {
  it("renders the homepage nav exactly once, at rest over the home slot", () => {
    renderDock();

    expect(screen.getAllByRole("navigation", { name: "Primary" })).toHaveLength(
      1,
    );
    expect(dock()).toHaveAttribute("data-nav-state", "home");
  });

  it("starts in the drawer position on a direct load of a study", () => {
    mocks.pathname = "/work/systems-in-motion";
    renderDock();

    expect(dock()).toHaveAttribute("data-nav-state", "reader");
  });

  it("keeps the same element through a move into the reader", async () => {
    renderDock();
    const nav = screen.getByRole("navigation", { name: "Primary" });

    await act(() => moveNav("reader", "flip"));

    expect(screen.getByRole("navigation", { name: "Primary" })).toBe(nav);
    expect(dock()).toHaveAttribute("data-nav-state", "reader");
  });

  it("does not move on a study-to-study open", async () => {
    mocks.pathname = "/work/systems-in-motion";
    renderDock();
    mocks.animate.mockClear();

    await act(() => moveNav("reader", "flip"));

    expect(mocks.animate).not.toHaveBeenCalled();
  });

  it("takes its new place with no flight when no reader has lent motion", async () => {
    // Home-only documents never load the reader, so motion is never there.
    // There is also no drawer to fly into: the dock just takes the position.
    registerDockAnimate(null);
    renderDock();

    await act(() => moveNav("reader", "flip"));

    expect(mocks.animate).not.toHaveBeenCalled();
    expect(dock()).toHaveAttribute("data-nav-state", "reader");
  });

  it("closes the reader when Work is clicked in the drawer", () => {
    mocks.pathname = "/work/systems-in-motion";
    renderDock();
    const close = vi.fn();
    registerReaderClose(close);

    const link = screen.getByRole("link", { name: "Work" });
    const click = createEvent.click(link);
    fireEvent(link, click);

    expect(click.defaultPrevented).toBe(true);
    expect(close).toHaveBeenCalledTimes(1);
  });

  it("leaves a modified click and a direct load to the browser", () => {
    mocks.pathname = "/work/systems-in-motion";
    renderDock();

    const link = screen.getByRole("link", { name: "Work" });
    const modified = createEvent.click(link, { metaKey: true });
    fireEvent(link, modified);

    expect(modified.defaultPrevented).toBe(false);
    expect(hasReaderClose()).toBe(false);

    const plain = createEvent.click(link);
    fireEvent(link, plain);

    expect(plain.defaultPrevented).toBe(false);
  });

  it("puts the nav back home when the route leaves the reader", async () => {
    mocks.pathname = "/work/systems-in-motion";
    const view = renderDock();
    expect(dock()).toHaveAttribute("data-nav-state", "reader");

    mocks.pathname = "/";
    view.rerender(
      <ThemeProvider>
        <NavDock />
      </ThemeProvider>,
    );

    await waitFor(() =>
      expect(dock()).toHaveAttribute("data-nav-state", "home"),
    );
  });

  it("puts the nav back in the drawer when the route enters a reader", async () => {
    // Browser Forward into a study entry restores the reader without running
    // the open morph, so nothing else moves the dock into the drawer.
    const view = renderDock();
    expect(dock()).toHaveAttribute("data-nav-state", "home");

    mocks.pathname = "/work/systems-in-motion";
    view.rerender(
      <ThemeProvider>
        <NavDock />
      </ThemeProvider>,
    );

    await waitFor(() =>
      expect(dock()).toHaveAttribute("data-nav-state", "reader"),
    );
  });

  it("hangs the phase row on one shared gap in both docks", () => {
    const read = (...parts: string[]) =>
      readFileSync(join(process.cwd(), ...parts), "utf8");
    const globals = read("src", "app", "globals.css");
    const dockCss = read("src", "components", "nav", "nav-dock.css");
    const toggleCss = read("src", "components", "theme", "theme-toggle.css");

    // One token, read once.
    expect(globals.match(/--wd-phase-row-gap:/g)).toHaveLength(1);
    expect(globals).toMatch(/--wd-phase-row-gap:\s*4px;/);

    // Home: the row hangs above the toggle by that token.
    expect(toggleCss).toMatch(
      /\.phase-row \{[\s\S]*?margin-bottom: var\(--wd-phase-row-gap\);/,
    );

    // Reader: the row hangs below the toggle by the same token, with no
    // drawer-only pixel gap.
    const readerRow = dockCss.match(
      /\.wd-nav-dock\[data-nav-state="reader"\] \.phase-row \{[^}]*\}/,
    )?.[0];

    expect(readerRow).toMatch(
      /top: calc\(100% \+ var\(--wd-phase-row-gap\)\);/,
    );
    expect(readerRow).not.toMatch(/\+ 24px/);
  });

  it("points each track's labels away from the other track", () => {
    const css = readFileSync(
      join(process.cwd(), "src", "components", "nav", "nav-dock.css"),
      "utf8",
    );
    const rule = (pattern: RegExp) => css.match(pattern)?.[0];

    // Reader: the row hangs below the toggle, so the toggle's own labels go
    // above it...
    expect(
      rule(
        /\.wd-nav-dock\[data-nav-state="reader"\]\s+\[data-mode-track\]\s+\.segment-tooltip \{[^}]*\}/,
      ),
    ).toMatch(/bottom: calc\(100% \+ 8px\)/);

    // ...and the row's labels go below, away from the toggle.
    expect(
      rule(
        /\.wd-nav-dock\[data-nav-state="reader"\] \.phase-row \.segment-tooltip \{[^}]*\}/,
      ),
    ).toMatch(/top: calc\(100% \+ 8px\)/);

    // Home: the row is above the toggle, so the toggle's labels go below it.
    expect(
      rule(
        /\.wd-nav-dock:not\(\[data-nav-state="reader"\]\)\s+\[data-mode-track\]\s+\.segment-tooltip \{[^}]*\}/,
      ),
    ).toMatch(/top: calc\(100% \+ 8px\)/);
  });

  it("measures the nav-to-content gap from one token", () => {
    const read = (...parts: string[]) =>
      readFileSync(join(process.cwd(), ...parts), "utf8");
    const globals = read("src", "app", "globals.css");
    const readerCss = read("src", "components", "work", "reader.css");

    expect(globals.match(/--wd-nav-content-gap:/g)).toHaveLength(2);
    expect(globals).toMatch(/--wd-nav-content-gap: 24px;/);
    expect(globals).toMatch(/--wd-nav-content-gap: 32px;/);

    // The column clearance and the rail both read it, with no leftover 12px.
    expect(readerCss.match(/var\(--wd-nav-content-gap\)/g)).toHaveLength(2);
    expect(readerCss).not.toMatch(/--wd-nav-height\) \+ 12px/);
  });

  it("scales the Day row out of the corner nearest the toggle", () => {
    const read = (...parts: string[]) =>
      readFileSync(join(process.cwd(), ...parts), "utf8");
    const dockCss = read("src", "components", "nav", "nav-dock.css");
    const toggleCss = read("src", "components", "theme", "theme-toggle.css");

    // Home: the row is above the toggle, so it grows from its bottom corner.
    expect(toggleCss).toMatch(/transform-origin: bottom right;/);

    // Reader: the row hangs below, keyed off the same attribute that flips it,
    // so it grows from the top corner instead.
    const readerRow = dockCss.match(
      /\.wd-nav-dock\[data-nav-state="reader"\] \.phase-row \{[^}]*\}/,
    )?.[0];

    expect(readerRow).toMatch(/transform-origin: top right;/);
  });

  it("reaches the overlay's close from anywhere in the app", () => {
    const close = vi.fn();
    registerReaderClose(close);

    expect(hasReaderClose()).toBe(true);
    requestReaderClose();
    expect(close).toHaveBeenCalledTimes(1);
  });

  it("hands the close back to the reader below when the overlay lets go", () => {
    const page = vi.fn();
    const overlay = vi.fn();
    const offPage = registerReaderClose(page);
    const offOverlay = registerReaderClose(overlay);

    requestReaderClose();
    expect(overlay).toHaveBeenCalledTimes(1);

    offOverlay();
    requestReaderClose();
    expect(page).toHaveBeenCalledTimes(1);

    offPage();
    expect(hasReaderClose()).toBe(false);
  });
});
