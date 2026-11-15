import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HomeCarousel } from "./home-carousel";
import type { CarouselItem } from "./home-carousel";

const ITEMS: CarouselItem[] = [
  { kind: "work", slug: "systems-in-motion", title: "Systems", cover: "tiles" },
  { kind: "work", slug: "title-sequence", title: "Titles", cover: "window" },
  { kind: "work", slug: "type-in-motion", title: "Type", cover: "phone" },
  { kind: "placeholder", title: "More work soon" },
];

type Recorded = {
  target: Element;
  keyframes: Record<string, unknown[]>;
  options: { duration?: number };
  onfinish: (() => void) | null;
  cancel: () => void;
};

let recorded: Recorded[] = [];

function rect(left: number, top: number, width: number, height: number) {
  return {
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
    x: left,
    y: top,
    toJSON: () => ({}),
  } as DOMRect;
}

const SLOTS = [
  { x: 0, w: 753 },
  { x: 765, w: 180 },
  { x: 957, w: 83 },
  { x: 1052, w: 84 },
];

// Motion reads the preference once per module load, so this file runs reduced.
beforeEach(() => {
  vi.useFakeTimers();
  window.history.pushState({}, "", "/");
  recorded = [];
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches: true,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  );
  Element.prototype.getBoundingClientRect = function () {
    if (this.classList.contains("car-row")) return rect(100, 50, 1136, 416);
    const parent = this.parentElement;
    if (parent?.classList.contains("car-guide")) {
      const slot = SLOTS[Array.from(parent.children).indexOf(this)];
      return rect(100 + slot.x, 50, slot.w, 416);
    }
    return rect(0, 0, 0, 0);
  };
  Element.prototype.animate = function (
    this: Element,
    keyframes: Record<string, unknown[]>,
    options: { duration?: number },
  ) {
    const record = {
      target: this,
      keyframes,
      options,
      onfinish: null,
      cancel: vi.fn(),
    };
    recorded.push(record);
    return record as unknown as Animation;
  } as unknown as typeof Element.prototype.animate;
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  // @ts-expect-error jsdom has no animate; remove the stub
  delete Element.prototype.animate;
  // @ts-expect-error restore jsdom's own
  delete Element.prototype.getBoundingClientRect;
});

describe("hover peek under reduced motion", () => {
  it("snaps the whole row one column right and crossfades with opacity only", () => {
    const { container } = render(<HomeCarousel items={ITEMS} />);

    act(() => {
      window.dispatchEvent(
        new MouseEvent("pointermove", { clientX: 110, clientY: 200 }),
      );
    });

    [96, 861, 1053, 1148].forEach((x, slot) => {
      const el = container.querySelector<HTMLElement>(
        `.car-slide[data-slot="${slot}"]:not([data-ghost])`,
      )!;
      expect(el.style.getPropertyValue("--car-x")).toBe(`${x}px`);
    });
    const prev = container.querySelector<HTMLElement>(".car-peek-edge")!;
    expect(prev.style.getPropertyValue("--car-x")).toBe("0px");
    expect(prev.style.opacity).toBe("1");

    // The edge blur appears with the copy, without a fade of its own.
    const layers = [
      ...container.querySelectorAll<HTMLElement>("[data-peek-blur]"),
    ];
    expect(layers.map((layer) => layer.dataset.edge)).toEqual([
      "right",
      "left",
    ]);
    for (const layer of layers) expect(layer.style.opacity).toBe("1");
    expect(
      recorded.some((r) => layers.includes(r.target as HTMLElement)),
    ).toBe(false);

    expect(recorded.length).toBeGreaterThan(0);
    for (const r of recorded) {
      expect(Object.keys(r.keyframes)).toEqual(["opacity"]);
      expect(r.options.duration).toBe(120);
    }
  });
});
