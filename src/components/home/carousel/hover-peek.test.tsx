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

  it("steps back one from the shifted pose when the previous card is clicked, no snap", () => {
    const { container } = render(<HomeCarousel items={ITEMS} />);
    move(110);
    drawShifted(container);
    // What the css draws on the open copy (jsdom has no stylesheet).
    prevCard(container)!.style.setProperty("--car-x", "0px");
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
    // It leaves the peek with its left end faded, and loses that as it grows
    // into the wide slot: no pop.
    expect("filter" in entering.keyframes).toBe(false);
    expect(entering.keyframes["--car-lf"]).toEqual([0.5, 0]);
    expect(entering.target).toHaveAttribute("data-peek-fade");

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
          r.target.hasAttribute("data-ghost") &&
          "--car-x" in r.keyframes,
      )!;
    expect(entering.keyframes["--car-x"][0]).toBe("-40px");
  });

  it("slides the copy back out when a step goes the other way, instead of vanishing", () => {
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
    expect(out.keyframes["--car-x"]).toEqual(["0px", "-96px"]);
    expect(prevCard(container)!.style.visibility).toBe("visible");

    move(600);
    finishStep();
    expect(prevCard(container)!.style.visibility).toBe("hidden");
  });

  it("carries the peek's mask strength into the step instead of popping", () => {
    const { container } = render(<HomeCarousel items={ITEMS} />);
    move(110);
    row(container).style.setProperty("--car-fade", "0.8");
    const before = recorded.length;

    fireEvent.keyDown(card(container, 0).querySelector(".car-host")!, {
      key: "ArrowRight",
    });

    const mask = recorded
      .slice(before)
      .find(
        (r) => r.target === row(container) && Array.isArray(r.keyframes),
      )!;
    const first = (mask.keyframes as unknown as { "--car-fade": number }[])[0];
    expect(first["--car-fade"]).toBe(0.8);
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
      /\.car-row\[data-stepping\]\s*\{\s*clip-path:\s*inset\(-12px 0\)/,
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
    // The copy is masked from the card's middle to its outer edge: sharp on the
    // inner half, blurred toward the edge.
    expect(css).toMatch(
      /\.car-peek-blur\[data-edge="left"\]\s*\{[^}]*mask-image:\s*linear-gradient\(\s*to right,\s*#000 0,\s*transparent calc\(var\(--car-peek-ramp, 50\) \* 1%\)/,
    );
    expect(css).toMatch(
      /\.car-peek-blur\[data-edge="right"\]\s*\{[^}]*mask-image:\s*linear-gradient\(\s*to left,\s*#000 0,\s*transparent calc\(var\(--car-peek-ramp, 50\) \* 1%\)/,
    );
    // While peeking, the row's mask holds and its ramps are the two edge cards'
    // fade widths, so the edges (and their borders) melt into the page.
    expect(css).toMatch(
      /\.car-row\[data-peeking\]\[data-mask\]\s*\{\s*--car-mask:\s*linear-gradient\(\s*to right,\s*rgb\(0 0 0 \/ calc\(1 - var\(--car-fade\)\)\) 0,\s*#000 var\(--peek-fade-left, 34px\),\s*#000 calc\(100% - var\(--peek-fade-right, 33px\)\),\s*rgb\(0 0 0 \/ calc\(1 - var\(--car-fade\)\)\) 100%/,
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

  it("clips the copy at the column's edge; only its hovered ring may enter the outset", () => {
    const block = css.match(/\.car-peek-edge\s*\{([^}]*)\}/)![1];

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
