import { fireEvent, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DrawerActionsProvider } from "./drawer-actions";
import { Breadcrumb } from "./breadcrumb";

const exit = vi.fn();
const close = vi.fn();
const stepBack = vi.fn();

function renderBreadcrumb(title?: string) {
  render(
    <DrawerActionsProvider close={close} stepBack={stepBack} exit={exit}>
      <Breadcrumb title={title} />
    </DrawerActionsProvider>,
  );
}

beforeEach(() => {
  exit.mockReset();
  close.mockReset();
  stepBack.mockReset();
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

describe("Breadcrumb", () => {
  it("uses a labelled nav landmark with an ordered list", () => {
    renderBreadcrumb();

    const nav = screen.getByRole("navigation", { name: "Breadcrumb" });
    expect(nav.querySelector("ol")).not.toBeNull();
    expect(nav.querySelectorAll("ol > li").length).toBe(3);
  });

  it("index: Home is a link, Work is the current static segment", () => {
    renderBreadcrumb();

    const home = screen.getByRole("link", { name: "Home" });
    const work = screen.getByText("Work", {
      selector: ".breadcrumb-item span",
    });

    expect(home).toHaveAttribute("href", "/");
    expect(work).toHaveAttribute("aria-current", "page");
    expect(work.closest("a")).toBeNull();
    expect(screen.queryByRole("link", { name: "Work" })).toBeNull();
  });

  it("reader: Home and Work link, the title is the current static segment", () => {
    renderBreadcrumb("Systems in motion");

    expect(screen.getByRole("link", { name: "Home" })).toHaveAttribute(
      "href",
      "/",
    );
    expect(screen.getByRole("link", { name: "Work" })).toHaveAttribute(
      "href",
      "/work",
    );

    const title = screen.getByText("Systems in motion", {
      selector: ".breadcrumb-current",
    });
    expect(title).toHaveAttribute("aria-current", "page");
    expect(title.closest("a")).toBeNull();
    expect(title).toHaveAttribute("title", "Systems in motion");
  });

  it("runs the drawer actions for plain clicks only", () => {
    renderBreadcrumb("Systems in motion");
    const home = screen.getByRole("link", { name: "Home" });
    const work = screen.getByRole("link", { name: "Work" });

    fireEvent.click(work);
    expect(stepBack).toHaveBeenCalledTimes(1);
    expect(close).not.toHaveBeenCalled();

    const modified = new MouseEvent("click", { bubbles: true, metaKey: true });
    work.dispatchEvent(modified);
    expect(modified.defaultPrevented).toBe(false);

    fireEvent.click(home);
    expect(close).toHaveBeenCalledTimes(1);
    expect(stepBack).toHaveBeenCalledTimes(1);
  });

  it("index: Home runs the drawer's exit, not close", () => {
    renderBreadcrumb();

    fireEvent.click(screen.getByRole("link", { name: "Home" }));

    expect(exit).toHaveBeenCalledTimes(1);
    expect(close).not.toHaveBeenCalled();
  });

  it("shares the nav item classes and the Glide layer", () => {
    renderBreadcrumb("Systems in motion");
    const home = screen.getByRole("link", { name: "Home" });

    for (const token of [
      "nav-item",
      "h-8",
      "px-2",
      "rounded-md",
      "text-base",
      "leading-5",
      "font-medium",
      "focus-visible:outline-primary",
    ]) {
      expect(home).toHaveClass(token);
    }

    expect(document.querySelector(".nav-glide")).not.toBeNull();
  });

  it("shows the capsule on a fine pointer and not on touch", () => {
    renderBreadcrumb("Systems in motion");
    const home = screen.getByRole("link", { name: "Home" });
    const work = screen.getByRole("link", { name: "Work" });

    Object.defineProperty(home, "offsetWidth", { value: 40 });
    Object.defineProperty(home, "offsetLeft", { value: 0 });
    Object.defineProperty(work, "offsetWidth", { value: 40 });
    Object.defineProperty(work, "offsetLeft", { value: 56 });

    fireEvent.pointerEnter(home, { pointerType: "touch" });
    expect(document.querySelector(".nav-glide")).not.toHaveAttribute(
      "data-visible",
    );

    fireEvent.pointerEnter(home, { pointerType: "mouse" });
    expect(document.querySelector(".nav-glide")).toHaveAttribute(
      "data-visible",
    );

    fireEvent.pointerEnter(work, { pointerType: "mouse" });
    expect(document.querySelector(".nav-glide")).toHaveAttribute(
      "data-visible",
    );
  });

  it("keeps the current segment at the nav's weight, marked by an underline", () => {
    renderBreadcrumb("Systems in motion");

    const title = screen.getByText("Systems in motion", {
      selector: ".breadcrumb-current",
    });
    const home = screen.getByRole("link", { name: "Home" });

    // The current crumb is not a tab, but it carries no extra weight either:
    // it stays at the nav's `font-medium` (500) and breadcrumb.css underlines
    // it. The links keep the nav weight and stay un-underlined.
    expect(title).toHaveClass("font-medium");
    expect(title).not.toHaveClass("font-semibold");
    expect(title).not.toHaveClass("font-bold");
    expect(home).toHaveClass("font-medium");
    expect(home).toHaveClass("no-underline");
    expect(home).not.toHaveClass("font-semibold");
  });

  it("underlines only the current segment, at 1px and 4px offset", () => {
    const css = readFileSync(
      join(process.cwd(), "src", "components", "work", "breadcrumb.css"),
      "utf8",
    );

    const rule = css.match(
      /\.breadcrumb-list \[aria-current="page"\] \{[^}]*\}/,
    )?.[0];

    expect(rule).toBeDefined();
    expect(rule).toMatch(/text-decoration-line: underline;/);
    expect(rule).toMatch(/text-decoration-thickness: 1px;/);
    expect(rule).toMatch(/text-underline-offset: 4px;/);
    expect(rule).toMatch(/text-decoration-skip-ink: auto;/);
    expect(rule).toMatch(/text-decoration-color: currentColor;/);
  });

  it("documents the 240px title clip and the separator token", () => {
    const css = readFileSync(
      join(process.cwd(), "src", "components", "work", "breadcrumb.css"),
      "utf8",
    );

    expect(css).toMatch(/\.breadcrumb-current \{[^}]*max-width: 240px;/);
    expect(css).toMatch(
      /\.breadcrumb-sep \{[^}]*color: var\(--on-surface-variant\);[^}]*font-size: var\(--text-base\);[^}]*font-weight: 400;/,
    );
  });
});
