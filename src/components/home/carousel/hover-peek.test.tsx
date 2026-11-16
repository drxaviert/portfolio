import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { findCard } from "@/components/work/use-morph";
import {
  OVERLAY_CLOSING_EVENT,
  OVERLAY_OPENED_EVENT,
} from "@/components/work/overlay-exit";
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

/** Four work cards, so the peek's previous and right-most are both pictures. */
const FOUR_WORKS: CarouselItem[] = [
  { kind: "work", slug: "systems-in-motion", title: "Systems", cover: "tiles" },
  { kind: "work", slug: "title-sequence", title: "Titles", cover: "window" },
  { kind: "work", slug: "type-in-motion", title: "Type", cover: "phone" },
  { kind: "work", slug: "fourth", title: "Fourth", cover: "tiles" },
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
  options: { duration?: number; easing?: string; fill?: string };
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

    if (this.matches("[data-work-card], [data-work-card-title]")) {
      // Where the card is drawn: the row's left plus its --car-x.
      const slide = this.closest<HTMLElement>(".car-slide");
      const x = Number.parseFloat(
        slide?.style.getPropertyValue("--car-x") ?? "0",
      );
      return rect(ROW.left + x, ROW.top, 753, ROW.height);
    }

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

/** Leaves the hover area and runs the peek's retract to its end. */
function leavePeek(c: HTMLElement) {
  move(600);
  act(() => vi.advanceTimersByTime(121));
  act(() => slides(prevCard(c)!).at(-1)!.onfinish?.());
}

/** Clicks the peek's previous card and runs the step to its landing. */
function clickPeek(c: HTMLElement) {
  prevCard(c)!.style.setProperty("--car-x", "0px");
  fireEvent.click(prevCard(c)!);
  finishStep();
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
      expect(run.options.duration).toBe(450);
      expect(run.options.easing).toBe("cubic-bezier(0.22, 1, 0.36, 1)");
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

  it("blurs a placeholder's card edge too, and holds it once revealed", () => {
    const { container } = render(<HomeCarousel items={ITEMS} />);
    const left = container.querySelector<HTMLElement>(
      '[data-peek-blur][data-edge="left"]',
    )!;

    // The previous item is the placeholder: no picture, but still a card face.
    expect(left).toBeTruthy();
    expect(left.querySelector("[data-peek-surface]")).toBeTruthy();
    expect(left.querySelector("a, button")).toBeNull();
    // What the css draws at rest (jsdom has no stylesheet).
    left.style.opacity = "0";

    move(110);

    const run = recorded.find((r) => r.target === left)!;
    expect(run.keyframes.opacity).toEqual([0, 1]);
    expect(run.options.fill).toBe("forwards");

    // When the reveal lands it is pinned at full strength, and a steady
    // pointer leaves it alone: no later animation, no fade back out.
    const prevRun = recorded.find(
      (r) => r.target === prevCard(container) && "--car-x" in r.keyframes,
    )!;
    act(() => prevRun.onfinish?.());
    expect(left.style.opacity).toBe("1");

    const before = recorded.length;
    act(() => vi.advanceTimersByTime(2000));
    move(110);
    expect(recorded).toHaveLength(before);
    expect(left.style.opacity).toBe("1");

    // Leaving fades it out with the retract, and the pin is cleared with it.
    move(100 + 400);
    act(() => vi.advanceTimersByTime(121));
    const fadeOut = recorded
      .filter((r) => r.target === left && !Array.isArray(r.keyframes))
      .at(-1)!;
    expect(fadeOut.keyframes.opacity).toEqual([1, 0]);
    expect(fadeOut.options.duration).toBe(350);
    act(() =>
      recorded
        .filter((r) => r.target === prevCard(container) && "--car-x" in r.keyframes)
        .at(-1)!
        .onfinish?.(),
    );
    expect(left.style.opacity).toBe("0");
  });

  it("puts the edge blur inside the edge cards, so the hold mask fades it too", () => {
    const { container } = render(<HomeCarousel items={FOUR_WORKS} />);
    const rowEl = row(container);
    const layers = [
      ...container.querySelectorAll<HTMLElement>("[data-peek-blur]"),
    ];
    // DOM order is card order: slot 2's right layer, then the peek copy's left.
    expect(layers.map((el) => el.dataset.edge)).toEqual(["right", "left"]);
    for (const layer of layers) {
      // Inside the row (so its mask reaches it) and inside the card.
      expect(rowEl.contains(layer)).toBe(true);
      expect(layer.closest(".car-slide")).toBeTruthy();
      expect(layer.querySelector(".car-peek-blur-copy")).toBeTruthy();
      expect(layer.querySelector(".car-content")).toBeTruthy();
    }
    // The middle cards have no layers of their own.
    expect(card(container, 1).querySelector("[data-peek-blur]")).toBeNull();
    for (const layer of layers) layer.style.opacity = "0";
    expect(recorded.some((r) => layers.includes(r.target as HTMLElement))).toBe(
      false,
    );

    move(110);

    for (const layer of layers) {
      const run = recorded.find((r) => r.target === layer)!;
      // It fades in with the reveal; the card carries it, so no transform.
      expect(run.keyframes.opacity).toEqual([0, 1]);
      expect("transform" in run.keyframes).toBe(false);
      expect(run.options.duration).toBe(450);
    }

    // Leaving fades them out on the retract timing.
    for (const layer of layers) layer.style.opacity = "1";
    move(100 + 400);
    act(() => vi.advanceTimersByTime(121));
    for (const layer of layers) {
      const out = recorded
        .filter((r) => r.target === layer && !Array.isArray(r.keyframes))
        .at(-1)!;
      expect(out.keyframes.opacity).toEqual([1, 0]);
      expect("transform" in out.keyframes).toBe(false);
      expect(out.options.duration).toBe(350);
    }
  });

  it("brings the previous item in from beyond the left edge into a 84px first slot", () => {
    const { container } = render(<HomeCarousel items={ITEMS} />);

    move(110);

    const copy = prevCard(container)!;
    const slide = slides(copy)[0];
    expect(slide.keyframes["--car-x"]).toEqual(["-96px", "0px"]);
    expect(slide.options.duration).toBe(450);
    expect(copy.style.width).toBe("84px");
    expect(copy.style.visibility).toBe("visible");
    // Blur and the left fade are css on the copy (so hover can lessen them),
    // not an animation: it is different from the first frame.
    expect(copy.style.getPropertyValue("--car-lf")).toBe("0.5");
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

  it("holds the edge fade at full strength after the reveal, never toggling it", () => {
    const { container } = render(<HomeCarousel items={ITEMS} />);

    move(110);

    const mask = recorded.find(
      (r) =>
        r.target === row(container) &&
        !Array.isArray(r.keyframes) &&
        "--car-fade" in r.keyframes,
    )!;
    // One smooth ramp in with the reveal, then a held fade: no in-and-out sweep.
    expect(mask.keyframes["--car-fade"]).toEqual([0, 1]);
    expect(mask.options.duration).toBe(450);
    expect(mask.options.fill).toBe("forwards");

    // When the reveal lands it is pinned at one and the mask stays on, so the
    // fade holds for the whole hover.
    expect(row(container)).toHaveAttribute("data-mask");
    act(() => slides(prevCard(container)!)[0].onfinish?.());
    expect(row(container)).toHaveAttribute("data-mask");
    expect(row(container).style.getPropertyValue("--car-fade")).toBe("1");

    // Leaving ramps it back to zero and takes the mask off.
    move(100 + 400);
    act(() => vi.advanceTimersByTime(121));
    const fadeOut = recorded
      .filter(
        (r) =>
          r.target === row(container) &&
          !Array.isArray(r.keyframes) &&
          "--car-fade" in r.keyframes,
      )
      .at(-1)!;
    expect(fadeOut.keyframes["--car-fade"]).toEqual([1, 0]);
    expect(fadeOut.options.duration).toBe(350);
    act(() => slides(prevCard(container)!).at(-1)!.onfinish?.());
    expect(row(container)).not.toHaveAttribute("data-mask");
    expect(row(container).style.getPropertyValue("--car-fade")).toBe("0");
  });

  it("reveals from the band just outside the column, not from far in the gutter", () => {
    const { container } = render(<HomeCarousel items={ITEMS} />);

    // The row starts at x=100; 20px into the gutter is inside the band, and the
    // band does not reach the page edge.
    move(80);
    expect(row(container)).toHaveAttribute("data-peeking");

    move(40);
    act(() => vi.advanceTimersByTime(121));
    act(() => slides(prevCard(container)!).at(-1)!.onfinish?.());
    expect(row(container)).not.toHaveAttribute("data-peeking");
    expect(slides(card(container, 0))).toHaveLength(2);
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
      expect(back.options.duration).toBe(350);
      expect(back.options.easing).toBe("cubic-bezier(0.22, 1, 0.36, 1)");
    }
    const copy = slides(prevCard(container)!).at(-1)!;
    expect(copy.keyframes["--car-x"].at(-1)).toBe("-96px");

    act(() => copy.onfinish?.());
    expect(row(container)).not.toHaveAttribute("data-peeking");
    expect(row(container)).not.toHaveAttribute("data-mask");
    expect(prevCard(container)!.style.visibility).toBe("hidden");
  });

  it("shows order[(first - 1 + n) % n]: the last item for four, the one before for six", () => {
    const four = render(<HomeCarousel items={ITEMS} />);
    expect(prevCard(four.container)!.textContent).toContain("More work soon");
    four.unmount();

    const six = render(<HomeCarousel items={SIX} />);
    expect(prevCard(six.container)!.textContent).toContain("Six");
  });

  it("steps back one from the shifted pose when the previous card is clicked, and lands peeked", () => {
    const { container } = render(<HomeCarousel items={ITEMS} />);
    move(110);
    drawShifted(container);
    // What the css draws on the open copy (jsdom has no stylesheet).
    prevCard(container)!.style.setProperty("--car-x", "0px");
    const cards = [0, 1, 2, 3].map((slot) => card(container, slot));
    const before = recorded.length;

    fireEvent.click(prevCard(container)!);

    expect(frontTitle()).toBe("More work soon");
    // The peek never goes away: it is part of this one run.
    expect(row(container)).toHaveAttribute("data-peeking");
    expect(row(container)).not.toHaveAttribute("data-stepping");
    expect(prevCard(container)!.style.visibility).toBe("visible");

    const steps = recorded.slice(before);
    for (let slot = 0; slot < 3; slot++) {
      const run = steps.find(
        (r) => r.target === cards[slot] && "--car-x" in r.keyframes,
      );
      // Each card starts where the shift left it and ends in the next
      // arrangement's peek slot, 96px further on: one journey, no replay.
      expect(run?.keyframes["--car-x"]).toEqual([
        `${OPEN_X[slot]}px`,
        `${OPEN_X[slot + 1]}px`,
      ]);
    }
    // The previous card takes over the copy's pose in this same frame and grows
    // out of its 84px first slot into the wide one - the card itself, not a
    // seam copy, so it never also leaves through the right-hand slot.
    const entering = steps.find(
      (r) => r.target === cards[3] && "--car-x" in r.keyframes,
    )!;
    expect(entering.keyframes["--car-x"]).toEqual(["0px", `${OPEN_X[0]}px`]);
    expect(entering.keyframes["--car-r"][0]).toBe(`${753 - 84}px`);
    // It leaves the peek with its left end faded, and loses that as it grows
    // into the wide slot: no pop.
    expect("filter" in entering.keyframes).toBe(false);
    expect(entering.keyframes["--car-lf"]).toEqual([0.5, 0]);
    expect(entering.target).toHaveAttribute("data-peek-fade");
    // The next previous card slides in on the step's own run and curve, so the
    // peek arrives as the row moves instead of after it.
    const copyRun = steps.find(
      (r) => r.target === prevCard(container) && "--car-x" in r.keyframes,
    )!;
    expect(copyRun.keyframes["--car-x"]).toEqual(["-96px", "0px"]);
    expect(copyRun.options.duration).toBe(900);
    expect(copyRun.options.easing).toBe("cubic-bezier(0.25, 0.8, 0.25, 1)");
    // The right edge changes hands on that same run: the card that becomes
    // right-most ramps its fade in from nothing (item 1 is the new slot 2), and
    // the card that stops being the right edge keeps the treatment while it
    // leaves, fading it out with the blur copy that stood in for it.
    const arriving = steps.find(
      (r) => r.target === cards[1] && "--car-rf" in r.keyframes,
    )!;
    expect(arriving.keyframes["--car-rf"]).toEqual([0, 1]);
    expect(arriving.options.duration).toBe(900);
    expect(arriving.options.easing).toBe("cubic-bezier(0.25, 0.8, 0.25, 1)");
    expect(cards[2]).toHaveAttribute("data-peek-out");
    const leaving = steps.find(
      (r) => r.target === cards[2] && "--car-rf" in r.keyframes,
    )!;
    expect(leaving.keyframes["--car-rf"]).toEqual([1, 0]);
    const leavingBlur = steps.find(
      (r) =>
        r.target === cards[2].querySelector("[data-peek-blur]") &&
        "opacity" in r.keyframes,
    )!;
    expect(leavingBlur.keyframes.opacity).toEqual([1, 0]);
    expect(leavingBlur.options.duration).toBe(900);
    // No seam copy runs on its own.
    expect(
      steps.some(
        (r) =>
          r.target instanceof HTMLElement &&
          r.target.hasAttribute("data-ghost") &&
          !r.target.classList.contains("car-peek-edge") &&
          "--car-x" in r.keyframes,
      ),
    ).toBe(false);

    const afterStep = recorded.length;
    finishStep();

    // It was already there: nothing started after the glide.
    expect(recorded).toHaveLength(afterStep);
    expect(row(container)).toHaveAttribute("data-peeking");
    expect(prevCard(container)!.textContent).toContain("Type");
    expect(prevCard(container)!.style.getPropertyValue("--car-lf")).toBe("0.5");
    // cards[] are the elements captured before the step: item 0 is slot 1 now.
    const endX = [OPEN_X[1], OPEN_X[2], OPEN_X[3], OPEN_X[0]];
    for (let index = 0; index < 4; index++) {
      expect(cards[index].style.getPropertyValue("--car-x")).toBe(
        `${endX[index]}px`,
      );
      expect(cards[index].style.getPropertyValue("--car-r")).toBe("0px");
    }
  });

  it("retargets to rest when the pointer leaves mid-glide, without a jump", () => {
    const { container } = render(<HomeCarousel items={ITEMS} />);
    move(110);
    drawShifted(container);
    prevCard(container)!.style.setProperty("--car-x", "0px");
    const cards = [0, 1, 2, 3].map((slot) => card(container, slot));

    fireEvent.click(prevCard(container)!);
    expect(row(container)).toHaveAttribute("data-peeking");
    const reveal = slides(prevCard(container)!).at(-1)!;
    expect(reveal.keyframes["--car-x"]).toEqual(["-96px", "0px"]);
    expect(reveal.options.duration).toBe(900);

    // The pointer leaves while the run is still going (jsdom does not run it:
    // stand in for the copy's drawn position).
    prevCard(container)!.style.setProperty("--car-x", "0px");
    const mark = recorded.length;
    move(600);

    expect(row(container)).toHaveAttribute("data-peeking");
    expect(row(container)).not.toHaveAttribute("data-stepping");
    const glide = recorded
      .slice(mark)
      .filter((r) => "--car-x" in r.keyframes && r.target !== prevCard(container));
    // Every card carries on from where it is drawn to its rest slot, on the
    // retarget curve: the run is turned round, not restarted.
    const restFor = [REST_X[1], REST_X[2], REST_X[3], REST_X[0]];
    for (let index = 0; index < 4; index++) {
      const run = glide.find((r) => r.target === cards[index])!;
      expect(run.keyframes["--car-x"][1]).toBe(`${restFor[index]}px`);
      expect(run.options.duration).toBe(350);
      expect(run.options.easing).toBe("cubic-bezier(0.22, 1, 0.36, 1)");
    }
    // The copy goes back out to the gutter on the same glide instead of
    // vanishing where it stood.
    const copyBack = recorded
      .filter(
        (r) =>
          r.target === prevCard(container) &&
          !Array.isArray(r.keyframes) &&
          "--car-x" in r.keyframes,
      )
      .at(-1)!;
    expect(copyBack.keyframes["--car-x"]).toEqual(["0px", "-96px"]);
    expect(copyBack.options.duration).toBe(350);

    finishStep();

    expect(row(container)).not.toHaveAttribute("data-peeking");
    expect(row(container)).not.toHaveAttribute("data-mask");
    expect(prevCard(container)!.style.visibility).toBe("hidden");
    for (let index = 0; index < 4; index++) {
      expect(cards[index].style.getPropertyValue("--car-x")).toBe(
        `${restFor[index]}px`,
      );
    }
  });

  it("retargets to the peek when the pointer enters mid-glide", () => {
    const { container } = render(<HomeCarousel items={ITEMS} />);
    move(600);

    const cards = [0, 1, 2, 3].map((slot) => card(container, slot));
    fireEvent.keyDown(cards[0].querySelector(".car-host")!, {
      key: "ArrowRight",
    });
    expect(row(container)).toHaveAttribute("data-stepping");
    expect(row(container)).not.toHaveAttribute("data-peeking");

    move(110);

    expect(row(container)).toHaveAttribute("data-peeking");
    // The row keeps its own edge mask for this glide and fades it out as the
    // cards' masks take over, so the ends never switch in one frame.
    expect(row(container)).toHaveAttribute("data-stepping");
    const rowRuns = recorded.filter(
      (r) =>
        r.target === row(container) &&
        !Array.isArray(r.keyframes) &&
        "--car-rm" in r.keyframes,
    );
    expect(rowRuns).toHaveLength(1);
    expect(rowRuns[0].keyframes["--car-rm"]).toEqual([0, 0]);
    expect(rowRuns[0].options.duration).toBe(350);
    // The right edge ramps in on the same glide rather than appearing when the
    // step lands (item 3 is the new slot 2 here).
    const rf = recorded.find(
      (r) => r.target === cards[3] && "--car-rf" in r.keyframes,
    )!;
    expect(rf.keyframes["--car-rf"]).toEqual([0, 1]);
    expect(rf.options.duration).toBe(350);
    // The running step's cards turn onto the peek arrangement: the feature that
    // was already leaving keeps going out left, the rest land in the peek slots.
    // The leaving feature keeps its width and slides out past the left edge; the
    // others turn onto the peek arrangement.
    const glideFor = [-765, OPEN_X[0], OPEN_X[1], OPEN_X[2]];
    for (let index = 0; index < 4; index++) {
      const run = slides(cards[index]).at(-1)!;
      expect(run.keyframes["--car-x"][1]).toBe(`${glideFor[index]}px`);
      expect(run.options.duration).toBe(350);
      expect(run.options.easing).toBe("cubic-bezier(0.22, 1, 0.36, 1)");
    }
    // The peek's own arrangement at the end of the run (the leaving card is
    // pushed out of the column, so it is not one of the four).
    const peekFor = [OPEN_X[3], OPEN_X[0], OPEN_X[1], OPEN_X[2]];
    // The copy is the new previous item (item 0, "Systems") and arrives on the
    // same glide.
    const copy = prevCard(container)!;
    expect(copy.textContent).toContain("Systems");
    const copyRun = slides(copy).at(-1)!;
    expect(copyRun.keyframes["--car-x"]).toEqual(["-96px", "0px"]);
    expect(copyRun.options.duration).toBe(350);

    finishStep();

    expect(row(container)).toHaveAttribute("data-peeking");
    // The row's mask is identity by then, so dropping it changes nothing.
    expect(row(container)).not.toHaveAttribute("data-stepping");
    for (let index = 0; index < 4; index++) {
      expect(cards[index].style.getPropertyValue("--car-x")).toBe(
        `${peekFor[index]}px`,
      );
    }
    expect(copy.style.visibility).toBe("visible");
    expect(copy.style.getPropertyValue("--car-lf")).toBe("0.5");
  });

  it("chains three peek clicks within 300ms into three steps, no click dropped", () => {
    const { container } = render(<HomeCarousel items={ITEMS} />);
    move(110);
    drawShifted(container);
    prevCard(container)!.style.setProperty("--car-x", "0px");
    const before = recorded.length;

    // Each click is one more step back even while the previous one is still
    // gliding: the running plan is re-aimed from the cards' drawn poses, the
    // same path an arrow pressed mid-run takes.
    fireEvent.click(prevCard(container)!);
    act(() => vi.advanceTimersByTime(150));
    expect(frontTitle()).toBe("More work soon");

    fireEvent.click(prevCard(container)!);
    act(() => vi.advanceTimersByTime(150));
    expect(frontTitle()).toBe("Type");

    fireEvent.click(prevCard(container)!);
    expect(frontTitle()).toBe("Titles");

    // Every click started a run of its own; none was swallowed by the guard.
    const clocks = recorded
      .slice(before)
      .filter(
        (r) =>
          r.target.classList.contains("car-row") &&
          !Array.isArray(r.keyframes) &&
          "opacity" in r.keyframes,
      );
    expect(clocks).toHaveLength(3);
    // The later runs are interrupts, so they carry speed instead of restarting
    // on the gentle step curve.
    const cardRuns = recorded
      .slice(before)
      .filter((r) => "--car-x" in r.keyframes)
      .slice(-4);
    for (const run of cardRuns)
      expect(run.options.easing).toBe("cubic-bezier(0.22, 1, 0.36, 1)");

    finishStep();

    // It lands in the peeking arrangement for offset 1, then nothing runs.
    expect(row(container)).toHaveAttribute("data-peeking");
    expect(prevCard(container)!.textContent).toContain("Systems");
    const after = recorded.length;
    act(() => vi.advanceTimersByTime(1000));
    expect(recorded).toHaveLength(after);
  });

  it("returns to rest after three chained peek clicks and a leave", () => {
    const { container } = render(<HomeCarousel items={ITEMS} />);
    move(110);
    drawShifted(container);
    prevCard(container)!.style.setProperty("--car-x", "0px");

    fireEvent.click(prevCard(container)!);
    act(() => vi.advanceTimersByTime(150));
    fireEvent.click(prevCard(container)!);
    act(() => vi.advanceTimersByTime(150));
    fireEvent.click(prevCard(container)!);
    finishStep();
    expect(row(container)).toHaveAttribute("data-peeking");

    leavePeek(container);

    expect(row(container)).not.toHaveAttribute("data-peeking");
    for (let slot = 0; slot < 4; slot++) {
      expect(card(container, slot).style.getPropertyValue("--car-x")).toBe(
        `${REST_X[slot]}px`,
      );
    }
  });

  it("returns to rest after leaving the peek a peek click landed in", () => {
    const { container } = render(<HomeCarousel items={ITEMS} />);
    move(110);
    drawShifted(container);
    clickPeek(container);

    // The landing writes the peek's poses inline (the step's own animations are
    // gone by then), so the retract has to put the rest poses back itself.
    expect(row(container)).toHaveAttribute("data-peeking");
    expect(card(container, 0).style.getPropertyValue("--car-x")).toBe(
      `${OPEN_X[0]}px`,
    );

    leavePeek(container);

    expect(row(container)).not.toHaveAttribute("data-peeking");
    expect(row(container)).not.toHaveAttribute("data-mask");
    for (let slot = 0; slot < 4; slot++) {
      expect(card(container, slot).style.getPropertyValue("--car-x")).toBe(
        `${REST_X[slot]}px`,
      );
    }
    expect(prevCard(container)!.style.visibility).toBe("hidden");
  });

  it("returns to rest after leaving a step that landed in the peek", () => {
    const { container } = render(<HomeCarousel items={ITEMS} />);
    move(110);
    // The pointer is in the zone, so the arrow step lands in the next peek.
    fireEvent.keyDown(card(container, 0).querySelector(".car-host")!, {
      key: "ArrowRight",
    });
    finishStep();
    expect(row(container)).toHaveAttribute("data-peeking");

    leavePeek(container);

    expect(row(container)).not.toHaveAttribute("data-peeking");
    for (let slot = 0; slot < 4; slot++) {
      expect(card(container, slot).style.getPropertyValue("--car-x")).toBe(
        `${REST_X[slot]}px`,
      );
    }
  });

  it("returns to rest after repeat peek clicks", () => {
    const { container } = render(<HomeCarousel items={ITEMS} />);
    move(110);
    drawShifted(container);
    clickPeek(container);
    clickPeek(container);
    clickPeek(container);
    expect(row(container)).toHaveAttribute("data-peeking");

    leavePeek(container);

    expect(row(container)).not.toHaveAttribute("data-peeking");
    for (let slot = 0; slot < 4; slot++) {
      expect(card(container, slot).style.getPropertyValue("--car-x")).toBe(
        `${REST_X[slot]}px`,
      );
    }
  });

  it("returns to rest after leaving and re-entering quickly", () => {
    const { container } = render(<HomeCarousel items={ITEMS} />);
    move(110);
    drawShifted(container);
    clickPeek(container);

    // Leave just long enough for the retract to start, then come back in.
    move(600);
    act(() => vi.advanceTimersByTime(121));
    move(110);
    act(() => vi.advanceTimersByTime(500));

    leavePeek(container);

    expect(row(container)).not.toHaveAttribute("data-peeking");
    for (let slot = 0; slot < 4; slot++) {
      expect(card(container, slot).style.getPropertyValue("--car-x")).toBe(
        `${REST_X[slot]}px`,
      );
    }
  });

  it("slides the leaving feature out at its width with the peek's left edge on the run", () => {
    const { container } = render(<HomeCarousel items={ITEMS} />);
    // The pointer stays away, so this is a plain forward step to rest.
    fireEvent.keyDown(card(container, 0).querySelector(".car-host")!, {
      key: "ArrowRight",
    });

    const leaving = container.querySelector<HTMLElement>(
      ".car-slide[data-edge-left]",
    )!;
    expect(leaving).toBeTruthy();
    expect(leaving.querySelector("[data-car-title]")?.textContent).toBe(
      "Systems",
    );
    // A push, not a shrink: it keeps its box and leaves past the left edge.
    const move = slides(leaving).at(-1)!;
    expect(move.keyframes["--car-x"]).toEqual(["0px", "-765px"]);
    expect(move.keyframes["--car-r"]).toEqual(["0px", "0px"]);
    // The peek's left edge, on the same run: the fade ramps in on --car-le and
    // the blur copy fades with it, anchored to the edge the card is drawn at.
    const fade = recorded.find(
      (r) => r.target === leaving && "--car-le" in r.keyframes,
    )!;
    expect(fade.keyframes["--car-le"]).toEqual([0, 1]);
    expect(fade.options.duration).toBe(900);
    const layer = leaving.querySelector<HTMLElement>("[data-peek-blur]")!;
    expect(layer).toHaveAttribute("data-edge", "left");
    const blur = recorded.find(
      (r) => r.target === layer && "opacity" in r.keyframes,
    )!;
    expect(blur.keyframes.opacity).toEqual([0, 1]);
    expect(blur.options.duration).toBe(900);
    // The left end is not blurred as a whole card: the edge copy does it.
    expect(
      recorded.some(
        (r) => r.target === leaving && !Array.isArray(r.keyframes) && "filter" in r.keyframes,
      ),
    ).toBe(false);

    finishStep();

    // At rest the card is out of the row and carries none of the edge state.
    expect(container.querySelector("[data-edge-left]")).toBeNull();
    expect(leaving.style.getPropertyValue("--car-le")).toBe("");
    expect(leaving.querySelector("[data-peek-blur]")).toBeNull();
  });

  it("ends every leave path at the rest rects with the peek's state cleared", () => {
    const setups: Record<string, (c: HTMLElement) => void> = {
      "plain peek": () => move(110),
      "peek click": (c) => {
        move(110);
        drawShifted(c);
        clickPeek(c);
      },
      "repeat clicks": (c) => {
        move(110);
        drawShifted(c);
        clickPeek(c);
        clickPeek(c);
      },
      "arrow while peeked": (c) => {
        move(110);
        fireEvent.keyDown(card(c, 0).querySelector(".car-host")!, {
          key: "ArrowRight",
        });
        finishStep();
      },
    };

    for (const [name, setup] of Object.entries(setups)) {
      const { container, unmount } = render(<HomeCarousel items={ITEMS} />);
      setup(container);
      leavePeek(container);

      expect(`${name}: ${row(container).hasAttribute("data-peeking")}`).toBe(
        `${name}: false`,
      );
      expect(row(container)).not.toHaveAttribute("data-mask");
      expect(["", "0"]).toContain(
        row(container).style.getPropertyValue("--car-fade"),
      );
      for (let slot = 0; slot < 4; slot++) {
        const slide = card(container, slot);
        expect(`${name} slot ${slot}: ${slide.style.getPropertyValue("--car-x")}`).toBe(
          `${name} slot ${slot}: ${REST_X[slot]}px`,
        );
        // The right edge's hand-over is per run; nothing is left on a card.
        expect(slide.style.getPropertyValue("--car-rf")).toBe("");
      }
      expect(container.querySelector("[data-peek-out]")).toBeNull();
      unmount();
    }
  });

  it("hands the peek's right edge over on the run instead of switching it at the landing", () => {
    const { container } = render(<HomeCarousel items={ITEMS} />);
    move(110);
    drawShifted(container);
    prevCard(container)!.style.setProperty("--car-x", "0px");
    fireEvent.click(prevCard(container)!);

    // The card that was the right edge of the old peek (item 2, now the 4th)
    // keeps the edge treatment, and keeps its blur copy, while it leaves.
    const leaving = card(container, 3);
    expect(leaving).toHaveAttribute("data-peek-out");
    const leavingBlur = leaving.querySelector("[data-peek-blur]");
    expect(leavingBlur).toHaveAttribute("data-edge", "right");
    // The card that becomes right-most (item 1, the new slot 2) is the only
    // other edge, and its blur layer is inside it.
    expect(card(container, 2).querySelector("[data-peek-blur]")).toBeTruthy();
    // The reveal's own blur list leaves the leaving card's copy out, so it is
    // faded by the step, not by the peek.
    const before = recorded.length;
    finishStep();

    expect(recorded).toHaveLength(before);
    // One right edge again, on the new slot 2, and no leftover out card.
    expect(container.querySelectorAll("[data-peek-out]")).toHaveLength(0);
    expect(
      container.querySelectorAll('.car-slide[data-slot="2"] [data-peek-blur]'),
    ).toHaveLength(1);
  });

  it("gives every slot one run and one timing on a peek click, so they start together", () => {
    const { container } = render(<HomeCarousel items={ITEMS} />);
    move(110);
    drawShifted(container);
    prevCard(container)!.style.setProperty("--car-x", "0px");
    const cards = [0, 1, 2, 3].map((slot) => card(container, slot));
    const before = recorded.length;

    // The reported case: a pointer click on the peeked card.
    fireEvent.click(prevCard(container)!, { detail: 1 });

    const runs = recorded
      .slice(before)
      .filter((r) => "--car-x" in r.keyframes);
    // One run per card, all created in this one task: the row cannot stagger.
    for (const el of cards) {
      expect(runs.filter((r) => r.target === el)).toHaveLength(1);
    }
    const timings = new Set(
      runs.map(
        (r) =>
          `${r.options.duration}|${r.options.easing}|${r.options.delay ?? 0}`,
      ),
    );
    expect(timings.size).toBe(1);
    // No seam copy runs on its own: the peeked card itself carries the motion.
    // (The peek's own copy does slide in, on the same one timing.)
    expect(
      runs.some(
        (r) =>
          r.target instanceof HTMLElement &&
          r.target.hasAttribute("data-ghost") &&
          !r.target.classList.contains("car-peek-edge"),
      ),
    ).toBe(false);
    // Every card starts where it is drawn this instant: the three shifted cards
    // at the shift, the peeked card where the copy was.
    for (let slot = 0; slot < 3; slot++) {
      expect(slides(cards[slot]).at(-1)!.keyframes["--car-x"][0]).toBe(
        `${OPEN_X[slot]}px`,
      );
    }
    expect(slides(cards[3]).at(-1)!.keyframes["--car-x"][0]).toBe("0px");
  });

  it("does not step when the click is not on the previous card", () => {
    const { container } = render(<HomeCarousel items={ITEMS} />);
    move(110);

    fireEvent.click(row(container));

    expect(frontTitle()).toBe("Systems");
  });

  it("holds the row where it is drawn when the featured card is clicked, no instant reset", () => {
    const { container } = render(<HomeCarousel items={ITEMS} />);
    move(110);
    drawShifted(container);
    const running = recorded.filter(
      (r) => "cancel" in r && (r as unknown as { cancel: unknown }).cancel,
    );

    const host = card(container, 0).querySelector<HTMLElement>(".car-host")!;
    host.addEventListener("click", (event) => event.preventDefault());
    fireEvent.click(host);

    // Nothing went back to rest: every card keeps its drawn position, the copy
    // stays, and the peek is neither retracting nor reopening.
    for (let slot = 0; slot < 4; slot++)
      expect(card(container, slot).style.getPropertyValue("--car-x")).toBe(
        `${OPEN_X[slot]}px`,
      );
    expect(row(container)).toHaveAttribute("data-peeking");
    expect(prevCard(container)!.style.visibility).toBe("visible");
    // The animations that were in flight are cancelled (frozen), not left to run.
    expect(running.length).toBeGreaterThan(0);
    for (const r of running)
      expect(
        (r as unknown as { cancel: ReturnType<typeof vi.fn> }).cancel,
      ).toHaveBeenCalled();
    const before = recorded.length;
    move(100 + 400);
    act(() => vi.advanceTimersByTime(500));
    expect(recorded).toHaveLength(before);
  });

  it("gives the morph the featured card's drawn box, not its rest box", () => {
    const { container } = render(<HomeCarousel items={ITEMS} />);
    move(110);
    drawShifted(container);

    const host = card(container, 0).querySelector<HTMLElement>(".car-host")!;
    host.addEventListener("click", (event) => event.preventDefault());
    fireEvent.click(host);

    // The reader's morph reads this at open and again at close.
    const measured = findCard("systems-in-motion")!;
    expect(measured.card.left).toBe(ROW.left + OPEN_X[0]);
    expect(measured.card.left).not.toBe(ROW.left + REST_X[0]);
  });

  it("puts the row back once the reader has landed, and before it measures to close", () => {
    for (const event of [OVERLAY_OPENED_EVENT, OVERLAY_CLOSING_EVENT]) {
      const { container, unmount } = render(<HomeCarousel items={ITEMS} />);
      move(110);
      drawShifted(container);
      const host = card(container, 0).querySelector<HTMLElement>(".car-host")!;
      host.addEventListener("click", (e) => e.preventDefault());
      fireEvent.click(host);
      expect(row(container)).toHaveAttribute("data-peeking");

      act(() => {
        window.dispatchEvent(new Event(event));
      });

      for (let slot = 0; slot < 4; slot++)
        expect(card(container, slot).style.getPropertyValue("--car-x")).toBe(
          `${REST_X[slot]}px`,
        );
      expect(row(container)).not.toHaveAttribute("data-peeking");
      expect(prevCard(container)!.style.visibility).toBe("hidden");
      // A blur layer frozen mid-fade is cleared with the peek.
      for (const layer of container.querySelectorAll<HTMLElement>(
        "[data-peek-blur]",
      )) {
        expect(layer.style.opacity).toBe("0");
      }
      // The close morph now finds the card at its rest box.
      expect(findCard("systems-in-motion")!.card.left).toBe(
        ROW.left + REST_X[0],
      );
      unmount();
    }
  });

  it("holds a step in flight where it is drawn when its card is clicked, then settles unseen", () => {
    const { container } = render(<HomeCarousel items={ITEMS} />);
    fireEvent.keyDown(card(container, 0).querySelector(".car-host")!, {
      key: "ArrowRight",
    });
    // "Titles" is first now (its slot is the target) and is still growing.
    const titles = [
      ...container.querySelectorAll<HTMLElement>(".car-slide"),
    ].find(
      (el) =>
        !el.hasAttribute("data-ghost") &&
        el.getAttribute("aria-label")?.endsWith(": Titles"),
    )!;
    titles.style.setProperty("--car-x", "310px");
    const inFlight = recorded.filter(
      (r) => !r.target.classList.contains("car-row"),
    );

    const host = titles.querySelector<HTMLElement>(".car-host")!;
    host.addEventListener("click", (event) => event.preventDefault());
    fireEvent.click(host);

    // Not settled: the card stays at the pose it is drawn at, and the step's
    // animations are stopped rather than left running or snapped to the end.
    expect(titles.style.getPropertyValue("--car-x")).toBe("310px");
    for (const r of inFlight)
      expect(
        (r as unknown as { cancel: ReturnType<typeof vi.fn> }).cancel,
      ).toHaveBeenCalled();
    expect(row(container)).toHaveAttribute("data-stepping");
    expect(findCard("title-sequence")!.card.left).toBe(ROW.left + 310);

    // The reader's panel is in the page when it reports it has landed.
    const layer = document.createElement("div");
    layer.className = "wd-expand-layer";
    document.body.appendChild(layer);

    act(() => {
      window.dispatchEvent(new Event(OVERLAY_OPENED_EVENT));
    });

    // Under the reader it lands at once: the close morph measures the card at
    // its rest box right after this.
    expect(titles.style.getPropertyValue("--car-x")).toBe("0px");
    expect(row(container)).not.toHaveAttribute("data-stepping");

    layer.remove();
  });

  it("works with the old ?blur= switch ignored, and ?peekRight= and ?peekFit= are gone", () => {
    window.history.pushState(
      {},
      "",
      "/?blur=none&peekRight=hover&peekFit=proportional",
    );
    const { container } = render(<HomeCarousel items={ITEMS} />);
    move(110);

    expect(row(container)).toHaveAttribute("data-peeking");
    expect(slides(prevCard(container)!)).toHaveLength(1);
    expect(container.querySelectorAll(".car-peek-edge")).toHaveLength(1);
    expect(card(container, 0).style.width).toBe("753px");
  });
});

describe("held motion without a reader", () => {
  /** Opens the peek, then clicks the featured card so the motion is held. */
  function hold() {
    const rendered = render(<HomeCarousel items={ITEMS} />);
    move(110);
    drawShifted(rendered.container);
    const host = card(rendered.container, 0).querySelector<HTMLElement>(
      ".car-host",
    )!;
    host.addEventListener("click", (event) => event.preventDefault());
    fireEvent.click(host);
    return rendered;
  }

  it("lets go on popstate when no reader is open, retracting with animation instead of snapping", () => {
    const { container } = hold();
    expect(row(container)).toHaveAttribute("data-peeking");
    const before = recorded.length;

    // A hard back: the url is the home page again and no reader is mounted.
    act(() => {
      window.dispatchEvent(new PopStateEvent("popstate"));
      vi.advanceTimersByTime(1);
    });

    const back = recorded
      .slice(before)
      .filter(
        (r) => "--car-x" in r.keyframes && r.target !== prevCard(container),
      );
    expect(back).toHaveLength(4);
    for (let slot = 0; slot < 4; slot++) {
      const run = back.find((r) => r.target === card(container, slot))!;
      // From where it is drawn to rest, over the retract curve: no jump.
      expect(run.keyframes["--car-x"]).toEqual([
        `${OPEN_X[slot]}px`,
        `${REST_X[slot]}px`,
      ]);
      expect(run.options.duration).toBe(350);
    }
    // Nothing was reset instantly: the cards still hold their drawn position
    // until the retract finishes.
    expect(card(container, 0).style.getPropertyValue("--car-x")).toBe(
      `${OPEN_X[0]}px`,
    );

    act(() => slides(prevCard(container)!).at(-1)!.onfinish?.());
    expect(row(container)).not.toHaveAttribute("data-peeking");
    // The fade is back to fully opaque.
    expect(row(container).style.getPropertyValue("--car-fade")).toBe("0");
  });

  it("stays held on popstate while a reader is open", () => {
    const { container } = hold();
    window.history.pushState({}, "", "/work/systems-in-motion");
    const before = recorded.length;

    act(() => {
      window.dispatchEvent(new PopStateEvent("popstate"));
      vi.advanceTimersByTime(1);
    });

    expect(recorded).toHaveLength(before);
    expect(row(container)).toHaveAttribute("data-peeking");
  });

  it("finds no reader after the grace period and lets go on the next pointer move", () => {
    const { container } = hold();
    const before = recorded.length;

    // A slow navigation gets a grace period first.
    act(() => vi.advanceTimersByTime(1000));
    move(100 + 400);
    expect(recorded).toHaveLength(before);

    act(() => vi.advanceTimersByTime(600));
    move(100 + 400);
    expect(recorded.length).toBeGreaterThan(before);
    expect(
      recorded
        .slice(before)
        .some(
          (r) => r.target === card(container, 0) && "--car-x" in r.keyframes,
        ),
    ).toBe(true);
  });

  it("does not let go while the reader's layer is in the page", () => {
    const { container } = hold();
    const layer = document.createElement("div");
    layer.className = "wd-expand-layer";
    document.body.appendChild(layer);
    const before = recorded.length;

    act(() => vi.advanceTimersByTime(3000));
    move(100 + 400);

    expect(recorded).toHaveLength(before);
    expect(row(container)).toHaveAttribute("data-peeking");
    layer.remove();
  });

  it("settles a held step on popstate", () => {
    const { container } = render(<HomeCarousel items={ITEMS} />);
    fireEvent.keyDown(card(container, 0).querySelector(".car-host")!, {
      key: "ArrowRight",
    });
    const titles = [
      ...container.querySelectorAll<HTMLElement>(".car-slide"),
    ].find(
      (el) =>
        !el.hasAttribute("data-ghost") &&
        el.getAttribute("aria-label")?.endsWith(": Titles"),
    )!;
    titles.style.setProperty("--car-x", "310px");
    const host = titles.querySelector<HTMLElement>(".car-host")!;
    host.addEventListener("click", (event) => event.preventDefault());
    fireEvent.click(host);
    expect(row(container)).toHaveAttribute("data-stepping");

    const mark = recorded.length;
    act(() => {
      window.dispatchEvent(new PopStateEvent("popstate"));
      vi.advanceTimersByTime(1);
    });

    // The hard back releases the step: it eases to rest instead of snapping.
    expect(row(container)).toHaveAttribute("data-stepping");
    expect(titles.style.getPropertyValue("--car-x")).toBe("310px");
    const runs = recorded
      .slice(mark)
      .filter(
        (r) =>
          !Array.isArray(r.keyframes) &&
          "--car-x" in r.keyframes &&
          r.target !== row(container),
      );
    expect(runs.length).toBeGreaterThan(0);
    const titlesRun = runs.find((r) => r.target === titles)!;
    expect(titlesRun).toBeDefined();
    expect(titlesRun.keyframes["--car-x"]).toEqual(["310px", "0px"]);
    for (const r of runs) {
      expect(r.options.duration).toBe(350);
      expect(r.options.easing).toBe("cubic-bezier(0.22, 1, 0.36, 1)");
    }

    finishStep();

    expect(row(container)).not.toHaveAttribute("data-stepping");
    expect(titles.style.getPropertyValue("--car-x")).toBe("0px");
  });
});

describe("hover zone cost", () => {
  /** Counts the row's box reads, the one layout read the zone could cause. */
  function countRowReads() {
    const original = Element.prototype.getBoundingClientRect;
    const count = { reads: 0 };
    Element.prototype.getBoundingClientRect = function (this: Element) {
      if (this.classList.contains("car-row")) count.reads++;
      return original.call(this);
    };
    return count;
  }

  it("reads the row's box once, not once per pointer move", () => {
    const count = countRowReads();
    render(<HomeCarousel items={ITEMS} />);
    const mounted = count.reads;

    for (let i = 0; i < 60; i++) move(100 + 300 + (i % 5));
    // Far from the zone the whole time: at most the one lazy read.
    expect(count.reads - mounted).toBeLessThanOrEqual(1);

    const settled = count.reads;
    for (let i = 0; i < 60; i++) move(100 + 300 + (i % 5));
    expect(count.reads).toBe(settled);
  });

  it("refreshes the cached box after a scroll, a resize and a step end, once each", () => {
    const count = countRowReads();
    const { container } = render(<HomeCarousel items={ITEMS} />);
    for (let i = 0; i < 5; i++) move(100 + 300);
    let before = count.reads;

    act(() => {
      window.dispatchEvent(new Event("scroll"));
    });
    for (let i = 0; i < 20; i++) move(100 + 300);
    expect(count.reads - before).toBe(1);

    before = count.reads;
    act(() => {
      window.dispatchEvent(new Event("resize"));
    });
    for (let i = 0; i < 20; i++) move(100 + 300);
    expect(count.reads - before).toBe(1);

    fireEvent.keyDown(card(container, 0).querySelector(".car-host")!, {
      key: "ArrowRight",
    });
    finishStep();
    before = count.reads;
    for (let i = 0; i < 20; i++) move(100 + 300);
    expect(count.reads - before).toBeLessThanOrEqual(1);
  });

  it("invalidates the cached box when the row itself resizes, once", () => {
    // Every cover also observes its own box now, so keep the callbacks that
    // watch the row, in registration order (measure first, hover second).
    const rowCallbacks: (() => void)[] = [];
    const original = globalThis.ResizeObserver;
    globalThis.ResizeObserver = class {
      constructor(callback: () => void) {
        this.callback = callback;
      }
      callback: () => void;
      observe(target: Element) {
        if (target.classList.contains("car-row")) {
          rowCallbacks.push(this.callback);
        }
      }
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;

    try {
      const count = countRowReads();
      const { container } = render(<HomeCarousel items={ITEMS} />);
      for (let i = 0; i < 5; i++) move(100 + 300);
      const before = count.reads;

      // A row resize marks the hover zone's box stale.
      act(() => rowCallbacks.at(-1)!());

      for (let i = 0; i < 20; i++) move(100 + 300);
      expect(count.reads - before).toBe(1);
      expect(container.querySelector(".car-row")).toBeInTheDocument();
    } finally {
      globalThis.ResizeObserver = original;
    }
  });

  it("still opens, holds and retracts from the cached box", () => {
    const count = countRowReads();
    const { container } = render(<HomeCarousel items={ITEMS} />);

    move(110);
    expect(row(container)).toHaveAttribute("data-peeking");
    const opened = count.reads;
    move(100 + 60);
    move(100 + 80);
    // The peek changing state marks the box stale once; nothing more.
    expect(count.reads - opened).toBeLessThanOrEqual(1);
    expect(row(container)).toHaveAttribute("data-peeking");

    move(100 + 400);
    act(() => vi.advanceTimersByTime(121));
    expect(prevCard(container)!).toBeTruthy();
  });
});

describe("peek glitch fixes", () => {
  it("does not flap at the zone boundary: wider only while open, and a retract is not undone", () => {
    const { container } = render(<HomeCarousel items={ITEMS} />);

    // At rest the zone is the first 40px: 60px in does not open it.
    move(100 + 60);
    expect(row(container)).not.toHaveAttribute("data-peeking");

    // Open, then the open zone (96px) holds the pointer at 60px.
    move(110);
    const opened = recorded.length;
    move(100 + 60);
    act(() => vi.advanceTimersByTime(500));
    expect(recorded).toHaveLength(opened);

    // Leave, let the retract start, come back to 60px: that is outside the
    // rest zone, so it stays retracting instead of reopening.
    move(100 + 400);
    act(() => vi.advanceTimersByTime(121));
    const retracting = recorded.length;
    move(100 + 60);
    act(() => vi.advanceTimersByTime(500));
    expect(recorded).toHaveLength(retracting);
  });

  it("retargets a reveal that is turned round from the pose it is at, not from rest", () => {
    const { container } = render(<HomeCarousel items={ITEMS} />);
    move(110);
    const copy = prevCard(container)!;
    // Half way through the reveal (jsdom does not run it): stand in for it.
    card(container, 0).style.setProperty("--car-x", "48px");
    copy.style.setProperty("--car-x", "-48px");
    row(container).style.setProperty("--car-fade", "0.6");
    const before = recorded.length;

    move(100 + 400);
    act(() => vi.advanceTimersByTime(121));

    const back = recorded.slice(before);
    const first = back.find(
      (r) => r.target === card(container, 0) && "--car-x" in r.keyframes,
    )!;
    expect(first.keyframes["--car-x"]).toEqual(["48px", "0px"]);
    // A turn round is shorter (half the distance is left) and eases in and out
    // instead of kicking off at full speed.
    expect(first.options.duration).toBe(175);
    expect(first.options.easing).toBe("cubic-bezier(0.4, 0, 0.2, 1)");
    expect(slides(copy).at(-1)!.keyframes["--car-x"]).toEqual([
      "-48px",
      "-96px",
    ]);
    // The mask strength carries on from where it is: no pop.
    const mask = back.find(
      (r) =>
        r.target === row(container) &&
        !Array.isArray(r.keyframes) &&
        "--car-fade" in r.keyframes,
    )!;
    expect(mask.keyframes["--car-fade"][0]).toBe(0.6);
  });

  it("steps back from a reveal in progress from the copy's drawn pose, not its end", () => {
    const { container } = render(<HomeCarousel items={ITEMS} />);
    move(110);
    const copy = prevCard(container)!;
    copy.style.setProperty("--car-x", "-40px");
    drawShifted(container);
    const before = recorded.length;

    fireEvent.click(copy);

    const entering = recorded
      .slice(before)
      .find(
        (r) =>
          r.target instanceof HTMLElement &&
          !r.target.hasAttribute("data-ghost") &&
          "--car-x" in r.keyframes &&
          r.keyframes["--car-x"][0] === "-40px",
      )!;
    expect(entering.keyframes["--car-x"][0]).toBe("-40px");
  });

  it("brings the next previous card in with a forward step instead of vanishing", () => {
    const { container } = render(<HomeCarousel items={ITEMS} />);
    move(110);
    prevCard(container)!.style.setProperty("--car-x", "0px");
    const before = recorded.length;

    fireEvent.keyDown(card(container, 0).querySelector(".car-host")!, {
      key: "ArrowRight",
    });

    const out = recorded
      .slice(before)
      .find(
        (r) => r.target === prevCard(container) && "--car-x" in r.keyframes,
      )!;
    // The copy now carries the *new* previous card (the old feature), so it
    // comes in from the gutter on the step's own run rather than sliding out.
    expect(out.keyframes["--car-x"]).toEqual(["-96px", "0px"]);
    expect(out.options.duration).toBe(900);
    expect(prevCard(container)!.style.visibility).toBe("visible");

    finishStep();
    // The step landed peeked; the pointer then leaves and the copy retracts.
    expect(row(container)).toHaveAttribute("data-peeking");
    move(600);
    act(() => vi.advanceTimersByTime(121));
    act(() => slides(prevCard(container)!).at(-1)!.onfinish?.());
    expect(prevCard(container)!.style.visibility).toBe("hidden");
  });

  it("holds the peek's mask strength through the step instead of popping", () => {
    const { container } = render(<HomeCarousel items={ITEMS} />);
    move(110);
    row(container).style.setProperty("--car-fade", "0.8");
    const before = recorded.length;

    fireEvent.keyDown(card(container, 0).querySelector(".car-host")!, {
      key: "ArrowRight",
    });

    // The row does not swap its mask for a step mask: it holds the peek's mask
    // at the strength it was drawn at, and the peek's own run carries it on.
    expect(row(container).style.getPropertyValue("--car-fade")).toBe("0.8");
    const mask = recorded
      .slice(before)
      .find(
        (r) =>
          r.target === row(container) &&
          !Array.isArray(r.keyframes) &&
          "--car-fade" in r.keyframes,
      )!;
    expect(mask.keyframes["--car-fade"][0]).toBe(0.8);
    expect(mask.options.duration).toBe(900);
  });
});

describe("peek css", () => {
  const css = readFileSync(
    resolve(process.cwd(), "src/components/home/carousel/home-carousel.css"),
    "utf8",
  );

  it("masks by alpha only, with no painted colour, and clips to the column", () => {
    expect(css).toMatch(
      /\.car-row\[data-stepping\],\s*\.car-row\[data-mask\]\s*\{\s*--car-mask/,
    );
    expect(css).toMatch(
      /\.car-row\[data-stepping\]\s*\{\s*clip-path:\s*inset\(-12px -4px\)/,
    );
    // While peeking only the left outset stays, so the previous card's ring is
    // not cut and the card pushed out never shows past the right edge.
    expect(css).toMatch(
      /\.car-row\[data-peeking\]\s*\{\s*clip-path:\s*inset\(-12px 0 -12px -6px\)/,
    );
    expect(css).not.toMatch(/color-mix/);
  });

  it("ramps a masked blurred copy inside the card, and holds the edge fade", () => {
    expect(css).toMatch(
      /\.car-peek-blur-copy\s*\{[^}]*filter:\s*blur\(\s*var\(--car-peek-blur, 8px\)/,
    );
    // The copy is blurred from the card's outer edge inward and ends on the very
    // ramp the card fades on (a share of it, the Peek blur width), so blurred
    // and sharp copies meet where the card is already solid.
    expect(css).toMatch(
      /\.car-peek-blur\[data-edge="left"\]\s*\{[^}]*mask-image:\s*linear-gradient\(\s*to right,\s*#000 0,\s*transparent calc\(var\(--peek-fade-left, 34px\) \* var\(--car-peek-ramp, 100\) \/ 100\)/,
    );
    expect(css).toMatch(
      /\.car-peek-blur\[data-edge="right"\]\s*\{[^}]*mask-image:\s*linear-gradient\(\s*to left,\s*#000 0,\s*transparent calc\(var\(--peek-fade-right, 33px\) \* var\(--car-peek-ramp, 100\) \/ 100\)/,
    );
    // Only while the peek is open is the filtered copy promoted.
    expect(css).toMatch(
      /\.car-row\[data-peeking\] \.car-peek-blur-copy\s*\{\s*will-change:\s*filter/,
    );
    expect(css).toMatch(/mask-image:\s*var\(--car-lf-fade\)/);
    // The mask reaches past the box so the hover ring is not masked away.
    expect(css).toMatch(/mask-clip:\s*no-clip/);
    expect(css).toMatch(/@property --car-lf/);
  });

  it("gives the edge cards one fade ramp on a box grown past the shadow", () => {
    // The mask stops at the masked box, so the box grows by the shadow's reach
    // (and the ring's 6px outset): 8px of padding with the same negative margin
    // keeps the card's own geometry, and the ramp's stops move in by the pad so
    // the fade still starts at the card's edge and ends at the Peek fade width.
    const peekFrame =
      /\.car-row\[data-peeking\] \.car-peek-edge \.car-frame\s*\{[^}]*mask-image:\s*linear-gradient\(\s*to right,\s*transparent var\(--car-shadow-pad\),\s*rgb\(0 0 0 \/ calc\(1 - var\(--car-fade\)\)\) var\(--car-shadow-pad\),\s*#000 calc\(var\(--car-shadow-pad\) \+ var\(--peek-fade-left, 34px\)\)/;
    expect(css).toMatch(peekFrame);

    // The right edge is the same ramp, and it takes its strength from the card's
    // own `--car-rf` too, so the edge can change hands during a step without
    // waiting for the landing.
    const lastFrame =
      /\.car-row\[data-peeking\] \.car-slide\[data-slot="2"\] \.car-frame,\s*\.car-row\[data-peeking\] \.car-slide\[data-peek-out\] \.car-frame\s*\{[^}]*right:\s*var\(--car-r\)[^}]*mask-image:\s*linear-gradient\(\s*to left,\s*rgb\(0 0 0 \/ calc\(1 - var\(--car-fade\) \* var\(--car-rf\)\)\)\s*var\(--car-shadow-pad\),\s*#000 calc\(var\(--car-shadow-pad\) \+ var\(--peek-fade-right, 33px\)\)/;
    expect(css).toMatch(lastFrame);

    // The box that grows carries the pad and its negative margin, and the host
    // sits back inside it, so the shadow fades but the card does not move. The
    // pad itself is the row's (the same reach the moving cards rely on).
    expect(css).toMatch(
      /\.car-row\s*\{[^}]*--car-shadow-pad:\s*8px/,
    );
    expect(css).toMatch(
      /\.car-row\[data-peeking\] \.car-peek-edge \.car-frame,\s*\.car-row\[data-peeking\] \.car-slide\[data-slot="2"\] \.car-frame,\s*\.car-row\[data-peeking\] \.car-slide\[data-peek-out\] \.car-frame\s*\{\s*margin:\s*calc\(-1 \* var\(--car-shadow-pad\)\);\s*padding:\s*var\(--car-shadow-pad\)/,
    );
    expect(css).toMatch(
      /\.car-row\[data-peeking\] \.car-peek-edge \.car-host,\s*\.car-row\[data-peeking\] \.car-slide\[data-slot="2"\] \.car-host,\s*\.car-row\[data-peeking\] \.car-slide\[data-peek-out\] \.car-host\s*\{[^}]*position:\s*absolute;\s*inset:\s*var\(--car-shadow-pad\)/,
    );
    // The shadow stays: the token is untouched and nothing drops it.
    expect(css).not.toMatch(/box-shadow:\s*none/);

    // The row and the copy carry no mask of their own while peeking, so nothing
    // is faded twice; the ring and the fill take the frame's one ramp.
    expect(css).toMatch(
      /\.car-row\[data-peeking\]:not\(\[data-stepping\]\)\s*\{\s*-webkit-mask-image:\s*none;\s*mask-image:\s*none/,
    );
    expect(css).toMatch(
      /\.car-row\[data-peeking\] \.car-peek-edge\s*\{\s*\/\*[^*]*\*\/\s*-webkit-mask-image:\s*none;\s*mask-image:\s*none/,
    );
    expect(css).not.toMatch(
      /data-peeking\] \.car-peek-edge \.car-clip\s*\{[^}]*mask-image/,
    );
    expect(css).not.toMatch(
      /data-peeking\] \.car-peek-edge :is\(\.ring-frame, \.ring-surface\)\s*\{[^}]*mask-image/,
    );
  });

  it("clips the copy at the column's edge; only its hovered ring may enter the outset", () => {
    const block = css.match(/^\.car-peek-edge\s*\{([^}]*)\}/m)![1];

    expect(block).toMatch(/clip-path:\s*inset\(/);
    expect(block).toContain("var(--car-x) * -1");
    expect(block).toContain("--car-ring: 0px");
    expect(css).toMatch(/\.car-peek-edge:hover\s*\{[^}]*--car-ring:\s*6px/);
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
