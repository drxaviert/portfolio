import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ScrollRuler } from "./scroll-ruler";
import { READER_SCROLL_ID } from "./parts";
import { RULER_MIN_TICKS } from "./ruler-model";

const fixtures: HTMLElement[] = [];
let panel: HTMLElement;
let mountPoint: HTMLElement;

function rect(top: number, height = 20, left = 0, width = 0): DOMRect {
  return {
    top,
    left,
    right: left + width,
    bottom: top + height,
    width,
    height,
    x: left,
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
  room = 209,
}: {
  blocks: Block[];
  intro?: string;
  scrollHeight?: number;
  clientHeight?: number;
  /** Room between the column's right edge and the panel's right edge. */
  room?: number;
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

  const column = document.createElement("div");
  column.className = "wd-reader-column";
  const columnRight = 1000 - room;
  column.getBoundingClientRect = () =>
    rect(0, scrollHeight, columnRight - 582, 582);

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
  column.append(isProse);
  scroll.append(column);

  panel = document.createElement("div");
  panel.className = "wd-reader-panel";
  panel.getBoundingClientRect = () => rect(0, 800, 0, 1000);
  panel.append(scroll);

  // React owns only this wrapper, so the fixture's own DOM survives the render.
  mountPoint = document.createElement("div");
  panel.append(mountPoint);

  document.body.append(panel);
  fixtures.push(panel);

  return { scroll, elements, prose, panel, mountPoint, column };
}

/** The ruler lives inside the reader's panel, as it does in the app. */
function renderRuler(slug: string) {
  return render(<ScrollRuler studySlug={slug} />, { container: mountPoint });
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
    renderRuler("systems-in-motion");

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
    renderRuler("systems-in-motion");

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
    renderRuler("duplicates");

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
    renderRuler("no-sections");

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
    renderRuler("one-section");

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
    renderRuler("twelve");

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
    renderRuler("short-study");

    await waitFor(() =>
      expect(ruler()).toHaveAttribute("data-visible", "false"),
    );

    expect(screen.queryAllByRole("link")).toHaveLength(0);
  });

  it("sits 40px to the right of the text column", async () => {
    mountStudy({ blocks: fourSections(), room: 209 });
    renderRuler("systems-in-motion");

    await waitFor(() =>
      expect(ruler()).toHaveAttribute("data-visible", "true"),
    );

    // 209px of room, less the 18px ruler column, split evenly: it is centred.
    expect(ruler().style.getPropertyValue("--wd-ruler-right")).toBe("95.5px");
  });

  it("hides itself when the panel leaves no room beside the column", async () => {
    mountStudy({ blocks: fourSections(), room: 60 });
    renderRuler("systems-in-motion");

    await waitFor(() =>
      expect(ruler()).toHaveAttribute("data-visible", "false"),
    );

    // Hidden by its own rule, so the links leave the tab order with it.
    expect(ruler().style.getPropertyValue("--wd-ruler-right")).toBe("2px");
  });

  it("stops measuring once the drawer starts closing", async () => {
    // The close fades the ruler out; measuring through it forced a layout under
    // a scaling panel and held the frame that had to start the fade.
    const { panel } = mountStudy({ blocks: fourSections(), room: 209 });
    const layer = document.createElement("div");
    layer.className = "wd-expand-layer";
    layer.dataset.phase = "closing";
    document.body.append(layer);
    layer.append(panel);

    renderRuler("systems-in-motion");

    // The same fixture writes 95.5px while open (see the fit test above).
    await waitFor(() => expect(ruler()).toBeInTheDocument());
    expect(ruler().style.getPropertyValue("--wd-ruler-right")).toBe("");
    // Nothing measured means no ticks either: the ruler is already on its way
    // out, and the next open remounts the reader and measures afresh.
    expect(ruler()).not.toHaveAttribute("data-visible");

    layer.remove();
  });

  it("takes the ruler's width and clearance out of the fit", async () => {
    // 40px gap + 18px ruler + 16px clearance is the least it can hold.
    mountStudy({ blocks: fourSections(), room: 73 });
    renderRuler("systems-in-motion");

    await waitFor(() =>
      expect(ruler()).toHaveAttribute("data-visible", "false"),
    );
  });

  it("follows the column when it moves", async () => {
    const { column } = mountStudy({ blocks: fourSections(), room: 209 });
    renderRuler("systems-in-motion");

    await waitFor(() =>
      expect(ruler()).toHaveAttribute("data-visible", "true"),
    );
    expect(ruler().style.getPropertyValue("--wd-ruler-right")).toBe("95.5px");

    // The panel narrowed: the column keeps its 582px cap and its edge moves in.
    column.getBoundingClientRect = () => rect(0, 2600, 1000 - 90 - 582, 582);
    fireEvent(window, new Event("resize"));

    await waitFor(() =>
      expect(ruler().style.getPropertyValue("--wd-ruler-right")).toBe("32px"),
    );
    expect(ruler()).toHaveAttribute("data-visible", "true");
  });

  it("holds its tick until a section crosses the landing line", async () => {
    const { scroll } = mountStudy({ blocks: fourSections() });
    renderRuler("systems-in-motion");

    await waitFor(() =>
      expect(ruler()).toHaveAttribute("data-visible", "true"),
    );

    // The top of the article: the first tick, before any section has arrived.
    expect(ruler()).toHaveAttribute("data-indicator", "0");

    scroll.scrollTop = 300;
    fireEvent.scroll(scroll);
    await waitFor(() => expect(ruler()).toHaveAttribute("data-indicator", "2"));

    // Inside the same section the mark does not move at all.
    scroll.scrollTop = 650;
    fireEvent.scroll(scroll);
    await new Promise((resolve) => setTimeout(resolve, 40));
    expect(ruler()).toHaveAttribute("data-indicator", "2");

    // The next heading crosses its line at 700.
    scroll.scrollTop = 700;
    fireEvent.scroll(scroll);
    await waitFor(() => expect(ruler()).toHaveAttribute("data-indicator", "6"));
  });

  it("takes the last section at the bottom of the article", async () => {
    const { scroll } = mountStudy({ blocks: fourSections() });
    renderRuler("systems-in-motion");

    await waitFor(() =>
      expect(ruler()).toHaveAttribute("data-visible", "true"),
    );

    scroll.scrollTop = 2000;
    fireEvent.scroll(scroll);

    await waitFor(() =>
      expect(ruler()).toHaveAttribute("data-indicator", "14"),
    );
  });

  it("jumps to a section's heading when its tick is clicked", async () => {
    const { scroll } = mountStudy({ blocks: fourSections() });
    renderRuler("systems-in-motion");

    await waitFor(() => expect(screen.getAllByRole("link")).toHaveLength(4));
    fireEvent.click(screen.getByLabelText("The process"));

    expect(scroll.scrollTo).toHaveBeenCalledWith({
      top: 1200,
      behavior: "smooth",
    });
  });

  it("moves once to the clicked tick, not through the sections between", async () => {
    const { scroll } = mountStudy({ blocks: fourSections() });
    renderRuler("systems-in-motion");

    await waitFor(() => expect(screen.getAllByRole("link")).toHaveLength(4));

    scroll.scrollTop = 0;
    fireEvent.click(screen.getByLabelText("The process"));

    expect(ruler()).toHaveAttribute("data-indicator", "10");

    // The smooth scroll passes the first two sections on its way there.
    scroll.scrollTop = 400;
    fireEvent.scroll(scroll);
    await new Promise((resolve) => setTimeout(resolve, 40));
    expect(ruler()).toHaveAttribute("data-indicator", "10");

    scroll.scrollTop = 1200;
    fireEvent.scroll(scroll);
    await new Promise((resolve) => setTimeout(resolve, 40));
    expect(ruler()).toHaveAttribute("data-indicator", "10");
  });

  it("lands a plain tick's jump on the section that tick belongs to", async () => {
    const { scroll } = mountStudy({ blocks: fourSections() });
    renderRuler("systems-in-motion");

    await waitFor(() => expect(screen.getAllByRole("link")).toHaveLength(4));

    const at = layoutTrack();
    // Row 3 is inside "The concept"'s paragraph, so its section is the one
    // above it, tick 2 — the mark must not stop on the plain tick.
    fireEvent.click(ruler(), { clientY: at(3) });

    expect(scroll.scrollTo).toHaveBeenCalledWith({
      top: 240,
      behavior: "smooth",
    });
    expect(ruler()).toHaveAttribute("data-indicator", "2");
  });

  it("jumps to the block at a plain tick, not only to sections", async () => {
    const { scroll } = mountStudy({ blocks: fourSections() });
    renderRuler("systems-in-motion");

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
    renderRuler("systems-in-motion");

    await waitFor(() => expect(screen.getAllByRole("link")).toHaveLength(4));
    fireEvent.click(screen.getByLabelText("The outcome"));

    expect(scroll.scrollTo).toHaveBeenCalledWith({
      top: 1700,
      behavior: "auto",
    });
  });

  it("leaves a modified click to the browser", async () => {
    const { scroll } = mountStudy({ blocks: fourSections() });
    renderRuler("systems-in-motion");

    await waitFor(() => expect(screen.getAllByRole("link")).toHaveLength(4));
    fireEvent.click(screen.getByLabelText("The system"), { metaKey: true });

    expect(scroll.scrollTo).not.toHaveBeenCalled();
  });

  it("previews the section and the text at the hovered tick", async () => {
    mountStudy({ blocks: fourSections() });
    renderRuler("systems-in-motion");

    await waitFor(() => expect(screen.getAllByRole("link")).toHaveLength(4));

    const at = layoutTrack();
    fireEvent.pointerMove(ruler(), { clientY: at(6) });

    expect(ruler()).toHaveAttribute("data-active", "true");
    expect(cardTitle()).toBe("The system");
    expect(cardBody()).toBe("We wrote the brief back as three lines.");
  });

  it("keeps one card open while scrubbing, swapping its text in place", async () => {
    mountStudy({ blocks: fourSections() });
    renderRuler("systems-in-motion");

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
    renderRuler("caption");

    await waitFor(() => expect(screen.getAllByRole("link")).toHaveLength(2));

    const at = layoutTrack();
    fireEvent.pointerMove(ruler(), { clientY: at(4) });

    expect(cardTitle()).toBe("The concept");
    expect(cardBody()).toBe("The wall at the end of week two.");
  });

  it("releases the preview when the pointer leaves", async () => {
    mountStudy({ blocks: fourSections() });
    renderRuler("systems-in-motion");

    await waitFor(() => expect(screen.getAllByRole("link")).toHaveLength(4));

    const at = layoutTrack();
    fireEvent.pointerMove(ruler(), { clientY: at(2) });
    fireEvent.pointerLeave(ruler());

    expect(ruler()).toHaveAttribute("data-active", "false");
  });

  it("keeps the preview while the pointer stays, even as focus moves away", async () => {
    mountStudy({ blocks: fourSections() });
    renderRuler("systems-in-motion");

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
    renderRuler("systems-in-motion");

    await waitFor(() => expect(screen.getAllByRole("link")).toHaveLength(4));
    fireEvent.focus(screen.getByLabelText("The system"));

    expect(ruler()).toHaveAttribute("data-active", "true");
    expect(cardTitle()).toBe("The system");
  });
});
