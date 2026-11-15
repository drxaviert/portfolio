import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SystemParamsContext } from "@/app/design-system/system-shell";
import type { GlideSpring } from "@/components/home/glide-spring";
import { MotionDemo } from "@/components/system/motion-demo";
import type { useSystemParams } from "@/lib/system/use-system-params";
import { DEFAULT_PARAMS } from "@/lib/system/params";
import { EASES } from "@/lib/system/source.generated";

type System = ReturnType<typeof useSystemParams>;

let listeners: Array<(tokens: Record<string, string>) => void> = [];
let reducedMotion = false;

const animate = vi.fn(() => ({
  cancel: vi.fn(),
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
      subscribe: (listener: (tokens: Record<string, string>) => void) => {
        listeners.push(listener);

        return () => {
          listeners = listeners.filter((entry) => entry !== listener);
        };
      },
      spring: (base: GlideSpring) => base,
      dispose: vi.fn(),
    },
  } as unknown as System;
}

function renderDemo(token = "--duration-medium-5") {
  return render(
    <SystemParamsContext value={makeSystem()}>
      <MotionDemo kind="duration" token={token} />
    </SystemParamsContext>,
  );
}

function emit(tokens: Record<string, string>): void {
  act(() => listeners.forEach((listener) => listener(tokens)));
}

beforeEach(() => {
  listeners = [];
  reducedMotion = false;
  animate.mockClear();

  Object.defineProperty(HTMLElement.prototype, "animate", {
    configurable: true,
    writable: true,
    value: animate,
  });
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
  Reflect.deleteProperty(HTMLElement.prototype, "animate");
  Reflect.deleteProperty(window, "matchMedia");
  vi.restoreAllMocks();
});

describe("MotionDemo", () => {
  it("labels the live duration and easing and replays with those values", () => {
    const { container } = renderDemo();

    emit({
      "--duration-medium-5": "150ms",
      "--ease-emphasized-standard": "cubic-bezier(0.32, 0.72, 0, 1)",
    });

    expect(screen.getByText("150ms")).toBeInTheDocument();
    expect(
      screen.getByText("cubic-bezier(0.32, 0.72, 0, 1)"),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Replay" }));

    expect(animate).toHaveBeenCalledTimes(1);
    expect(animate).toHaveBeenCalledWith(
      expect.any(Array),
      expect.objectContaining({
        duration: 150,
        easing: "cubic-bezier(0.32, 0.72, 0, 1)",
      }),
    );

    const frames = (
      animate.mock.calls as unknown as Array<
        [Keyframe[], KeyframeAnimationOptions]
      >
    )[0][0];

    expect(frames[1].transform).toContain("100cqw");
    expect(container.querySelector("[data-motion-dot]")).toBeInTheDocument();
  });

  it("rounds the visible label to whole ms but animates the exact value", () => {
    renderDemo();

    emit({
      "--duration-medium-5": "272.727ms",
      "--ease-emphasized-standard": "cubic-bezier(0.32, 0.72, 0, 1)",
    });

    expect(screen.getByText("273ms")).toBeInTheDocument();
    expect(screen.queryByText("272.727ms")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Replay" }));

    expect(animate).toHaveBeenCalledWith(
      expect.any(Array),
      expect.objectContaining({ duration: 272.727 }),
    );
  });

  it("converts second-based tokens to milliseconds", () => {
    renderDemo("--duration-ambient-1");
    emit({ "--duration-ambient-1": "8s" });

    fireEvent.click(screen.getByRole("button", { name: "Replay" }));

    expect(animate).toHaveBeenCalledWith(
      expect.any(Array),
      expect.objectContaining({ duration: 8000 }),
    );
  });

  it("shows the end state without animating under reduced motion", () => {
    reducedMotion = true;

    const { container } = renderDemo();
    const dot = container.querySelector("[data-motion-dot]") as HTMLElement;

    fireEvent.click(screen.getByRole("button", { name: "Replay" }));

    expect(animate).not.toHaveBeenCalled();
    expect(dot.style.transform).toContain("100cqw");
  });

  it("uses the live ease token when documenting an easing", () => {
    render(
      <SystemParamsContext value={makeSystem()}>
        <MotionDemo kind="ease" token="--ease-spring" />
      </SystemParamsContext>,
    );

    emit({ "--ease-spring": "cubic-bezier(0.34, 1.3, 0.64, 1)" });

    expect(
      screen.getByText("cubic-bezier(0.34, 1.3, 0.64, 1)"),
    ).toBeInTheDocument();
    expect(screen.getByText(EASES["--ease-spring"])).toBeInTheDocument();
  });
});
