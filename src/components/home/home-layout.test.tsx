import { render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EMPTY_WORK_LABEL } from "./empty-work";
import { HomeLayout } from "./home-layout";

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

describe("HomeLayout", () => {
  it("renders one empty state and no band when there are no studies", () => {
    const { container } = render(<HomeLayout items={[]} />);

    // One line, in the band's place: no stand-in card and no empty column.
    expect(screen.getAllByText(EMPTY_WORK_LABEL)).toHaveLength(1);
    expect(container.querySelector(".car-row")).toBeNull();
    expect(container.querySelector(".car-title")).toBeNull();
    expect(
      screen.queryByRole("region", { name: "Selected work" }),
    ).not.toBeInTheDocument();
  });

  it("scales the frame with --fit and keeps the gap in frame space", () => {
    const { container } = render(<HomeLayout items={[]} />);
    const frame = container.querySelector<HTMLElement>("[data-home-frame]");

    expect(frame).not.toBeNull();
    // Viewport units inside a zoomed element are not zoomed, so the gap is
    // computed against the viewport divided by the fit.
    expect(frame?.style.getPropertyValue("--frame-gap")).toContain(
      "100dvh / var(--fit)",
    );

    const globals = readFileSync(
      join(process.cwd(), "src", "app", "globals.css"),
      "utf8",
    );
    const desktop = globals.slice(globals.indexOf("@media (min-width: 768px)"));

    expect(globals).toMatch(/--fit:\s*1;/);
    expect(globals).toMatch(/tan\(atan2\(100vw,\s*1280px\)\)/);
    // 910 includes the 1px top line plus the centring slack that keeps it at
    // y=0; 908 left the line 1px above the viewport at fit < 1.
    expect(globals).toMatch(/tan\(atan2\(100dvh,\s*910px\)\)/);
    expect(desktop).toMatch(
      /\[data-home-frame\]\s*\{[^}]*zoom:\s*var\(--fit\);/,
    );
  });
});
