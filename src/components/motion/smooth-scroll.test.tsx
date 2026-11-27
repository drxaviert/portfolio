import { readFileSync } from "node:fs";
import { join } from "node:path";
import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const lenis = vi.hoisted(() => ({
  created: [] as unknown[],
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

    constructor(options: unknown) {
      lenis.created.push(options);
      lenis.instances.set(document.documentElement, this);
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

beforeEach(() => {
  lenis.created.length = 0;
  lenis.instances.clear();
  lenis.destroy.mockClear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("SmoothScroll", () => {
  it("mounts the trial options and leaves no DOM", () => {
    stubReducedMotion(false);

    const { container, unmount } = render(<SmoothScroll />);

    expect(container).toBeEmptyDOMElement();
    expect(lenis.created).toHaveLength(1);
    expect(lenis.created[0]).toMatchObject({
      lerp: 0.1,
      autoRaf: true,
      wheelMultiplier: 1,
      syncTouch: false,
      allowNestedScroll: "smooth",
      stopInertiaOnNavigate: true,
    });

    unmount();

    expect(lenis.destroy).toHaveBeenCalledTimes(1);
  });

  it("stays on native scroll under prefers-reduced-motion", () => {
    stubReducedMotion(true);

    render(<SmoothScroll />);

    expect(lenis.created).toHaveLength(0);
  });

  it("destroys on the preference turning on and remounts when it clears", () => {
    stubReducedMotion(false);

    render(<SmoothScroll />);

    expect(lenis.created).toHaveLength(1);

    flipReducedMotion(true);

    expect(lenis.destroy).toHaveBeenCalledTimes(1);

    flipReducedMotion(false);

    expect(lenis.created).toHaveLength(2);
  });

  it("lets a native programmatic scroll win over Lenis inertia", () => {
    stubReducedMotion(false);

    render(<SmoothScroll />);

    const instance = [...lenis.instances.values()][0] as {
      isScrolling: boolean | "native" | "smooth";
      animatedScroll: number;
      actualScroll: number;
      scrollTo: ReturnType<typeof vi.fn>;
    };

    instance.isScrolling = "smooth";
    instance.animatedScroll = 900;
    instance.actualScroll = 900;

    document.dispatchEvent(new Event("scroll"));

    expect(instance.scrollTo).not.toHaveBeenCalled();

    // The browser has started its own smooth scroll from the wheel's target.
    instance.actualScroll = 420;

    document.dispatchEvent(new Event("scroll"));

    expect(instance.scrollTo).toHaveBeenCalledWith(420, {
      immediate: true,
      force: true,
    });
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

  it("keeps the canvas, focus viewer and art dialog out of Lenis", () => {
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
