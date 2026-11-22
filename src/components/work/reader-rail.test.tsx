import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { READER_SCROLL_ID, READER_TITLE_ID } from "./parts";
import { ReaderMobileActions, ReaderRail } from "./reader-rail";

let scroll: HTMLElement;
let title: HTMLElement;

function stubMatchMedia(reduced: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches: reduced && query === "(prefers-reduced-motion: reduce)",
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  );
}

beforeEach(() => {
  stubMatchMedia(false);

  scroll = document.createElement("div");
  scroll.id = READER_SCROLL_ID;
  Object.defineProperty(scroll, "clientHeight", {
    configurable: true,
    value: 600,
  });
  scroll.scrollTo = vi.fn();

  title = document.createElement("h1");
  title.id = READER_TITLE_ID;
  title.tabIndex = -1;

  document.body.append(scroll, title);
});

afterEach(() => {
  vi.unstubAllGlobals();
  scroll.remove();
  title.remove();
});

/** The reach-to-top control is quiet until scrolled more than one screen. */
async function scrollPastOneScreen() {
  scroll.scrollTop = 601;
  fireEvent.scroll(scroll);

  await waitFor(() =>
    expect(screen.getByLabelText("Back to top")).not.toHaveAttribute("inert"),
  );
}

describe("ReaderRail", () => {
  it("stacks above the 880px figure breakouts", () => {
    const css = readFileSync(
      join(process.cwd(), "src", "components", "work", "reader.css"),
      "utf8",
    );

    expect(css).toMatch(
      /@media \(min-width: 1024px\) \{\s*\.wd-rail \{[^}]*position: absolute;[^}]*z-index: 1;/,
    );
  });

  it("keeps only the reach-to-top control in the rail", () => {
    render(<ReaderRail />);

    // The way back is the shared BackLink above the article now.
    expect(screen.queryByRole("link", { name: "Work" })).toBeNull();
    expect(screen.getByLabelText("Back to top")).toHaveClass("wd-rail-top");
  });

  it("hides Back to top until the reader is a screen down", async () => {
    render(<ReaderRail />);

    expect(screen.getByLabelText("Back to top")).toHaveAttribute("inert");

    await scrollPastOneScreen();
  });

  it("scrolls to the top smoothly, then focuses the title", async () => {
    render(<ReaderRail />);

    await scrollPastOneScreen();
    fireEvent.click(screen.getByLabelText("Back to top"));

    expect(scroll.scrollTo).toHaveBeenCalledWith({
      top: 0,
      behavior: "smooth",
    });
    expect(document.activeElement).toBe(title);
  });

  it("jumps to the top under reduced motion", async () => {
    stubMatchMedia(true);
    render(<ReaderRail />);

    await scrollPastOneScreen();
    fireEvent.click(screen.getByLabelText("Back to top"));

    expect(scroll.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: "auto" });
  });
});

describe("ReaderMobileActions", () => {
  it("keeps only the thumb-reach Back to top button", () => {
    render(<ReaderMobileActions />);

    expect(screen.getByLabelText("Back to top")).toHaveClass(
      "wd-reader-action",
    );
    expect(screen.queryByLabelText("Back to work")).toBeNull();
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("scrolls to the top and focuses the title", async () => {
    render(<ReaderMobileActions />);

    await scrollPastOneScreen();
    fireEvent.click(screen.getByLabelText("Back to top"));

    expect(scroll.scrollTo).toHaveBeenCalledWith({
      top: 0,
      behavior: "smooth",
    });
    expect(document.activeElement).toBe(title);
  });
});
