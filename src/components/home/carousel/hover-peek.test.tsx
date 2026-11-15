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

const row = (c: HTMLElement) => c.querySelector<HTMLElement>(".car-row")!;
const strip = (c: HTMLElement, side: "left" | "right") =>
  c.querySelector<HTMLElement>(`.car-peek-edge[data-side="${side}"]`);
const card = (c: HTMLElement, slot: number) =>
  c.querySelector<HTMLElement>(
    `.car-slide[data-slot="${slot}"]:not([data-ghost])`,
  )!;

function pushes(target: Element) {
  return recorded.filter(
    (r) => r.target === target && "--car-r" in r.keyframes,
  );
}

function frontTitle(): string {
  return (
    screen
      .getAllByRole("group")
      .map((el) => el.getAttribute("aria-label") ?? "")
      .find((l) => l.startsWith("1 of") && !l.includes("undefined"))
      ?.split(": ")[1] ?? ""
  );
}

function finishStep() {
  const clock = recorded.filter((r) => r.target.classList.contains("car-row"));
  act(() => clock.at(-1)?.onfinish?.());
}

describe("left hover peek", () => {
  it("reveals inside the column, pushing the first card by peek + gap", () => {
    const { container } = render(<HomeCarousel items={ITEMS} />);
    expect(row(container)).not.toHaveAttribute("data-peeking");

    move(110);

    expect(row(container)).toHaveAttribute("data-peeking");
    const push = pushes(card(container, 0))[0];
    expect(push.keyframes["--car-r"]).toEqual(["0px", "32px"]);
    expect(push.keyframes["--car-x"]).toEqual(["0px", "32px"]);
    expect(push.options.duration).toBe(250);
    expect(push.options.easing).toBe("cubic-bezier(0.23, 1, 0.32, 1)");

    const slide = recorded.find(
      (r) => r.target === strip(container, "left") && "--car-x" in r.keyframes,
    )!;
    expect(slide.keyframes["--car-x"]).toEqual(["-20px", "0px"]);
  });

  it("reveals from the gutter, not only from inside the column", () => {
    const { container } = render(<HomeCarousel items={ITEMS} />);

    move(40);

    expect(pushes(card(container, 0))).toHaveLength(1);
  });

  it("does nothing for a pointer elsewhere in the column", () => {
    const { container } = render(<HomeCarousel items={ITEMS} />);

    move(600);

    expect(row(container)).not.toHaveAttribute("data-peeking");
    expect(recorded).toHaveLength(0);
  });

  it("retracts after a 120ms leave delay, and not if the pointer returns", () => {
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
    const back = pushes(card(container, 0)).at(-1)!;
    expect(recorded.length).toBeGreaterThan(after);
    expect(back.keyframes["--car-r"].at(-1)).toBe("0px");
    expect(back.options.duration).toBe(200);
    expect(back.options.easing).toBe("ease-out");

    act(() => back.onfinish?.());
    expect(row(container)).not.toHaveAttribute("data-peeking");
    expect(card(container, 0)).not.toHaveAttribute("data-clipped");
  });

  it("shows order[(first - 1 + n) % n] as an inert, hidden, unfocusable copy", () => {
    const { container } = render(<HomeCarousel items={ITEMS} />);
    const left = strip(container, "left")!;

    expect(left.textContent).toContain("More work soon");
    expect(left).toHaveAttribute("aria-hidden", "true");
    expect(left).toHaveAttribute("inert");
    expect(
      left.querySelector("a, button, [tabindex], [data-work-card]"),
    ).toBeNull();
    expect(container.querySelectorAll("[data-work-card]")).toHaveLength(1);
  });

  it("shows the item before the first for six items", () => {
    const { container } = render(<HomeCarousel items={SIX} />);

    expect(strip(container, "left")!.textContent).toContain("Six");
  });

  it("steps back one when the strip is clicked, then reappears if the pointer stays", () => {
    const { container } = render(<HomeCarousel items={ITEMS} />);
    move(110);
    const before = recorded.length;

    fireEvent.click(row(container), { clientX: 110, clientY: 200 });

    expect(frontTitle()).toBe("More work soon");
    expect(strip(container, "left")!.style.visibility).toBe("hidden");
    expect(row(container)).not.toHaveAttribute("data-peeking");
    const entering = recorded
      .slice(before)
      .find((r) => r.keyframes.filter?.[0] === "blur(4.00px)");
    expect(entering).toBeDefined();
    expect(entering!.keyframes["--car-x"][0]).toBe("0px");
    expect(entering!.keyframes["--car-r"][0]).toBe("574px");

    const afterStep = recorded.length;
    finishStep();

    expect(recorded.length).toBeGreaterThan(afterStep);
    expect(row(container)).toHaveAttribute("data-peeking");
    expect(strip(container, "left")!.textContent).toContain("Type");
  });

  it("does not step when the click lands off the strip", () => {
    const { container } = render(<HomeCarousel items={ITEMS} />);
    move(110);

    fireEvent.click(row(container), { clientX: 130, clientY: 200 });

    expect(frontTitle()).toBe("Systems");
  });

  it("puts the pushed card back before the first card opens", () => {
    const { container } = render(<HomeCarousel items={ITEMS} />);
    move(110);

    const host = card(container, 0).querySelector<HTMLElement>(".car-host")!;
    host.addEventListener("click", (event) => event.preventDefault());
    fireEvent.click(host);

    expect(card(container, 0).style.getPropertyValue("--car-r")).toBe("0px");
    expect(card(container, 0)).not.toHaveAttribute("data-clipped");
  });

  it("is independent of ?blur=", () => {
    for (const blur of ["edge", "motion", "none"]) {
      window.history.pushState({}, "", `/?blur=${blur}`);
      const { container, unmount } = render(<HomeCarousel items={ITEMS} />);
      move(110);

      expect(row(container)).toHaveAttribute("data-peeking");
      unmount();
    }
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

describe("?peekRight=", () => {
  it("defaults to the ?blur= behaviour: no strip on edge, the static strip on peek", () => {
    const { container, unmount } = render(<HomeCarousel items={ITEMS} />);
    expect(container.querySelector(".car-peek:not(.car-peek-edge)")).toBeNull();
    unmount();

    window.history.pushState({}, "", "/?blur=peek");
    const peek = render(<HomeCarousel items={ITEMS} />);
    expect(
      peek.container.querySelector(".car-peek:not(.car-peek-edge)"),
    ).not.toBeNull();
  });

  it("static shows the always-on strip even without ?blur=peek", () => {
    window.history.pushState({}, "", "/?peekRight=static");
    const { container } = render(<HomeCarousel items={ITEMS} />);

    expect(
      container.querySelector(".car-peek:not(.car-peek-edge)"),
    ).not.toBeNull();
    expect(row(container)).toHaveAttribute("data-blur", "peek");
  });

  it("none governs the right edge over ?blur=peek", () => {
    window.history.pushState({}, "", "/?blur=peek&peekRight=none");
    const { container } = render(<HomeCarousel items={ITEMS} />);

    expect(container.querySelector(".car-peek:not(.car-peek-edge)")).toBeNull();
    expect(strip(container, "right")).toBeNull();
  });

  it("hover mirrors the left: last card pushed in, next item peeks, click steps forward", () => {
    window.history.pushState({}, "", "/?peekRight=hover");
    const { container } = render(<HomeCarousel items={ITEMS} />);
    const right = strip(container, "right")!;

    expect(right.textContent).toContain("Systems");
    expect(right).toHaveAttribute("inert");

    move(1090);

    const push = pushes(card(container, 3))[0];
    expect(push.keyframes["--car-r"]).toEqual(["0px", "32px"]);
    expect(push.keyframes["--car-x"][0]).toBe(push.keyframes["--car-x"][1]);
    expect(row(container)).toHaveAttribute("data-peeking");
    const slide = recorded.find(
      (r) => r.target === right && "--car-x" in r.keyframes,
    )!;
    expect(slide.keyframes["--car-x"]).toEqual(["1000px", "980px"]);

    fireEvent.click(row(container), { clientX: 1090, clientY: 200 });
    expect(frontTitle()).toBe("Titles");
  });

  it("hover leaves the left peek working too", () => {
    window.history.pushState({}, "", "/?peekRight=hover");
    const { container } = render(<HomeCarousel items={ITEMS} />);

    move(110);

    expect(pushes(card(container, 0))).toHaveLength(1);
    expect(pushes(card(container, 3))).toHaveLength(0);
  });
});
