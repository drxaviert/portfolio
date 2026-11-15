import { act, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Box } from "./morph";
import { flipFrom } from "./morph";
import { ExpandShell } from "./expand-shell";
import { findCard } from "./use-morph";

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

const CARD_A: Box = { left: 100, top: 200, width: 753, height: 416 };
const CARD_B: Box = { left: 50, top: 60, width: 720, height: 450 };
// jsdom has no layout, so the untransformed panel box comes from offsetLeft
// (0 here) plus the mocked rect width and height.
const PANEL: Box = { left: 0, top: 0, width: 1408, height: 868 };

function toDomRect(box: Box): DOMRect {
  return {
    ...box,
    right: box.left + box.width,
    bottom: box.top + box.height,
    x: box.left,
    y: box.top,
    toJSON: () => box,
  } as DOMRect;
}

/** A page card. Re-reading the rect on every call is what close depends on. */
function placeCard(rect: Box) {
  document.body.innerHTML = "";

  const card = document.createElement("a");
  card.dataset.workCard = SLUG;

  const title = document.createElement("h1");
  title.textContent = "Systems in motion";
  card.append(title);

  card.getBoundingClientRect = () => toDomRect(rect);
  document.body.append(card);

  return {
    setRect(next: Box) {
      card.getBoundingClientRect = () => toDomRect(next);
    },
  };
}

function ReaderStub() {
  return (
    <div className="wd-reader-panel">
      <div className="wd-reader-scroll">
        <h1 id="wd-study-title">Systems in motion</h1>
      </div>
    </div>
  );
}

function panelElement() {
  return document.querySelector<HTMLElement>(".wd-reader-panel")!;
}

function layerElement() {
  return document.querySelector<HTMLElement>(".wd-expand-layer")!;
}

const nativeRect = HTMLElement.prototype.getBoundingClientRect;

beforeEach(() => {
  mocks.animate.mockReset();
  mocks.animate.mockReturnValue({
    finished: Promise.resolve(),
    complete: vi.fn(),
    stop: vi.fn(),
  });
  mocks.reduce = false;
  mocks.back.mockReset();
  mocks.push.mockReset();

  window.history.replaceState({}, "", "/work/systems-in-motion");

  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  );

  HTMLElement.prototype.getBoundingClientRect = function () {
    if (this.classList?.contains("wd-reader-panel")) {
      return toDomRect(PANEL);
    }

    return nativeRect.call(this);
  };
});

afterEach(() => {
  vi.useRealTimers();
  HTMLElement.prototype.getBoundingClientRect = nativeRect;
  document.body.innerHTML = "";
  vi.unstubAllGlobals();
});

describe("findCard", () => {
  it("returns null when no card exists for the slug", () => {
    document.body.innerHTML = "";

    expect(findCard(SLUG)).toBeNull();
  });

  it("reads the card's live rect on every call", () => {
    const card = placeCard(CARD_A);

    expect(findCard(SLUG)).toEqual(CARD_A);

    card.setRect(CARD_B);

    expect(findCard(SLUG)).toEqual(CARD_B);
  });
});

