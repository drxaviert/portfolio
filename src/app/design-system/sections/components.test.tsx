import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SystemParamsContext } from "@/app/design-system/system-shell";
import { ComponentsSection } from "@/app/design-system/sections/components";
import type { GlideSpring } from "@/components/home/glide-spring";
import type { useSystemParams } from "@/lib/system/use-system-params";
import { DEFAULT_PARAMS } from "@/lib/system/params";

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

describe("ComponentsSection", () => {
  it("documents the Card with its states, note and consumed tokens", () => {
    const { container } = render(
      <SystemParamsContext value={makeSystem()}>
        <ComponentsSection />
      </SystemParamsContext>,
    );

    expect(screen.getByRole("heading", { name: "Card" })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Nav item + Glide" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Theme toggle" }),
    ).toBeInTheDocument();
    expect(container.textContent).toContain("hover-only today");
    expect(container.querySelectorAll(".ring-host").length).toBeGreaterThan(0);
    expect(container.querySelectorAll(".nav-glide").length).toBeGreaterThan(0);
    expect(container.querySelectorAll("[data-theme-toggle]").length).toBeGreaterThan(
      0,
    );
    expect(
      container.querySelectorAll('[data-token^="--"]').length,
    ).toBe(15);
  });
});
