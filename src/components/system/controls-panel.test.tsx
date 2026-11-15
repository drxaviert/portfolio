import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ControlsPanel } from "@/components/system/controls-panel";
import {
  SystemActionsContext,
  SystemParamsContext,
} from "@/app/design-system/system-shell";
import type { GlideSpring } from "@/components/home/glide-spring";
import type { useSystemParams } from "@/lib/system/use-system-params";
import { DEFAULT_PARAMS, PARAM_RANGES } from "@/lib/system/params";
import type { Params } from "@/lib/system/params";

type System = ReturnType<typeof useSystemParams>;

const LABELS: Record<keyof Params, string> = {
  hue: "Hue",
  round: "Roundness",
  tod: "Time of day",
  contrast: "Contrast",
  speed: "Motion speed",
};

function makeSystem(params: Params): System {
  return {
    params,
    setParam: vi.fn(),
    reset: vi.fn(),
    sitePhase: "day",
    engine: {
      set: vi.fn(),
      get: () => params,
      subscribe: () => () => {},
      spring: (base: GlideSpring) => base,
      dispose: vi.fn(),
    },
  };
}

function renderPanel(system: System) {
  return render(
    <SystemParamsContext value={system}>
      <SystemActionsContext
        value={{ setParam: system.setParam, reset: system.reset }}
      >
        <ControlsPanel />
      </SystemActionsContext>
    </SystemParamsContext>,
  );
}

describe("ControlsPanel", () => {
  it("gives every slider a visible label and the range from PARAM_RANGES", () => {
    renderPanel(makeSystem(DEFAULT_PARAMS));

    for (const key of Object.keys(PARAM_RANGES) as Array<keyof Params>) {
      const input = screen.getByLabelText(LABELS[key]);

      expect(input).toHaveAttribute("type", "range");
      expect(input).toHaveAttribute("min", String(PARAM_RANGES[key].min));
      expect(input).toHaveAttribute("max", String(PARAM_RANGES[key].max));
      expect(input).toHaveAttribute("step", String(PARAM_RANGES[key].step));
    }
  });

  it("writes keyboard steps through setParam", async () => {
    const user = userEvent.setup();
    const system = makeSystem(DEFAULT_PARAMS);

    renderPanel(system);

    await user.click(screen.getByLabelText("Hue"));
    await user.keyboard("{ArrowRight}");

    expect(system.setParam).toHaveBeenCalledWith("hue", 1);
  });

  it("shows every value with tabular numerals", () => {
    renderPanel(
      makeSystem({
        ...DEFAULT_PARAMS,
        hue: 40,
        round: 1.5,
        tod: 0.5,
        contrast: 1.2,
        speed: 2,
      }),
    );

    for (const value of ["40°", "1.50×", "50%", "1.20×", "2.00×"]) {
      expect(screen.getByText(value)).toHaveClass("tabular-nums");
    }
  });

  it("labels the time-of-day ticks", () => {
    renderPanel(makeSystem(DEFAULT_PARAMS));

    for (const tick of ["Dawn", "Midday", "Dusk", "Night"]) {
      expect(screen.getByText(tick)).toBeInTheDocument();
    }
  });

  it("resets through the secondary button", async () => {
    const user = userEvent.setup();
    const system = makeSystem(DEFAULT_PARAMS);

    renderPanel(system);
    await user.click(screen.getByRole("button", { name: "Reset" }));

    expect(system.reset).toHaveBeenCalledTimes(1);
  });

  it("keeps inputs at 16px with a focus-visible ring", () => {
    renderPanel(makeSystem(DEFAULT_PARAMS));

    const input = screen.getByLabelText("Hue");

    expect(input.className).toContain("text-base");
    expect(input.className).toContain("focus-visible:outline");
  });
});
