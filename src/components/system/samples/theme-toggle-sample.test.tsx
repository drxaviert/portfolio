import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SystemParamsContext } from "@/app/design-system/system-shell";
import { ThemeToggleSample } from "@/components/system/samples/theme-toggle-sample";
import type { GlideSpring } from "@/components/home/glide-spring";
import type { useSystemParams } from "@/lib/system/use-system-params";
import { DEFAULT_PARAMS, todForPhase } from "@/lib/system/params";
import { THEME_CHANGE_EVENT } from "@/lib/theme";

type System = ReturnType<typeof useSystemParams>;

function makeSystem(): { system: System; setParam: ReturnType<typeof vi.fn> } {
  const setParam = vi.fn();

  return {
    setParam,
    system: {
      params: DEFAULT_PARAMS,
      setParam,
      reset: vi.fn(),
      sitePhase: "day",
      engine: {
        set: vi.fn(),
        get: () => DEFAULT_PARAMS,
        subscribe: () => () => {},
        spring: (base: GlideSpring) => base,
        dispose: vi.fn(),
      },
    } as unknown as System,
  };
}

function renderSample(forceState?: "rest" | "focus-visible") {
  const { system, setParam } = makeSystem();

  const view = render(
    <SystemParamsContext value={system}>
      <ThemeToggleSample forceState={forceState} />
    </SystemParamsContext>,
  );

  return { setParam, ...view };
}

function themeGroup(): HTMLElement {
  return screen.getByRole("radiogroup", { name: "Theme" });
}

beforeEach(() => {
  window.localStorage.clear();
  window.localStorage.setItem("theme", "night");
  document.documentElement.dataset.phase = "dawn";
  document.documentElement.dataset.mode = "night";
  document.documentElement.classList.remove("dark");
});

afterEach(() => {
  window.localStorage.clear();
  delete document.documentElement.dataset.phase;
  delete document.documentElement.dataset.mode;
  document.documentElement.classList.remove("dark");
  vi.restoreAllMocks();
});

describe("ThemeToggleSample", () => {
  it("renders the three icon-only segments with labels and tooltips", () => {
    renderSample();

    const radios = within(themeGroup()).getAllByRole("radio");

    expect(radios.map((radio) => radio.getAttribute("aria-label"))).toEqual([
      "Day",
      "Night",
      "Auto",
    ]);
    expect(within(themeGroup()).getByRole("radio", { name: "Day" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(themeGroup().style.width).toBe("106px");
    expect(themeGroup().querySelectorAll(".segment-tooltip")).toHaveLength(3);
  });

  it("opens the four Day-phase options after clicking Day and moves tod on Dusk", () => {
    const { setParam } = renderSample();

    fireEvent.click(within(themeGroup()).getByRole("radio", { name: "Day" }));

    const phaseGroup = screen.getByRole("radiogroup", { name: "Day phase" });
    const phases = within(phaseGroup).getAllByRole("radio");

    expect(phases.map((phase) => phase.getAttribute("aria-label"))).toEqual([
      "Clock",
      "Dawn",
      "Midday",
      "Dusk",
    ]);
    expect(phaseGroup.style.width).toBe("140px");

    fireEvent.click(within(phaseGroup).getByRole("radio", { name: "Dusk" }));

    expect(setParam).toHaveBeenCalledWith("tod", todForPhase("dusk"));
    expect(
      within(phaseGroup).getByRole("radio", { name: "Dusk" }),
    ).toHaveAttribute("aria-checked", "true");
  });

  it("never changes the real site theme, storage or phase", () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    const removeItem = vi.spyOn(Storage.prototype, "removeItem");
    const clear = vi.spyOn(Storage.prototype, "clear");
    const themeEvent = vi.fn();

    window.addEventListener(THEME_CHANGE_EVENT, themeEvent);

    renderSample();

    fireEvent.click(within(themeGroup()).getByRole("radio", { name: "Night" }));
    fireEvent.click(within(themeGroup()).getByRole("radio", { name: "Day" }));
    fireEvent.click(
      within(screen.getByRole("radiogroup", { name: "Day phase" })).getByRole(
        "radio",
        { name: "Dusk" },
      ),
    );
    fireEvent.click(within(themeGroup()).getByRole("radio", { name: "Auto" }));

    expect(setItem).not.toHaveBeenCalled();
    expect(removeItem).not.toHaveBeenCalled();
    expect(clear).not.toHaveBeenCalled();
    expect(window.localStorage.getItem("theme")).toBe("night");
    expect(document.documentElement.dataset.phase).toBe("dawn");
    expect(document.documentElement.dataset.mode).toBe("night");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(themeEvent).not.toHaveBeenCalled();

    window.removeEventListener(THEME_CHANGE_EVENT, themeEvent);
  });

  it("supports the forced focus-visible state for the doc matrix", () => {
    const { container } = renderSample("focus-visible");

    expect(container.querySelector("[data-theme-toggle]")).toHaveAttribute(
      "data-state",
      "focus-visible",
    );
    expect(
      within(themeGroup()).getByRole("radio", { name: "Day" }).className,
    ).toContain("outline-primary");
  });
});
