import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CAROUSEL_STEP_END, CAROUSEL_STEP_START } from "../step-events";
import { HomeCarousel } from "./home-carousel";
import type { CarouselItem } from "./home-carousel";

const ITEMS: CarouselItem[] = [
  { kind: "work", slug: "systems-in-motion", title: "Systems", cover: "tiles" },
  { kind: "work", slug: "title-sequence", title: "Titles", cover: "window" },
  { kind: "work", slug: "type-in-motion", title: "Type", cover: "phone" },
  { kind: "placeholder", title: "More work soon" },
];

/** Property-indexed keyframes, or the array form (the title's). */
type Frames = Record<string, unknown[]> & { length?: number };

function hasProp(r: { keyframes: Frames }, key: string): boolean {
  return !Array.isArray(r.keyframes) && key in r.keyframes;
}

type Recorded = {
  target: Element;
  keyframes: Frames;
  options: { duration?: number; easing?: string; delay?: number };
  cancel: ReturnType<typeof vi.fn>;
  onfinish: (() => void) | null;
};

let recorded: Recorded[] = [];

function stubMatchMedia(reduce: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches: reduce && query.includes("prefers-reduced-motion"),
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
  window.history.pushState({}, "", "/");
  recorded = [];
  stubMatchMedia(false);
  Element.prototype.animate = function animate(
    this: Element,
    keyframes: Frames,
    options: Recorded["options"],
  ) {
    const record: Recorded = {
      target: this,
      keyframes,
      options,
      cancel: vi.fn(),
      onfinish: null,
    };
    recorded.push(record);
    return record as unknown as Animation;
  } as unknown as typeof Element.prototype.animate;
});

afterEach(() => {
  vi.unstubAllGlobals();
  // @ts-expect-error jsdom has no animate; remove the stub
  delete Element.prototype.animate;
});

function slides() {
  return screen
    .getAllByRole("group")
    .filter((el) => el.dataset.slot !== undefined);
}

/** Visible, non-ghost slides in slot order. */
function labels(): string[] {
  return slides()
    .filter((el) => !el.hasAttribute("data-ghost"))
    .map((el) => el.getAttribute("aria-label")!)
    .sort();
}

function frontTitle(): string {
  return (
    labels()
      .find((label) => label.startsWith("1 of"))
      ?.split(": ")[1] ?? ""
  );
}

function host(title: string): HTMLElement {
  const slide = slides().find(
    (el) =>
      !el.hasAttribute("data-ghost") &&
      el.getAttribute("aria-label")?.endsWith(`: ${title}`),
  )!;
  return slide.querySelector<HTMLElement>(".car-host")!;
}

function finishStep() {
  const clock = recorded.filter((r) => r.target.classList.contains("car-row"));
  act(() => clock.at(-1)?.onfinish?.());
}

describe("HomeCarousel markup", () => {
  it("is a carousel of four slides", () => {
    render(<HomeCarousel items={ITEMS} />);

    const region = screen.getByRole("region", { name: "Selected work" });
    expect(region).toHaveAttribute("aria-roledescription", "carousel");
    expect(labels()).toEqual([
      "1 of 4: Systems",
      "2 of 4: Titles",
      "3 of 4: Type",
      "4 of 4: More work soon",
    ]);
    for (const slide of slides()) {
      expect(slide).toHaveAttribute("aria-roledescription", "slide");
    }
  });

  it("gives only the first work the morph's hooks", () => {
    const { container } = render(<HomeCarousel items={ITEMS} />);

    const cards = container.querySelectorAll("[data-work-card]");
    expect(cards).toHaveLength(1);
    expect(cards[0]).toHaveAttribute("data-work-card", "systems-in-motion");
    expect(cards[0]).toHaveAttribute("href", "/work/systems-in-motion");
    expect(cards[0].querySelector("[data-work-card-title]")).toHaveTextContent(
      "Systems",
    );
  });

  it("does not move anything on its own", () => {
    vi.useFakeTimers();
    render(<HomeCarousel items={ITEMS} />);
    vi.advanceTimersByTime(30_000);
    vi.useRealTimers();

    expect(recorded).toHaveLength(0);
  });
});

