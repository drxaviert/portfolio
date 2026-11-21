import { render, screen } from "@testing-library/react";
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
});
