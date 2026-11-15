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
import {
  hasReaderClose,
  moveNav,
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

vi.mock("motion/react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("motion/react")>();

  return {
    ...actual,
    animate: mocks.animate as unknown as typeof actual.animate,
    useReducedMotion: () => false,
  };
});

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

  it("reaches the overlay's close from anywhere in the app", () => {
    const close = vi.fn();
    registerReaderClose(close);

    expect(hasReaderClose()).toBe(true);
    requestReaderClose();
    expect(close).toHaveBeenCalledTimes(1);
  });
});
