import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HomeCarousel } from "./home-carousel";
import type { CarouselItem } from "./home-carousel";

const ITEMS: CarouselItem[] = [
  { kind: "work", slug: "systems-in-motion", title: "Systems", cover: "tiles" },
  { kind: "work", slug: "title-sequence", title: "Titles", cover: "window" },
  { kind: "work", slug: "type-in-motion", title: "Type", cover: "phone" },
  { kind: "placeholder", title: "More work soon" },
];

const SIX: CarouselItem[] = [
  ...ITEMS,
  { kind: "placeholder", title: "Five" },
  { kind: "placeholder", title: "Six" },
];

const ROW = { left: 100, top: 50, width: 1136, height: 416 };
const SLOTS = [
  { x: 0, w: 753 },
  { x: 765, w: 180 },
  { x: 957, w: 83 },
  { x: 1052, w: 84 },
];

type Frames = Record<string, unknown[]> & { length?: number };
type Recorded = {
  target: Element;
  keyframes: Frames;
  options: { duration?: number; easing?: string };
  onfinish: (() => void) | null;
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

function stubMedia(hover: boolean, reduce: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches: query.includes("hover: hover")
        ? hover
        : reduce && query.includes("prefers-reduced-motion"),
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  );
}

beforeEach(() => {
  vi.useFakeTimers();
  window.history.pushState({}, "", "/");
  recorded = [];
  stubMedia(true, false);
  Element.prototype.getBoundingClientRect = function () {
    if (this.classList.contains("car-row"))
      return rect(ROW.left, ROW.top, ROW.width, ROW.height);

    const parent = this.parentElement;
    if (parent?.classList.contains("car-guide")) {
      const slot = SLOTS[Array.from(parent.children).indexOf(this)];
      return rect(ROW.left + slot.x, ROW.top, slot.w, ROW.height);
    }
    return rect(0, 0, 0, 0);
  };
  Element.prototype.animate = function (
    this: Element,
    keyframes: Frames,
    options: Recorded["options"],
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

function move(x: number, y = 200) {
  act(() => {
    window.dispatchEvent(
      new MouseEvent("pointermove", { clientX: x, clientY: y }),
    );
  });
}

const REST_X = SLOTS.map((slot) => slot.x);
const REST_W = SLOTS.map((slot) => slot.w);
// With the peek open at xl widths (W = 1136, peek 20, gap 12) the extra 32px
// goes to the first card when the fit is featured.
const OPEN_X = [32, 829, 1021, 1116];
const OPEN_W = [785, 180, 83, 84];

const row = (c: HTMLElement) => c.querySelector<HTMLElement>(".car-row")!;
const strip = (c: HTMLElement) =>
  c.querySelector<HTMLElement>('.car-peek-edge[data-side="left"]');
const card = (c: HTMLElement, slot: number) =>
  c.querySelector<HTMLElement>(
    `.car-slide[data-slot="${slot}"]:not([data-ghost])`,
  )!;

/** The animations of `--car-x` on one element, in start order. */
function slides(target: Element) {
  return recorded.filter(
    (r) => r.target === target && "--car-x" in r.keyframes,
  );
}

function frontTitle(): string {
  return (
    screen
      .getAllByRole("group")
      .map((el) => el.getAttribute("aria-label") ?? "")
      .find((l) => l.startsWith("1 of"))
      ?.split(": ")[1] ?? ""
  );
}

function finishStep() {
  const clock = recorded.filter((r) => r.target.classList.contains("car-row"));
  act(() => clock.at(-1)?.onfinish?.());
}

/** jsdom does not run animations: stand in for what the open peek draws. */
function drawPushed(c: HTMLElement) {
  for (let slot = 0; slot < 4; slot++) {
    const el = card(c, slot);
    el.style.setProperty("--car-x", `${OPEN_X[slot]}px`);
    el.style.setProperty(
      "--car-r",
      `${Number.parseFloat(el.style.width) - OPEN_W[slot]}px`,
    );
  }
}

describe("left hover peek", () => {
  it("moves every card to its peek pose together, by position and crop only", () => {
    const { container } = render(<HomeCarousel items={ITEMS} />);
    expect(row(container)).not.toHaveAttribute("data-peeking");

    move(110);

    expect(row(container)).toHaveAttribute("data-peeking");
    for (let slot = 0; slot < 4; slot++) {
      const run = slides(card(container, slot))[0];
      const box = Math.max(OPEN_W[slot], REST_W[slot]);

      expect(run.keyframes["--car-x"]).toEqual([
        `${REST_X[slot]}px`,
        `${OPEN_X[slot]}px`,
      ]);
      // The crop starts where the card looks like rest and ends at the peek
      // width; the box is set once, never animated.
      expect(run.keyframes["--car-r"]).toEqual([
        `${box - REST_W[slot]}px`,
        `${box - OPEN_W[slot]}px`,
      ]);
      expect("width" in run.keyframes).toBe(false);
      expect(card(container, slot).style.width).toBe(`${box}px`);
      expect(run.options.duration).toBe(250);
      expect(run.options.easing).toBe("cubic-bezier(0.23, 1, 0.32, 1)");
    }
  });

  it("slides the strip in from the column edge", () => {
    const { container } = render(<HomeCarousel items={ITEMS} />);

    move(110);

    const slide = slides(strip(container)!)[0];
    expect(slide.keyframes["--car-x"]).toEqual(["-20px", "0px"]);
    expect(slide.options.duration).toBe(250);
  });

  it("gives the last card the strip's blur and fade over its 20px shape", () => {
    const { container } = render(<HomeCarousel items={ITEMS} />);

    move(110);

    const last = slides(card(container, 3))[0];
    expect(last.keyframes.filter).toEqual(["none", "blur(4px)"]);
    expect(last.keyframes["--car-pe"]).toEqual([0, 1]);
    expect(card(container, 3)).toHaveAttribute("data-peek-end");
    // No other card blurs, and there is no right-edge copy any more.
    const blurred = recorded.filter((r) => r.keyframes.filter);
    expect(blurred.map((r) => r.target)).toEqual([card(container, 3)]);
    expect(container.querySelectorAll(".car-peek-edge")).toHaveLength(1);
    // The 20px shape: what shows of the card is the column's width minus its x.
    expect(1136 - OPEN_X[3]).toBe(20);
  });

  it("reveals from the gutter, not only from inside the column", () => {
    const { container } = render(<HomeCarousel items={ITEMS} />);

    move(40);

    expect(slides(card(container, 0))).toHaveLength(1);
  });

  it("does nothing for a pointer elsewhere, including the right edge", () => {
    const { container } = render(<HomeCarousel items={ITEMS} />);

    move(600);
    move(1090);

    expect(row(container)).not.toHaveAttribute("data-peeking");
    expect(recorded).toHaveLength(0);
  });

  it("retracts every card after a 120ms leave delay, and not if the pointer returns", () => {
    const { container } = render(<HomeCarousel items={ITEMS} />);
    move(110);
    const after = recorded.length;

    move(600);
    act(() => vi.advanceTimersByTime(100));
    expect(recorded).toHaveLength(after);

    move(110);
    act(() => vi.advanceTimersByTime(200));
    expect(recorded).toHaveLength(after);

    move(600);
    act(() => vi.advanceTimersByTime(121));
    for (let slot = 0; slot < 4; slot++) {
      const back = slides(card(container, slot)).at(-1)!;
      expect(back.keyframes["--car-x"].at(-1)).toBe(`${REST_X[slot]}px`);
      expect(back.options.duration).toBe(200);
      expect(back.options.easing).toBe("ease-out");
    }

    act(() => slides(strip(container)!).at(-1)!.onfinish?.());
    expect(row(container)).not.toHaveAttribute("data-peeking");
    for (let slot = 0; slot < 4; slot++) {
      expect(card(container, slot).style.width).toBe(`${REST_W[slot]}px`);
      expect(card(container, slot)).not.toHaveAttribute("data-clipped");
    }
  });

  it("shows order[(first - 1 + n) % n] as an inert, hidden, unfocusable copy", () => {
    const { container } = render(<HomeCarousel items={ITEMS} />);
    const left = strip(container)!;

    expect(left.textContent).toContain("More work soon");
    expect(left).toHaveAttribute("aria-hidden", "true");
    expect(left).toHaveAttribute("inert");
    expect(
      left.querySelector("a, button, [tabindex], [data-work-card]"),
    ).toBeNull();
    expect(container.querySelectorAll("[data-work-card]")).toHaveLength(1);
    expect(container.querySelectorAll(".car-peek-edge")).toHaveLength(1);
  });

  it("shows the item before the first for six items", () => {
    const { container } = render(<HomeCarousel items={SIX} />);

    expect(strip(container)!.textContent).toContain("Six");
  });

  it("steps back one from the pushed pose, with no snap, then reappears if the pointer stays", () => {
    const { container } = render(<HomeCarousel items={ITEMS} />);
    move(110);
    drawPushed(container);
    const cards = [0, 1, 2, 3].map((slot) => card(container, slot));
    const before = recorded.length;

    fireEvent.click(row(container), { clientX: 110, clientY: 200 });

    expect(frontTitle()).toBe("More work soon");
    expect(strip(container)!.style.visibility).toBe("hidden");
    expect(row(container)).not.toHaveAttribute("data-peeking");

    const steps = recorded.slice(before);
    for (let slot = 0; slot < 4; slot++) {
      const run = steps.find(
        (r) => r.target === cards[slot] && "--car-x" in r.keyframes,
      );
      // Each card starts where the peek left it, not at its rest slot.
      expect(run?.keyframes["--car-x"][0]).toBe(`${OPEN_X[slot]}px`);
    }
    // The item stepping in grows out of the strip, still blurred.
    const entering = steps.find(
      (r) => r.keyframes.filter?.[0] === "blur(4.00px)",
    );
    expect(entering!.keyframes["--car-x"][0]).toBe("0px");
    expect(entering!.keyframes["--car-r"][0]).toBe(`${753 - 20}px`);

    const afterStep = recorded.length;
    finishStep();

    expect(recorded.length).toBeGreaterThan(afterStep);
    expect(row(container)).toHaveAttribute("data-peeking");
    expect(strip(container)!.textContent).toContain("Type");
  });

  it("does not step when the click lands off the strip", () => {
    const { container } = render(<HomeCarousel items={ITEMS} />);
    move(110);

    fireEvent.click(row(container), { clientX: 130, clientY: 200 });

    expect(frontTitle()).toBe("Systems");
  });

  it("puts the row back before the first card opens", () => {
    const { container } = render(<HomeCarousel items={ITEMS} />);
    move(110);
    drawPushed(container);

    const host = card(container, 0).querySelector<HTMLElement>(".car-host")!;
    host.addEventListener("click", (event) => event.preventDefault());
    fireEvent.click(host);

    for (let slot = 0; slot < 4; slot++) {
      const el = card(container, slot);
      expect(el.style.getPropertyValue("--car-x")).toBe(`${REST_X[slot]}px`);
      expect(el.style.getPropertyValue("--car-r")).toBe("0px");
      expect(el.style.width).toBe(`${REST_W[slot]}px`);
    }
    expect(row(container)).not.toHaveAttribute("data-peeking");
  });

  it("treats both ends the same whatever ?blur= is, and ?peekRight= is gone", () => {
    for (const blur of ["edge", "motion", "none"]) {
      window.history.pushState({}, "", `/?blur=${blur}&peekRight=hover`);
      const { container, unmount } = render(<HomeCarousel items={ITEMS} />);
      move(110);

      expect(row(container)).toHaveAttribute("data-peeking");
      expect(slides(strip(container)!)).toHaveLength(1);
      expect(card(container, 3)).toHaveAttribute("data-peek-end");
      expect(container.querySelectorAll(".car-peek-edge")).toHaveLength(1);
      move(1090);
      unmount();
    }
  });
});

describe("?peekFit=", () => {
  it("featured is the default: the first card takes the 32px, the others keep their widths", () => {
    const { container } = render(<HomeCarousel items={ITEMS} />);

    move(110);

    expect(card(container, 0).style.width).toBe("785px");
    expect(card(container, 1).style.width).toBe("180px");
    expect(card(container, 2).style.width).toBe("83px");
  });

  it("proportional shares the extra by rest width, and the pieces still add up", () => {
    window.history.pushState({}, "", "/?peekFit=proportional");
    const { container } = render(<HomeCarousel items={ITEMS} />);

    move(110);

    const widths = [0, 1, 2].map((slot) => {
      const run = slides(card(container, slot))[0];
      const box = Number.parseFloat(card(container, slot).style.width);
      return box - Number.parseFloat(String(run.keyframes["--car-r"][1]));
    });
    expect(widths[0] + widths[1] + widths[2]).toBeCloseTo(1048, 1);
    expect(widths[0]).toBeCloseTo(753 + (32 * 753) / 1016, 1);
    expect(widths[1]).toBeCloseTo(180 + (32 * 180) / 1016, 1);
    expect(widths[2]).toBeCloseTo(83 + (32 * 83) / 1016, 1);
  });
});

describe("edge treatment css", () => {
  const css = readFileSync(
    resolve(process.cwd(), "src/components/home/carousel/home-carousel.css"),
    "utf8",
  );

  it("masks both end shapes over the same width with the same fade, painting no colour", () => {
    const left = css.match(
      /\.car-peek-edge\[data-side="left"\]\s*\{([^}]*)\}/,
    )![1];
    const end = css.match(/\.car-slide\[data-peek-end\]\s*\{([^}]*)\}/)![1];

    expect(left).toContain("var(--car-hp-edge)");
    expect(left).toContain("var(--car-hp, 20px)");
    expect(end).toContain("var(--car-hp-edge-r)");
    expect(end).toContain("var(--car-hp, 20px)");
    // Both fade by the same tunable (--car-hf); the right one is scaled by
    // --car-pe, which is 1 when the peek is open.
    expect(css).toMatch(/--car-hp-edge:[^;]*var\(--car-hf, 0\.45\)/);
    expect(css).toMatch(/--car-hp-edge-r:[^;]*var\(--car-hf, 0\.45\)/);
    expect(css).not.toMatch(/color-mix|backdrop-filter/);
  });

  it("keeps the step mask on the row and the column clip while peeking", () => {
    expect(css).toMatch(
      /\.car-row\[data-stepping\]\[data-blur="edge"\]\s*\{\s*--car-mask/,
    );
    expect(css).toMatch(
      /\.car-row\[data-stepping\],\s*\.car-row\[data-peeking\]\s*\{\s*clip-path:\s*inset\(-12px 0\)/,
    );
  });
});

describe("without a hovering pointer", () => {
  it("renders no strip and ignores the pointer", () => {
    stubMedia(false, false);
    const { container } = render(<HomeCarousel items={ITEMS} />);

    move(110);

    expect(container.querySelector(".car-peek-edge")).toBeNull();
    expect(recorded).toHaveLength(0);
  });
});
