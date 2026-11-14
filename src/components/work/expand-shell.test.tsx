/* eslint-disable @next/next/no-html-link-for-pages -- the panel below is a DOM
   fixture, not a route: plain anchors keep the trap's own `a[href]` selector
   under test instead of Next's Link. */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ExpandShell } from "./expand-shell";

const mocks = vi.hoisted(() => ({
  animate: vi.fn(),
  back: vi.fn(),
  push: vi.fn(),
}));

vi.mock("motion/react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("motion/react")>();

  return {
    ...actual,
    animate: mocks.animate as unknown as typeof actual.animate,
  };
});

vi.mock("next/navigation", () => ({
  useRouter: () => ({ back: mocks.back, push: mocks.push }),
}));

const SLUG = "systems-in-motion";

/**
 * The reader's panel, cut down to its tabbable shape at 1440: the nav, the
 * focused title, the article's controls and the mobile "Back to work" link,
 * which is the last node in the DOM and hidden at this width.
 */
function ReaderStub() {
  return (
    <div className="wd-reader-panel">
      <nav>
        <a href="/">Home</a>
      </nav>
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

const RECT_LIST = { length: 1, 0: RECT, item: () => RECT } as unknown as DOMRectList;
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
  mocks.animate.mockReturnValue({
    finished: Promise.resolve(),
    complete: vi.fn(),
    stop: vi.fn(),
  });
  mocks.back.mockReset();
  mocks.push.mockReset();

  window.history.replaceState({ workOverlay: true }, "", `/work/${SLUG}`);
  stubMatchMedia();
  stubRenderedBoxes();

  const main = document.createElement("main");
  document.body.append(main);
});

afterEach(() => {
  Element.prototype.getClientRects = nativeRects;
  document.body.innerHTML = "";
  vi.unstubAllGlobals();
});

describe("ExpandShell focus containment", () => {
  it("wraps Tab from the last rendered control, not the hidden one", async () => {
    await renderShell();

    screen.getByRole("link", { name: "Next project" }).focus();
    fireEvent.keyDown(document, { key: "Tab" });

    expect(document.activeElement).toBe(
      screen.getByRole("link", { name: "Home" }),
    );
  });

  it("takes Tab off the focused title to the first control", async () => {
    await renderShell();

    document.getElementById("wd-study-title")!.focus();
    fireEvent.keyDown(document, { key: "Tab" });

    expect(document.activeElement).toBe(
      screen.getByRole("link", { name: "Home" }),
    );
  });

  it("wraps Shift+Tab from the focused title to the last rendered control", async () => {
    await renderShell();

    document.getElementById("wd-study-title")!.focus();
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });

    expect(document.activeElement).toBe(
      screen.getByRole("link", { name: "Next project" }),
    );
  });

  it("inerts the homepage while the reader is open", async () => {
    await renderShell();

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
      expect(document.querySelector<HTMLElement>(".wd-reader-panel")!.style.opacity).toBe("0"),
    );

    unmount();

    expect(inertAtFocus).toBe(false);
    expect(document.activeElement).toBe(card);
  });

  it("returns focus to the nav when the study has no homepage card", async () => {
    const home = document.querySelector<HTMLElement>("body > main")!;
    const logo = document.createElement("a");
    logo.href = "/";
    logo.setAttribute("aria-label", "Home");
    home.append(logo);

    const { unmount } = await renderShell();

    fireEvent.click(backdrop());
    await waitFor(() =>
      expect(document.querySelector<HTMLElement>(".wd-reader-panel")!.style.opacity).toBe("0"),
    );

    unmount();

    expect(document.activeElement).toBe(logo);
  });
});
