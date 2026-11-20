import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { LAYOUT_STORAGE_KEY } from "./layout-preference";
import { WorkIndex } from "./work-index";
import { listWork } from "@/lib/work";

const works = listWork();

function renderIndex() {
  return render(
    <ThemeProvider>
      <WorkIndex works={works} />
    </ThemeProvider>,
  );
}

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
  window.localStorage.clear();
  document.documentElement.removeAttribute("data-work-layout");
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("layout toggle", () => {
  it("defaults to the grid and records it on <html>", () => {
    renderIndex();

    expect(screen.getByRole("radio", { name: "Grid view" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(screen.getByRole("radio", { name: "List view" })).toHaveAttribute(
      "aria-checked",
      "false",
    );
    expect(document.documentElement).toHaveAttribute(
      "data-work-layout",
      "grid",
    );
  });

  it("remembers the visitor's choice across a remount", () => {
    const first = renderIndex();

    fireEvent.click(screen.getByRole("radio", { name: "List view" }));

    expect(screen.getByRole("radio", { name: "List view" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(document.documentElement).toHaveAttribute(
      "data-work-layout",
      "list",
    );
    expect(window.localStorage.getItem(LAYOUT_STORAGE_KEY)).toBe("list");

    first.unmount();
    document.documentElement.removeAttribute("data-work-layout");

    renderIndex();

    expect(screen.getByRole("radio", { name: "List view" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(document.documentElement).toHaveAttribute(
      "data-work-layout",
      "list",
    );
  });

  it("still switches when storage throws", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation((key) => {
      if (key === LAYOUT_STORAGE_KEY) throw new Error("blocked");
      return null;
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation((key) => {
      if (key === LAYOUT_STORAGE_KEY) throw new Error("blocked");
    });

    renderIndex();

    expect(screen.getByRole("radio", { name: "Grid view" })).toHaveAttribute(
      "aria-checked",
      "true",
    );

    fireEvent.click(screen.getByRole("radio", { name: "List view" }));

    expect(screen.getByRole("radio", { name: "List view" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(document.documentElement).toHaveAttribute(
      "data-work-layout",
      "list",
    );
  });

  it("moves the choice with the arrow keys", () => {
    renderIndex();

    const grid = screen.getByRole("radio", { name: "Grid view" });
    const list = screen.getByRole("radio", { name: "List view" });

    grid.focus();
    fireEvent.keyDown(grid, { key: "ArrowRight" });

    expect(list).toHaveAttribute("aria-checked", "true");
    expect(document.activeElement).toBe(list);

    fireEvent.keyDown(list, { key: "ArrowLeft" });

    expect(grid).toHaveAttribute("aria-checked", "true");
    expect(document.activeElement).toBe(grid);

    fireEvent.keyDown(grid, { key: "End" });
    expect(list).toHaveAttribute("aria-checked", "true");

    fireEvent.keyDown(list, { key: "Home" });
    expect(grid).toHaveAttribute("aria-checked", "true");
  });
});
