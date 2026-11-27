import { readFileSync } from "node:fs";
import { join } from "node:path";
import { act, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type CreatedOptions = {
  wrapper?: Element;
  content?: Element;
  eventsTarget?: Element;
  lerp?: number;
  autoRaf?: boolean;
  wheelMultiplier?: number;
  syncTouch?: boolean;
  allowNestedScroll?: boolean;
  [key: string]: unknown;
};

const lenis = vi.hoisted(() => ({
  created: [] as CreatedOptions[],
  instances: new Map<Element, unknown>(),
  destroy: vi.fn(),
}));

vi.mock("lenis", () => ({
  default: class MockLenis {
    static get(element: Element) {
      return lenis.instances.get(element);
    }

    isScrolling: boolean | "native" | "smooth" = false;
    animatedScroll = 0;
    actualScroll = 0;
    scrollTo = vi.fn();

    constructor(options: CreatedOptions) {
      lenis.created.push(options);
      lenis.instances.set(options.wrapper ?? document.documentElement, this);
    }

    destroy = lenis.destroy;
  },
}));

import { SmoothScroll } from "./smooth-scroll";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

/** A matchMedia whose preference can be flipped, as the OS can flip it. */
let reduced = false;
const listeners = new Set<() => void>();

function stubReducedMotion(matches: boolean) {
  reduced = matches;
  listeners.clear();

  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches: reduced,
      media: query,
      onchange: null,
      addEventListener: (_event: string, listener: () => void) => {
        listeners.add(listener);
      },
      removeEventListener: (_event: string, listener: () => void) => {
        listeners.delete(listener);
      },
      addListener: (listener: () => void) => {
        listeners.add(listener);
      },
      removeListener: (listener: () => void) => {
        listeners.delete(listener);
      },
      dispatchEvent: () => false,
    })),
  );
}

function flipReducedMotion(matches: boolean) {
  reduced = matches;

  act(() => {
    for (const listener of [...listeners]) listener();
  });
}

/** The live reader plus the drawer shell it lives in. */
function mountReader({
  phase = "open",
  leave = false,
}: { phase?: string; leave?: boolean } = {}) {
  document.body.innerHTML = `
    <main></main>
    <div class="wd-expand-layer" data-phase="${phase}">
      <div class="wd-drawer-view"${leave ? ' data-leave=""' : ""}>
        <div id="wd-reader-scroll" class="wd-reader-scroll">
          <div class="wd-reader-column">
            <button type="button">Back to top</button>
          </div>
        </div>
      </div>
    </div>
  `;

  return document.getElementById("wd-reader-scroll") as HTMLElement;
}

type FakeLenis = {
  isScrolling: boolean | "native" | "smooth";
  animatedScroll: number;
  actualScroll: number;
  scrollTo: ReturnType<typeof vi.fn>;
};

function instanceFor(element: Element): FakeLenis {
  return lenis.instances.get(element) as FakeLenis;
}

/** Let the effect's first animation frame run, as a real paint would. */
async function settle() {
  await act(async () => {
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => resolve());
    });
  });
}

async function renderSmooth() {
  const view = render(<SmoothScroll />);
  await settle();
  return view;
}

