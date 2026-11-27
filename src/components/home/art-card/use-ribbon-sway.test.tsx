import { act, render } from "@testing-library/react";
import { useRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useRibbonSway } from "./use-ribbon-sway";

const STRIPS = 18;
const FRAME = 1000 / 60;

function Layer() {
  const ref = useRef<HTMLDivElement>(null);

  useRibbonSway(ref, true);

  return (
    <div ref={ref} data-testid="layer">
      {Array.from({ length: STRIPS }, (_, i) => (
        <span key={i} className="shred-strip">
          {Array.from({ length: 4 }, (_, j) => (
            <span
              key={j}
              className="shred-strip-segment"
              data-root={j === 0 ? "true" : undefined}
            />
          ))}
        </span>
      ))}
    </div>
  );
}

const read = (layer: HTMLElement) =>
  Array.from(layer.children).map(
    (strip) => parseFloat((strip as HTMLElement).style.rotate) || 0,
  );

describe("useRibbonSway", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({ matches: false, addEventListener: vi.fn() })),
    );
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
      left: 0,
      top: 0,
      right: 180,
      bottom: 100,
      width: 180,
      height: 100,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("swings smoothly under a drag, decays, and stops the loop", () => {
    const { getByTestId } = render(<Layer />);
    const layer = getByTestId("layer");
    const fire = (type: string, clientX: number) => {
      const event = new MouseEvent(type, { clientX, bubbles: false });

      Object.defineProperty(event, "timeStamp", {
        value: performance.now(),
      });
      layer.dispatchEvent(event);
    };
    const frames: number[][] = [];
    const frame = () => {
      act(() => {
        vi.advanceTimersByTime(FRAME);
      });
      frames.push(read(layer));
    };

    fire("pointerenter", 0);

    // Drag across all the strips at ~1200px/s (150ms), one event per frame.
    for (let x = 0; x <= 180; x += 20) {
      fire("pointermove", x);
      frame();
    }

    // Let it ring out for 6s.
    for (let i = 0; i < 360; i += 1) frame();

    let maxJump = 0;
    let peak = 0;
    let lastActive = 0;

    frames.forEach((now, f) => {
      now.forEach((value, i) => {
        peak = Math.max(peak, Math.abs(value));
        if (Math.abs(value) > 0.05) lastActive = f;
        if (f > 0)
          maxJump = Math.max(maxJump, Math.abs(value - frames[f - 1][i]));
      });
    });

    expect(peak).toBeGreaterThan(2);
    expect(peak).toBeLessThan(14);
    expect(maxJump).toBeLessThan(1.5);
    // Settled (below 0.05deg) well inside ~3.5s, and the loop stopped.
    expect((lastActive * FRAME) / 1000).toBeLessThan(3.5);
    expect(read(layer).every((value) => value === 0)).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });
});
