import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SystemParamsContext } from "@/app/design-system/system-shell";
import { ColourSection } from "@/app/design-system/sections/colour";
import type { GlideSpring } from "@/components/home/glide-spring";
import type { useSystemParams } from "@/lib/system/use-system-params";
import { DEFAULT_PARAMS } from "@/lib/system/params";
import { PALETTE } from "@/lib/system/source.generated";

type System = ReturnType<typeof useSystemParams>;

function makeSystem(): System {
  return {
    params: DEFAULT_PARAMS,
    setParam: vi.fn(),
    reset: vi.fn(),
    sitePhase: "day",
    engine: {
      set: vi.fn(),
      get: () => DEFAULT_PARAMS,
      subscribe: () => () => {},
      spring: (base: GlideSpring) => base,
      dispose: vi.fn(),
    },
  } as unknown as System;
}

beforeEach(() => {
  const original = window.getComputedStyle.bind(window);

  vi.spyOn(window, "getComputedStyle").mockImplementation((element, pseudo) => {
    if (element === document.documentElement) {
      return {
        getPropertyValue: (name: string) =>
          original(element, pseudo).getPropertyValue(name),
      } as CSSStyleDeclaration;
    }

    return original(element, pseudo);
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("ColourSection", () => {
  it("renders one row per palette token, grouped by family", () => {
    const { container } = render(
      <SystemParamsContext value={makeSystem()}>
        <ColourSection />
      </SystemParamsContext>,
    );

    const paletteRows = container.querySelectorAll('[data-token^="--palette-"]');

    expect(paletteRows).toHaveLength(Object.keys(PALETTE).length);
    expect(container.textContent).toContain("Neutral");
    expect(container.textContent).toContain("--palette-blue-600");
  });

  it("shows the current role values plus a static defaults table", () => {
    const { container } = render(
      <SystemParamsContext value={makeSystem()}>
        <ColourSection />
      </SystemParamsContext>,
    );

    expect(container.querySelector('[data-token="--primary"]')).not.toBeNull();
    expect(container.querySelector("table")).not.toBeNull();
    expect(container.textContent).toContain("Defaults per phase");
  });
});