beforeEach(() => {
  document.body.innerHTML = "";
  lenis.created.length = 0;
  lenis.instances.clear();
  lenis.destroy.mockClear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("SmoothScroll", () => {
  it("mounts the trial options on the live reader and leaves no DOM", async () => {
    stubReducedMotion(false);
    const reader = mountReader();

    const { container, unmount } = await renderSmooth();

    expect(container).toBeEmptyDOMElement();
    expect(lenis.created).toHaveLength(1);
    expect(lenis.created[0]).toMatchObject({
      lerp: 0.1,
      autoRaf: true,
      wheelMultiplier: 1,
      syncTouch: false,
      allowNestedScroll: false,
    });
    expect(lenis.created[0].wrapper).toBe(reader);
    expect(lenis.created[0].content).toBe(
      reader.querySelector(".wd-reader-column"),
    );
    expect(lenis.created[0].eventsTarget).toBe(reader);

    unmount();

    expect(lenis.destroy).toHaveBeenCalledTimes(1);
  });

  it("never adopts the index, the canvas or another nested scroller", async () => {
    stubReducedMotion(false);
    document.body.innerHTML = `
      <main></main>
      <div class="wd-expand-layer" data-phase="open">
        <div class="wd-drawer-view">
          <div id="wd-index-scroll" class="wd-index-scroll"></div>
        </div>
      </div>
      <div class="cv-reader"><div class="cv-surface"></div></div>
      <div class="other-scroller" style="overflow-y: auto; height: 80px">
        <div style="height: 800px"></div>
      </div>
    `;

    await renderSmooth();

    expect(lenis.created).toHaveLength(0);
  });

  it("ignores the outgoing copy and a closed shell", async () => {
    stubReducedMotion(false);
    mountReader({ leave: true });

    const first = await renderSmooth();

    expect(lenis.created).toHaveLength(0);
    first.unmount();

    mountReader({ phase: "closed" });
    await renderSmooth();

    expect(lenis.created).toHaveLength(0);
  });

  it("rebinds to the next study's reader and destroys the old one", async () => {
    stubReducedMotion(false);
    const first = mountReader();

    await renderSmooth();

    expect(lenis.created).toHaveLength(1);

    const second = document.createElement("div");
    second.id = "wd-reader-scroll";
    second.className = "wd-reader-scroll";
    second.innerHTML = '<div class="wd-reader-column"></div>';
    first.replaceWith(second);

    await waitFor(() => expect(lenis.created).toHaveLength(2));

    expect(lenis.created[1].wrapper).toBe(second);
    expect(lenis.destroy).toHaveBeenCalledTimes(1);
  });

  it("stops inertia on a pointerdown inside the reader", async () => {
    stubReducedMotion(false);
    const reader = mountReader();

    await renderSmooth();

    const instance = instanceFor(reader);
    instance.isScrolling = "smooth";
    instance.animatedScroll = 900;
    instance.actualScroll = 700;

    act(() => {
      reader
        .querySelector("button")
        ?.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    });

    expect(instance.scrollTo).toHaveBeenCalledWith(700, {
      immediate: true,
      force: true,
    });
  });

  it("does not stop inertia for a pointerdown outside the reader", async () => {
    stubReducedMotion(false);
    const reader = mountReader();

    await renderSmooth();

    const instance = instanceFor(reader);
    instance.isScrolling = "smooth";
    instance.animatedScroll = 900;
    instance.actualScroll = 700;

    act(() => {
      document.body.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    });

    expect(instance.scrollTo).not.toHaveBeenCalled();
  });

  it("stops inertia on a key press inside the reader", async () => {
    stubReducedMotion(false);
    const reader = mountReader();

    await renderSmooth();

    const instance = instanceFor(reader);
    instance.isScrolling = "smooth";
    instance.animatedScroll = 900;
    instance.actualScroll = 700;

    act(() => {
      reader
        .querySelector("button")
        ?.dispatchEvent(new Event("keydown", { bubbles: true }));
    });

    expect(instance.scrollTo).toHaveBeenCalledWith(700, {
      immediate: true,
      force: true,
    });
  });

  it("yields to a native scroll that leaves Lenis' last write", async () => {
    stubReducedMotion(false);
    const reader = mountReader();

    await renderSmooth();

    const instance = instanceFor(reader);
    instance.isScrolling = "smooth";
    instance.animatedScroll = 900;
    instance.actualScroll = 900;

    act(() => {
      reader.dispatchEvent(new Event("scroll"));
    });

    expect(instance.scrollTo).not.toHaveBeenCalled();

    instance.actualScroll = 420;

    act(() => {
      reader.dispatchEvent(new Event("scroll"));
    });

    expect(instance.scrollTo).toHaveBeenCalledWith(420, {
      immediate: true,
      force: true,
    });
  });

  it("stays on native scroll under prefers-reduced-motion", async () => {
    stubReducedMotion(true);
    mountReader();

    await renderSmooth();

    expect(lenis.created).toHaveLength(0);
  });

  it("destroys on the preference turning on and rebinds when it clears", async () => {
    stubReducedMotion(false);
    mountReader();

    await renderSmooth();

    expect(lenis.created).toHaveLength(1);

    flipReducedMotion(true);

    expect(lenis.destroy).toHaveBeenCalledTimes(1);

    flipReducedMotion(false);
    await settle();

    expect(lenis.created).toHaveLength(2);
  });

  it("removes listeners and destroys the instance on unmount", async () => {
    stubReducedMotion(false);
    const reader = mountReader();

    const { unmount } = await renderSmooth();
    const instance = instanceFor(reader);

    instance.isScrolling = "smooth";
    instance.animatedScroll = 900;
    instance.actualScroll = 700;
    unmount();

    act(() => {
      reader.dispatchEvent(new Event("scroll"));
      reader.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    });

    expect(instance.scrollTo).not.toHaveBeenCalled();
    expect(lenis.destroy).toHaveBeenCalledTimes(1);
  });

  it("ships the standard Lenis rules with the overscroll lock", () => {
    const css = read("src/components/motion/smooth-scroll.css");

    expect(css).toMatch(/html\.lenis\s*\{\s*overscroll-behavior:\s*none;/);
    expect(css).toMatch(/html\.lenis body\s*\{\s*height:\s*auto;/);
    expect(css).toMatch(
      /\.lenis\.lenis-smooth iframe\s*\{\s*pointer-events:\s*none;/,
    );
    expect(css).toMatch(
      /\[data-lenis-prevent\][\s\S]*?overscroll-behavior:\s*contain;/,
    );
  });

  it("keeps the canvas, focus viewer and art dialog explicitly excluded", () => {
    const surfaces = [
      ["src/components/canvas/infinite-canvas.tsx", "cv-surface"],
      ["src/components/canvas/focus-viewer.tsx", "cv-viewer"],
      ["src/components/home/art-card/art-dialog.tsx", "art-dialog"],
    ] as const;

    for (const [file, className] of surfaces) {
      const source = read(file);

      expect(source).toMatch(
        new RegExp(`className="${className}"[\\s\\S]{0,80}data-lenis-prevent`),
      );
    }
  });
});
