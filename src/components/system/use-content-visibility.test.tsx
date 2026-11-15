import { act, fireEvent, render, screen } from "@testing-library/react";
import type { JSX } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useContentVisibility } from "./use-content-visibility";

let observers: IntersectionObserverCallback[] = [];

class FakeObserver implements IntersectionObserver {
  readonly root = null;
  readonly rootMargin = "";
  readonly thresholds = [];

  constructor(callback: IntersectionObserverCallback) {
    observers.push(callback);
  }

  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
}

function Probe(): JSX.Element {
  const ref = useContentVisibility<HTMLDivElement>("row");

  return <div ref={ref} data-testid="probe" />;
}

function intersect(target: Element, isIntersecting: boolean): void {
  act(() => {
    observers.forEach((callback) =>
      callback(
        [{ target, isIntersecting } as IntersectionObserverEntry],
        {} as IntersectionObserver,
      ),
    );
  });
}

let top = 0;

beforeEach(() => {
  observers = [];
  top = 0;
  vi.stubGlobal("IntersectionObserver", FakeObserver);
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
    () =>
      ({
        top,
        bottom: top + 120,
        height: 120,
        left: 0,
        right: 320,
        width: 320,
        x: 0,
        y: top,
        toJSON: () => ({}),
      }) as DOMRect,
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("useContentVisibility", () => {
  it("hides with an intrinsic height and reveals on intersection", () => {
    render(<Probe />);

    const probe = screen.getByTestId("probe");

    intersect(probe, false);

    expect(probe.style.contentVisibility).toBe("hidden");
    expect(probe.style.containIntrinsicSize).toBe("120px");

    intersect(probe, true);

    expect(probe.style.contentVisibility).toBe("visible");
  });

  it("reveals everything for keyboard navigation and re-applies on pointer", () => {
    render(<Probe />);

    const probe = screen.getByTestId("probe");

    top = 5000;
    intersect(probe, false);

    expect(probe.style.contentVisibility).toBe("hidden");

    fireEvent.keyDown(window, { key: "Tab" });
    expect(probe.style.contentVisibility).toBe("visible");

    fireEvent.pointerDown(window);
    expect(probe.style.contentVisibility).toBe("hidden");
  });
});
