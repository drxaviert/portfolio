import { act, fireEvent, render, waitFor } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Box } from "./morph";
import { flipFrom } from "./morph";
import { ExpandShell } from "./expand-shell";
import { findCard } from "./use-morph";
import {
  announceProgressionEntry,
  clearProgressionEntry,
  leaveDrawer,
} from "./progression";
import { registerNavDock } from "@/components/nav/nav-flight";
import {
  CAROUSEL_CLOSE_EASE,
  CAROUSEL_CLOSE_S,
  CAROUSEL_EASE,
  CAROUSEL_OPEN_S,
} from "./carousel-step";

const mocks = vi.hoisted(() => ({
  animate: vi.fn(),
  reduce: false,
  back: vi.fn(),
  push: vi.fn(),
  replace: vi.fn(),
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
  useRouter: () => ({
    back: mocks.back,
    push: mocks.push,
    replace: mocks.replace,
  }),
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
function placeCard(rect: Box, slug = SLUG) {
  document.body.innerHTML = "";

  return addCard(rect, slug);
}

function addCard(rect: Box, slug = SLUG) {
  const card = document.createElement("a");
  card.dataset.workCard = slug;

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
  mocks.replace.mockReset();

  clearProgressionEntry();
  leaveDrawer();
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

  it("starts the content entrance 300ms before the 900ms flight lands", async () => {
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
      vi.advanceTimersByTime(599);
    });
    expect(layerElement()).toHaveAttribute("data-reveal", "pending");

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(layerElement()).toHaveAttribute("data-reveal", "on");
  });

  it("releases the content on the reveal timer even when effects re-run", async () => {
    // StrictMode remounts effects in development: the entrance timer must
    // survive that, or the cascade only starts when the morph settles 300ms
    // later (the T13 report's dev-only delay).
    placeCard(CARD_A);
    mocks.animate.mockReturnValue({
      finished: new Promise(() => {}),
      complete: vi.fn(),
      stop: vi.fn(),
    });
    vi.useFakeTimers();

    render(
      <StrictMode>
        <ExpandShell slug={SLUG}>
          <ReaderStub />
        </ExpandShell>
      </StrictMode>,
    );

    act(() => {
      vi.advanceTimersByTime(600);
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

  it("replaces home when the entry is not marked as the in-app overlay", async () => {
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

    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith("/"));
    expect(mocks.back).not.toHaveBeenCalled();
  });

  it("starts a direct load open and resting, without an open morph", async () => {
    placeCard(CARD_A);

    render(
      <ExpandShell slug={SLUG} resting>
        <ReaderStub />
      </ExpandShell>,
    );

    // No morph and no nav flight: the reader is already where it belongs.
    expect(layerElement()).toHaveAttribute("data-phase", "open");
    expect(layerElement()).toHaveAttribute("data-reveal", "on");
    expect(mocks.animate).not.toHaveBeenCalled();
    // The homepage underneath is resting, and the entry is not the in-app
    // overlay (closing replaces it instead of going back).
    expect(document.documentElement.dataset.entrancePlayed).toBe("true");
    expect(window.history.state?.workOverlay).toBeUndefined();
    // Exactly what a settled open morph leaves: the FLIP pose is measured from
    // the panel's top-left corner, so the resting panel must carry that origin.
    expect(panelElement().style.transformOrigin).toBe("left top");
  });

  it("gives a direct load and a soft open the same close origin", async () => {
    placeCard(CARD_A);

    const resting = render(
      <ExpandShell slug={SLUG} resting>
        <ReaderStub />
      </ExpandShell>,
    );
    const restingOrigin = panelElement().style.transformOrigin;
    resting.unmount();
    document.body.innerHTML = "";
    // A fresh open from the homepage, not a study swap.
    leaveDrawer();

    placeCard(CARD_A);
    render(
      <ExpandShell slug={SLUG}>
        <ReaderStub />
      </ExpandShell>,
    );

    await waitFor(() =>
      expect(layerElement()).toHaveAttribute("data-phase", "open"),
    );

    // The soft open's morph settles to the same inline origin.
    expect(panelElement().style.transformOrigin).toBe(restingOrigin);
  });

  it("flips a direct load's panel into its card and replaces the entry", async () => {
    placeCard(CARD_A);

    render(
      <ExpandShell slug={SLUG} resting>
        <ReaderStub />
      </ExpandShell>,
    );

    const panel = document.querySelector<HTMLElement>(
      ".wd-expand-layer .wd-reader-panel",
    )!;
    fireEvent.click(
      document.querySelector<HTMLElement>(".wd-expand-backdrop")!,
    );

    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith("/"));
    expect(mocks.back).not.toHaveBeenCalled();

    const close = mocks.animate.mock.calls.filter(([el]) => el === panel);
    const pose = close[close.length - 1][1];
    expect(pose).toMatchObject(flipFrom(CARD_A, PANEL));
  });

  it("closes a card-less overlay on the close flight", async () => {
    document.body.innerHTML = "";
    const toHome = vi.fn(() => Promise.resolve());
    const unregister = registerNavDock({
      toReader: vi.fn(() => Promise.resolve()),
      toHome,
    });

    render(
      <ExpandShell slug={SLUG}>
        <ReaderStub />
      </ExpandShell>,
    );

    await waitFor(() =>
      expect(layerElement()).toHaveAttribute("data-phase", "open"),
    );

    const panel = document.querySelector<HTMLElement>(
      ".wd-expand-layer .wd-reader-panel",
    )!;
    fireEvent.click(
      document.querySelector<HTMLElement>(".wd-expand-backdrop")!,
    );

    await waitFor(() => expect(panel.style.opacity).toBe("0"));

    const close = mocks.animate.mock.calls.find(
      ([element]) => element === panel,
    );
    expect(close?.[1]).toEqual({ opacity: 0, scale: 0.95 });
    expect(close?.[2]).toEqual({
      duration: CAROUSEL_CLOSE_S,
      ease: CAROUSEL_CLOSE_EASE,
    });
    // Shrinks in place about the middle of the on-screen area.
    expect(panel.style.transformOrigin).toBe("512px 384px");
    expect(toHome).toHaveBeenCalledWith("flip", {
      duration: CAROUSEL_CLOSE_S,
      ease: CAROUSEL_CLOSE_EASE,
    });

    unregister();
  });

  it("keeps the 120ms fade for a card-less close under reduced motion", async () => {
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

    const panel = document.querySelector<HTMLElement>(
      ".wd-expand-layer .wd-reader-panel",
    )!;
    fireEvent.click(
      document.querySelector<HTMLElement>(".wd-expand-backdrop")!,
    );

    await waitFor(() => expect(panel.style.opacity).toBe("0"));

    const calls = mocks.animate.mock.calls.filter(
      ([element]) => element === panel,
    );
    const close = calls[calls.length - 1];
    expect(close[1]).toEqual({ opacity: 0 });
    expect(close[2]).toMatchObject({ duration: 0.12, ease: "easeOut" });
  });

  it("leaves the route even when the close flight never finishes", async () => {
    // A paused frame loop never resolves the close animation; the route change
    // must not be held hostage by it.
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

    await act(async () => {
      // The close is capped at the drawer's 350ms flight (morph.ts landWithin).
      await vi.advanceTimersByTimeAsync(370);
    });

    expect(mocks.back).toHaveBeenCalledTimes(1);
  });

  it("flips a study-to-study close into the card the drawer opened from", async () => {
    placeCard(CARD_A);

    const first = render(
      <ExpandShell slug={SLUG}>
        <ReaderStub />
      </ExpandShell>,
    );
    await waitFor(() =>
      expect(layerElement()).toHaveAttribute("data-phase", "open"),
    );
    // Study to study: the slot remounts for the next slug, the drawer's origin
    // must survive.
    first.unmount();

    render(
      <ExpandShell slug="title-sequence">
        <ReaderStub />
      </ExpandShell>,
    );
    await waitFor(() =>
      expect(layerElement()).toHaveAttribute("data-phase", "open"),
    );

    const panel = document.querySelector<HTMLElement>(
      ".wd-expand-layer .wd-reader-panel",
    )!;
    fireEvent.click(
      document.querySelector<HTMLElement>(".wd-expand-backdrop")!,
    );

    await waitFor(() => expect(panel.style.opacity).toBe("0"));
    const calls = mocks.animate.mock.calls.filter(([el]) => el === panel);
    expect(calls[calls.length - 1][1]).toMatchObject(flipFrom(CARD_A, PANEL));
  });

  it("joins the open drawer on a study hand-off instead of flying out of a card", async () => {
    // The incoming study even has a card on screen: a hand-off must not use it.
    placeCard(CARD_B, "title-sequence");
    announceProgressionEntry(1);

    render(
      <ExpandShell slug="title-sequence">
        <ReaderStub />
      </ExpandShell>,
    );

    const layer = layerElement();

    // Open from the first frame, with no morph and no nav flight.
    expect(layer).toHaveAttribute("data-phase", "open");
    expect(layer).toHaveAttribute("data-handoff");
    expect(layer).toHaveAttribute("data-reveal", "pending");
    expect(
      mocks.animate.mock.calls.filter(([el]) => el === panelElement()),
    ).toHaveLength(0);

    // The entrance is released on the next frame, so `pending` paints first.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 90));
    });

    expect(layer).toHaveAttribute("data-reveal", "on");
    expect(window.history.state?.workDepth).toBe(1);
  });

  it("closes into the current study's card when the homepage has one", async () => {
    placeCard(CARD_A);
    const first = render(
      <ExpandShell slug={SLUG}>
        <ReaderStub />
      </ExpandShell>,
    );
    await waitFor(() =>
      expect(layerElement()).toHaveAttribute("data-phase", "open"),
    );
    first.unmount();

    placeCard(CARD_B, "title-sequence");
    announceProgressionEntry(1);

    render(
      <ExpandShell slug="title-sequence">
        <ReaderStub />
      </ExpandShell>,
    );
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 90));
    });

    const panel = panelElement();
    fireEvent.click(
      document.querySelector<HTMLElement>(".wd-expand-backdrop")!,
    );

    await waitFor(() => expect(panel.style.opacity).toBe("0"));
    const calls = mocks.animate.mock.calls.filter(([el]) => el === panel);
    expect(calls[calls.length - 1][1]).toMatchObject(flipFrom(CARD_B, PANEL));
  });

  it("returns to the homepage entry in one step from a switched study", async () => {
    placeCard(CARD_A);
    announceProgressionEntry(2);

    render(
      <ExpandShell slug="title-sequence">
        <ReaderStub />
      </ExpandShell>,
    );
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 90));
    });

    const go = vi.spyOn(window.history, "go").mockImplementation(() => {});
    window.history.replaceState(
      { workOverlay: true, workOrigin: SLUG, workDepth: 2 },
      "",
      "/work/title-sequence",
    );

    fireEvent.click(
      document.querySelector<HTMLElement>(".wd-expand-backdrop")!,
    );

    await waitFor(() => expect(go).toHaveBeenCalledWith(-3));
    expect(mocks.back).not.toHaveBeenCalled();
  });

  it("flips a direct load of a card-less study into the featured card", async () => {
    // Only the featured study has a home card, so it is the only possible
    // origin for a study without one.
    placeCard(CARD_A);

    render(
      <ExpandShell slug="title-sequence" resting>
        <ReaderStub />
      </ExpandShell>,
    );

    // The reader's own URL, as on a direct load.
    window.history.replaceState({}, "", "/work/title-sequence");

    const panel = document.querySelector<HTMLElement>(
      ".wd-expand-layer .wd-reader-panel",
    )!;
    fireEvent.click(
      document.querySelector<HTMLElement>(".wd-expand-backdrop")!,
    );

    await waitFor(() => expect(panel.style.opacity).toBe("0"));
    const calls = mocks.animate.mock.calls.filter(([el]) => el === panel);
    expect(calls[calls.length - 1][1]).toMatchObject(flipFrom(CARD_A, PANEL));
    expect(mocks.replace).toHaveBeenCalledWith("/");
  });

  it("falls back to the card-less exit when the origin card is gone", async () => {
    placeCard(CARD_A);

    render(
      <ExpandShell slug={SLUG} resting>
        <ReaderStub />
      </ExpandShell>,
    );

    // The card left the page (a different route is behind the reader now).
    document.querySelector("[data-work-card]")?.remove();
    const panel = document.querySelector<HTMLElement>(
      ".wd-expand-layer .wd-reader-panel",
    )!;
    fireEvent.click(
      document.querySelector<HTMLElement>(".wd-expand-backdrop")!,
    );

    await waitFor(() => expect(panel.style.opacity).toBe("0"));
    const calls = mocks.animate.mock.calls.filter(([el]) => el === panel);
    expect(calls[calls.length - 1][1]).toEqual({ opacity: 0, scale: 0.95 });
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

  it("opens the card morph on the carousel's 900ms and curve", () => {
    placeCard(CARD_A);
    mocks.animate.mockReturnValue({
      finished: new Promise(() => {}),
      complete: vi.fn(),
      stop: vi.fn(),
    });

    render(
      <ExpandShell slug={SLUG}>
        <ReaderStub />
      </ExpandShell>,
    );

    const panel = panelElement();

    // The start pose is the card's: the panel FLIPs out of it, with no offset of
    // the motion's own.
    expect(panel.style.transform).toMatch(
      new RegExp(`^translate\\(${CARD_A.left}px, ${CARD_A.top}px\\) scale\\(`),
    );
    const [, scaleX, scaleY] = panel.style.transform.match(
      /scale\(([\d.]+), ([\d.]+)\)/,
    )!;
    expect(Number(scaleX)).toBeCloseTo(CARD_A.width / PANEL.width, 5);
    expect(Number(scaleY)).toBeCloseTo(CARD_A.height / PANEL.height, 5);

    const open = mocks.animate.mock.calls.filter(([el]) => el === panel);
    expect(open).toHaveLength(1);
    expect(open[0][1]).toEqual({ x: 0, y: 0, scaleX: 1, scaleY: 1 });
    expect(open[0][2]).toEqual({
      duration: CAROUSEL_OPEN_S,
      ease: CAROUSEL_EASE,
    });
    // The shipped open is the carousel's step: 900ms, quick.
    expect(open[0][2]).toMatchObject({ duration: 0.9 });
  });

  it("hands the nav the drawer's own flight, so the two stay in sync", () => {
    const toReader = vi.fn(() => Promise.resolve());
    const toHome = vi.fn(() => Promise.resolve());
    const release = registerNavDock({ toReader, toHome });
    placeCard(CARD_A);

    render(
      <ExpandShell slug={SLUG}>
        <ReaderStub />
      </ExpandShell>,
    );

    expect(toReader).toHaveBeenCalledWith("flip", {
      duration: CAROUSEL_OPEN_S,
      ease: CAROUSEL_EASE,
    });

    release();
  });
});
