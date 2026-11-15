import { act, fireEvent, render, screen } from "@testing-library/react";
import type { JSX } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useContentVisibility } from "./use-content-visibility";

function Probe({
  id,
  height,
}: {
  id: string;
  height: number;
}): JSX.Element {
  const ref = useContentVisibility<HTMLDivElement>();

  return <div ref={ref} data-testid={id} data-height={height} />;
}

type LogEntry =
  | { kind: "visibility"; id: string; value: string }
  | { kind: "intrinsic"; id: string; value: string }
  | { kind: "read"; id: string; visibility: string };

let log: LogEntry[] = [];
let originalStyle: typeof window.getComputedStyle;

beforeEach(() => {
  log = [];
  originalStyle = window.getComputedStyle.bind(window);

  vi.spyOn(window, "getComputedStyle").mockImplementation((element) => {
    if (element instanceof HTMLElement && element.hasAttribute("data-testid")) {
      return {
        paddingTop: "10px",
        paddingBottom: "6px",
        borderTopWidth: "2px",
        borderBottomWidth: "2px",
      } as CSSStyleDeclaration;
    }

    return originalStyle(element);
  });

  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
    function (this: HTMLElement) {
      const height = Number(this.dataset.height ?? 120);
      const id = this.dataset.testid ?? "unknown";

      log.push({
        kind: "read",
        id,
        visibility: this.style.contentVisibility,
      });

      return {
        top: 0,
        bottom: height,
        height,
        left: 0,
        right: 320,
        width: 320,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      } as DOMRect;
    },
  );
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

function instrument(probe: HTMLElement): void {
  let intrinsic = probe.style.containIntrinsicSize;
  let visibility = probe.style.contentVisibility;

  Object.defineProperty(probe.style, "containIntrinsicSize", {
    configurable: true,
    get: () => intrinsic,
    set: (value: string) => {
      intrinsic = value;
      log.push({ kind: "intrinsic", id: probe.dataset.testid!, value });
    },
  });

  Object.defineProperty(probe.style, "contentVisibility", {
    configurable: true,
    get: () => visibility,
    set: (value: string) => {
      visibility = value;
      log.push({ kind: "visibility", id: probe.dataset.testid!, value });
    },
  });
}

describe("useContentVisibility", () => {
  it("subtracts the content-box padding and border from the rect", () => {
    render(<Probe id="probe" height={120} />);

    const probe = screen.getByTestId("probe");

    expect(probe.style.contentVisibility).toBe("auto");
    // 120 border-box - (10 + 6 padding) - (2 + 2 border) = 100 content-box.
    expect(probe.style.containIntrinsicSize).toMatch(/^auto 100(\.00)?px$/);
  });

  it("reveals, reads every element, then re-lazies in order", () => {
    vi.useFakeTimers();
    render(
      <>
        <Probe id="first" height={120} />
        <Probe id="second" height={200} />
      </>,
    );

    const first = screen.getByTestId("first");
    const second = screen.getByTestId("second");

    instrument(first);
    instrument(second);
    log = [];

    first.dataset.height = "160";
    second.dataset.height = "240";

    fireEvent(window, new Event("resize"));

    act(() => {
      vi.advanceTimersByTime(150);
    });

    const reads = log.filter((entry) => entry.kind === "read");
    const lastReveal = log
      .map((entry) => entry.kind === "visibility" && entry.value === "visible")
      .lastIndexOf(true);
    const firstRead = log.findIndex((entry) => entry.kind === "read");
    const lastRead = log
      .map((entry) => entry.kind === "read")
      .lastIndexOf(true);
    const firstIntrinsic = log.findIndex(
      (entry) => entry.kind === "intrinsic",
    );

    expect(reads).toHaveLength(2);
    expect(reads.every((entry) => entry.visibility === "visible")).toBe(true);
    expect(lastReveal).toBeGreaterThanOrEqual(0);
    expect(lastReveal).toBeLessThan(firstRead);
    expect(firstIntrinsic).toBeGreaterThan(lastRead);

    expect(first.style.contentVisibility).toBe("auto");
    expect(second.style.contentVisibility).toBe("auto");
    expect(first.style.containIntrinsicSize).toMatch(/^auto 140(\.00)?px$/);
    expect(second.style.containIntrinsicSize).toMatch(/^auto 220(\.00)?px$/);
  });
});
