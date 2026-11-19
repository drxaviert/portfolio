/* eslint-disable @next/next/no-html-link-for-pages -- the anchors below are DOM
   fixtures, not routes: plain anchors keep the focus trap's own `a[href]`
   selector and the morph's `[data-work-card]` lookup under test. */
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { MotionGlobalConfig } from "motion/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { DrawerShell } from "./drawer-shell";
import { setCloseBehaviour } from "./proto-layout-toggle";
import { CAROUSEL_EASE, CAROUSEL_OPEN_S } from "./carousel-step";
import type { Box } from "./morph";

const mocks = vi.hoisted(() => ({
  animate: vi.fn(),
  reduce: false,
  pathname: "/work",
  back: vi.fn(),
  push: vi.fn(),
  replace: vi.fn(),
  go: vi.fn(),
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
  usePathname: () => mocks.pathname,
  useRouter: () => ({
    back: mocks.back,
    push: mocks.push,
    replace: mocks.replace,
  }),
}));

const STUDY = "/work/systems-in-motion";
const PANEL: Box = { left: 0, top: 0, width: 1408, height: 868 };
const CARD: Box = { left: 100, top: 200, width: 753, height: 416 };
const CAPSULE: Box = { left: 800, top: 700, width: 56, height: 32 };

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

function panelElement() {
  return document.querySelector<HTMLElement>(".wd-reader-panel")!;
}

function layerElement() {
  return document.querySelector<HTMLElement>(".wd-expand-layer")!;
}

function placeCard(rect: Box = CARD, slug = "systems-in-motion") {
  const card = document.createElement("a");
  card.href = `/work/${slug}`;
  card.dataset.workCard = slug;
  card.getBoundingClientRect = () => toDomRect(rect);
  document.body.append(card);

  return card;
}

function placeDock() {
  const dock = document.createElement("div");
  dock.dataset.navDock = "";
  dock.innerHTML = `<a href="/" aria-label="Home">Home</a><a href="/work" aria-label="Work">Work</a>`;

  const work = dock.querySelector<HTMLElement>('a[aria-label="Work"]')!;
  work.getBoundingClientRect = () => toDomRect(CAPSULE);

  document.body.append(dock);

  return dock;
}

/** A minimal study: the shell only needs a heading to label the dialog. */
function Study() {
  return (
    <div>
      <h1 id="wd-study-title" tabIndex={-1}>
        Systems in motion
      </h1>
      <a href="/work" className="wd-rail-work">
        Work
      </a>
    </div>
  );
}

function Index() {
  return (
    <div>
      <h1 id="wd-index-title" tabIndex={-1}>
        Work
      </h1>
      <a href="/work/systems-in-motion">Systems in motion</a>
    </div>
  );
}

function renderDrawer(
  pathname: string,
  children: ReactNode = <Index />,
  options: { resting?: boolean; inApp?: boolean } = {},
) {
  mocks.pathname = pathname;
  window.history.replaceState(
    options.inApp === false ? {} : { workOverlay: true },
    "",
    pathname,
  );

  return render(
    <DrawerShell resting={options.resting ?? false}>{children}</DrawerShell>,
  );
}

async function renderOpen(pathname = "/work", children: ReactNode = <Index />) {
  const view = renderDrawer(pathname, children);

  await waitFor(() =>
    expect(layerElement()).toHaveAttribute("data-phase", "open"),
  );

  return view;
}

const nativeRect = HTMLElement.prototype.getBoundingClientRect;
const nativeRects = Element.prototype.getClientRects;

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
  mocks.go.mockReset();
  vi.spyOn(window.history, "go").mockImplementation(mocks.go);

  setCloseBehaviour("a");
  window.sessionStorage.clear();
  document.documentElement.removeAttribute("data-entrance-played");

  // AnimatePresence only swaps its child once the exit has played; jsdom has
  // no compositor, so let every animation land at once. The real durations are
  // asserted where they are set (drawer-shell.tsx, motion-values.test.ts).
  MotionGlobalConfig.instantAnimations = true;

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
    if (this.classList?.contains("wd-reader-panel")) return toDomRect(PANEL);

    return nativeRect.call(this);
  };

  // jsdom has no layout: a connected node counts as rendered, except the ones a
  // test marks with `data-unrendered` (the reader's hidden mobile controls).
  Element.prototype.getClientRects = function () {
    if (!this.isConnected || this.hasAttribute("data-unrendered")) {
      return { length: 0, item: () => null } as unknown as DOMRectList;
    }

    return RECT_LIST;
  };

  placeDock();
  const main = document.createElement("main");
  document.body.append(main);
});

