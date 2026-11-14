import { createEvent, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { ReaderNav } from "./reader-nav";

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

function renderNav(onClose: () => void) {
  render(
    <ThemeProvider>
      <ReaderNav onClose={onClose} />
    </ThemeProvider>,
  );
}

describe("ReaderNav", () => {
  it("closes on a primary click on Work and prevents the default", () => {
    const onClose = vi.fn();
    renderNav(onClose);

    const link = screen.getByRole("link", { name: "Work" });
    const click = createEvent.click(link);
    fireEvent(link, click);

    expect(click.defaultPrevented).toBe(true);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes on a primary click on the logo", () => {
    const onClose = vi.fn();
    renderNav(onClose);

    const link = screen.getByRole("link", { name: "Home" });
    const click = createEvent.click(link);
    fireEvent(link, click);

    expect(click.defaultPrevented).toBe(true);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("leaves a modified click to the browser", () => {
    const onClose = vi.fn();
    renderNav(onClose);

    const link = screen.getByRole("link", { name: "Work" });
    const click = createEvent.click(link, { metaKey: true });
    fireEvent(link, click);

    expect(click.defaultPrevented).toBe(false);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("closes before the link's own navigation handler runs", () => {
    const onClose = vi.fn();
    renderNav(onClose);

    const link = screen.getByRole("link", { name: "Work" });
    const navigate = vi.fn();
    link.addEventListener("click", navigate);

    fireEvent.click(link);

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(navigate).not.toHaveBeenCalled();
  });

  it("closes on Escape", () => {
    const onClose = vi.fn();
    renderNav(onClose);

    fireEvent.keyDown(window, { key: "Escape" });

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
