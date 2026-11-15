import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SystemParamsContext } from "@/app/design-system/system-shell";
import { ComponentDoc } from "@/components/system/component-doc";
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

function Doc() {
  return (
    <ComponentDoc
      name="Card"
      description="The ring card."
      states={["rest", "hover", "focus-visible"]}
      render={(state) => (
        <div data-testid="sample" data-state={state ?? "live"} />
      )}
      use={["Use it for work tiles."]}
      dont={["Do not add a border."]}
      tokens={["--radius-lg", "--shadow-card"]}
      notes="Cards are hover-only today."
    />
  );
}

function renderDoc() {
  return render(
    <SystemParamsContext value={makeSystem()}>
      <Doc />
    </SystemParamsContext>,
  );
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

describe("ComponentDoc", () => {
  it("renders a live preview and one labelled cell per state", () => {
    const { container } = renderDoc();

    expect(
      container.querySelector('[data-doc-preview] [data-testid="sample"]'),
    ).toHaveAttribute("data-state", "live");

    for (const state of ["rest", "hover", "focus-visible"]) {
      expect(
        container.querySelector(
          `[data-doc-state="${state}"] [data-testid="sample"]`,
        ),
      ).toHaveAttribute("data-state", state);
      const label =
        state === "focus-visible"
          ? "Focus visible"
          : state === "hover"
            ? "Hover"
            : "Rest";

      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    }
  });

  it("forces the live sample from aria-pressed toggles", () => {
    const { container } = renderDoc();
    const hover = screen.getByRole("button", { name: "Hover" });
    const live = screen.getByRole("button", { name: "Live" });

    expect(live).toHaveAttribute("aria-pressed", "true");
    expect(hover).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(hover);

    expect(hover).toHaveAttribute("aria-pressed", "true");
    expect(
      container.querySelector('[data-doc-preview] [data-testid="sample"]'),
    ).toHaveAttribute("data-state", "hover");

    fireEvent.click(live);

    expect(live).toHaveAttribute("aria-pressed", "true");
    expect(
      container.querySelector('[data-doc-preview] [data-testid="sample"]'),
    ).toHaveAttribute("data-state", "live");
  });

  it("renders the use and don't lists, notes and one token row per token", () => {
    const { container } = renderDoc();

    expect(screen.getByText("Use it for work tiles.")).toBeInTheDocument();
    expect(screen.getByText("Do not add a border.")).toBeInTheDocument();
    expect(screen.getByText("Cards are hover-only today.")).toBeInTheDocument();

    expect(container.querySelectorAll("[data-token]")).toHaveLength(2);
    expect(container.textContent).toContain("--radius-lg");
    expect(container.textContent).toContain("--shadow-card");
  });
});
