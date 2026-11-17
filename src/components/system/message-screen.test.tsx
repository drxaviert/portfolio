import { render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MessageScreen } from "./message-screen";

const css = readFileSync(
  path.join(process.cwd(), "src/components/system/message-screen.css"),
  "utf8",
);

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

describe("message screen", () => {
  it("fills the viewport without reserving a nav slot", () => {
    render(
      <MessageScreen kicker="404" title="This page doesn't exist.">
        <p>Body</p>
      </MessageScreen>,
    );

    const main = screen.getByRole("main");
    expect(main).toHaveAttribute("data-message-screen");
    expect(main).toHaveClass("min-h-svh");
    expect(main).not.toHaveClass("min-h-screen");
    expect(document.querySelector("[data-nav-slot]")).toBeNull();
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
  });

  it("hides the root layout's dock on these screens", () => {
    expect(css).toMatch(
      /:root:has\(\[data-message-screen\]\) \.wd-nav-dock \{\s*display: none;/,
    );
  });
});
