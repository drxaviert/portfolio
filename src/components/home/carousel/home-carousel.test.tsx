import { act, fireEvent, render, screen, within } from "@testing-library/react";
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
  keyframes: PropertyIndexedKeyframes;
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
  recorded = [];
  stubMatchMedia(false);
  Element.prototype.animate = function animate(
    this: Element,
    keyframes: PropertyIndexedKeyframes,
  ) {
    const record: Recorded = {
      target: this,
      keyframes,
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

  it("announces the new front card politely", () => {
    render(<HomeCarousel items={ITEMS} />);

    fireEvent.keyDown(host("Systems"), { key: "ArrowRight" });

    const region = screen.getByRole("region", { name: "Selected work" });
    expect(within(region).getByText("Showing Titles")).toHaveAttribute(
      "aria-live",
      "polite",
    );
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

  it("moves with transform and clip-path only", () => {
    render(<HomeCarousel items={ITEMS} />);

    fireEvent.keyDown(host("Systems"), { key: "ArrowRight" });

    const moves = recorded.filter((r) => "transform" in r.keyframes);
    expect(moves.length).toBeGreaterThan(0);
    for (const move of moves) {
      expect(Object.keys(move.keyframes).sort()).toEqual([
        "clipPath",
        "transform",
      ]);
    }
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
