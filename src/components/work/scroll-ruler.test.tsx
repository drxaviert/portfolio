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

type Block = {
  tag: "h2" | "p" | "figure";
  text: string;
  caption?: string;
  top: number;
  height?: number;
};

/**
 * A study in the reader's own shape: a scroll container, a column, the intro
 * and the prose. jsdom has no layout, so the scroll box and every block's
 * offset are supplied here; the component reads exactly these.
 */
function mountStudy({
  blocks,
  intro = "Systems in motion",
  scrollHeight = 2600,
  clientHeight = 600,
}: {
  blocks: Block[];
  intro?: string;
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

  const isProse = document.createElement("div");
  isProse.className = "wd-reader-main";

  const introTitle = document.createElement("h1");
  introTitle.className = "wd-intro-title";
  introTitle.textContent = intro;

  const prose = document.createElement("div");
  prose.className = "wd-prose";

  const elements = blocks.map((block) => {
    const element = document.createElement(
      block.tag === "figure" ? "figure" : block.tag,
    );

    if (block.tag === "figure") {
      const caption = document.createElement("figcaption");
      caption.textContent = block.caption ?? block.text;
      element.append(caption);
    } else {
      element.textContent = block.text;
    }

    element.getBoundingClientRect = () =>
      rect(block.top, block.height ?? (block.tag === "h2" ? 20 : 60));

    return element;
  });

  prose.append(...elements);
  isProse.append(introTitle, prose);
  scroll.append(isProse);
  document.body.append(scroll);
  fixtures.push(scroll);

  return { scroll, elements, prose };
}

function ruler() {
  return screen.getByRole("navigation", { name: "Sections" });
}

function card() {
  return ruler().querySelector(".wd-ruler-card") as HTMLElement;
}

function cardTitle() {
  return ruler().querySelector(".wd-ruler-card-title")?.textContent;
}

function cardBody() {
  return ruler().querySelector(".wd-ruler-card-body")?.textContent;
}

/** A real study: four `##` sections with a paragraph under each. */
function fourSections(): Block[] {
  return [
    { tag: "h2", text: "The concept", top: 200 },
    { tag: "p", text: "The brief was one sentence long.", top: 240 },
    { tag: "h2", text: "The system", top: 700 },
    { tag: "p", text: "We wrote the brief back as three lines.", top: 740 },
    { tag: "h2", text: "The process", top: 1200 },
    {
      tag: "p",
      text: "The first prototype was deliberately plain.",
      top: 1240,
    },
    { tag: "h2", text: "The outcome", top: 1700 },
    { tag: "p", text: "What stayed is not very photogenic.", top: 1740 },
  ];
}

/** Points the track at a real box, so pointer heights mean a row. */
function layoutTrack() {
  const track = ruler().querySelector(".wd-ruler-track") as HTMLElement;
  track.getBoundingClientRect = () => rect(100, RULER_MIN_TICKS * 13);
  return (tick: number) => 100 + 13 * tick + 6;
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
    mountStudy({ blocks: fourSections() });
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
    const { elements } = mountStudy({ blocks: fourSections() });
    render(<ScrollRuler studySlug="systems-in-motion" />);

    const headings = elements.filter((el) => el.tagName === "H2");

    await waitFor(() =>
      expect(
        headings.find((el) => el.textContent === "The system"),
      ).toHaveAttribute("id", "the-system"),
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
    const { elements } = mountStudy({
      blocks: [
        { tag: "h2", text: "The system", top: 300 },
        { tag: "h2", text: "The system", top: 800 },
        { tag: "h2", text: "The system", top: 1300 },
      ],
    });
    render(<ScrollRuler studySlug="duplicates" />);

    await waitFor(() => expect(screen.getAllByRole("link")).toHaveLength(3));

    expect(elements.map((element) => element.id)).toEqual([
      "the-system",
      "the-system-2",
      "the-system-3",
    ]);
  });

  it("keeps every tick live in a study with no sections", async () => {
    mountStudy({
      blocks: [{ tag: "p", text: "Just the one paragraph.", top: 300 }],
      intro: "A short study",
    });
    render(<ScrollRuler studySlug="no-sections" />);

    await waitFor(() =>
      expect(ruler()).toHaveAttribute("data-visible", "true"),
    );

    expect(screen.queryAllByRole("link")).toHaveLength(0);
    expect(ruler().querySelectorAll(".wd-ruler-slot")).toHaveLength(
      RULER_MIN_TICKS,
    );

    const at = layoutTrack();
    fireEvent.pointerMove(ruler(), { clientY: at(8) });

    expect(cardTitle()).toBe("A short study");
    expect(cardBody()).toBe("Just the one paragraph.");
  });

  it("treats a single heading as progress only", async () => {
    mountStudy({ blocks: [{ tag: "h2", text: "The concept", top: 300 }] });
    render(<ScrollRuler studySlug="one-section" />);

    await waitFor(() =>
      expect(ruler()).toHaveAttribute("data-visible", "true"),
    );

    expect(screen.queryAllByRole("link")).toHaveLength(0);
  });

  it("gives twelve sections twelve distinct ticks", async () => {
    mountStudy({
      blocks: Array.from({ length: 12 }, (_, index) => ({
        tag: "h2" as const,
        text: `Part ${index + 1}`,
        top: 200 + index * 200,
      })),
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
      blocks: fourSections(),
      scrollHeight: 600,
    });
    render(<ScrollRuler studySlug="short-study" />);

    await waitFor(() =>
      expect(ruler()).toHaveAttribute("data-visible", "false"),
    );

    expect(screen.queryAllByRole("link")).toHaveLength(0);
  });

  it("writes the reading position as scroll progress", async () => {
    const { scroll } = mountStudy({ blocks: fourSections() });
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
    const { scroll } = mountStudy({ blocks: fourSections() });
    render(<ScrollRuler studySlug="systems-in-motion" />);

    await waitFor(() => expect(screen.getAllByRole("link")).toHaveLength(4));
    fireEvent.click(screen.getByLabelText("The process"));

    expect(scroll.scrollTo).toHaveBeenCalledWith({
      top: 1200,
      behavior: "smooth",
    });
  });

  it("jumps to the block at a plain tick, not only to sections", async () => {
    const { scroll } = mountStudy({ blocks: fourSections() });
    render(<ScrollRuler studySlug="systems-in-motion" />);

    await waitFor(() => expect(screen.getAllByRole("link")).toHaveLength(4));

    const at = layoutTrack();
    // Row 3 sits inside "The concept"'s paragraph, which starts at 240.
    fireEvent.click(ruler(), { clientY: at(3) });

    expect(scroll.scrollTo).toHaveBeenCalledWith({
      top: 240,
      behavior: "smooth",
    });
  });

  it("jumps instantly under reduced motion", async () => {
    stubMatchMedia(true);
    const { scroll } = mountStudy({ blocks: fourSections() });
    render(<ScrollRuler studySlug="systems-in-motion" />);

    await waitFor(() => expect(screen.getAllByRole("link")).toHaveLength(4));
    fireEvent.click(screen.getByLabelText("The outcome"));

    expect(scroll.scrollTo).toHaveBeenCalledWith({
      top: 1700,
      behavior: "auto",
    });
  });

  it("leaves a modified click to the browser", async () => {
    const { scroll } = mountStudy({ blocks: fourSections() });
    render(<ScrollRuler studySlug="systems-in-motion" />);

    await waitFor(() => expect(screen.getAllByRole("link")).toHaveLength(4));
    fireEvent.click(screen.getByLabelText("The system"), { metaKey: true });

    expect(scroll.scrollTo).not.toHaveBeenCalled();
  });

  it("previews the section and the text at the hovered tick", async () => {
    mountStudy({ blocks: fourSections() });
    render(<ScrollRuler studySlug="systems-in-motion" />);

    await waitFor(() => expect(screen.getAllByRole("link")).toHaveLength(4));

    const at = layoutTrack();
    fireEvent.pointerMove(ruler(), { clientY: at(6) });

    expect(ruler()).toHaveAttribute("data-active", "true");
    expect(cardTitle()).toBe("The system");
    expect(cardBody()).toBe("We wrote the brief back as three lines.");
  });

  it("keeps one card open while scrubbing, swapping its text in place", async () => {
    mountStudy({ blocks: fourSections() });
    render(<ScrollRuler studySlug="systems-in-motion" />);

    await waitFor(() => expect(screen.getAllByRole("link")).toHaveLength(4));

    const at = layoutTrack();
    fireEvent.pointerMove(ruler(), { clientY: at(2) });

    const element = card();
    expect(cardTitle()).toBe("The concept");

    fireEvent.pointerMove(ruler(), { clientY: at(10) });

    // Same node throughout: the card never closes and reopens between ticks.
    expect(card()).toBe(element);
    expect(ruler()).toHaveAttribute("data-active", "true");
    expect(cardTitle()).toBe("The process");
    expect(cardBody()).toBe("The first prototype was deliberately plain.");
  });

  it("previews an image block through its caption", async () => {
    mountStudy({
      blocks: [
        { tag: "h2", text: "The concept", top: 200 },
        { tag: "p", text: "Opening paragraph.", top: 240, height: 40 },
        {
          tag: "figure",
          text: "",
          caption: "The wall at the end of week two.",
          top: 300,
          height: 400,
        },
        { tag: "h2", text: "The system", top: 760 },
        { tag: "p", text: "We wrote the brief back.", top: 800 },
      ],
    });
    render(<ScrollRuler studySlug="caption" />);

    await waitFor(() => expect(screen.getAllByRole("link")).toHaveLength(2));

    const at = layoutTrack();
    fireEvent.pointerMove(ruler(), { clientY: at(4) });

    expect(cardTitle()).toBe("The concept");
    expect(cardBody()).toBe("The wall at the end of week two.");
  });

  it("releases the preview when the pointer leaves", async () => {
    mountStudy({ blocks: fourSections() });
    render(<ScrollRuler studySlug="systems-in-motion" />);

    await waitFor(() => expect(screen.getAllByRole("link")).toHaveLength(4));

    const at = layoutTrack();
    fireEvent.pointerMove(ruler(), { clientY: at(2) });
    fireEvent.pointerLeave(ruler());

    expect(ruler()).toHaveAttribute("data-active", "false");
  });

  it("keeps the preview while the pointer stays, even as focus moves away", async () => {
    mountStudy({ blocks: fourSections() });
    render(<ScrollRuler studySlug="systems-in-motion" />);

    await waitFor(() => expect(screen.getAllByRole("link")).toHaveLength(4));

    const at = layoutTrack();
    fireEvent.pointerMove(ruler(), { clientY: at(2) });

    // Clicking a tick blurs the section link the keyboard had reached; the
    // pointer is still on the column, so the preview must stay up.
    const link = screen.getAllByRole("link")[0];
    fireEvent.focus(link);
    fireEvent.blur(link);

    expect(ruler()).toHaveAttribute("data-active", "true");
    expect(cardTitle()).toBe("The concept");

    fireEvent.pointerLeave(ruler());
    expect(ruler()).toHaveAttribute("data-active", "false");
  });

  it("shows the preview for a focused section tick, so the keyboard gets it", async () => {
    mountStudy({ blocks: fourSections() });
    render(<ScrollRuler studySlug="systems-in-motion" />);

    await waitFor(() => expect(screen.getAllByRole("link")).toHaveLength(4));
    fireEvent.focus(screen.getByLabelText("The system"));

    expect(ruler()).toHaveAttribute("data-active", "true");
    expect(cardTitle()).toBe("The system");
  });
});
