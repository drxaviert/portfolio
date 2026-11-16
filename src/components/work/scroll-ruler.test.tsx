import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ScrollRuler } from "./scroll-ruler";
import { READER_SCROLL_ID } from "./parts";
import { RULER_MIN_TICKS } from "./ruler-model";

const fixtures: HTMLElement[] = [];

function rect(top: number, height = 20): DOMRect {
  return {
    top,
    left: 0,
    right: 0,
    bottom: top + height,
    width: 0,
    height,
    x: 0,
    y: top,
    toJSON: () => ({}),
  } as DOMRect;
}

function stubMatchMedia(reduce: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches: reduce && query === "(prefers-reduced-motion: reduce)",
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

/**
 * A study in the reader's own shape: a scroll container, a column, the prose.
 * jsdom has no layout, so the scroll box, its height and each heading's offset
 * are supplied here; the component reads exactly these.
 */
function mountStudy({
  sections,
  tops,
  scrollHeight = 2600,
  clientHeight = 600,
}: {
  sections: string[];
  tops: number[];
  scrollHeight?: number;
  clientHeight?: number;
}) {
  const scroll = document.createElement("div");
  scroll.id = READER_SCROLL_ID;
  Object.defineProperty(scroll, "clientHeight", {
    configurable: true,
    get: () => clientHeight,
  });
  Object.defineProperty(scroll, "scrollHeight", {
    configurable: true,
    get: () => scrollHeight,
  });
  scroll.getBoundingClientRect = () => rect(0, clientHeight);
  scroll.scrollTo = vi.fn();

  const prose = document.createElement("div");
  prose.className = "wd-prose";

  const headings = sections.map((text, index) => {
    const heading = document.createElement("h2");
    heading.className = "wd-h2";
    heading.textContent = text;
    heading.getBoundingClientRect = () => rect(tops[index]);
    return heading;
  });

  prose.append(...headings);
  scroll.append(prose);
  document.body.append(scroll);
  fixtures.push(scroll);

  return { scroll, headings };
}

function ruler() {
  return screen.getByRole("navigation", { name: "Sections" });
}

/** The sections of a real study: four `##` headings, evenly spread. */
function fourSections() {
  return mountStudy({
    sections: ["The concept", "The system", "The process", "The outcome"],
    tops: [200, 700, 1200, 1700],
  });
}

beforeEach(() => {
  stubMatchMedia(false);
});

afterEach(() => {
  vi.unstubAllGlobals();
  fixtures.splice(0).forEach((node) => node.remove());
});

describe("ScrollRuler", () => {
  it("draws the reference ruler's 17 ticks and one link per section", async () => {
    fourSections();
    render(<ScrollRuler studySlug="systems-in-motion" />);

    await waitFor(() =>
      expect(ruler().querySelectorAll(".wd-ruler-slot")).toHaveLength(
        RULER_MIN_TICKS,
      ),
    );

    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(4);
    expect(links.map((link) => link.getAttribute("aria-label"))).toEqual([
      "The concept",
      "The system",
      "The process",
      "The outcome",
    ]);
  });

  it("generates the heading ids the links point at", async () => {
    const { headings } = fourSections();
    render(<ScrollRuler studySlug="systems-in-motion" />);

    await waitFor(() =>
      expect(headings[1]).toHaveAttribute("id", "the-system"),
    );

    for (const heading of headings) {
      expect(screen.getByLabelText(heading.textContent!)).toHaveAttribute(
        "href",
        `#${heading.id}`,
      );
      expect(document.getElementById(heading.id)).toBe(heading);
    }
  });

  it("de-duplicates headings with the same text", async () => {
    const { headings } = mountStudy({
      sections: ["The system", "The system", "The system"],
      tops: [300, 800, 1300],
    });
    render(<ScrollRuler studySlug="duplicates" />);

    await waitFor(() => expect(screen.getAllByRole("link")).toHaveLength(3));

    expect(headings.map((heading) => heading.id)).toEqual([
      "the-system",
      "the-system-2",
      "the-system-3",
    ]);
  });

  it("shows the progress tick but no section marks with no headings", async () => {
    mountStudy({ sections: [], tops: [] });
    render(<ScrollRuler studySlug="no-sections" />);

    await waitFor(() =>
      expect(ruler()).toHaveAttribute("data-visible", "true"),
    );

    expect(screen.queryAllByRole("link")).toHaveLength(0);
    expect(ruler().querySelector(".wd-ruler-indicator")).not.toBeNull();
  });

  it("treats a single heading as progress only", async () => {
    mountStudy({ sections: ["The concept"], tops: [300] });
    render(<ScrollRuler studySlug="one-section" />);

    await waitFor(() =>
      expect(ruler()).toHaveAttribute("data-visible", "true"),
    );

    expect(screen.queryAllByRole("link")).toHaveLength(0);
  });

  it("gives twelve sections twelve distinct ticks", async () => {
    mountStudy({
      sections: Array.from({ length: 12 }, (_, index) => `Part ${index + 1}`),
      tops: Array.from({ length: 12 }, (_, index) => 200 + index * 200),
    });
    render(<ScrollRuler studySlug="twelve" />);

    await waitFor(() => expect(screen.getAllByRole("link")).toHaveLength(12));

    const ticks = new Set(
      screen.getAllByRole("link").map((link) => link.parentElement),
    );
    expect(ticks.size).toBe(12);
  });

  it("has no ruler at all in a study that does not scroll", async () => {
    mountStudy({
      sections: ["The concept", "The system"],
      tops: [200, 700],
      scrollHeight: 600,
    });
    render(<ScrollRuler studySlug="short-study" />);

    await waitFor(() =>
      expect(ruler()).toHaveAttribute("data-visible", "false"),
    );

    expect(screen.queryAllByRole("link")).toHaveLength(0);
  });

  it("writes the reading position as scroll progress", async () => {
    const { scroll } = fourSections();
    render(<ScrollRuler studySlug="systems-in-motion" />);

    await waitFor(() =>
      expect(ruler()).toHaveAttribute("data-visible", "true"),
    );

    scroll.scrollTop = 1000;
    fireEvent.scroll(scroll);

    await waitFor(() =>
      expect(ruler().style.getPropertyValue("--wd-ruler-progress")).toBe(
        "0.5000",
      ),
    );
  });

  it("jumps to a section's heading when its tick is clicked", async () => {
    const { scroll } = fourSections();
    render(<ScrollRuler studySlug="systems-in-motion" />);

    await waitFor(() => expect(screen.getAllByRole("link")).toHaveLength(4));
    fireEvent.click(screen.getByLabelText("The process"));

    expect(scroll.scrollTo).toHaveBeenCalledWith({
      top: 1200,
      behavior: "smooth",
    });
  });

  it("jumps instantly under reduced motion", async () => {
    stubMatchMedia(true);
    const { scroll } = fourSections();
    render(<ScrollRuler studySlug="systems-in-motion" />);

    await waitFor(() => expect(screen.getAllByRole("link")).toHaveLength(4));
    fireEvent.click(screen.getByLabelText("The outcome"));

    expect(scroll.scrollTo).toHaveBeenCalledWith({
      top: 1700,
      behavior: "auto",
    });
  });

  it("leaves a modified click to the browser", async () => {
    const { scroll } = fourSections();
    render(<ScrollRuler studySlug="systems-in-motion" />);

    await waitFor(() => expect(screen.getAllByRole("link")).toHaveLength(4));
    fireEvent.click(screen.getByLabelText("The system"), { metaKey: true });

    expect(scroll.scrollTo).not.toHaveBeenCalled();
  });

  it("snaps a click near a tick to the nearest section", async () => {
    const { scroll } = fourSections();
    render(<ScrollRuler studySlug="systems-in-motion" />);

    await waitFor(() => expect(screen.getAllByRole("link")).toHaveLength(4));

    const track = ruler().querySelector(".wd-ruler-track") as HTMLElement;
    // Rows of 13px from the top of the track: row 14 is the fourth section.
    track.getBoundingClientRect = () => rect(100, RULER_MIN_TICKS * 13);

    fireEvent.click(ruler(), { clientY: 100 + 13 * 14 + 6 });

    expect(scroll.scrollTo).toHaveBeenCalledWith({
      top: 1700,
      behavior: "smooth",
    });
  });

  it("names the hovered section in the margin", async () => {
    fourSections();
    render(<ScrollRuler studySlug="systems-in-motion" />);

    await waitFor(() => expect(screen.getAllByRole("link")).toHaveLength(4));

    const track = ruler().querySelector(".wd-ruler-track") as HTMLElement;
    track.getBoundingClientRect = () => rect(100, RULER_MIN_TICKS * 13);

    fireEvent.pointerMove(ruler(), { clientY: 100 + 13 * 10 + 6 });

    expect(ruler()).toHaveAttribute("data-active", "true");
    expect(ruler().querySelector(".wd-ruler-label")).toHaveTextContent(
      "The process",
    );
  });

  it("shows the label for a focused tick, so the keyboard gets it too", async () => {
    fourSections();
    render(<ScrollRuler studySlug="systems-in-motion" />);

    await waitFor(() => expect(screen.getAllByRole("link")).toHaveLength(4));
    fireEvent.focus(screen.getByLabelText("The system"));

    expect(ruler()).toHaveAttribute("data-active", "true");
    expect(ruler().querySelector(".wd-ruler-label")).toHaveTextContent(
      "The system",
    );
  });
});
