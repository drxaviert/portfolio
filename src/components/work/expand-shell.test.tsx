/* eslint-disable @next/next/no-html-link-for-pages -- the panel below is a DOM
   fixture, not a route: plain anchors keep the trap's own `a[href]` selector
   under test instead of Next's Link. */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ExpandShell } from "./expand-shell";
import { clearProgressionEntry, leaveDrawer } from "./progression";

const mocks = vi.hoisted(() => ({
  animate: vi.fn(),
  reduce: false,
  back: vi.fn(),
  push: vi.fn(),
}));

vi.mock("motion/react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("motion/react")>();

  return {
    ...actual,
    animate: mocks.animate as unknown as typeof actual.animate,
    useReducedMotion: () => mocks.reduce,
  };
});

vi.mock("next/navigation", () => ({
  useRouter: () => ({ back: mocks.back, push: mocks.push }),
}));

const SLUG = "systems-in-motion";

/**
 * The reader's panel, cut down to its tabbable shape at 1440: the focused
 * title, the article's controls and the mobile "Back to work" link, which is
 * the last node in the DOM and hidden at this width. The nav is not in here:
 * it is one element in the root layout, ahead of the panel.
 */
function ReaderStub() {
  return (
    <div className="wd-reader-panel">
      <h1 id="wd-study-title" tabIndex={-1}>
        Systems in motion
      </h1>
      <a href="/">Work</a>
      <a href="/work/title-sequence">Next project</a>
      <a href="/" data-unrendered>
        Back to work
      </a>
    </div>
  );
}

const RECT = {
  x: 0,
  y: 0,
  top: 0,
  left: 0,
  right: 10,
  bottom: 10,
  width: 10,
  height: 10,
  toJSON: () => ({}),
} as DOMRect;

const RECT_LIST = {
  length: 1,
  0: RECT,
  item: () => RECT,
} as unknown as DOMRectList;
const EMPTY_LIST = { length: 0, item: () => null } as unknown as DOMRectList;

const nativeRects = Element.prototype.getClientRects;

/** jsdom has no layout: rendered boxes come from the `data-unrendered` marker. */
function stubRenderedBoxes() {
  Element.prototype.getClientRects = function (this: Element) {
    return this.hasAttribute("data-unrendered") ? EMPTY_LIST : RECT_LIST;
  };
}

function stubMatchMedia(matches = false) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches,
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

function placeCard() {
  const card = document.createElement("a");
  card.href = `/work/${SLUG}`;
  card.dataset.workCard = SLUG;
  document.body.append(card);

  return card;
}

/** The root layout's nav, which the trap cycles after the panel. */
function placeDock() {
  const dock = document.createElement("div");
  dock.dataset.navDock = "";
  dock.innerHTML =
    '<a href="/" aria-label="Home">Home</a><a href="/play">Play</a>';
  document.body.append(dock);

  return dock;
}

function panelLayer() {
  return document.querySelector<HTMLElement>(".wd-expand-layer")!;
}

function backdrop() {
  return document.querySelector<HTMLElement>(".wd-expand-backdrop")!;
}

async function renderShell() {
  const view = render(
    <ExpandShell slug={SLUG}>
      <ReaderStub />
    </ExpandShell>,
  );

  await waitFor(() =>
    expect(panelLayer()).toHaveAttribute("data-phase", "open"),
  );

  return view;
}

beforeEach(() => {
  mocks.animate.mockReset();
  mocks.reduce = false;
  mocks.animate.mockReturnValue({
    finished: Promise.resolve(),
    complete: vi.fn(),
    stop: vi.fn(),
  });
  mocks.back.mockReset();
  mocks.push.mockReset();

  clearProgressionEntry();
  leaveDrawer();
  window.history.replaceState({ workOverlay: true }, "", `/work/${SLUG}`);
  stubMatchMedia();
  stubRenderedBoxes();

  placeDock();

  const main = document.createElement("main");
  document.body.append(main);
});

afterEach(() => {
  Element.prototype.getClientRects = nativeRects;
  document.body.innerHTML = "";
  vi.unstubAllGlobals();
});

