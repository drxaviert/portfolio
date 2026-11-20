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
    // A closed shell is off the screen while a slow route exit is still on its
    // way; visibility keeps the panel's box for the next open's FLIP.
    expect(css).toMatch(
      /\.wd-expand-layer\[data-phase="closed"\] \{[^}]*visibility: hidden;/,
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

    act(() => requestReaderClose());
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

    act(() => requestReaderClose());
    await waitFor(() => expect(layerElement()).toHaveAttribute("data-phase", "closing"));

    const panel = panelElement();
    const close = mocks.animate.mock.calls.filter(([el]) => el === panel).at(-1)!;

    expect(close[1]).toEqual({ opacity: 0, scale: 0.95 });
  });

  it("fades the panel out in 120ms under reduced motion", async () => {
    placeCard();
    mocks.reduce = true;
    await renderOpen(STUDY, <Study />);

    act(() => requestReaderClose());
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
    // The flight is over: the shell settled closed and released the page.
    expect(layerElement()).toHaveAttribute("data-phase", "closed");
  });

  it("steps back to the index on Esc from a study", async () => {
    placeCard();
    await renderOpen(STUDY, <Study />);

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

    fireEvent.click(document.querySelector(".wd-expand-backdrop")!);

    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/work"));
    expect(mocks.back).not.toHaveBeenCalled();
    expect(layerElement()).toHaveAttribute("data-phase", "open");
  });

  it("steps back with Back when the index went first in the drawer", async () => {
    placeCard();
    const view = await renderOpen("/work");

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

  it("does not step back and close in one Esc burst", async () => {
    placeCard();
    const view = await renderOpen("/work");

    // The drawer opened on the index; the study was pushed on top of it.
    mocks.pathname = STUDY;
    window.history.replaceState(
      { workOverlay: true, workPrev: "index" },
      "",
      STUDY,
    );
    view.rerender(
      <DrawerShell>
        <Study />
      </DrawerShell>,
    );

    vi.useFakeTimers();

    // A burst of five presses is one step back, never five.
    for (let press = 0; press < 5; press += 1) {
      fireEvent.keyDown(window, { key: "Escape" });
    }

    expect(mocks.back).toHaveBeenCalledTimes(1);
    expect(mocks.push).not.toHaveBeenCalled();

    // The route lands on the index; the burst's tail must not close it.
    mocks.pathname = "/work";
    window.history.replaceState({}, "", "/work");
    view.rerender(
      <DrawerShell>
        <Index />
      </DrawerShell>,
    );
    fireEvent.keyDown(window, { key: "Escape" });

    expect(mocks.back).toHaveBeenCalledTimes(1);

    // A fresh press after the burst window closes the drawer normally.
    vi.advanceTimersByTime(400);
    fireEvent.keyDown(window, { key: "Escape" });
    await act(async () => {});

    // The close runs (through history depth, as this entry chain accumulated
    // one on the simulated step back).
    expect(mocks.go.mock.calls.length + mocks.back.mock.calls.length).toBeGreaterThan(
      1,
    );
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

    act(() => requestReaderClose());
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

  it.each([
    ["a pointer", false],
    ["a key", true],
  ])("shows the returned focus ring only when %s closed the drawer", async (_, keyboard) => {
    const view = await renderOpen("/work");

    if (keyboard) {
      fireEvent.keyDown(window, { key: "Escape" });
    } else {
      fireEvent.pointerDown(document.querySelector(".wd-expand-backdrop")!);
      fireEvent.click(document.querySelector(".wd-expand-backdrop")!);
    }
    await waitFor(() => expect(mocks.back).toHaveBeenCalled());

    view.unmount();
    document.body.innerHTML = "";
    placeDock();
    const work = screen.getByRole("link", { name: "Work" });
    const focus = vi.spyOn(work, "focus");

    await act(async () => {
      await new Promise((resolve) => requestAnimationFrame(resolve));
    });

    expect(focus).toHaveBeenCalledWith({
      preventScroll: true,
      focusVisible: keyboard,
    });
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

    act(() => requestReaderClose());

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

    act(() => requestReaderClose());

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
  async function cacheDrawerAway(entry: CachedEntry) {
    window.history.replaceState({}, "", "/");
    act(() => entry.control.current?.setHidden(true));
    // The hide settles its rendered phase just after the commit.
    await act(async () => {});
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

    // The shell is shut: the flight is over, so it settled closed.
    expect(layerElement()).toHaveAttribute("data-phase", "closed");
    expect(panelElement().style.opacity).toBe("0");

    await cacheDrawerAway(entry);
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
    expect(layerElement()).toHaveAttribute("data-phase", "closed");

    await cacheDrawerAway(entry);
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
    expect(layerElement()).toHaveAttribute("data-phase", "closed");

    await cacheDrawerAway(entry);
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
    await cacheDrawerAway(entry);

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

    act(() => requestReaderClose());
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

    act(() => requestReaderClose());
    await waitFor(() => expect(mocks.back).toHaveBeenCalled());
    expect(layerElement()).toHaveAttribute("data-phase", "closed");

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

    // Back out: the ghost draws the exit and the router hides the live shell.
    // Hiding is a transition of its own: the shell is closed while it is away.
    await cacheDrawerAway(entry);
    expect(layerElement()).toHaveAttribute("data-phase", "closed");
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

  /**
   * A small seeded generator: the same storms every run, so a failure names the
   * sequence that broke.
   */
  function seeded(seed: number) {
    let state = seed;

    return () => {
      state = (state + 0x6d2b79f5) | 0;
      let t = state;

      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);

      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /**
   * One storm run. With the Navigation API, the same-URL push (Work clicked
   * while already on /work) arrives as a navigate event; without it, the click
   * is the only signal, so the run dispatches the same click the browser would.
   */
  async function runStorm(withNavigation: boolean) {
    type NavListener = (event: {
      navigationType: string;
      canIntercept: boolean;
      destination: { url: string };
      intercept: (options: { handler: () => Promise<void> }) => void;
    }) => void;

    const navListeners = new Set<NavListener>();

    Object.defineProperty(window, "navigation", {
      configurable: true,
      value: withNavigation
        ? {
            addEventListener: (type: string, listener: NavListener) => {
              if (type === "navigate") navListeners.add(listener);
            },
            removeEventListener: (type: string, listener: NavListener) => {
              if (type === "navigate") navListeners.delete(listener);
            },
          }
        : undefined,
    });

    const fireNavigation = (pathname: string, navigationType = "push") => {
      for (const listener of [...navListeners]) {
        listener({
          navigationType,
          canIntercept: true,
          destination: { url: `${location.origin}${pathname}` },
          intercept: () => undefined,
        });
      }
    };

    /** The visitor's click on a link into the drawer, without the API. */
    const clickLink = (path: string) => {
      const link = document.createElement("a");
      link.setAttribute("href", path);
      link.addEventListener("click", (event) => event.preventDefault());
      document.body.append(link);
      fireEvent.click(link);
      link.remove();
    };

    const routes: Record<string, ReactNode> = {
      "/work": <Index />,
      [STUDY]: <Study />,
    };

    const entry = await renderCached("/work");
    const { view, control } = entry;

    // The storm is about ordering, not wall-clock time: run its flights and
    // deferred route changes on fake timers so 200 sequences stay quick.
    vi.useFakeTimers();

    // A flight that lands on the next tick, not in the same one: a click can
    // arrive while a close is still flying, and the browser would not have
    // navigated yet. Resolve on demand too, because stopping a flight finishes
    // it (as motion does).
    mocks.animate.mockImplementation(() => {
      let land!: () => void;
      const finished = new Promise<void>((resolve) => {
        land = resolve;
      });
      const timer = window.setTimeout(() => land(), 0);

      return {
        finished,
        complete: () => {
          window.clearTimeout(timer);
          land();
        },
        stop: () => {
          window.clearTimeout(timer);
          land();
        },
      };
    });

    let leaveTimer: number | null = null;
    const cancelLeave = () => {
      if (!leaveTimer) return;
      window.clearTimeout(leaveTimer);
      leaveTimer = null;
    };
    const leave = () => {
      if (window.location.pathname.startsWith("/work")) {
        window.history.replaceState({}, "", "/");
      }
      mocks.pathname = "/";
      act(() => control.current?.setHidden(true));
    };
    // The mocked router navigates a beat later, as the real one does; a push
    // into the drawer before it lands supersedes it (the storm's race).
    const scheduleLeave = () => {
      cancelLeave();
      leaveTimer = window.setTimeout(() => {
        leaveTimer = null;
        leave();
      }, 0);
    };

    mocks.back.mockImplementation(scheduleLeave);
    mocks.replace.mockImplementation(scheduleLeave);
    mocks.go.mockImplementation(scheduleLeave);

    /** The tree is really gone from the page (the router or our CSS hid it). */
    const offScreen = () => {
      const layer = document.querySelector<HTMLElement>(
        ".wd-expand-layer:not([data-exit-ghost])",
      );

      if (!layer) return true;
      if (getComputedStyle(layer).display === "none") return true;

      return getComputedStyle(layer).visibility === "hidden";
    };

    /** For the invariant: a settled closed shell counts as hidden. */
    const hidden = () => {
      const layer = document.querySelector<HTMLElement>(
        ".wd-expand-layer:not([data-exit-ghost])",
      );

      if (!layer) return true;
      if (getComputedStyle(layer).display === "none") return true;
      if (getComputedStyle(layer).visibility === "hidden") return true;

      return layer.dataset.phase === "closed";
    };

    const showTo = (path: string, node: ReactNode) => {
      // Showing an already-visible drawer is not an event in the app, and it
      // must not cancel a close's pending route: only a navigation does that.
      if (!offScreen()) return;

      cancelLeave();
      mocks.pathname = path;
      window.history.replaceState({}, "", path);
      view.rerender(<CachedDrawer control={control}>{node}</CachedDrawer>);
      act(() => control.current?.setHidden(false));
    };

    const pushTo = (path: string, node: ReactNode) => {
      cancelLeave();

      if (offScreen()) {
        showTo(path, node);
        return;
      }

      const same = path === window.location.pathname;
      mocks.pathname = path;
      if (!same) window.history.replaceState({}, "", path);
      view.rerender(<CachedDrawer control={control}>{node}</CachedDrawer>);

      if (withNavigation) fireNavigation(path);
      else clickLink(path);
    };

    const settle = async () => {
      // Flights land on a timer, their completions and the deferred phase
      // updates follow in microtasks: give the whole chain a few ticks.
      for (let tick = 0; tick < 3; tick += 1) {
        await act(async () => {
          await vi.advanceTimersByTimeAsync(5);
        });
      }
    };

    const assertConsistent = (run: number) => {
      const layer = document.querySelector<HTMLElement>(
        ".wd-expand-layer:not([data-exit-ghost])",
      );
      const panel = document.querySelector<HTMLElement>(".wd-reader-panel");
      const overflow = document.body.style.overflow;
      const inert =
        document.querySelector("body > main")?.hasAttribute("inert") ?? false;
      const copies = document.querySelectorAll(
        ".wd-drawer-view[data-leave]",
      ).length;
      const ghosts = document.querySelectorAll("[data-exit-ghost]").length;

      // Nothing a transition started may outlive it.
      expect({ run, copies, ghosts }).toEqual({ run, copies: 0, ghosts: 0 });

      if (hidden()) {
        // Gone from the screen: the page is the visitor's again.
        expect({ run, overflow, inert }).toEqual({
          run,
          overflow: "",
          inert: false,
        });
        return;
      }

      // Still on screen: a fully open drawer, never a phase left behind.
      expect({ run, phase: layer?.dataset.phase }).toEqual({
        run,
        phase: "open",
      });
      expect({ run, overflow, inert }).toEqual({
        run,
        overflow: "hidden",
        inert: true,
      });
      expect({ run, transform: panel?.style.transform ?? "" }).toEqual({
        run,
        transform: "",
      });
      expect(getComputedStyle(panel!).opacity).toBe("1");
    };

    const random = seeded(20261119);
    const gaps = [0, 0, 1, 2, 4, 8];
    const usable = ["esc", "backdrop", "work", "route", "back", "leave", "show"];

    for (let run = 0; run < 200; run += 1) {
      showTo("/work", routes["/work"]);
      await settle();

      const steps = 2 + Math.floor(random() * 5);

      for (let step = 0; step < steps; step += 1) {
        const action = usable[Math.floor(random() * usable.length)];
        const gap = gaps[Math.floor(random() * gaps.length)];

        // Every step, its timer and its route signal run inside one act, so a
        // mocked router callback or a deferred re-entry lands inside it too.
        await act(async () => {
          if (gap > 0) {
            await vi.advanceTimersByTimeAsync(gap);
          }

          if (action === "esc" || action === "backdrop") {
            // A hidden tree has no listener and nothing to click: its effects
            // are unmounted, so gestures only exist on a visible drawer.
            if (offScreen()) return;

            if (action === "esc") {
              fireEvent.keyDown(window, { key: "Escape" });
            } else {
              fireEvent.click(document.querySelector(".wd-expand-backdrop")!);
            }
          } else if (action === "work") {
            // A Work click: the same URL, so only the navigation event says so.
            pushTo("/work", routes["/work"]);
          } else if (action === "route") {
            const path = random() < 0.5 ? "/work" : STUDY;
            pushTo(path, routes[path]);
          } else if (action === "back") {
            // The browser leaves /work*: the ghost flight, then the route goes.
            fireNavigation("/", "traverse");
            scheduleLeave();
          } else if (action === "leave") {
            scheduleLeave();
          } else {
            showTo("/work", routes["/work"]);
          }
        });

        if (gap === 0) {
          await act(async () => {});
        }
      }

      await settle();
      assertConsistent(run);
    }

    delete (window as { navigation?: unknown }).navigation;
  }

  it("settles consistently through 200 random open/close storms", async () => {
    await runStorm(true);
  }, 40_000);

  it("settles through the storms without the Navigation API", async () => {
    await runStorm(false);
  }, 40_000);

  it("settles closed and unlocked when the exit never lands, and a later click re-enters", async () => {
    const entry = await renderCached();
    vi.useFakeTimers();

    // The router takes the exit request and nothing leaves.
    mocks.back.mockImplementation(() => {});
    mocks.replace.mockImplementation(() => {});
    mocks.go.mockImplementation(() => {});

    fireEvent.keyDown(window, { key: "Escape" });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    // The flight is over: the shell is closed, off the screen, the page free.
    expect(layerElement()).toHaveAttribute("data-phase", "closed");
    expect(document.body.style.overflow).toBe("");
    expect(document.querySelector("body > main")).not.toHaveAttribute("inert");

    // Nothing reopens it by itself, however long the route takes.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(4000);
    });
    expect(layerElement()).toHaveAttribute("data-phase", "closed");
    expect(document.body.style.overflow).toBe("");

    // A real re-entry - the Work link - opens it again.
    const link = document.createElement("a");
    link.setAttribute("href", "/work");
    link.addEventListener("click", (event) => event.preventDefault());
    document.body.append(link);
    fireEvent.click(link);
    link.remove();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(layerElement()).toHaveAttribute("data-phase", "open");
    expect(panelElement().style.transform).toBe("");
    expect(document.body.style.overflow).toBe("hidden");
    expect(document.querySelector("body > main")).toHaveAttribute("inert");
    expect(entry.control.current).not.toBeNull();
  });

  it("stays closed while a slow exit lands, and never reopens by itself", async () => {
    const entry = await renderCached();
    vi.useFakeTimers();

    // The route leaves after three seconds, as a throttled exit does.
    const leave = () => {
      window.history.replaceState({}, "", "/");
      mocks.pathname = "/";
      act(() => entry.control.current?.setHidden(true));
    };
    mocks.back.mockImplementation(() => {
      window.setTimeout(leave, 3000);
    });
    mocks.replace.mockImplementation(() => {
      window.setTimeout(leave, 3000);
    });
    mocks.go.mockImplementation(() => {
      window.setTimeout(leave, 3000);
    });

    fireEvent.keyDown(window, { key: "Escape" });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(layerElement()).toHaveAttribute("data-phase", "closed");

    // Past the old fallback window the shell is still closed, not open again.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(layerElement()).toHaveAttribute("data-phase", "closed");
    expect(document.body.style.overflow).toBe("");

    // The slow exit lands: the tree hides and the shell stays closed.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });
    expect(layerElement()).toHaveAttribute("data-phase", "closed");
    expect(getComputedStyle(layerElement()).display).toBe("none");
    expect(document.body.style.overflow).toBe("");
  });
});
