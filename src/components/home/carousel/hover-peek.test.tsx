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
// With the peek open at xl widths the row shifts by 84 + 12 = 96.
const OPEN_X = REST_X.map((x) => x + 96);

const row = (c: HTMLElement) => c.querySelector<HTMLElement>(".car-row")!;
const prevCard = (c: HTMLElement) =>
  c.querySelector<HTMLElement>(".car-peek-edge");
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
  const clock = recorded.filter(
    (r) =>
      r.target.classList.contains("car-row") && !Array.isArray(r.keyframes),
  );
  act(() => clock.at(-1)?.onfinish?.());
}

/** jsdom does not run animations: stand in for what the open peek draws. */
function drawShifted(c: HTMLElement) {
  for (let slot = 0; slot < 4; slot++)
    card(c, slot).style.setProperty("--car-x", `${OPEN_X[slot]}px`);
}

describe("left hover peek", () => {
  it("shifts the whole row one column right, widths untouched, last card off the column", () => {
    const { container } = render(<HomeCarousel items={ITEMS} />);
    expect(row(container)).not.toHaveAttribute("data-peeking");

    move(110);

    expect(row(container)).toHaveAttribute("data-peeking");
    for (let slot = 0; slot < 4; slot++) {
      const run = slides(card(container, slot))[0];

      expect(run.keyframes["--car-x"]).toEqual([
        `${REST_X[slot]}px`,
        `${OPEN_X[slot]}px`,
      ]);
      // Position only: no crop, no width.
      expect("--car-r" in run.keyframes).toBe(false);
      expect("width" in run.keyframes).toBe(false);
      expect(card(container, slot).style.width).toBe(`${REST_W[slot]}px`);
      expect(run.options.duration).toBe(250);
      expect(run.options.easing).toBe("cubic-bezier(0.23, 1, 0.32, 1)");
    }
    // [prev 84][12][featured 753][12][180][12][83] fills the column exactly,
    // and the last card is out past its right edge.
    const prev = 0;
    expect(prev + 84 + 12).toBe(OPEN_X[0]);
    expect(OPEN_X[0] + 753 + 12).toBe(OPEN_X[1]);
    expect(OPEN_X[1] + 180 + 12).toBe(OPEN_X[2]);
    expect(OPEN_X[2] + 83).toBe(1136);
    expect(OPEN_X[3]).toBeGreaterThanOrEqual(1136);
  });

  it("brings the previous item in from beyond the left edge into a 84px first slot, unblurred", () => {
    const { container } = render(<HomeCarousel items={ITEMS} />);

    move(110);

    const copy = prevCard(container)!;
    const slide = slides(copy)[0];
    expect(slide.keyframes["--car-x"]).toEqual(["-96px", "0px"]);
    expect(slide.options.duration).toBe(250);
    expect(copy.style.width).toBe("84px");
    expect(copy.style.visibility).toBe("visible");
    expect(
      recorded.some(
        (r) => !Array.isArray(r.keyframes) && "filter" in r.keyframes,
      ),
    ).toBe(false);
  });

  it("is a plain copy: aria-hidden, nothing focusable, no second data-work-card", () => {
    const { container } = render(<HomeCarousel items={ITEMS} />);
    const copy = prevCard(container)!;

    expect(copy).toHaveAttribute("aria-hidden", "true");
    expect(
      copy.querySelector("a, button, [tabindex], [data-work-card]"),
    ).toBeNull();
    expect(container.querySelectorAll("[data-work-card]")).toHaveLength(1);
    expect(container.querySelectorAll(".car-peek-edge")).toHaveLength(1);
  });

  it("masks the edges only while the row moves, not at the open rest state", () => {
    const { container } = render(<HomeCarousel items={ITEMS} />);

    move(110);

    expect(row(container)).toHaveAttribute("data-peek-moving");
    const mask = recorded.find(
      (r) => r.target === row(container) && Array.isArray(r.keyframes),
    )!;
    const frames = mask.keyframes as unknown as { "--car-fade": number }[];
    expect(frames[0]["--car-fade"]).toBe(0);
    expect(frames.at(-1)!["--car-fade"]).toBe(0);
    expect(Math.max(...frames.map((f) => f["--car-fade"]))).toBe(1);
    expect(mask.options.duration).toBe(250);

    act(() => mask.onfinish?.());
    expect(row(container)).not.toHaveAttribute("data-peek-moving");
    expect(row(container)).toHaveAttribute("data-peeking");
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

  it("keeps the zone open over the previous card so the pointer can reach it", () => {
    const { container } = render(<HomeCarousel items={ITEMS} />);
    move(110);
    const after = recorded.length;

    // The previous card is the first 84px; the open zone reaches the featured card.
    move(100 + 80);
    act(() => vi.advanceTimersByTime(300));
    expect(recorded).toHaveLength(after);
    expect(row(container)).toHaveAttribute("data-peeking");

    // Over the featured card the zone ends and the peek retracts.
    move(100 + 300);
    act(() => vi.advanceTimersByTime(121));
    expect(recorded.length).toBeGreaterThan(after);
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
    const copy = slides(prevCard(container)!).at(-1)!;
    expect(copy.keyframes["--car-x"].at(-1)).toBe("-96px");

    act(() => copy.onfinish?.());
    expect(row(container)).not.toHaveAttribute("data-peeking");
    expect(prevCard(container)!.style.visibility).toBe("hidden");
  });

  it("shows order[(first - 1 + n) % n]: the last item for four, the one before for six", () => {
    const four = render(<HomeCarousel items={ITEMS} />);
    expect(prevCard(four.container)!.textContent).toContain("More work soon");
    four.unmount();

    const six = render(<HomeCarousel items={SIX} />);
    expect(prevCard(six.container)!.textContent).toContain("Six");
  });

  it("steps back one from the shifted pose when the previous card is clicked, no snap", () => {
    const { container } = render(<HomeCarousel items={ITEMS} />);
    move(110);
    drawShifted(container);
    const cards = [0, 1, 2, 3].map((slot) => card(container, slot));
    const before = recorded.length;

    fireEvent.click(prevCard(container)!);

    expect(frontTitle()).toBe("More work soon");
    expect(prevCard(container)!.style.visibility).toBe("hidden");
    expect(row(container)).not.toHaveAttribute("data-peeking");

    const steps = recorded.slice(before);
    for (let slot = 0; slot < 4; slot++) {
      const run = steps.find(
        (r) => r.target === cards[slot] && "--car-x" in r.keyframes,
      );
      // Each card starts where the shift left it, not at its rest slot.
      expect(run?.keyframes["--car-x"][0]).toBe(`${OPEN_X[slot]}px`);
    }
    // The previous item grows out of its 84px first slot into the wide one.
    const entering = steps.find(
      (r) =>
        r.target instanceof HTMLElement &&
        r.target.hasAttribute("data-ghost") &&
        "--car-x" in r.keyframes,
    )!;
    expect(entering.keyframes["--car-x"][0]).toBe("0px");
    expect(entering.keyframes["--car-r"][0]).toBe(`${753 - 84}px`);

    const afterStep = recorded.length;
    finishStep();

    expect(recorded.length).toBeGreaterThan(afterStep);
    expect(row(container)).toHaveAttribute("data-peeking");
    expect(prevCard(container)!.textContent).toContain("Type");
  });

  it("does not step when the click is not on the previous card", () => {
    const { container } = render(<HomeCarousel items={ITEMS} />);
    move(110);

    fireEvent.click(row(container));

    expect(frontTitle()).toBe("Systems");
  });

  it("puts the row back before the featured card opens its drawer", () => {
    const { container } = render(<HomeCarousel items={ITEMS} />);
    move(110);
    drawShifted(container);

    const host = card(container, 0).querySelector<HTMLElement>(".car-host")!;
    host.addEventListener("click", (event) => event.preventDefault());
    fireEvent.click(host);

    for (let slot = 0; slot < 4; slot++)
      expect(card(container, slot).style.getPropertyValue("--car-x")).toBe(
        `${REST_X[slot]}px`,
      );
    expect(row(container)).not.toHaveAttribute("data-peeking");
    expect(prevCard(container)!.style.visibility).toBe("hidden");
  });

  it("works whatever ?blur= is, and ?peekRight= and ?peekFit= are gone", () => {
    for (const blur of ["edge", "motion", "none"]) {
      window.history.pushState(
        {},
        "",
        `/?blur=${blur}&peekRight=hover&peekFit=proportional`,
      );
      const { container, unmount } = render(<HomeCarousel items={ITEMS} />);
      move(110);

      expect(row(container)).toHaveAttribute("data-peeking");
      expect(slides(prevCard(container)!)).toHaveLength(1);
      expect(container.querySelectorAll(".car-peek-edge")).toHaveLength(1);
      expect(card(container, 0).style.width).toBe("753px");
      move(1090);
      unmount();
    }
  });
});

describe("peek css", () => {
  const css = readFileSync(
    resolve(process.cwd(), "src/components/home/carousel/home-carousel.css"),
    "utf8",
  );

  it("masks only while moving, with no painted colour, and clips to the column", () => {
    expect(css).toMatch(
      /\.car-row\[data-stepping\]\[data-blur="edge"\],\s*\.car-row\[data-peek-moving\]\s*\{\s*--car-mask/,
    );
    expect(css).toMatch(
      /\.car-row\[data-stepping\],\s*\.car-row\[data-peeking\]\s*\{\s*clip-path:\s*inset\(-12px 0\)/,
    );
    expect(css).not.toMatch(/color-mix|backdrop-filter/);
  });

  it("lets the previous card take the pointer for its ring and cursor", () => {
    expect(css).toMatch(
      /\.car-slide\.car-peek-edge\s*\{\s*pointer-events:\s*auto/,
    );
    expect(css).toMatch(/\.car-peek-edge\s*\{[^}]*cursor:\s*pointer/);
  });
});

describe("without a hovering pointer", () => {
  it("renders no copy and ignores the pointer", () => {
    stubMedia(false, false);
    const { container } = render(<HomeCarousel items={ITEMS} />);

    move(110);

    expect(container.querySelector(".car-peek-edge")).toBeNull();
    expect(recorded).toHaveLength(0);
  });
});