describe("ExpandShell focus containment", () => {
  it("takes Tab off the focused title into the article, not the nav", async () => {
    await renderShell();

    document.getElementById("wd-study-title")!.focus();
    fireEvent.keyDown(document, { key: "Tab" });

    expect(document.activeElement).toBe(
      screen.getByRole("link", { name: "Work" }),
    );
  });

  it("takes Tab off the article's last control to the nav's first", async () => {
    await renderShell();

    screen.getByRole("link", { name: "Next project" }).focus();
    fireEvent.keyDown(document, { key: "Tab" });

    expect(document.activeElement).toBe(
      screen.getByRole("link", { name: "Home" }),
    );
  });

  it("wraps Tab off the nav's last control back to the article's first", async () => {
    await renderShell();

    screen.getByRole("link", { name: "Play" }).focus();
    fireEvent.keyDown(document, { key: "Tab" });

    expect(document.activeElement).toBe(
      screen.getByRole("link", { name: "Work" }),
    );
  });

  it("wraps Shift+Tab off the focused title to the nav's last control", async () => {
    await renderShell();

    document.getElementById("wd-study-title")!.focus();
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });

    expect(document.activeElement).toBe(
      screen.getByRole("link", { name: "Play" }),
    );
  });

  it("wraps Shift+Tab off the article's first control to the nav's last", async () => {
    await renderShell();

    screen.getByRole("link", { name: "Work" }).focus();
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });

    expect(document.activeElement).toBe(
      screen.getByRole("link", { name: "Play" }),
    );
  });

  it("wraps Shift+Tab off the nav's first control to the article's last", async () => {
    await renderShell();

    screen.getByRole("link", { name: "Home" }).focus();
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });

    expect(document.activeElement).toBe(
      screen.getByRole("link", { name: "Next project" }),
    );
  });

  it("leaves a Tab inside the article to the browser", async () => {
    await renderShell();

    screen.getByRole("link", { name: "Work" }).focus();

    expect(fireEvent.keyDown(document, { key: "Tab" })).toBe(true);
  });

  it("inerts the homepage while the reader is open", async () => {
    await renderShell();

    expect(document.querySelector("body > main")).toHaveAttribute("inert");
  });

  it("leaves the homepage un-inert until the morph lands", async () => {
    placeCard();
    let land!: () => void;
    mocks.animate.mockReturnValueOnce({
      finished: new Promise<void>((resolve) => (land = resolve)),
      complete: vi.fn(),
      stop: vi.fn(),
    });

    render(
      <ExpandShell slug={SLUG}>
        <ReaderStub />
      </ExpandShell>,
    );
    const main = document.querySelector("body > main")!;

    expect(panelLayer()).toHaveAttribute("data-phase", "opening");
    expect(main).not.toHaveAttribute("inert");

    land();
    await waitFor(() =>
      expect(panelLayer()).toHaveAttribute("data-phase", "open"),
    );
    expect(main).toHaveAttribute("inert");
  });

  it("never inerts the homepage when a close interrupts the morph", async () => {
    placeCard();
    mocks.animate.mockReturnValueOnce({
      finished: new Promise<void>(() => {}),
      complete: vi.fn(),
      stop: vi.fn(),
    });

    const { unmount } = render(
      <ExpandShell slug={SLUG}>
        <ReaderStub />
      </ExpandShell>,
    );
    const main = document.querySelector("body > main")!;

    fireEvent.click(backdrop());
    await waitFor(() =>
      expect(panelLayer()).toHaveAttribute("data-phase", "closing"),
    );
    expect(main).not.toHaveAttribute("inert");

    unmount();
    expect(main).not.toHaveAttribute("inert");
  });

  it("inerts the homepage at once under reduced motion", async () => {
    mocks.reduce = true;
    placeCard();
    mocks.animate.mockReturnValueOnce({
      finished: new Promise<void>(() => {}),
      complete: vi.fn(),
      stop: vi.fn(),
    });

    render(
      <ExpandShell slug={SLUG}>
        <ReaderStub />
      </ExpandShell>,
    );

    expect(panelLayer()).toHaveAttribute("data-phase", "opening");
    expect(document.querySelector("body > main")).toHaveAttribute("inert");
  });

  it("inerts the homepage at once on a direct load", () => {
    render(
      <ExpandShell slug={SLUG} resting>
        <ReaderStub />
      </ExpandShell>,
    );

    expect(document.querySelector("body > main")).toHaveAttribute("inert");
  });

  it("clears the background before returning focus to the source card", async () => {
    const card = placeCard();
    const main = document.querySelector<HTMLElement>("body > main")!;
    let inertAtFocus: boolean | null = null;

    const focus = card.focus.bind(card);
    card.focus = (...args: FocusOptions[]) => {
      inertAtFocus = main.hasAttribute("inert");
      focus(...args);
    };

    const { unmount } = await renderShell();

    fireEvent.click(backdrop());
    await waitFor(() =>
      expect(
        document.querySelector<HTMLElement>(".wd-reader-panel")!.style.opacity,
      ).toBe("0"),
    );

    unmount();

    expect(inertAtFocus).toBe(false);
    expect(document.activeElement).toBe(card);
  });

  it("returns focus to the laid-out card, not an earlier copy with no box", async () => {
    // The carousel keeps a box-less copy of the card ahead of the one on screen.
    const hidden = placeCard();
    hidden.setAttribute("data-unrendered", "");
    const card = placeCard();

    const { unmount } = await renderShell();

    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() =>
      expect(
        document.querySelector<HTMLElement>(".wd-reader-panel")!.style.opacity,
      ).toBe("0"),
    );

    unmount();

    expect(document.activeElement).toBe(card);
  });

  it("returns focus to the persistent nav when the study has no homepage card", async () => {
    const logo = screen.getByRole("link", { name: "Home" });

    const { unmount } = await renderShell();

    fireEvent.click(backdrop());
    await waitFor(() =>
      expect(
        document.querySelector<HTMLElement>(".wd-reader-panel")!.style.opacity,
      ).toBe("0"),
    );

    unmount();

    expect(document.activeElement).toBe(logo);
  });
});
