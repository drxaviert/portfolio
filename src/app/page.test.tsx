import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ThemeProvider } from "@/components/theme/theme-provider";
import Page from "@/app/page";

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

describe("home page", () => {
  it("renders the promoted prototype layout", () => {
    render(
      <ThemeProvider>
        <Page />
      </ThemeProvider>,
    );

    // Below md the stacked card and from md the carousel card both render
    // (CSS picks one), so the featured study appears twice in the markup.
    const cards = screen.getAllByRole("link", { name: "Systems in motion" });
    expect(cards.length).toBeGreaterThan(0);
    for (const link of cards) {
      expect(link).toHaveAttribute("href", "/work/systems-in-motion");
    }
    // The nav itself is one element in the root layout; the page reserves its
    // slot and nothing else.
    expect(document.querySelector("[data-nav-slot]")).toBeInTheDocument();
    expect(
      screen.queryByRole("navigation", { name: "Primary" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Play Door to the Cosmos" }),
    ).toBeInTheDocument();
  });

  it("mounts the edge blur bands, which belong to the homepage alone", () => {
    const { container } = render(
      <ThemeProvider>
        <Page />
      </ThemeProvider>,
    );

    // The bands are homepage-scoped by where they mount (app/page.tsx); a
    // study's direct load comes from app/work/layout.tsx and has none.
    expect(container.querySelectorAll(".wd-edge-blur")).toHaveLength(2);
    expect(container.querySelector(".wd-edge-blur--top")).not.toBeNull();
    expect(container.querySelector(".wd-edge-blur--bottom")).not.toBeNull();
  });

  it("leaves the hidden study out and still steps with the arrow keys", () => {
    render(
      <ThemeProvider>
        <Page />
      </ThemeProvider>,
    );

    expect(
      screen.queryByRole("link", { name: "Human Contact" }),
    ).not.toBeInTheDocument();

    const carousel = screen.getByRole("region", { name: "Selected work" });
    const slides = carousel.querySelectorAll(".car-slide:not([data-ghost])");
    const front = () =>
      carousel
        .querySelector('[data-slot="0"] .car-host')
        ?.getAttribute("aria-label");

    // Four visible studies and the placeholder that closes the row.
    expect(slides).toHaveLength(5);
    expect(front()).toBe("Systems in motion");

    fireEvent.keyDown(carousel, { key: "ArrowRight" });
    expect(front()).toBe("The title sequence");

    fireEvent.keyDown(carousel, { key: "ArrowLeft" });
    expect(front()).toBe("Systems in motion");
  });

  it("does not render dev-only tools", () => {
    render(
      <ThemeProvider>
        <Page />
      </ThemeProvider>,
    );

    expect(
      screen.queryByLabelText("Horizon glow tuner"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("radiogroup", { name: "Preview phase" }),
    ).not.toBeInTheDocument();
  });

  it("gives the carousel's four visible cards the entrance as items 3-6", () => {
    render(
      <ThemeProvider>
        <Page />
      </ThemeProvider>,
    );

    const carousel = screen.getByRole("region", { name: "Selected work" });
    const slides = Array.from(
      carousel.querySelectorAll<HTMLElement>(".car-slide:not([data-ghost])"),
    );
    const itemAt = (slot: number) =>
      slides
        .find((slide) => slide.dataset.slot === String(slot))
        ?.querySelector<HTMLElement>("[data-entrance-item]")?.dataset
        .entranceItem;

    expect([0, 1, 2, 3].map(itemAt)).toEqual(["3", "4", "5", "6"]);
    for (const slide of slides.filter((s) => Number(s.dataset.slot) >= 4)) {
      expect(slide.querySelector("[data-entrance-item]")).toBeNull();
    }
    // The row and the slides themselves never animate: only the card inside.
    expect(carousel.querySelector(".car-row")?.closest(".entrance-cell")).toBe(
      null,
    );
    for (const cell of carousel.querySelectorAll(".entrance-cell")) {
      expect(cell.getAttribute("data-entrance-row")).toBe("2");
      expect(cell.parentElement).toHaveClass("car-frame");
    }
  });
});
