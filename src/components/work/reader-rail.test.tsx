import {
  createEvent,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { READER_SCROLL_ID, READER_TITLE_ID } from "./parts";
import { ReaderMobileActions, ReaderRail } from "./reader-rail";
import { ReaderCloseProvider } from "./reader-close";

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...rest
  }: { href: string; children: ReactNode } & Record<string, unknown>) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

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

/** The reader is quiet until it has been scrolled more than one screen. */
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

  it("closes through the overlay's own path, with no prop drilled in", () => {
    const close = vi.fn();

    render(
      <ReaderCloseProvider close={close}>
        <ReaderRail />
      </ReaderCloseProvider>,
    );

    fireEvent.click(screen.getByRole("link", { name: "Work" }));

    expect(close).toHaveBeenCalledTimes(1);
  });

  it("prevents the default navigation when the reader can close", () => {
    const close = vi.fn();
    render(<ReaderRail onClose={close} />);

    const link = screen.getByRole("link", { name: "Work" });
    const click = createEvent.click(link);
    fireEvent(link, click);

    expect(click.defaultPrevented).toBe(true);
    expect(close).toHaveBeenCalledTimes(1);
  });

  it("leaves a direct load to follow the link home", () => {
    render(<ReaderRail />);

    const link = screen.getByRole("link", { name: "Work" });
    const click = createEvent.click(link);
    fireEvent(link, click);

    expect(click.defaultPrevented).toBe(false);
    expect(link).toHaveAttribute("href", "/");
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
  it("labels both thumb-reach buttons", () => {
    render(<ReaderMobileActions />);

    expect(screen.getByLabelText("Back to work")).toHaveAttribute("href", "/");
    expect(screen.getByLabelText("Back to top")).toBeInTheDocument();
  });

  it("closes from the thumb-reach Work button in the overlay", () => {
    const close = vi.fn();

    render(
      <ReaderCloseProvider close={close}>
        <ReaderMobileActions />
      </ReaderCloseProvider>,
    );

    fireEvent.click(screen.getByLabelText("Back to work"));

    expect(close).toHaveBeenCalledTimes(1);
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