describe("clicks", () => {
  it("steps a non-first card to the front and cancels its navigation", () => {
    render(<HomeCarousel items={ITEMS} />);

    const notPrevented = fireEvent.click(host("Type"));

    expect(notPrevented).toBe(false);
    expect(frontTitle()).toBe("Type");
    expect(labels()).toEqual([
      "1 of 4: Type",
      "2 of 4: More work soon",
      "3 of 4: Systems",
      "4 of 4: Titles",
    ]);
  });

  it("lets the first work's link navigate", () => {
    render(<HomeCarousel items={ITEMS} />);

    const notPrevented = fireEvent.click(host("Systems"));

    expect(notPrevented).toBe(true);
    expect(recorded).toHaveLength(0);
  });

  it("finishes a running step before the first card opens", () => {
    render(<HomeCarousel items={ITEMS} />);

    fireEvent.click(host("Titles"));
    const running = recorded.filter((r) => r.cancel.mock.calls.length === 0);
    expect(running.length).toBeGreaterThan(0);

    const notPrevented = fireEvent.click(host("Titles"));

    expect(notPrevented).toBe(true);
    for (const record of running) expect(record.cancel).toHaveBeenCalled();
  });

  it("leaves the placeholder inert in the first slot", () => {
    render(<HomeCarousel items={ITEMS} />);

    fireEvent.click(host("More work soon"));
    expect(frontTitle()).toBe("More work soon");
    const before = recorded.length;

    const notPrevented = fireEvent.click(host("More work soon"));

    expect(notPrevented).toBe(false);
    expect(frontTitle()).toBe("More work soon");
    expect(recorded).toHaveLength(before);
    expect(host("More work soon")).toHaveAttribute("aria-disabled", "true");
    expect(document.querySelectorAll("[data-work-card]")[0]).toBeUndefined();
  });
});

describe("keys", () => {
  it("steps by one with the arrow keys", () => {
    render(<HomeCarousel items={ITEMS} />);
    const first = host("Systems");

    fireEvent.keyDown(first, { key: "ArrowRight" });
    expect(frontTitle()).toBe("Titles");

    fireEvent.keyDown(first, { key: "ArrowLeft" });
    fireEvent.keyDown(first, { key: "ArrowLeft" });
    expect(frontTitle()).toBe("More work soon");
  });

  it("ignores other keys", () => {
    render(<HomeCarousel items={ITEMS} />);

    fireEvent.keyDown(host("Systems"), { key: "ArrowDown" });

    expect(frontTitle()).toBe("Systems");
    expect(recorded).toHaveLength(0);
  });

  it("announces a pointer step politely", () => {
    render(<HomeCarousel items={ITEMS} />);

    // A click has a detail of 1; a keyboard activation has 0.
    fireEvent.click(host("Titles"), { detail: 1 });

    const region = screen.getByRole("region", { name: "Selected work" });
    expect(within(region).getByText("Showing Titles")).toHaveAttribute(
      "aria-live",
      "polite",
    );
  });

  it("does not announce a keyboard step: focus moves to the first card, which reads itself", () => {
    const { container } = render(<HomeCarousel items={ITEMS} />);
    const live = container.querySelector("[aria-live]")!;

    fireEvent.keyDown(host("Systems"), { key: "ArrowRight" });
    expect(live.textContent).toBe("");

    // Enter on a card is a click with no pointer: the same.
    fireEvent.click(host("Type"), { detail: 0 });
    expect(live.textContent).toBe("");

    // A pointer step afterwards still announces.
    fireEvent.click(host("More work soon"), { detail: 1 });
    expect(live.textContent).toContain("Showing");
  });
});

