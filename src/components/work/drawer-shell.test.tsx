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
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Activity, createRef, useImperativeHandle, useState } from "react";
import type { ReactNode, RefObject } from "react";
import { DrawerShell } from "./drawer-shell";
import { setCloseBehaviour } from "./proto-layout-toggle";
import { CAROUSEL_EASE, CAROUSEL_OPEN_S } from "./carousel-step";
import { flipFrom } from "./morph";
import type { Box } from "./morph";
import { requestReaderClose } from "@/components/nav/nav-flight";

const mocks = vi.hoisted(() => ({
  animate: vi.fn(),
  releaseElement: vi.fn(),
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
    releaseElement:
      mocks.releaseElement as unknown as typeof actual.releaseElement,
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
const nativeScrollTop = Object.getOwnPropertyDescriptor(
  Element.prototype,
  "scrollTop",
)!;

/**
 * jsdom keeps whatever `scrollTop` you assign, even on a detached node. A
 * browser clamps to the scrollable range, and an element with no layout box has
 * a scroll height of 0, so a write made before the copy is in the document
 * lands on 0 — the bug this models. Without it, the regression test below would
 * pass on the old code.
 */
function modelBrowserScrolling() {
  const offsets = new WeakMap<HTMLElement, number>();
  const isScroller = (element: HTMLElement) =>
    element.matches?.(".wd-reader-scroll, .wd-index-scroll") ?? false;
  const range = (element: HTMLElement) =>
    element.isConnected ? { height: 2000, view: 600 } : { height: 0, view: 0 };

  Object.defineProperty(HTMLElement.prototype, "scrollTop", {
    configurable: true,
    get(this: HTMLElement) {
      if (!isScroller(this)) return nativeScrollTop.get!.call(this);

      const { height, view } = range(this);

      return height === 0 ? 0 : Math.min(offsets.get(this) ?? 0, height - view);
    },
    set(this: HTMLElement, value: number) {
      if (!isScroller(this)) {
        nativeScrollTop.set!.call(this, value);

        return;
      }

      const { height, view } = range(this);

      offsets.set(
        this,
        height === 0 ? 0 : Math.max(0, Math.min(value, height - view)),
      );
    },
  });
}

function ScrolledIndex() {
  return (
    <div>
      <h1 id="wd-index-title" tabIndex={-1}>
        Work
      </h1>
      <div className="wd-index-scroll">
        <a href="/work/systems-in-motion">Systems in motion</a>
      </div>
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

beforeEach(() => {
  mocks.animate.mockReset();
  mocks.animate.mockReturnValue({
    finished: Promise.resolve(),
    complete: vi.fn(),
    stop: vi.fn(),
  });
  mocks.releaseElement.mockReset();
  mocks.reduce = false;
  mocks.back.mockReset();
  mocks.push.mockReset();
  mocks.replace.mockReset();
  mocks.go.mockReset();
  vi.spyOn(window.history, "go").mockImplementation(mocks.go);

  setCloseBehaviour("a");
  window.sessionStorage.clear();
  document.documentElement.removeAttribute("data-entrance-played");

  // Motion's own animations land at once: jsdom has no compositor. The swap's
  // fades are CSS and Web Animations (see the cross-fade test, which runs with
  // this off), and the real durations are asserted where they are set.
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
  delete (HTMLElement.prototype as { scrollTop?: unknown }).scrollTop;
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

  it("cross-fades: the old view stays, frozen, while the new one fades in", async () => {
    // This test runs with Motion's instant animations OFF: the swap must not
    // depend on a library animation landing, and the two views must coexist.
    MotionGlobalConfig.instantAnimations = false;

    // The copy's fade is a Web Animation; hold it open so the frozen view can be
    // inspected the way a frame in a browser would show it.
    const nativeAnimate = Element.prototype.animate;
    let finish!: () => void;
    Element.prototype.animate = vi.fn(() => ({
      finished: new Promise<void>((resolve) => {
        finish = resolve;
      }),
      cancel: vi.fn(),
      play: vi.fn(),
      pause: vi.fn(),
    })) as unknown as Element["animate"];

    const view = await renderOpen();
    const panel = panelElement();

    mocks.pathname = STUDY;
    window.history.replaceState({ keep: true }, "", STUDY);
    view.rerender(
      <DrawerShell>
        <Study />
      </DrawerShell>,
    );

    const views = [...document.querySelectorAll<HTMLElement>(".wd-drawer-view")];
    // Two views at once: the incoming one (fading in) and the outgoing copy.
    expect(views).toHaveLength(2);

    const [incoming, outgoing] = views;

    expect(incoming).toHaveAttribute("data-enter");
    expect(incoming.querySelector("h1")?.textContent).toBe("Systems in motion");
    expect(outgoing).toHaveAttribute("data-leave");
    // The copy is the view that was on screen: the index's own heading, not the
    // new study's.
    expect(outgoing.querySelector("h1")?.textContent).toBe("Work");
    expect(outgoing.querySelector("#wd-study-title")).toBeNull();
    // It is a picture: hidden from AT, inert, and it takes no clicks.
    expect(outgoing).toHaveAttribute("aria-hidden", "true");
    expect(outgoing).toHaveAttribute("inert");
    expect(outgoing.querySelector("[id]")).toBeNull();
    // The panel never moves.
    expect(panelElement()).toBe(panel);
    expect(panel.style.transform).toBe("");

    act(() => finish());

    await waitFor(() =>
      expect(document.querySelectorAll(".wd-drawer-view")).toHaveLength(1),
    );

    Element.prototype.animate = nativeAnimate;
  });

  it("shows a snapshot's content at rest instead of replaying the entrance", () => {
    // The copy and the ghost still sit under a `data-reveal="on"` layer, so the
    // reader entrance matches their blocks again and restarts them blurred and
    // 10px low. jsdom does not apply the imported stylesheet's cascade, so the
    // rule is checked at the source, the same way home-nav.test.tsx checks its
    // touch targets.
    const css = readFileSync(
      join(process.cwd(), "src", "components", "work", "drawer-shell.css"),
      "utf8",
    );

    const rule = css.match(
      /\[data-leave\] \*,\s*\[data-exit-ghost\] \.wd-drawer-view \*\s*\{([^}]*)\}/,
    );

    expect(rule).not.toBeNull();
    expect(rule![1]).toMatch(/animation: none !important;/);
    expect(rule![1]).toMatch(/transition: none !important;/);

    // Only the content is neutralised. The copy's fade is a Web Animation on
    // the view, and the ghost's backdrop fade and panel flight are the drawer's
    // own close, so the containers keep their own rules.
    expect(css).toMatch(
      /\.wd-drawer-view\[data-leave\] \{[^}]*pointer-events: none;/,
    );
    expect(css).toMatch(
      /\.wd-expand-layer\[data-phase="closing"\] \.wd-expand-backdrop \{[^}]*wd-backdrop-out/,
    );
  });

  it("keeps the scroll position on the copy it fades out", async () => {
    // The copy is cloned after React detaches the old view, and a detached
    // scroller reports 0, so the position has to be carried over rather than
    // read at swap time. Model the browser's clamp for the test.
    modelBrowserScrolling();

    // Hold the copy's fade open, or it removes itself before the assertion.
    const nativeAnimate = Element.prototype.animate;
    Element.prototype.animate = vi.fn(() => ({
      finished: new Promise<void>(() => {}),
      cancel: vi.fn(),
    })) as unknown as Element["animate"];

    const view = await renderOpen("/work", <ScrolledIndex />);

    const live = document.querySelector<HTMLElement>(".wd-index-scroll")!;
    live.scrollTop = 900;
    fireEvent.scroll(live);
    expect(live.scrollTop).toBe(900);

    mocks.pathname = STUDY;
    window.history.replaceState({}, "", STUDY);
    view.rerender(
      <DrawerShell>
        <Study />
      </DrawerShell>,
    );

    const copy = document.querySelector<HTMLElement>(
      ".wd-drawer-view[data-leave] .wd-index-scroll",
    );

    expect(copy).not.toBeNull();
    // Written before the copy was in the document, this would be 0 — the flash
    // of the top of the page the audit saw.
    expect(copy!.scrollTop).toBe(900);

    Element.prototype.animate = nativeAnimate;
  });

  it("closes onto the visible card when the recorded one was hidden", async () => {
    // 1280: the carousel's copy is the origin. Resized below 768, that copy is
    // display:none and the stacked one is on screen; the close must find it,
    // not the zero-size copy (which collapsed the panel into a point).
    const carouselCard = placeCard(CARD);
    carouselCard.setAttribute("data-unrendered", "");
    const stacked = { left: 16, top: 180, width: 340, height: 420 };
    placeCard(stacked);

    await renderOpen(STUDY, <Study />);

    fireEvent.click(document.querySelector(".wd-expand-backdrop")!);
    await waitFor(() => expect(mocks.back).toHaveBeenCalled());

    const panel = panelElement();
    const close = mocks.animate.mock.calls.filter(([el]) => el === panel).at(-1)!;
    const pose = close[1] as { scaleX: number };

    expect(pose).toMatchObject(flipFrom(stacked, PANEL));
    expect(pose.scaleX).toBeGreaterThan(0);
    expect(pose.scaleX).toBeCloseTo(340 / PANEL.width, 5);
  });

  it("scales and fades when nothing is left to land on", async () => {
    placeCard();
    await renderOpen(STUDY, <Study />);

    // Both the recorded card and the nav are gone (a route that took the
    // homepage away, or a direct load with no nav).
    document.querySelectorAll("[data-work-card], [data-nav-dock]").forEach((el) => el.remove());

    fireEvent.click(document.querySelector(".wd-expand-backdrop")!);
    await waitFor(() => expect(layerElement()).toHaveAttribute("data-phase", "closing"));

    const panel = panelElement();
    const close = mocks.animate.mock.calls.filter(([el]) => el === panel).at(-1)!;

    expect(close[1]).toEqual({ opacity: 0, scale: 0.95 });
  });

  it("fades the panel out in 120ms under reduced motion", async () => {
    placeCard();
    mocks.reduce = true;
    await renderOpen(STUDY, <Study />);

    fireEvent.click(document.querySelector(".wd-expand-backdrop")!);
    await waitFor(() => expect(mocks.back).toHaveBeenCalled());

    const panel = panelElement();
    const close = mocks.animate.mock.calls.filter(([el]) => el === panel).at(-1)!;

    expect(close[1]).toEqual({ opacity: 0 });
    expect(close[2]).toMatchObject({ duration: 0.12, ease: "easeOut" });
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

  it("closes to the homepage entry after a chain of studies", async () => {
    placeCard();
    const view = await renderOpen("/work");

    // index -> A -> B: two pushes above the entry the drawer opened on.
    for (const route of [STUDY, "/work/title-sequence"]) {
      mocks.pathname = route;
      window.history.replaceState({ workOverlay: true }, "", route);
      view.rerender(
        <DrawerShell>
          <Study />
        </DrawerShell>,
      );
    }

    fireEvent.keyDown(window, { key: "Escape" });

    await waitFor(() => expect(mocks.go).toHaveBeenCalledWith(-3));
    expect(mocks.back).not.toHaveBeenCalled();
  });

  it("restores the entry's own depth on Back", async () => {
    placeCard();
    const view = await renderOpen("/work");

    for (const route of [STUDY, "/work/title-sequence"]) {
      mocks.pathname = route;
      window.history.replaceState({ workOverlay: true }, "", route);
      view.rerender(
        <DrawerShell>
          <Study />
        </DrawerShell>,
      );
    }

    // Back to a restored entry whose own depth is zero.
    window.history.replaceState(
      { workOverlay: true, workDepth: 0, workPrev: "index" },
      "",
      "/work/type-in-motion",
    );
    fireEvent.popState(window);
    mocks.pathname = "/work/type-in-motion";
    view.rerender(
      <DrawerShell>
        <Study />
      </DrawerShell>,
    );

    fireEvent.keyDown(window, { key: "Escape" });

    await waitFor(() => expect(mocks.back).toHaveBeenCalledTimes(1));
    expect(mocks.go).not.toHaveBeenCalled();
  });

  it("jumps an opening morph to its end on a resize", async () => {
    placeCard();
    const complete = vi.fn();
    mocks.animate.mockReturnValue({
      finished: new Promise(() => {}),
      complete,
      stop: vi.fn(),
    });

    renderDrawer(STUDY, <Study />);

    expect(layerElement()).toHaveAttribute("data-phase", "opening");

    fireEvent(window, new Event("resize"));

    expect(complete).toHaveBeenCalled();
  });

  it("steps back to the index after Next project, not to the study behind it", async () => {
    placeCard();
    const view = await renderOpen("/work");
    act(() => setCloseBehaviour("b"));

    // index -> A -> B: the entry behind B is A, not the index.
    for (const route of [STUDY, "/work/title-sequence"]) {
      mocks.pathname = route;
      window.history.replaceState({ workOverlay: true }, "", route);
      view.rerender(
        <DrawerShell>
          <Study />
        </DrawerShell>,
      );
    }

    fireEvent.keyDown(window, { key: "Escape" });

    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/work"));
    expect(mocks.back).not.toHaveBeenCalled();
  });

  /**
   * The router hides a route segment instead of unmounting it: React Activity
   * keeps the DOM and every bit of state, tears the effects down while the
   * segment is away, and runs them again when it is shown. That reuse is what
   * made a closed drawer come back shut, so the cache is part of the test.
   */
  type CacheControl = { setHidden: (hidden: boolean) => void };

  function CachedDrawer({
    children,
    control,
  }: {
    children: ReactNode;
    control: RefObject<CacheControl | null>;
  }) {
    const [hidden, setHidden] = useState(false);

    useImperativeHandle(control, () => ({ setHidden }), []);

    return (
      <Activity mode={hidden ? "hidden" : "visible"}>
        <DrawerShell>{children}</DrawerShell>
      </Activity>
    );
  }

  type CachedEntry = {
    view: ReturnType<typeof render>;
    control: RefObject<CacheControl | null>;
  };

  async function renderCached(
    pathname = "/work",
    children: ReactNode = <Index />,
  ): Promise<CachedEntry> {
    mocks.pathname = pathname;
    window.history.replaceState({ workOverlay: true }, "", pathname);

    const control = createRef<CacheControl>();
    const view = render(
      <CachedDrawer control={control}>{children}</CachedDrawer>,
    );

    await waitFor(() =>
      expect(layerElement()).toHaveAttribute("data-phase", "open"),
    );

    return { view, control };
  }

  /** The route leaves `/work*`; the segment goes away with its state. */
  function cacheDrawerAway(entry: CachedEntry) {
    window.history.replaceState({}, "", "/");
    act(() => entry.control.current?.setHidden(true));
  }

  /** The next entry renders the segment again, then shows it. */
  function showDrawerAgain(
    entry: CachedEntry,
    pathname = "/work",
    children: ReactNode = <Index />,
  ) {
    mocks.pathname = pathname;
    window.history.replaceState({}, "", pathname);
    entry.view.rerender(
      <CachedDrawer control={entry.control}>{children}</CachedDrawer>,
    );
    act(() => entry.control.current?.setHidden(false));
  }

  /** The panel's inline pose for a flight out of `origin`. CSSOM rounds it. */
  function poseFrom(origin: Box) {
    return flipFrom(origin, PANEL);
  }

  function readPose(panel: HTMLElement) {
    const match = panel.style.transform.match(
      /translate\((-?[\d.]+)px, (-?[\d.]+)px\) scale\((-?[\d.]+), (-?[\d.]+)\)/,
    );

    expect(match).not.toBeNull();

    const [, x, y, scaleX, scaleY] = match!;

    return {
      x: Number(x),
      y: Number(y),
      scaleX: Number(scaleX),
      scaleY: Number(scaleY),
    };
  }

  /** Hold the reopen's flight so the pose it starts from can be read. */
  function holdOpenMorph() {
    mocks.animate.mockReturnValue({
      finished: new Promise(() => {}),
      complete: vi.fn(),
      stop: vi.fn(),
    });
  }

  /**
   * A drawer that closed must not come back posed on its origin and invisible.
   * The reopen runs the ordinary open from this entry's own origin, and the
   * page lock comes back with it.
   */
  async function expectReopenedFrom(origin: Box) {
    await waitFor(() =>
      expect(layerElement()).toHaveAttribute("data-phase", "opening"),
    );

    const panel = panelElement();
    const pose = poseFrom(origin);
    const observed = readPose(panel);

    expect(panel.style.opacity).toBe("");
    expect(observed.x).toBeCloseTo(pose.x, 3);
    expect(observed.y).toBeCloseTo(pose.y, 3);
    expect(observed.scaleX).toBeCloseTo(pose.scaleX, 5);
    expect(observed.scaleY).toBeCloseTo(pose.scaleY, 5);
    expect(document.body.style.overflow).toBe("hidden");
  }

  it("reopens from the nav after an Esc close, instead of coming back shut", async () => {
    const entry = await renderCached();

    fireEvent.keyDown(window, { key: "Escape" });
    await waitFor(() => expect(mocks.back).toHaveBeenCalled());

    // The shell is shut: posed on the capsule, transparent.
    expect(layerElement()).toHaveAttribute("data-phase", "closing");
    expect(panelElement().style.opacity).toBe("0");

    cacheDrawerAway(entry);
    // The homepage is interactive again while the drawer is away.
    expect(document.body.style.overflow).toBe("");

    holdOpenMorph();
    showDrawerAgain(entry);

    await expectReopenedFrom(CAPSULE);
  });

  it("reopens after a backdrop close", async () => {
    const entry = await renderCached();

    fireEvent.click(document.querySelector(".wd-expand-backdrop")!);
    await waitFor(() => expect(mocks.back).toHaveBeenCalled());
    expect(layerElement()).toHaveAttribute("data-phase", "closing");

    cacheDrawerAway(entry);
    holdOpenMorph();
    showDrawerAgain(entry);

    await expectReopenedFrom(CAPSULE);
  });

  it("reopens after the logo's close gesture", async () => {
    const entry = await renderCached();

    // The dock treats the logo as the reader's close: nav-dock.tsx hands
    // `a[href="/"]` to the registered reader close.
    act(() => requestReaderClose());
    await waitFor(() => expect(mocks.back).toHaveBeenCalled());
    expect(layerElement()).toHaveAttribute("data-phase", "closing");

    cacheDrawerAway(entry);
    holdOpenMorph();
    showDrawerAgain(entry);

    await expectReopenedFrom(CAPSULE);
  });

  it("flies in from the card clicked on the new entry, not the last origin", async () => {
    placeCard();
    const entry = await renderCached();

    // Index entry, closed from the nav's capsule.
    fireEvent.keyDown(window, { key: "Escape" });
    await waitFor(() => expect(mocks.back).toHaveBeenCalled());
    cacheDrawerAway(entry);

    holdOpenMorph();
    // The new entry is a study, pushed by the card: the reopened drawer has to
    // grow out of the card, not out of the capsule the last entry used.
    showDrawerAgain(entry, STUDY, <Study />);

    await expectReopenedFrom(CARD);
    // A new entry starts on its route's content, not on a copy of the old one.
    expect(document.querySelectorAll(".wd-drawer-view")).toHaveLength(1);
  });

  it("cancels a close that a reopen interrupts, and resumes from the panel's box", async () => {
    const view = await renderOpen(STUDY, <Study />);

    // Hold the close in flight.
    mocks.animate.mockReturnValue({
      finished: new Promise(() => {}),
      complete: vi.fn(),
      stop: vi.fn(),
    });

    fireEvent.keyDown(window, { key: "Escape" });
    expect(layerElement()).toHaveAttribute("data-phase", "closing");

    // Mid-flight, the panel is a scaled box on screen, not its layout box.
    const panel = panelElement();
    Object.defineProperties(panel, {
      offsetLeft: { configurable: true, value: PANEL.left },
      offsetTop: { configurable: true, value: PANEL.top },
      offsetWidth: { configurable: true, value: PANEL.width },
      offsetHeight: { configurable: true, value: PANEL.height },
    });
    const mid: Box = { left: 300, top: 360, width: 600, height: 400 };
    panel.getBoundingClientRect = () => toDomRect(mid);

    // The visitor clicks nav Work before the flight lands: the new entry
    // arrives without the tree ever leaving `/work*`.
    mocks.pathname = "/work";
    window.history.replaceState({}, "", "/work");
    view.rerender(
      <DrawerShell>
        <Index />
      </DrawerShell>,
    );

    await waitFor(() =>
      expect(layerElement()).toHaveAttribute("data-phase", "opening"),
    );

    // It grows back from where it visually was, not from its layout box.
    expect(panel.style.opacity).toBe("");
    const pose = readPose(panel);
    expect(pose.x).toBeCloseTo(mid.left - PANEL.left, 3);
    expect(pose.y).toBeCloseTo(mid.top - PANEL.top, 3);
    expect(pose.scaleX).toBeCloseTo(mid.width / PANEL.width, 5);
    expect(pose.scaleY).toBeCloseTo(mid.height / PANEL.height, 5);

    // The stale close stops at its generation: it never latches the new entry
    // shut or navigates over it.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 380));
    });
    expect(mocks.back).not.toHaveBeenCalled();
    expect(mocks.replace).not.toHaveBeenCalled();
    expect(mocks.go).not.toHaveBeenCalled();
  });

  it("reopens when a new entry lands after the close had finished", async () => {
    const view = await renderOpen(STUDY, <Study />);

    fireEvent.keyDown(window, { key: "Escape" });
    await waitFor(() => expect(mocks.back).toHaveBeenCalled());
    expect(layerElement()).toHaveAttribute("data-phase", "closing");

    holdOpenMorph();
    mocks.pathname = "/work";
    window.history.replaceState({}, "", "/work");
    view.rerender(
      <DrawerShell>
        <Index />
      </DrawerShell>,
    );

    await waitFor(() =>
      expect(layerElement()).toHaveAttribute("data-phase", "opening"),
    );

    // A finished close left no flight to resume, so it opens from this entry's
    // origin like any first open.
    const panel = panelElement();
    expect(panel.style.opacity).toBe("");
    expect(readPose(panel).scaleX).toBeCloseTo(CAPSULE.width / PANEL.width, 5);
    expect(mocks.back).toHaveBeenCalledTimes(1);
  });

  it("re-reads the pose from the DOM when a Back exit left the shell open but hidden", async () => {
    const entry = await renderCached();
    const panel = panelElement();

    // Back out: the ghost draws the exit, the live shell is only hidden, so it
    // still believes it is open when it comes back.
    cacheDrawerAway(entry);
    expect(layerElement()).toHaveAttribute("data-phase", "open");
    expect(document.body.style.overflow).toBe("");

    holdOpenMorph();
    showDrawerAgain(entry, "/work");

    await waitFor(() =>
      expect(layerElement()).toHaveAttribute("data-phase", "opening"),
    );

    // Motion caches the transform values it last rendered, and the pose here
    // was written straight to the style: the flight has to detach that cache
    // and read the DOM, or it animates identity over identity and lands in a
    // frame with no visible motion.
    expect(mocks.releaseElement).toHaveBeenCalledWith(panel);
    expect(panel.style.opacity).toBe("");
    expect(readPose(panel).scaleX).toBeCloseTo(
      CAPSULE.width / PANEL.width,
      5,
    );
  });
});
