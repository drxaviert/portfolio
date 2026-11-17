import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RingHoverPointer } from "./ring-pointer";
import { announceStep } from "./step-events";

let queue: FrameRequestCallback[] = [];
let log: string[] = [];

function flushFrame() {
  const run = queue;
  queue = [];
  act(() => run.forEach((callback) => callback(0)));
}

beforeEach(() => {
  queue = [];
  log = [];
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    queue.push(callback);
    return queue.length;
  });
  vi.stubGlobal("cancelAnimationFrame", () => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function setup() {
  const { container } = render(
    <>
      <RingHoverPointer />
      <div className="ring-host" data-testid="host">
        <span className="ring-glow" data-testid="glow" />
      </div>
    </>,
  );
  const host = container.querySelector<HTMLElement>(".ring-host")!;
  const glow = container.querySelector<HTMLElement>(".ring-glow")!;
  let left = 100;

  host.getBoundingClientRect = () => {
    log.push("read");
    return { left, top: 0, width: 200, height: 100 } as DOMRect;
  };
  const set = glow.style.setProperty.bind(glow.style);
  glow.style.setProperty = (name: string, value: string | null) => {
    log.push(`write ${name}`);
    set(name, value);
  };

  return {
    host,
    glow,
    move: (x: number) => {
      left = x;
    },
  };
}

describe("ring glow follow", () => {
  it("reads the box on entry, then writes without re-reading it", () => {
    const { host } = setup();

    act(() => {
      host.dispatchEvent(
        new MouseEvent("pointermove", {
          bubbles: true,
          clientX: 150,
          clientY: 20,
        }),
      );
    });
    // The entry measures the box once; the flush that follows only writes.
    expect(log.filter((entry) => entry === "read")).toHaveLength(1);
    log.length = 0;
    flushFrame();

    expect(log).toEqual(["write --ring-mx", "write --ring-my"]);
  });

  it("follows a card that moves under a still pointer while a step runs, then stops", () => {
    const { host, glow, move } = setup();

    act(() => {
      host.dispatchEvent(
        new MouseEvent("pointermove", {
          bubbles: true,
          clientX: 150,
          clientY: 20,
        }),
      );
    });
    flushFrame();
    const before = glow.style.getPropertyValue("--ring-mx");

    // The step starts; the card moves with no pointer event at all.
    act(() => announceStep("start"));
    move(300);
    flushFrame();
    expect(glow.style.getPropertyValue("--ring-mx")).not.toBe(before);
    // It keeps scheduling frames for as long as the step runs.
    expect(queue).toHaveLength(1);
    move(500);
    flushFrame();
    expect(glow.style.getPropertyValue("--ring-mx")).toBe(
      `${150 - 500 - 100}px`,
    );
    expect(queue).toHaveLength(1);

    // The step ends: one last read lands the glow, then it stops scheduling.
    act(() => announceStep("end"));
    flushFrame();
    expect(queue).toHaveLength(0);
  });
});
