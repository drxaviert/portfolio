import { fireEvent, render, waitFor } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GazeOrb } from "./gaze-orb";

const FINE = "(hover: hover) and (pointer: fine)";
const CALM = "(prefers-reduced-motion: reduce)";

function stubPointer({
  fine = true,
  calm = false,
}: {
  fine?: boolean;
  calm?: boolean;
} = {}) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches: query === FINE ? fine : query === CALM ? calm : false,
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

function renderOrb() {
  const { container } = render(<GazeOrb />);
  const orb = container.firstElementChild as HTMLElement;

  orb.getBoundingClientRect = () =>
    ({
      left: 100,
      top: 100,
      width: 36,
      height: 36,
      right: 136,
      bottom: 136,
      x: 100,
      y: 100,
      toJSON: () => ({}),
    }) as DOMRect;

  return { orb, eyes: orb.firstElementChild as HTMLElement };
}

function gaze(eyes: HTMLElement) {
  const match = /translate3d\((-?[\d.]+)px,\s*(-?[\d.]+)px/.exec(
    eyes.style.transform,
  );

  return {
    x: match ? Number(match[1]) : 0,
    y: match ? Number(match[2]) : 0,
  };
}

afterEach(() => {
  delete document.documentElement.dataset.phaseSwitching;
  vi.unstubAllGlobals();
});

describe("GazeOrb", () => {
  it("aims the eyes at a fine pointer", async () => {
    stubPointer();
    const { eyes } = renderOrb();

    // 42px right of the centre of a 36px head, with the shipped 60px reach and
    // full strength: 70% of the 4.5px horizontal range.
    fireEvent.pointerMove(window, {
      clientX: 160,
      clientY: 118,
      pointerType: "mouse",
    });

    await waitFor(() => expect(gaze(eyes).x).toBeCloseTo(3.15, 1));
    expect(gaze(eyes).y).toBeCloseTo(0, 1);
  });

  it("holds its aim through a theme crossfade's synthetic pointer leave", async () => {
    stubPointer();
    const { eyes } = renderOrb();

    fireEvent.pointerMove(window, {
      clientX: 160,
      clientY: 118,
      pointerType: "mouse",
    });
    await waitFor(() => expect(gaze(eyes).x).toBeCloseTo(3.15, 1));

    // A view transition drops hit tests for its length and reports a leave.
    document.documentElement.dataset.phaseSwitching = "click";
    fireEvent.pointerLeave(document.documentElement);
    await new Promise((resolve) => setTimeout(resolve, 120));
    expect(gaze(eyes).x).toBeCloseTo(3.15, 1);

    // A genuine leave still rests the face.
    delete document.documentElement.dataset.phaseSwitching;
    fireEvent.pointerLeave(document.documentElement);
    await waitFor(() => expect(gaze(eyes).x).toBeCloseTo(0, 1));
  });

  it.each([
    ["reduced motion", true, true],
    ["a coarse pointer", false, false],
  ])("rests under %s", async (_label, fine, calm) => {
    stubPointer({ fine, calm });
    const { eyes } = renderOrb();

    fireEvent.pointerMove(window, {
      clientX: 160,
      clientY: 118,
      pointerType: "mouse",
    });
    await new Promise((resolve) => setTimeout(resolve, 120));

    expect(gaze(eyes).x).toBe(0);
    expect(gaze(eyes).y).toBe(0);
  });

  it("keeps Motion out of the nav's first-load module", () => {
    // The nav lives in the root layout; importing motion/react here would put
    // it back into every route's first load. PR #41 removed it (-28.9 kB gzip).
    const source = readFileSync(
      join(process.cwd(), "src", "components", "home", "gaze-orb.tsx"),
      "utf8",
    );

    expect(source).not.toMatch(/from "motion\/react"/);
  });
});