describe("the wrap seam", () => {
  it("adds a plain copy while the leaving card exits, then drops it", () => {
    const { container } = render(<HomeCarousel items={ITEMS} />);

    fireEvent.keyDown(host("Systems"), { key: "ArrowRight" });

    const ghost = container.querySelector<HTMLElement>("[data-ghost]")!;
    expect(ghost).toBeInTheDocument();
    expect(ghost).toHaveAttribute("aria-hidden", "true");
    expect(ghost).toHaveAttribute("inert");
    expect(ghost.querySelector("a, button, [data-work-card]")).toBeNull();
    expect(ghost.querySelector("[data-car-title]")).toHaveTextContent(
      "Systems",
    );

    finishStep();

    expect(container.querySelector("[data-ghost]")).toBeNull();
    expect(container.querySelectorAll(".car-slide")).toHaveLength(4);
  });

  it("moves and crops in one animation, as same-thread custom properties", () => {
    const { container } = render(<HomeCarousel items={ITEMS} />);

    fireEvent.keyDown(host("Systems"), { key: "ArrowRight" });

    // Regression: animating transform (compositor) and clip-path (main thread)
    // together let the crop lag the move, and a shrinking card's surface showed
    // across the gap. Position and crop are one animation of two custom
    // properties, never transform or clip-path themselves.
    const moves = recorded.filter((r) => hasProp(r, "--car-x"));
    expect(moves.length).toBeGreaterThan(0);
    for (const move of moves) {
      expect(
        Object.keys(move.keyframes)
          .filter((key) => key !== "filter")
          .sort(),
      ).toEqual(["--car-r", "--car-x"]);
      expect(move.target.hasAttribute("data-clipped")).toBe(true);
    }
    expect(recorded.some((r) => hasProp(r, "transform"))).toBe(false);
    expect(recorded.some((r) => hasProp(r, "clipPath"))).toBe(false);

    // Every card in the row is cropped while it moves.
    const cropped = container.querySelectorAll(".car-slide[data-clipped]");
    expect(cropped.length).toBeGreaterThan(0);
  });

  it("crops the card's whole box at its start, and uncrops it at rest", () => {
    const { container } = render(<HomeCarousel items={ITEMS} />);

    fireEvent.keyDown(host("Systems"), { key: "ArrowRight" });
    expect(container.querySelectorAll(".car-slide[data-clipped]")).toHaveLength(
      5,
    );

    finishStep();

    expect(container.querySelectorAll("[data-clipped]")).toHaveLength(0);
    for (const slide of container.querySelectorAll<HTMLElement>(".car-slide")) {
      expect(slide.style.getPropertyValue("--car-r")).toBe("0px");
    }
  });
});

