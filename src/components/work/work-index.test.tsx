import { render, screen } from "@testing-library/react";
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

describe("work index close", () => {
  it("renders one labelled close control on the index", () => {
    renderIndex();

    const close = screen.getByRole("button", {
      name: "Close work, back to home",
    });

    expect(close).toHaveAttribute("type", "button");
    expect(close).toHaveClass("wd-index-close");
  });

  it("closes through the drawer's exit, not by routing", async () => {
    const user = userEvent.setup();
    const { exit, close } = renderIndex();

    await user.click(
      screen.getByRole("button", { name: "Close work, back to home" }),
    );

    // `exit` is Esc's gesture: step back or close, through the lifecycle and
    // its guards. A raw `close` or a router push would skip both.
    expect(exit).toHaveBeenCalledTimes(1);
    expect(close).not.toHaveBeenCalled();
  });

  it("shows Close and the Esc hint in a tooltip hidden from the name", () => {
    renderIndex();

    const button = screen.getByRole("button", {
      name: "Close work, back to home",
    });
    const tooltip = button.querySelector(".wd-index-close-tooltip");

    expect(tooltip).toHaveTextContent("Close");
    expect(tooltip?.querySelector("kbd")).toHaveTextContent("Esc");
    expect(tooltip).toHaveAttribute("aria-hidden", "true");
    // The visible hint never joins the accessible name.
    expect(button).toHaveAccessibleName("Close work, back to home");
  });

  it("is the panel's first Tab stop and opens with Enter or Space", async () => {
    const user = userEvent.setup();
    const { exit } = renderIndex();
    const button = screen.getByRole("button", {
      name: "Close work, back to home",
    });

    // The drawer's trap restarts a stranded heading's sequential navigation at
    // the panel's first stop; this button precedes the list, so it is that
    // stop.
    await user.tab();
    expect(button).toHaveFocus();

    await user.keyboard("{Enter}");
    expect(exit).toHaveBeenCalledTimes(1);

    await user.keyboard(" ");
    expect(exit).toHaveBeenCalledTimes(2);
  });

  it("keeps the 32px visual, the 40px hit area and the nav's own fill", () => {
    const css = readFileSync(
      join(process.cwd(), "src", "components", "work", "work-index.css"),
      "utf8",
    );

    expect(css).toMatch(
      /\.wd-index-close \{[^}]*width: 32px;[^}]*height: 32px;/,
    );
    expect(css).toMatch(/\.wd-index-close::after \{[^}]*inset: -4px;/);
    expect(css).toMatch(/border-radius: var\(--radius-md\);/);
    expect(css).toMatch(
      /\.wd-index-close:hover \{[^}]*var\(--nav-hover-fill\) 55%/,
    );
    // The nav's right edge, mirrored on the panel: half the panel minus the
    // 1136px frame's half width.
    expect(css).toMatch(/right: max\(16px, calc\(50% - 568px\)\);/);
    expect(css).toMatch(
      /top: calc\(var\(--wd-nav-inset\) \+ var\(--wd-nav-height\) \+ 4px\);/,
    );
  });
});
