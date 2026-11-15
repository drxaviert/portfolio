import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SystemEngineContext, SystemParamsContext } from "@/app/design-system/system-shell";
import type { GlideSpring } from "@/components/home/glide-spring";
import { TokenRow } from "@/components/system/token-row";
import type { useSystemParams } from "@/lib/system/use-system-params";
import { DEFAULT_PARAMS } from "@/lib/system/params";

type System = ReturnType<typeof useSystemParams>;

let listeners: Array<(tokens: Record<string, string>) => void> = [];
let values: Record<string, string> = {};
let styleReads = 0;

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

function renderToken(token: string) {
  const system = makeSystem();

  return render(
    <SystemParamsContext value={system}>
      <SystemEngineContext value={system.engine}>
        <TokenRow token={token} usage="Use for cards, not for pills." />
      </SystemEngineContext>
    </SystemParamsContext>,
  );
}

function renderRow() {
  return renderToken("--radius-lg");
}

beforeEach(() => {
  listeners = [];
  values = { "--radius-lg": "12px" };
  styleReads = 0;
  const original = window.getComputedStyle.bind(window);

  vi.spyOn(window, "getComputedStyle").mockImplementation((element, pseudo) => {
    if (element === document.documentElement) {
      return {
        getPropertyValue: (name: string) => {
          styleReads += 1;

          return (
            values[name] ?? original(element, pseudo).getPropertyValue(name)
          );
        },
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

    act(() =>
      listeners.forEach((listener) => listener({ "--radius-lg": "18px" })),
    );

    expect(screen.getByText("18px")).toBeInTheDocument();
  });

  it("reads computed CSS once for a token the engine does not write", () => {
    values["--text-sm"] = "14px";
    renderToken("--text-sm");

    expect(screen.getByText("14px")).toBeInTheDocument();
    expect(styleReads).toBe(1);

    values["--text-sm"] = "16px";
    act(() => listeners.forEach((listener) => listener({})));

    // Static design tokens do not follow parameter frames, and a reread here
    // would force a style recalc of the whole document every frame.
    expect(screen.getByText("14px")).toBeInTheDocument();
    expect(styleReads).toBe(1);
  });

  it("does not rewrite a value that did not change", () => {
    renderRow();

    const value = screen.getByText("12px");
    const textNode = value.firstChild;

    act(() =>
      listeners.forEach((listener) => listener({ "--radius-lg": "12px" })),
    );

    expect(value.firstChild).toBe(textNode);
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
