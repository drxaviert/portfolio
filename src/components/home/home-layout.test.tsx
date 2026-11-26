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

  it("scales the xl frame with --fit and the 768 frame with --home-fit", () => {
    const { container } = render(<HomeLayout items={[]} />);
    const frame = container.querySelector<HTMLElement>("[data-home-frame]");
    const vertical = container.querySelector<HTMLElement>(
      '[data-frame-line="v"]',
    );
    const horizontals = container.querySelectorAll<HTMLElement>(
      '[data-frame-line="h"]',
    );

    expect(frame).not.toBeNull();
    // The verticals keep main's full-viewport length; only their x position
    // follows the composition. The horizontals sit on the box's top and last
    // pixel, so the verticals cross them at the frame corners.
    expect(vertical?.style.getPropertyValue("top")).toBe(
      "var(--frame-line-v-top)",
    );
    expect(vertical?.style.getPropertyValue("height")).toBe(
      "var(--frame-line-v-height)",
    );
    expect(horizontals[0]?.style.getPropertyValue("top")).toBe(
      "var(--frame-line-top)",
    );
    expect(horizontals[0]?.style.getPropertyValue("left")).toBe(
      "var(--frame-line-h-left)",
    );
    expect(horizontals[0]?.style.getPropertyValue("width")).toBe(
      "var(--frame-line-h-width)",
    );
    expect(horizontals[1]?.style.getPropertyValue("top")).toBe(
      "calc(var(--frame-line-top) + var(--frame-line-height) - 1px)",
    );

    const globals = readFileSync(
      join(process.cwd(), "src", "app", "globals.css"),
      "utf8",
    );
    const desktop = globals.slice(globals.indexOf("@media (min-width: 768px)"));

    expect(globals).toMatch(/--fit:\s*1;/);
    expect(globals).toMatch(/--home-fit:\s*1;/);
    expect(globals).toMatch(/tan\(atan2\(100vw,\s*1440px\)\)/);
    // 910 includes the 1px top line plus the centring slack that keeps it at
    // y=0; 908 left the line 1px above the viewport at fit < 1.
    expect(globals).toMatch(/tan\(atan2\(100dvh,\s*910px\)\)/);
    // The 768 frame is 768x964; its fit is capped at 1 so it never grows.
    expect(globals).toMatch(/tan\(atan2\(100vw,\s*768px\)\)/);
    expect(globals).toMatch(/tan\(atan2\(100dvh,\s*964px\)\)/);
    expect(globals).toMatch(/--frame-line-height:\s*909px/);
    expect(globals).toMatch(/--frame-line-height:\s*964px/);
    expect(globals).toMatch(
      /--frame-line-v-height:\s*calc\(100dvh \/ var\(--home-fit\)\)/,
    );
    expect(globals).toMatch(/--frame-line-v-top:\s*calc\(\(100% - 100dvh \/ var\(--home-fit\)\) \/ 2\)/);
    expect(globals).toMatch(
      /--frame-line-h-width:\s*calc\(100vw \/ var\(--home-fit\)\)/,
    );
    expect(desktop).toMatch(
      /\[data-home-frame\]\s*\{[^}]*zoom:\s*var\(--home-fit\);/,
    );
  });

  it("renders a supplied Play card slot instead of the empty shell", () => {
    render(
      <HomeLayout
        items={[]}
        playCard={<div data-testid="play-card-slot">Daily painting</div>}
      />,
    );

    expect(screen.getByTestId("play-card-slot")).toBeInTheDocument();
  });
});
