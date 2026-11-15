import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HomeNav } from "@/components/home/home-nav";
import { ThemeProvider } from "@/components/theme/theme-provider";
import {
  ReaderCloseProvider,
  useEscToClose,
  useReaderClose,
} from "./reader-close";

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

function EscProbe() {
  const close = useReaderClose();
  useEscToClose(close);

  return null;
}

function renderOverlay(onClose: () => void) {
  render(
    <ThemeProvider>
      <ReaderCloseProvider close={onClose}>
        <EscProbe />
        <HomeNav />
      </ReaderCloseProvider>
    </ThemeProvider>,
  );
}

function phaseRow(): HTMLElement {
  return document.querySelector<HTMLElement>('[data-phase-row="true"]')!;
}

describe("reader close", () => {
  it("closes on Escape", () => {
    const onClose = vi.fn();
    renderOverlay(onClose);

    fireEvent.keyDown(window, { key: "Escape" });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("ignores an Escape a popover already handled", () => {
    const onClose = vi.fn();
    renderOverlay(onClose);

    const popover = (event: KeyboardEvent) => event.preventDefault();
    document.addEventListener("keydown", popover);

    fireEvent.keyDown(document, { key: "Escape" });

    document.removeEventListener("keydown", popover);

    expect(onClose).not.toHaveBeenCalled();
  });

  it("dismisses the theme menu before closing the reader", () => {
    const onClose = vi.fn();
    renderOverlay(onClose);

    fireEvent.click(
      screen.getByRole("button", { name: "Choose theme, currently Auto" }),
    );
    expect(screen.getByRole("menu", { name: "Theme" })).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });

    expect(
      screen.queryByRole("menu", { name: "Theme" }),
    ).not.toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.keyDown(document, { key: "Escape" });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("dismisses the Day phase row before closing the reader", () => {
    const onClose = vi.fn();
    renderOverlay(onClose);

    const day = screen.getByRole("radio", { name: "Day" });
    fireEvent.click(day);
    // A real click also focuses the segment, which is what makes the row the
    // owner of the next Escape while the user is in it.
    fireEvent.focus(day);
    expect(phaseRow()).toHaveAttribute("data-visible", "true");

    fireEvent.keyDown(document, { key: "Escape" });

    expect(phaseRow()).toHaveAttribute("data-visible", "false");
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.keyDown(document, { key: "Escape" });

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
