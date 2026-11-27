import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HomeCarousel } from "./home-carousel";
import type { CarouselItem } from "./home-carousel";

const ITEMS: CarouselItem[] = [
  { kind: "work", slug: "ai-agents-google", title: "Systems" },
  { kind: "work", slug: "klaris", title: "Titles" },
  { kind: "work", slug: "shapes-in-motion", title: "Type" },
  { kind: "placeholder", title: "More work soon" },
];

/** Property-indexed keyframes, or the array form (the title's). */
type Frames = Record<string, unknown[]> & { length?: number };

type Recorded = {
  target: Element;
  keyframes: Frames;
  options: { duration?: number; easing?: string };
};

function hasProp(r: { keyframes: Frames }, key: string): boolean {
  return !Array.isArray(r.keyframes) && key in r.keyframes;
}

let recorded: Recorded[] = [];

// Motion reads the preference once per module load, so this file stubs it
// before the carousel renders and every test in it runs reduced.
beforeEach(() => {
  recorded = [];
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches: query.includes("prefers-reduced-motion"),
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  );
  Element.prototype.animate = function animate(
    this: Element,
    keyframes: Frames,
    options: Recorded["options"],
  ) {
    recorded.push({ target: this, keyframes, options });
    return { cancel: vi.fn() } as unknown as Animation;
  } as unknown as typeof Element.prototype.animate;
});

afterEach(() => {
  vi.unstubAllGlobals();
  // @ts-expect-error jsdom has no animate; remove the stub
  delete Element.prototype.animate;
});

describe("HomeCarousel with reduced motion", () => {
  it("crossfades the row and never tweens a transform", () => {
    const { container } = render(<HomeCarousel items={ITEMS} />);
    const first = container.querySelector("[data-work-card]")!;

    fireEvent.keyDown(first, { key: "ArrowRight" });

    expect(
      screen.getByRole("group", { name: "1 of 4: Titles" }),
    ).toBeInTheDocument();
    expect(recorded.some((r) => hasProp(r, "--car-x"))).toBe(false);
    expect(recorded.some((r) => hasProp(r, "--car-r"))).toBe(false);

    // Only the slots whose item changed fade, from 0.6, in 120ms; the row as a
    // whole does not.
    const fades = recorded.filter((r) => hasProp(r, "opacity"));
    expect(fades).toHaveLength(4);
    for (const fade of fades) {
      expect(fade.target).toHaveClass("car-slide");
      expect(fade.keyframes.opacity).toEqual([0.6, 1]);
      expect(fade.options.duration).toBe(120);
      expect(fade.options.easing).toBe("ease-out");
    }
    expect(
      recorded.some((r) => r.target === container.querySelector(".car-row")),
    ).toBe(false);
    expect(container.querySelector("[data-ghost]")).toBeNull();
  });
});
