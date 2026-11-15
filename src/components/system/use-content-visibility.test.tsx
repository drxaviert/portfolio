import { act, fireEvent, render, screen } from "@testing-library/react";
import type { JSX } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useContentVisibility } from "./use-content-visibility";

function Probe(): JSX.Element {
  const ref = useContentVisibility<HTMLDivElement>();

  return <div ref={ref} data-testid="probe" />;
}

let height = 120;

beforeEach(() => {
  height = 120;
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
    () =>
      ({
        top: 0,
        bottom: height,
        height,
        left: 0,
        right: 320,
        width: 320,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }) as DOMRect,
  );
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("useContentVisibility", () => {
  it("hands layout to the browser while keeping a measured placeholder", () => {
    render(<Probe />);

    const probe = screen.getByTestId("probe");

    expect(probe.style.contentVisibility).toBe("auto");
    expect(probe.style.containIntrinsicSize).toMatch(/^auto 120(\.00)?px$/);
  });

  it("re-measures after a resize so the placeholder follows the layout", () => {
    vi.useFakeTimers();
    render(<Probe />);

    const probe = screen.getByTestId("probe");

    height = 160;
    fireEvent(window, new Event("resize"));

    act(() => {
      vi.advanceTimersByTime(150);
    });

    expect(probe.style.containIntrinsicSize).toMatch(/^auto 160(\.00)?px$/);
  });
});