describe("ExpandShell", () => {
  it("holds the panel opaque when the study has no source card", async () => {
    document.body.innerHTML = "";

    render(
      <ExpandShell slug={SLUG}>
        <ReaderStub />
      </ExpandShell>,
    );

    await waitFor(() =>
      expect(layerElement()).toHaveAttribute("data-phase", "open"),
    );

    const panel = panelElement();
    const open = mocks.animate.mock.calls.filter(
      ([element]) => element === panel,
    );

    expect(open).toHaveLength(0);
    expect(panel.style.opacity).toBe("");
  });

  it("keeps the 120ms opacity fade for a card-less open under reduced motion", async () => {
    document.body.innerHTML = "";
    mocks.reduce = true;

    render(
      <ExpandShell slug={SLUG}>
        <ReaderStub />
      </ExpandShell>,
    );

    await waitFor(() =>
      expect(layerElement()).toHaveAttribute("data-phase", "open"),
    );

    const panel = panelElement();
    const open = mocks.animate.mock.calls.filter(
      ([element]) => element === panel,
    );

    expect(open).toHaveLength(1);
    expect(open[0][1]).toEqual({ opacity: 1 });
    expect(open[0][2]).toMatchObject({ duration: 0.12, ease: "easeOut" });
  });

  it("starts the content entrance 120ms before the morph lands", async () => {
    placeCard(CARD_A);
    mocks.animate.mockReturnValue({
      finished: new Promise(() => {}),
      complete: vi.fn(),
      stop: vi.fn(),
    });
    vi.useFakeTimers();

    render(
      <ExpandShell slug={SLUG}>
        <ReaderStub />
      </ExpandShell>,
    );

    expect(layerElement()).toHaveAttribute("data-reveal", "pending");

    act(() => {
      vi.advanceTimersByTime(359);
    });
    expect(layerElement()).toHaveAttribute("data-reveal", "pending");

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(layerElement()).toHaveAttribute("data-reveal", "on");
  });

  it("releases the content at once when there is no morph to wait for", async () => {
    document.body.innerHTML = "";

    render(
      <ExpandShell slug={SLUG}>
        <ReaderStub />
      </ExpandShell>,
    );

    await waitFor(() =>
      expect(layerElement()).toHaveAttribute("data-reveal", "on"),
    );
  });

  it("drops a pending entrance when the reader closes mid-morph", async () => {
    placeCard(CARD_A);
    mocks.animate.mockReturnValue({
      finished: new Promise(() => {}),
      complete: vi.fn(),
      stop: vi.fn(),
    });
    vi.useFakeTimers();

    render(
      <ExpandShell slug={SLUG}>
        <ReaderStub />
      </ExpandShell>,
    );

    act(() => {
      fireEvent.click(
        document.querySelector<HTMLElement>(".wd-expand-backdrop")!,
      );
    });
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(layerElement()).toHaveAttribute("data-phase", "closing");
    expect(layerElement()).toHaveAttribute("data-reveal", "pending");
  });

  it("does not render or animate a separate title clone", async () => {
    placeCard(CARD_A);

    const view = render(
      <ExpandShell slug={SLUG}>
        <ReaderStub />
      </ExpandShell>,
    );

    await waitFor(() =>
      expect(layerElement()).toHaveAttribute("data-phase", "open"),
    );

    // Only the panel moves: no fixed title element, and no animation on
    // anything but the panel (the nav lives outside this tree).
    expect(document.querySelector(".wd-title-fly")).toBeNull();
    const animated = new Set(
      mocks.animate.mock.calls.map(([element]) => element as Element),
    );
    expect([...animated]).toEqual([panelElement()]);

    view.unmount();
  });

  it("measures the card again for the close morph", async () => {
    const card = placeCard(CARD_A);

    render(
      <ExpandShell slug={SLUG}>
        <ReaderStub />
      </ExpandShell>,
    );

    await waitFor(() =>
      expect(layerElement()).toHaveAttribute("data-phase", "open"),
    );

    const panel = panelElement();
    const closePose = flipFrom(CARD_B, PANEL);

    card.setRect(CARD_B);
    fireEvent.click(
      document.querySelector<HTMLElement>(".wd-expand-backdrop")!,
    );

    await waitFor(() => expect(panel.style.opacity).toBe("0"));

    const calls = mocks.animate.mock.calls.filter(
      ([element]) => element === panel,
    );
    const close = calls[calls.length - 1][1];

    expect(close).toMatchObject(closePose);
    expect(close.scaleX).toBeCloseTo(720 / 1408);
    expect(close.scaleY).toBeCloseTo(450 / 868);
  });

  it("goes back when the entry is the in-app overlay", async () => {
    placeCard(CARD_A);

    render(
      <ExpandShell slug={SLUG}>
        <ReaderStub />
      </ExpandShell>,
    );

    await waitFor(() =>
      expect(layerElement()).toHaveAttribute("data-phase", "open"),
    );

    fireEvent.click(
      document.querySelector<HTMLElement>(".wd-expand-backdrop")!,
    );

    await waitFor(() => expect(mocks.back).toHaveBeenCalledTimes(1));
    expect(mocks.push).not.toHaveBeenCalled();
  });

  it("pushes home when the entry is not marked as the in-app overlay", async () => {
    placeCard(CARD_A);

    render(
      <ExpandShell slug={SLUG}>
        <ReaderStub />
      </ExpandShell>,
    );

    await waitFor(() =>
      expect(layerElement()).toHaveAttribute("data-phase", "open"),
    );

    window.history.replaceState({}, "");
    fireEvent.click(
      document.querySelector<HTMLElement>(".wd-expand-backdrop")!,
    );

    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/"));
    expect(mocks.back).not.toHaveBeenCalled();
  });

  it("stays put when the route already left the reader", async () => {
    placeCard(CARD_A);

    render(
      <ExpandShell slug={SLUG}>
        <ReaderStub />
      </ExpandShell>,
    );

    await waitFor(() =>
      expect(layerElement()).toHaveAttribute("data-phase", "open"),
    );

    const panel = panelElement();
    window.history.replaceState({}, "", "/");
    fireEvent.click(
      document.querySelector<HTMLElement>(".wd-expand-backdrop")!,
    );

    await waitFor(() => expect(panel.style.opacity).toBe("0"));
    expect(mocks.back).not.toHaveBeenCalled();
    expect(mocks.push).not.toHaveBeenCalled();
  });
});
