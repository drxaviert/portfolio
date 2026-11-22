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

describe("work index back link", () => {
  it("renders the shared Home control at the top of the list", () => {
    renderIndex();

    const back = screen.getByRole("link", {
      name: "Close work, back to home",
    });

    expect(back).toHaveClass("wd-back-link");
    expect(back).toHaveTextContent("Home");
    expect(back).toHaveAttribute("href", "/");
    expect(back.closest(".wd-work-column")).not.toBeNull();
    expect(back.closest(".wd-work-list")).toBeNull();

    // Above the rows, so it is the list's first entrance beat and its first
    // focusable.
    const rows = document.querySelector(".wd-work-list");
    expect(
      back.compareDocumentPosition(rows!) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("closes through the drawer's exit, not by routing", async () => {
    const user = userEvent.setup();
    const { exit, close } = renderIndex();
    const back = screen.getByRole("link", {
      name: "Close work, back to home",
    });

    await user.click(back);

    // `exit` is Esc's gesture: the same lifecycle and burst guards. A plain
    // click must not also follow the fallback href.
    expect(exit).toHaveBeenCalledTimes(1);
    expect(close).not.toHaveBeenCalled();
  });

  it("leaves a modified click to the browser", () => {
    const { exit } = renderIndex();
    const back = screen.getByRole("link", {
      name: "Close work, back to home",
    });
    const modified = createEvent.click(back, { metaKey: true });
    fireEvent(back, modified);

    expect(modified.defaultPrevented).toBe(false);
    expect(exit).not.toHaveBeenCalled();
  });

  it("is the panel's first Tab stop and opens with Enter", async () => {
    const user = userEvent.setup();
    const { exit } = renderIndex();
    const back = screen.getByRole("link", {
      name: "Close work, back to home",
    });

    // The trap restarts a stranded heading's sequential navigation at the
    // panel's first stop; the back link precedes the rows, so it is that stop.
    await user.tab();
    expect(back).toHaveFocus();

    await user.keyboard("{Enter}");
    expect(exit).toHaveBeenCalledTimes(1);
  });

  it("keeps the shared geometry, type, hover fill and entrance", () => {
    const shared = readFileSync(
      join(process.cwd(), "src", "components", "work", "back-link.css"),
      "utf8",
    );
    const list = readFileSync(
      join(process.cwd(), "src", "components", "work", "work-list.css"),
      "utf8",
    );

    expect(shared).toMatch(
      /\.wd-back-link \{[^}]*height: 32px;[^}]*font-size: var\(--text-sm\);[^}]*font-weight: 500;/,
    );
    expect(shared).toMatch(/\.wd-back-label \{\s*min-inline-size: 40px;/);
    expect(shared).toMatch(
      /\.wd-back-link:hover \{[^}]*var\(--nav-hover-fill\) 55%/,
    );
    expect(shared).toMatch(
      /\.wd-back-link:focus-visible \{[^}]*outline: 2px solid var\(--primary\);/,
    );
    expect(list).toMatch(
      /\.wd-work-column\[data-work-anim="on"\] \.wd-back \{\s*animation: wd-work-soft 700ms/,
    );
  });
});