describe("carousel CSS", () => {
  const css = readFileSync(
    resolve(process.cwd(), "src/components/home/carousel/home-carousel.css"),
    "utf8",
  );

  it("crops the card element itself, so no painted layer can sit outside it", () => {
    // The card's box is the wider end; the host holds the width the card is
    // drawn at, so the fill, ring and shadow all end on the visible edge.
    expect(css).toMatch(
      /\.car-slide\[data-clipped\] \.car-host\s*\{\s*width:\s*calc\(100% - var\(--car-r\)\)/,
    );
    expect(css).toMatch(
      /\.car-slide\s*\{[^}]*transform:\s*translateX\(var\(--car-x\)\)/,
    );
  });

  it("clips the row close to the column edges while stepping, outset at rest", () => {
    expect(css).toMatch(/\.car-row\s*\{[^}]*clip-path:\s*inset\(-12px -6px\)/);
    // 4px is the ring's band and the shadow: enough that an edge card keeps its
    // border through a step, still inside the 12px gutter.
    expect(css).toMatch(
      /\.car-row\[data-stepping\]\s*\{\s*clip-path:\s*inset\(-12px -4px\)/,
    );
  });

  it("edge treatment paints no colour: a mask only", () => {
    const start = css.indexOf("@property --car-fade");
    const end = css.indexOf(".car-row[data-stepping] {", start);
    const edge = css.slice(start, end);

    expect(edge).toMatch(/mask-image/);
    expect(edge).not.toMatch(
      /background|backdrop-filter|color-mix|var\(--surface/,
    );
    expect(css).not.toMatch(/\.car-edge/);
  });

  it("registers position as a non-inheriting and crop as an inherited length", () => {
    // `--car-r` inherits: the host reads it to hold the width the card is drawn
    // at. `--car-x` stays on the slide only.
    expect(css).toMatch(
      /@property --car-x\s*\{[^}]*syntax:\s*"<length>";[^}]*inherits:\s*false/,
    );
    expect(css).toMatch(
      /@property --car-r\s*\{[^}]*syntax:\s*"<length>";[^}]*inherits:\s*true/,
    );
  });
});

describe("easing and one timeline", () => {
  it("defaults to a 900ms quick-start ease-out curve", () => {
    render(<HomeCarousel items={ITEMS} />);

    fireEvent.keyDown(host("Systems"), { key: "ArrowRight" });

    const card = recorded.find((r) => hasProp(r, "--car-x"))!;
    expect(card.options.duration).toBe(900);
    expect(card.options.easing).toBe("cubic-bezier(0.25, 0.8, 0.25, 1)");
  });

  it("runs card, clip, covers, title and the wrap copy on the same duration and curve", () => {
    const { container } = render(<HomeCarousel items={ITEMS} />);

    fireEvent.keyDown(host("Systems"), { key: "ArrowRight" });

    const timeline = recorded.filter(
      (r) => !r.target.classList.contains("car-row"),
    );
    const titles = timeline.filter((r) =>
      r.target.hasAttribute("data-car-title"),
    );
    const ghost = container.querySelector("[data-ghost]")!;

    expect(titles.length).toBeGreaterThan(0);
    expect(
      timeline.some((r) => ghost.contains(r.target) || r.target === ghost),
    ).toBe(true);
    for (const r of timeline) {
      expect(r.options.duration).toBe(900);
      expect(r.options.easing).toBe("cubic-bezier(0.25, 0.8, 0.25, 1)");
      expect(r.options.delay ?? 0).toBe(0);
    }
  });

  it("gives every slot one timing tuple and no delay: the row is not staggered", () => {
    render(<HomeCarousel items={ITEMS} />);

    // The reported case: a pointer click on a non-first card.
    fireEvent.click(host("Titles"), { detail: 1 });

    const moves = recorded.filter((r) => hasProp(r, "--car-x"));
    expect(moves.length).toBeGreaterThanOrEqual(4);
    const timings = new Set(
      moves.map(
        (r) =>
          `${r.options.duration}|${r.options.easing}|${r.options.delay ?? 0}`,
      ),
    );
    expect(timings).toEqual(
      new Set(["900|cubic-bezier(0.25, 0.8, 0.25, 1)|0"]),
    );
  });

  it("holds a title back until the card is mostly wide", () => {
    render(<HomeCarousel items={ITEMS} />);

    fireEvent.keyDown(host("Systems"), { key: "ArrowRight" });

    const arriving = recorded.find(
      (r) =>
        r.target.hasAttribute("data-car-title") &&
        Array.isArray(r.keyframes) &&
        r.keyframes.some((k) => k.offset === 0.75),
    );
    expect(arriving).toBeDefined();
  });

  it("the responsive preset sets both the duration and the curve, and the retarget curve stays", async () => {
    window.history.pushState({}, "", "/?tune=1");
    render(<HomeCarousel items={ITEMS} />);

    const duration = await screen.findByLabelText(/Duration/);
    fireEvent.change(duration, { target: { value: "800" } });
    const first = host("Systems");
    fireEvent.keyDown(first, { key: "ArrowRight" });

    const move = recorded.find((r) => hasProp(r, "--car-x"))!;
    expect(move.options.duration).toBe(800);

    // An interrupt still takes the ease-out that carries speed.
    const before = recorded.length;
    fireEvent.keyDown(first, { key: "ArrowRight" });
    const retargeted = recorded
      .slice(before)
      .find((r) => hasProp(r, "--car-x"))!;
    expect(retargeted.options.easing).toBe("cubic-bezier(0.22, 1, 0.36, 1)");
    expect(retargeted.options.duration).toBe(800);
  });

  it("tells the page when a step starts and ends, for things that follow the pointer", () => {
    const events: string[] = [];
    const start = () => events.push("start");
    const end = () => events.push("end");
    window.addEventListener(CAROUSEL_STEP_START, start);
    window.addEventListener(CAROUSEL_STEP_END, end);
    render(<HomeCarousel items={ITEMS} />);

    fireEvent.keyDown(host("Systems"), { key: "ArrowRight" });
    expect(events).toEqual(["start"]);

    finishStep();
    expect(events).toEqual(["start", "end"]);

    window.removeEventListener(CAROUSEL_STEP_START, start);
    window.removeEventListener(CAROUSEL_STEP_END, end);
  });

  it("tells the page a step ended when the row unmounts mid-step", () => {
    const events: string[] = [];
    const start = () => events.push("start");
    const end = () => events.push("end");
    window.addEventListener(CAROUSEL_STEP_START, start);
    window.addEventListener(CAROUSEL_STEP_END, end);
    const { unmount } = render(<HomeCarousel items={ITEMS} />);

    fireEvent.keyDown(host("Systems"), { key: "ArrowRight" });
    expect(events).toEqual(["start"]);

    unmount();

    expect(events).toEqual(["start", "end"]);

    window.removeEventListener(CAROUSEL_STEP_START, start);
    window.removeEventListener(CAROUSEL_STEP_END, end);
  });

  it("retargets a running step on an ease-out", () => {
    render(<HomeCarousel items={ITEMS} />);
    const first = host("Systems");

    fireEvent.keyDown(first, { key: "ArrowRight" });
    const before = recorded.length;
    fireEvent.keyDown(first, { key: "ArrowRight" });

    const retargeted = recorded
      .slice(before)
      .find((r) => hasProp(r, "--car-x"))!;
    expect(retargeted.options.easing).toBe("cubic-bezier(0.22, 1, 0.36, 1)");
  });
});

describe("edge blur", () => {
  it("a step fades the row's edge mask, with no overlay elements", () => {
    const { container } = render(<HomeCarousel items={ITEMS} />);
    const row = container.querySelector<HTMLElement>(".car-row")!;
    expect(container.querySelector(".car-edge")).toBeNull();
    expect(recorded).toHaveLength(0);
    expect(row).not.toHaveAttribute("data-stepping");

    fireEvent.keyDown(host("Systems"), { key: "ArrowRight" });

    expect(row).toHaveAttribute("data-stepping");
    const fades = recorded.filter(
      (r) =>
        r.target === row &&
        Array.isArray(r.keyframes) &&
        r.keyframes.length > 1,
    );
    expect(fades).toHaveLength(1);
    expect(fades[0].target).toBe(row);
    expect(fades[0].options.duration).toBe(900);
    expect(
      (fades[0].keyframes as unknown as { "--car-rm": number }[]).at(-1),
    ).toMatchObject({ "--car-rm": 0 });

    finishStep();
    expect(row).not.toHaveAttribute("data-stepping");
  });

  it("edge blurs only the cards coming in through the left end", () => {
    render(<HomeCarousel items={ITEMS} />);

    // A step back brings a card in through the left end: it blurs as a whole.
    fireEvent.keyDown(host("Systems"), { key: "ArrowLeft" });

    const blurred = recorded.filter((r) => hasProp(r, "filter"));
    expect(blurred.length).toBeGreaterThan(0);
    for (const r of blurred) {
      expect(r.target.classList).toContain("car-slide");
      const [from] = r.keyframes["--car-x"] as string[];
      expect(parseFloat(from)).toBeLessThan(0);
    }
  });

  it("melts a card crossing the right end at the column's edge, not with a whole-card blur", () => {
    const { container } = render(<HomeCarousel items={ITEMS} />);
    const css = readFileSync(
      resolve(process.cwd(), "src/components/home/carousel/home-carousel.css"),
      "utf8",
    );

    // A step on brings the seam copy in past the right end. It used to blur as
    // a whole and be cut hard by the row's clip at the column's edge; it now
    // carries the column-anchored mask and blur copy, so it takes no filter (a
    // filter on the slide would stop its mask painting in Chromium).
    fireEvent.keyDown(host("Systems"), { key: "ArrowRight" });

    expect(recorded.some((r) => hasProp(r, "filter"))).toBe(false);
    const ghost = container.querySelector<HTMLElement>(
      ".car-slide[data-ghost]",
    )!;
    expect(ghost).toHaveAttribute("data-cross-right");
    expect(ghost.querySelector("[data-cross-blur]")).not.toBeNull();
    // The right-most slot carries the layer too; the inner slots do not.
    const slide = (slot: number) =>
      container.querySelector<HTMLElement>(
        `.car-slide[data-slot="${slot}"]:not([data-ghost])`,
      )!;
    expect(slide(1)).not.toHaveAttribute("data-cross-right");
    // The copy of the peek's right edge is not driven by the peek.
    expect(ghost.querySelector("[data-cross-blur]")).not.toHaveAttribute(
      "data-peek-blur",
    );
    // The mask is anchored to the column's edge in the card's own box, never
    // to the card's drawn edge.
    expect(css).toMatch(
      /\.car-slide\[data-cross-right\]\s*\{\s*--car-cross-r:\s*calc\(var\(--car-row-w, 100vw\) - var\(--car-x\)\)/,
    );
  });

  it("caps the edge blur at 2.5px and promotes only the blurred cards, only during the step", () => {
    const { container } = render(<HomeCarousel items={ITEMS} />);
    const css = readFileSync(
      resolve(process.cwd(), "src/components/home/carousel/home-carousel.css"),
      "utf8",
    );

    fireEvent.keyDown(host("Systems"), { key: "ArrowLeft" });

    const blurred = recorded.filter((r) => hasProp(r, "filter"));
    for (const r of blurred) {
      expect(r.keyframes.filter?.some((f) => f === "blur(2.50px)")).toBe(true);
      expect(r.target).toHaveAttribute("data-edge-blur");
    }
    expect(container.querySelectorAll("[data-edge-blur]")).toHaveLength(
      blurred.length,
    );
    // The css hints will-change only while a step or a peek is on, never at
    // rest. (A step that lands in the peek arrangement runs without the row
    // mask, so it needs the promotion under [data-peeking] too.)
    expect(css).toMatch(
      /\.car-row\[data-stepping\] \.car-slide\[data-edge-blur\],\s*\.car-row\[data-peeking\] \.car-slide\[data-edge-blur\]\s*\{\s*will-change:\s*filter/,
    );
    expect(css).not.toMatch(/\.car-slide\s*\{[^}]*will-change/);

    finishStep();
    expect(container.querySelectorAll("[data-edge-blur]")).toHaveLength(0);
  });

  it("ignores the old ?blur= and ?sliver= switches: it is always crop and edge", () => {
    window.history.pushState({}, "", "/?blur=none&sliver=grey");
    const { container } = render(<HomeCarousel items={ITEMS} />);

    fireEvent.keyDown(host("Systems"), { key: "ArrowLeft" });

    // The row still masks and the leaving/entering cards still blur.
    const row = container.querySelector<HTMLElement>(".car-row")!;
    expect(row).toHaveAttribute("data-stepping");
    expect(
      recorded.filter((r) => r.target === row && Array.isArray(r.keyframes)),
    ).toHaveLength(1);
    expect(recorded.some((r) => hasProp(r, "filter"))).toBe(true);
    // No sliver fill layer exists at all any more.
    expect(container.querySelector(".car-grey, [data-car-grey]")).toBeNull();
  });
});

describe("interrupts", () => {
  it("retargets a running step without queueing another", () => {
    render(<HomeCarousel items={ITEMS} />);
    const first = host("Systems");

    fireEvent.keyDown(first, { key: "ArrowRight" });
    const firstRun = [...recorded];

    fireEvent.keyDown(first, { key: "ArrowRight" });

    // The first run was cancelled in place; there is one run at a time.
    for (const record of firstRun) expect(record.cancel).toHaveBeenCalled();
    expect(frontTitle()).toBe("Type");

    // A stale clock from the cancelled run cannot end the new one.
    firstRun
      .filter((r) => r.target.classList.contains("car-row"))
      .forEach((r) => r.onfinish?.());
    const live = recorded
      .slice(firstRun.length)
      .filter((r) => r.cancel.mock.calls.length === 0);
    expect(live.length).toBeGreaterThan(0);

    finishStep();
    for (const record of live) expect(record.cancel).toHaveBeenCalled();
  });
});
