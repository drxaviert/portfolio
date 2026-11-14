import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HomeCarousel } from "./home-carousel";
import type { CarouselItem } from "./home-carousel";

const ITEMS: CarouselItem[] = [
  { kind: "work", slug: "systems-in-motion", title: "Systems", cover: "tiles" },
  { kind: "work", slug: "title-sequence", title: "Titles", cover: "window" },
  { kind: "work", slug: "type-in-motion", title: "Type", cover: "phone" },
  { kind: "placeholder", title: "More work soon" },
];

type Recorded = { target: Element; keyframes: PropertyIndexedKeyframes };

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
    keyframes: PropertyIndexedKeyframes,
  ) {
    recorded.push({ target: this, keyframes });
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
    expect(recorded.some((r) => "transform" in r.keyframes)).toBe(false);
    expect(recorded.some((r) => "clipPath" in r.keyframes)).toBe(false);

    const fade = recorded.find((r) => "opacity" in r.keyframes);
    expect(fade?.target).toBe(container.querySelector(".car-row"));
    expect(container.querySelector("[data-ghost]")).toBeNull();
  });
});
