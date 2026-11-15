import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SystemParamsContext } from "@/app/design-system/system-shell";
import {
  GLIDE_LEAD_SPRING,
  GLIDE_TRAIL_SPRING,
  stepEdge,
} from "@/components/home/glide-spring";
import type { GlideSpring } from "@/components/home/glide-spring";
import {
  NavGlideDemo,
  NavItemSample,
} from "@/components/system/samples/nav-item-sample";
import type { useSystemParams } from "@/lib/system/use-system-params";
import { DEFAULT_PARAMS } from "@/lib/system/params";

vi.mock("@/components/home/glide-spring", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/components/home/glide-spring")>();

  return { ...actual, stepEdge: vi.fn(actual.stepEdge) };
});

type System = ReturnType<typeof useSystemParams>;

let frames: FrameRequestCallback[] = [];
let reducedMotion = false;
const spring = vi.fn((base: GlideSpring) => ({
  stiffness: base.stiffness * 4,
  dampingRatio: base.dampingRatio,
}));

function makeSystem(): System {
  return {
    params: DEFAULT_PARAMS,
    setParam: vi.fn(),
    reset: vi.fn(),
    sitePhase: "day",
    engine: {
      set: vi.fn(),
      get: () => DEFAULT_PARAMS,
      subscribe: () => () => {},
      spring,
      dispose: vi.fn(),
    },
  } as unknown as System;
}

function stubRect(element: Element, left: number, width: number): void {
  vi.spyOn(element, "getBoundingClientRect").mockReturnValue({
    left,
    right: left + width,
    top: 0,
    bottom: 32,
    width,
    height: 32,
    x: left,
    y: 0,
    toJSON: () => ({}),
  } as DOMRect);
}

function rects(): {
  run: Element;
  work: HTMLElement;
  play: HTMLElement;
  about: HTMLElement;
} {
  const run = document.querySelector("[data-nav-run]") as Element;
  const work = screen.getByRole("link", { name: "Work" });
  const play = screen.getByRole("link", { name: "Play" });
  const about = screen.getByRole("link", { name: "About" });

  stubRect(run, 100, 400);
  stubRect(work, 110, 40);
  stubRect(play, 160, 40);
  stubRect(about, 210, 50);

  return { run, work, play, about };
}

function renderDemo() {
  return render(
    <SystemParamsContext value={makeSystem()}>
      <NavGlideDemo />
    </SystemParamsContext>,
  );
}

function flush(now: number): void {
  const queued = frames.splice(0);

  act(() => queued.forEach((callback) => callback(now)));
}

beforeEach(() => {
  frames = [];
  reducedMotion = false;
  vi.mocked(stepEdge).mockClear();
  spring.mockClear();

  vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
    frames.push(callback);

    return frames.length;
  });
  vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      matches: query.includes("prefers-reduced-motion") ? reducedMotion : false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
});

afterEach(() => {
  Reflect.deleteProperty(window, "matchMedia");
  vi.restoreAllMocks();
});

describe("NavItemSample", () => {
  it("forces the requested state on the root", () => {
    const { container } = render(
      <NavItemSample label="Work" forceState="active" active />,
    );

    expect(container.firstElementChild).toHaveAttribute(
      "data-state",
      "active",
    );
    expect(screen.getByRole("link", { name: "Work" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("shows the shared capsule for hover and focus states", () => {
    const { container, rerender } = render(
      <NavItemSample label="Work" forceState="rest" />,
    );
    const capsule = () => container.querySelector(".nav-glide");

    expect(capsule()).not.toHaveAttribute("data-visible");

    rerender(<NavItemSample label="Work" forceState="hover" />);
    expect(capsule()).toHaveAttribute("data-visible");

    rerender(<NavItemSample label="Work" forceState="focus-visible" />);
    expect(capsule()).toHaveAttribute("data-visible");
  });
});

describe("NavGlideDemo", () => {
  it("places the capsule exactly on the first hovered item", () => {
    const { container } = renderDemo();
    const { work } = rects();

    fireEvent.pointerEnter(work, { pointerType: "mouse" });

    const capsule = container.querySelector(".nav-glide") as HTMLElement;

    expect(capsule).toHaveAttribute("data-visible");
    expect(capsule.style.clipPath).toContain("0 calc(100% - 50px) 0 10px");
  });

  it("moves the capsule with keyboard focus", () => {
    const { container } = renderDemo();
    const { about } = rects();

    act(() => about.focus());

    const capsule = container.querySelector(".nav-glide") as HTMLElement;

    expect(capsule).toHaveAttribute("data-visible");
    expect(capsule.style.clipPath).toContain("0 calc(100% - 160px) 0 110px");
  });

  it("steps retargets with the engine-scaled springs", () => {
    renderDemo();
    const { work, about } = rects();

    fireEvent.pointerEnter(work, { pointerType: "mouse" });
    fireEvent.pointerEnter(about, { pointerType: "mouse" });

    const now = performance.now() + 200;

    flush(now);

    const leadCall = vi
      .mocked(stepEdge)
      .mock.calls.find(([, , , value]) => value.stiffness === 4400);
    const trailCall = vi
      .mocked(stepEdge)
      .mock.calls.find(([, , , value]) => value.stiffness === 3600);

    expect(spring).toHaveBeenCalledWith(GLIDE_LEAD_SPRING);
    expect(spring).toHaveBeenCalledWith(GLIDE_TRAIL_SPRING);
    expect(leadCall).toBeDefined();
    expect(trailCall).toBeDefined();
  });

  it("jumps instantly under reduced motion", () => {
    reducedMotion = true;

    const { container } = renderDemo();
    const { work, about } = rects();
    const capsule = container.querySelector(".nav-glide") as HTMLElement;

    fireEvent.pointerEnter(work, { pointerType: "mouse" });
    fireEvent.pointerEnter(about, { pointerType: "mouse" });

    expect(capsule.style.clipPath).toContain(
      "0 calc(100% - 160px) 0 110px",
    );
    expect(capsule.style.display).toBe("block");
  });
});
