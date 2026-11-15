import { render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SystemEngineContext, SystemParamsContext } from "@/app/design-system/system-shell";
import { MotionSection } from "@/app/design-system/sections/motion";
import { M3_DURATIONS } from "@/lib/system/m3-scale";
import type { GlideSpring } from "@/components/home/glide-spring";
import type { useSystemParams } from "@/lib/system/use-system-params";
import { DEFAULT_PARAMS } from "@/lib/system/params";
import { EASES, DURATIONS } from "@/lib/system/source.generated";

type System = ReturnType<typeof useSystemParams>;

function makeSystem(): System {
  return {
    params: { ...DEFAULT_PARAMS, speed: 2 },
    setParam: vi.fn(),
    reset: vi.fn(),
    sitePhase: "day",
    engine: {
      set: vi.fn(),
      get: () => ({ ...DEFAULT_PARAMS, speed: 2 }),
      subscribe: () => () => {},
      // Mirrors the engine's corrected time scaling: speed ×2 -> stiffness ×4.
      spring: (base: GlideSpring) => ({
        stiffness: base.stiffness * 4,
        dampingRatio: base.dampingRatio,
      }),
      dispose: vi.fn(),
    },
  } as unknown as System;
}

function renderMotion() {
  const system = makeSystem();

  return render(
    <SystemParamsContext value={system}>
      <SystemEngineContext value={system.engine}>
        <MotionSection />
      </SystemEngineContext>
    </SystemParamsContext>,
  );
}

beforeEach(() => {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      matches: false,
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

describe("MotionSection", () => {
  it("renders one demo per duration and per easing", () => {
    renderMotion();

    expect(screen.getAllByRole("button", { name: "Replay" })).toHaveLength(
      Object.keys(DURATIONS).length + Object.keys(EASES).length,
    );
  });

  it("lists every M3 duration with today's nearest token", () => {
    renderMotion();

    const table = screen.getByRole("table", { name: /duration comparison/i });
    const rows = within(table).getAllByRole("row");

    expect(rows).toHaveLength(M3_DURATIONS.length + 1);

    for (const entry of M3_DURATIONS) {
      expect(
        within(table).queryAllByText(`${entry.ms}ms`).length,
      ).toBeGreaterThan(0);
    }
  });

  it("shows the Glide springs scaled by the engine", () => {
    renderMotion();

    expect(screen.getAllByText("4400").length).toBeGreaterThan(0);
    expect(screen.getAllByText("3600").length).toBeGreaterThan(0);
    expect(screen.getAllByText("0.9").length).toBeGreaterThan(0);
  });
});