afterEach(() => {
  vi.useRealTimers();
  MotionGlobalConfig.instantAnimations = false;
  HTMLElement.prototype.getBoundingClientRect = nativeRect;
  Element.prototype.getClientRects = nativeRects;
  document.body.innerHTML = "";
  vi.unstubAllGlobals();
});

describe("DrawerShell", () => {
  it("is one panel, labelled by the content it is showing", async () => {
    await renderOpen();

    const dialog = screen.getByRole("dialog");
    expect(dialog).toBe(panelElement());
    // The nav is the dialog's sibling in the root layout: aria-modal would
    // remove it from the accessibility tree.
    expect(dialog).not.toHaveAttribute("aria-modal");
    expect(dialog).toHaveAttribute("aria-labelledby", "wd-index-title");
  });

  it("relabels the same panel when the content becomes a study", async () => {
    const view = await renderOpen();
    const panel = panelElement();

    mocks.pathname = STUDY;
    window.history.replaceState({}, "", STUDY);
    view.rerender(
      <DrawerShell>
        <Study />
      </DrawerShell>,
    );

    await waitFor(() =>
      expect(screen.getByRole("dialog")).toHaveAttribute(
        "aria-labelledby",
        "wd-study-title",
      ),
    );
    expect(panelElement()).toBe(panel);
  });

  it("cross-fades the content without moving the panel", async () => {
    const view = await renderOpen();
    const panel = panelElement();

    mocks.pathname = STUDY;
    window.history.replaceState({ keep: true }, "", STUDY);
    view.rerender(
      <DrawerShell>
        <Study />
      </DrawerShell>,
    );

    // mode="wait": the outgoing index stays mounted for its fade, and the same
    // panel element carries both views.
    expect(document.getElementById("wd-index-title")).toBeInTheDocument();
    expect(panelElement()).toBe(panel);

    await waitFor(() =>
      expect(document.getElementById("wd-study-title")).toBeInTheDocument(),
    );

    expect(panelElement()).toBe(panel);
    expect(panel.style.transform).toBe("");
  });

  it("opens on the carousel's 900ms, from the card it was clicked", async () => {
    placeCard();
    mocks.animate.mockReturnValue({
      finished: new Promise(() => {}),
      complete: vi.fn(),
      stop: vi.fn(),
    });

    renderDrawer(STUDY, <Study />);

    const panel = panelElement();
    expect(panel.style.transform).toMatch(
      new RegExp(`^translate\\(${CARD.left}px, ${CARD.top}px\\) scale\\(`),
    );

    const open = mocks.animate.mock.calls.filter(([el]) => el === panel);
    expect(open).toHaveLength(1);
    expect(open[0][1]).toEqual({ x: 0, y: 0, scaleX: 1, scaleY: 1 });
    expect(open[0][2]).toEqual({
      duration: CAROUSEL_OPEN_S,
      ease: CAROUSEL_EASE,
    });
  });

  it("grows out of the nav's Work capsule when the index opens", async () => {
    mocks.animate.mockReturnValue({
      finished: new Promise(() => {}),
      complete: vi.fn(),
      stop: vi.fn(),
    });

    renderDrawer("/work", <Index />);

    expect(panelElement().style.transform).toMatch(
      new RegExp(`^translate\\(${CAPSULE.left}px, ${CAPSULE.top}px\\) scale\\(`),
    );
  });

  it("opens resting on a direct load, with no morph at all", async () => {
    placeCard();

    renderDrawer(STUDY, <Study />, { resting: true });

    expect(layerElement()).toHaveAttribute("data-phase", "open");
    expect(layerElement()).toHaveAttribute("data-reveal", "on");
    expect(mocks.animate).not.toHaveBeenCalled();
    expect(document.documentElement.dataset.entrancePlayed).toBe("true");
    expect(panelElement().style.transformOrigin).toBe("left top");
  });

  it("keeps the 120ms opacity fade for a direct load under reduced motion", async () => {
    mocks.reduce = true;

    render(
      <DrawerShell>
        <Index />
      </DrawerShell>,
    );

    await waitFor(() =>
      expect(layerElement()).toHaveAttribute("data-phase", "open"),
    );

    const panel = panelElement();
    const fade = mocks.animate.mock.calls.filter(([el]) => el === panel);
    expect(fade.length).toBeLessThanOrEqual(1);

    if (fade.length === 1) {
      expect(fade[0][1]).toEqual({ opacity: 1 });
      expect(fade[0][2]).toMatchObject({ duration: 0.12, ease: "easeOut" });
    }
  });

  it("moves no panel under reduced motion", async () => {
    placeCard();
    mocks.reduce = true;

    renderDrawer(STUDY, <Study />);

    const panel = panelElement();
    const moves = mocks.animate.mock.calls.filter(
      ([el, target]) => el === panel && "x" in (target as object),
    );

    expect(moves).toHaveLength(0);
  });

  it("closes the whole drawer on Esc from the index", async () => {
    await renderOpen("/work");

    fireEvent.keyDown(window, { key: "Escape" });

    await waitFor(() => expect(mocks.back).toHaveBeenCalledTimes(1));
    expect(layerElement()).toHaveAttribute("data-phase", "closing");
  });

  it("closes the whole drawer on Esc from a study under A", async () => {
    placeCard();
    await renderOpen(STUDY, <Study />);

    fireEvent.keyDown(window, { key: "Escape" });

    await waitFor(() => expect(mocks.back).toHaveBeenCalledTimes(1));
    expect(mocks.push).not.toHaveBeenCalled();
  });

  it("steps back to the index on Esc from a study under B", async () => {
    placeCard();
    await renderOpen(STUDY, <Study />);
    act(() => setCloseBehaviour("b"));

    fireEvent.keyDown(window, { key: "Escape" });

    // This drawer opened on the study, so no index entry is behind it: the
    // step back pushes the index rather than closing.
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/work"));
    expect(mocks.back).not.toHaveBeenCalled();
    expect(layerElement()).toHaveAttribute("data-phase", "open");
  });

  it("pushes the index when no index entry is behind the study", async () => {
    // Opened straight from a homepage card: there is no index to go back to.
    placeCard();
    await renderOpen(STUDY, <Study />);
    act(() => setCloseBehaviour("b"));

    fireEvent.click(document.querySelector(".wd-expand-backdrop")!);

    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/work"));
    expect(mocks.back).not.toHaveBeenCalled();
    expect(layerElement()).toHaveAttribute("data-phase", "open");
  });

  it("steps back with Back when the index went first in the drawer", async () => {
    placeCard();
    const view = await renderOpen("/work");
    act(() => setCloseBehaviour("b"));

    // The drawer opened on the index; the study was pushed on top of it.
    mocks.pathname = STUDY;
    window.history.replaceState({}, "", STUDY);
    view.rerender(
      <DrawerShell>
        <Study />
      </DrawerShell>,
    );

    fireEvent.keyDown(window, { key: "Escape" });

    await waitFor(() => expect(mocks.back).toHaveBeenCalledTimes(1));
    expect(mocks.push).not.toHaveBeenCalled();
  });

  it("traps Tab in the panel and the nav, then wraps", async () => {
    await renderOpen();

    document.getElementById("wd-index-title")!.focus();
    fireEvent.keyDown(document, { key: "Tab" });

    expect(document.activeElement).toBe(
      screen.getByRole("link", { name: "Systems in motion" }),
    );

    fireEvent.keyDown(document, { key: "Tab" });
    expect(document.activeElement).toBe(
      screen.getByRole("link", { name: "Home" }),
    );

    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(
      within(panelElement()).getByRole("link", { name: "Systems in motion" }),
    ).toBe(document.activeElement);
  });

  it("inerts the homepage once the drawer has landed", async () => {
    await renderOpen();

    expect(document.querySelector("body > main")).toHaveAttribute("inert");
  });

  it("returns focus to the card the drawer grew out of", async () => {
    placeCard();
    const view = await renderOpen(STUDY, <Study />);

    fireEvent.keyDown(window, { key: "Escape" });
    await waitFor(() => expect(mocks.back).toHaveBeenCalled());

    view.unmount();
    // Simulate the route's commit having hidden the old tree already.
    document.body.innerHTML = "";
    placeDock();
    placeCard();

    await act(async () => {
      await new Promise((resolve) => requestAnimationFrame(resolve));
    });

    expect(document.activeElement?.getAttribute("data-work-card")).toBe(
      "systems-in-motion",
    );
  });

  it("falls back to the nav's Work item when there is no card to return to", async () => {
    const view = await renderOpen("/work");

    fireEvent.keyDown(window, { key: "Escape" });
    await waitFor(() => expect(mocks.back).toHaveBeenCalled());

    view.unmount();
    document.body.innerHTML = "";
    placeDock();

    await act(async () => {
      await new Promise((resolve) => requestAnimationFrame(resolve));
    });

    expect(document.activeElement).toBe(
      screen.getByRole("link", { name: "Work" }),
    );
  });
});
