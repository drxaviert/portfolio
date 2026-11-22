import { createEvent, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { listWork } from "@/lib/work";
import { DrawerActionsProvider } from "./drawer-actions";
import { WorkIndex } from "./work-index";

const works = listWork();

function renderIndex(exit = vi.fn(), close = vi.fn()) {
  render(
    <ThemeProvider>
      <DrawerActionsProvider close={close} stepBack={vi.fn()} exit={exit}>
        <WorkIndex works={works} />
      </DrawerActionsProvider>
    </ThemeProvider>,
  );

  return { exit, close };
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
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("work index breadcrumb", () => {
  it("renders Home / Work at the top of the list", () => {
    renderIndex();

    const nav = screen.getByRole("navigation", { name: "Breadcrumb" });
    const home = screen.getByRole("link", { name: "Home" });
    const work = screen.getByText("Work", {
      selector: ".breadcrumb-item span",
    });

    expect(nav).toBeInTheDocument();
    expect(nav.querySelector("ol")).not.toBeNull();
    expect(home).toHaveAttribute("href", "/");
    expect(home).toHaveClass("nav-item");
    expect(work).toHaveAttribute("aria-current", "page");
    expect(work.closest("a")).toBeNull();
    expect(home.closest(".wd-work-column")).not.toBeNull();
    expect(home.closest(".wd-work-list")).toBeNull();
    expect(document.querySelector(".nav-glide")).not.toBeNull();

    // Above the rows, so it is the list's first entrance beat and its first
    // focusable.
    const rows = document.querySelector(".wd-work-list");
    expect(
      home.compareDocumentPosition(rows!) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("closes through the drawer's exit, not by routing", async () => {
    const user = userEvent.setup();
    const { exit, close } = renderIndex();

    await user.click(screen.getByRole("link", { name: "Home" }));

    // `exit` is Esc's gesture: the same lifecycle and burst guards. A plain
    // click must not also follow the fallback href.
    expect(exit).toHaveBeenCalledTimes(1);
    expect(close).not.toHaveBeenCalled();
  });

  it("leaves a modified click to the browser", () => {
    const { exit } = renderIndex();
    const home = screen.getByRole("link", { name: "Home" });
    const modified = createEvent.click(home, { metaKey: true });
    fireEvent(home, modified);

    expect(modified.defaultPrevented).toBe(false);
    expect(exit).not.toHaveBeenCalled();
  });

  it("is the panel's first Tab stop and opens with Enter", async () => {
    const user = userEvent.setup();
    const { exit } = renderIndex();

    await user.tab();
    expect(screen.getByRole("link", { name: "Home" })).toHaveFocus();

    await user.keyboard("{Enter}");
    expect(exit).toHaveBeenCalledTimes(1);
  });

  it("keeps the nav item spec, the glide layer and the Soft-focus entrance", () => {
    renderIndex();

    const home = screen.getByRole("link", { name: "Home" });
    const list = readFileSync(
      join(process.cwd(), "src", "components", "work", "work-list.css"),
      "utf8",
    );

    // The exact nav item geometry and type; the shared class is the contract.
    for (const token of [
      "nav-item",
      "h-8",
      "px-2",
      "rounded-md",
      "text-base",
      "leading-5",
      "font-medium",
    ]) {
      expect(home).toHaveClass(token);
    }
    expect(home).toHaveClass("focus-visible:outline-primary");
    expect(document.querySelector(".nav-glide")).not.toBeNull();
    expect(list).toMatch(
      /\.wd-work-column\[data-work-anim="on"\] \.wd-breadcrumb \{\s*animation: wd-work-soft 700ms/,
    );
  });
});
