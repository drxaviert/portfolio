import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SystemParamsContext } from "@/app/design-system/system-shell";
import type { GlideSpring } from "@/components/home/glide-spring";
import { TokenRow } from "@/components/system/token-row";
import type { useSystemParams } from "@/lib/system/use-system-params";
import { DEFAULT_PARAMS } from "@/lib/system/params";

type System = ReturnType<typeof useSystemParams>;

let listeners: Array<(tokens: Record<string, string>) => void> = [];
let values: Record<string, string> = {};

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

function renderRow() {
  return render(
    <SystemParamsContext value={makeSystem()}>
      <TokenRow token="--radius-lg" usage="Use for cards, not for pills." />
    </SystemParamsContext>,
  );
}

beforeEach(() => {
  listeners = [];
  values = { "--radius-lg": "12px" };
  const original = window.getComputedStyle.bind(window);

  vi.spyOn(window, "getComputedStyle").mockImplementation((element, pseudo) => {
    if (element === document.documentElement) {
      return {
        getPropertyValue: (name: string) =>
          values[name] ?? original(element, pseudo).getPropertyValue(name),
      } as CSSStyleDeclaration;
    }

    return original(element, pseudo);
  });

  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText: vi.fn(() => Promise.resolve()) },
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("TokenRow", () => {
  it("shows the live computed value on mount and follows engine frames", () => {
    renderRow();

    expect(screen.getByText("12px")).toBeInTheDocument();

    values["--radius-lg"] = "18px";
    act(() => listeners.forEach((listener) => listener({})));

    expect(screen.getByText("18px")).toBeInTheDocument();
  });

  it("prefers the value the engine just wrote over computed style", () => {
    renderRow();

    values["--radius-lg"] = "18px";
    act(() =>
      listeners.forEach((listener) =>
        listener({ "--radius-lg": "24px" }),
      ),
    );

    expect(screen.getByText("24px")).toBeInTheDocument();
    expect(screen.queryByText("18px")).not.toBeInTheDocument();
  });

  it("copies the token name and reverts Copied after 1500ms", () => {
    vi.useFakeTimers();
    renderRow();

    fireEvent.click(screen.getByRole("button", { name: "Copy --radius-lg" }));

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith("--radius-lg");
    expect(screen.getByText("Copied")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1500);
    });

    expect(screen.queryByText("Copied")).not.toBeInTheDocument();
    expect(screen.getByText("Copy")).toBeInTheDocument();
  });

  it("truncates long values instead of pushing the row wider", () => {
    values["--radius-lg"] = "--radius-lg: ".repeat(30);
    renderRow();

    expect(screen.getByText(/--radius-lg: --radius-lg/)).toHaveClass("truncate");
  });
});
