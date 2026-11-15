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

const ROW = { left: 100, top: 50, width: 1000, height: 416 };
const SLOTS = [
  { x: 0, w: 594 },
  { x: 606, w: 170 },
  { x: 788, w: 100 },
  { x: 900, w: 100 },
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

const row = (c: HTMLElement) => c.querySelector<HTMLElement>(".car-row")!;
const strip = (c: HTMLElement) =>
  c.querySelector<HTMLElement>('.car-peek-edge[data-side="left"]');
const copy = (c: HTMLElement) =>
  c.querySelector<HTMLElement>('.car-peek-edge[data-side="right"]');
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

function fades(c: HTMLElement) {
  return recorded.filter(
    (r) => r.target === row(c) && "--car-fade" in r.keyframes,
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
  for (let slot = 0; slot < 4; slot++)
    card(c, slot).style.setProperty("--car-x", `${REST_X[slot] + 32}px`);
}

describe("left hover peek", () => {
  it("moves every card right by peek + gap together, widths untouched", () => {
    const { container } = render(<HomeCarousel items={ITEMS} />);
    expect(row(container)).not.toHaveAttribute("data-peeking");

    move(110);

    expect(row(container)).toHaveAttribute("data-peeking");
    for (let slot = 0; slot < 4; slot++) {
      const run = slides(card(container, slot))[0];
      expect(run.keyframes["--car-x"]).toEqual([
        `${REST_X[slot]}px`,
        `${REST_X[slot] + 32}px`,
      ]);
      expect("--car-r" in run.keyframes).toBe(false);
      expect(run.options.duration).toBe(250);
      expect(run.options.easing).toBe("cubic-bezier(0.23, 1, 0.32, 1)");
      expect(card(container, slot)).not.toHaveAttribute("data-clipped");
    }
  });

  it("slides the strip in from the column edge, with no row-wide mask", () => {
    const { container } = render(<HomeCarousel items={ITEMS} />);

    move(110);

    const slide = slides(strip(container)!)[0];
    expect(slide.keyframes["--car-x"]).toEqual(["-20px", "0px"]);
    expect(slide.options.duration).toBe(250);
    expect(fades(container)).toHaveLength(0);
  });

  it("confines the right-edge blur to a copy: no card is blurred", () => {
    const { container } = render(<HomeCarousel items={ITEMS} />);

    move(110);

    const blurred = recorded.filter((r) => r.keyframes.filter);
    // Only the right copy animates a blur, to the same amount the left strip has
    // from css (--car-hp-blur); no card blurs.
    expect(blurred.map((r) => r.target)).toEqual([copy(container)]);
    expect(blurred[0].keyframes.filter?.at(-1)).toBe(
      `blur(${row(container).style.getPropertyValue("--car-hp-blur")})`,
    );
    // The copy rides the last card exactly; the card is cut where the copy is.
    expect(slides(copy(container)!)[0].keyframes["--car-x"]).toEqual(
      slides(card(container, 3))[0].keyframes["--car-x"],
    );
    expect(card(container, 3)).toHaveAttribute("data-edge-cut");
    expect(card(container, 0)).not.toHaveAttribute("data-edge-cut");
    expect(copy(container)).toHaveAttribute("aria-hidden", "true");
    expect(copy(container)).toHaveAttribute("inert");
  });

  it("derives both treated widths from the one peek width", () => {
    const { container } = render(<HomeCarousel items={ITEMS} />);

    expect(row(container).style.getPropertyValue("--car-hp")).toBe("20px");
    expect(row(container).style.getPropertyValue("--car-hf")).toBe("0.45");
    // The strip is 20px wide on the left and the copy's slice is 20px on the
    // right: the css below reads the same --car-hp for both.
    move(110);
    expect(slides(strip(container)!)[0].keyframes["--car-x"]).toEqual([
      "-20px",
      "0px",
    ]);
    expect(
      (strip(container)!.style.width.replace("px", "") as unknown as number) -
        Number(
          strip(container)!.style.getPropertyValue("--car-r").replace("px", ""),
        ),
    ).toBe(20);
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
    expect(container.querySelectorAll(".car-peek-edge")).toHaveLength(2);
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
      expect(run?.keyframes["--car-x"][0]).toBe(`${REST_X[slot] + 32}px`);
    }
    // The item stepping in grows out of the strip, still blurred.
    const entering = steps.find(
      (r) => r.keyframes.filter?.[0] === "blur(4.00px)",
    );
    expect(entering!.keyframes["--car-x"][0]).toBe("0px");
    expect(entering!.keyframes["--car-r"][0]).toBe("574px");
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

    for (let slot = 0; slot < 4; slot++)
      expect(card(container, slot).style.getPropertyValue("--car-x")).toBe(
        `${REST_X[slot]}px`,
      );
    expect(row(container)).not.toHaveAttribute("data-peeking");
  });

  it("treats both edges whatever ?blur= is, and ?peekRight= is gone", () => {
    for (const blur of ["edge", "motion", "none"]) {
      window.history.pushState({}, "", `/?blur=${blur}&peekRight=hover`);
      const { container, unmount } = render(<HomeCarousel items={ITEMS} />);
      move(110);

      expect(row(container)).toHaveAttribute("data-peeking");
      expect(slides(strip(container)!)).toHaveLength(1);
      expect(slides(copy(container)!)).toHaveLength(1);
      expect(container.querySelectorAll(".car-peek-edge")).toHaveLength(2);
      move(1090);
      unmount();
    }
  });
});

describe("edge treatment css", () => {
  const css = readFileSync(
    resolve(process.cwd(), "src/components/home/carousel/home-carousel.css"),
    "utf8",
  );

  it("masks both slices with the same width, fade and curve, and paints no colour", () => {
    const left = css.match(
      /\.car-peek-edge\[data-side="left"\]\s*\{([^}]*)\}/,
    )![1];
    const right = css.match(
      /\.car-peek-edge\[data-side="right"\]\s*\{([^}]*)\}/,
    )![1];

    // Both are 1 - fade at the outer edge, #000 on the inner, over --car-hp.
    expect(left).toContain("var(--car-hp-edge)");
    expect(right).toContain("var(--car-hp-edge)");
    expect(left).toContain("var(--car-hp, 20px)");
    expect(right).toContain("var(--car-hp, 20px)");
    expect(right).toMatch(/clip-path:\s*inset\(0 0 0 var\(--car-cut\)\)/);
    expect(css).toMatch(
      /\.car-slide\[data-edge-cut\][^}]*var\(--car-hp, 20px\)/,
    );
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
