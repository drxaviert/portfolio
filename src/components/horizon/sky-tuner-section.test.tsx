import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { SKY_PHASES, SKY_TUNING_DEFAULTS } from "./cosmic-sky";
import { SkyTunerSection } from "./sky-tuner-section";
import { getSkyTuning, SKY_STORAGE_KEY, setSkyTuning } from "./sky-tuning";

afterEach(() => {
  window.localStorage.clear();
  setSkyTuning(SKY_TUNING_DEFAULTS);
});

describe("SkyTunerSection", () => {
  it("shows the stored tuning on mount and pushes it to the live store", () => {
    const phase = SKY_PHASES[0];
    window.localStorage.setItem(
      SKY_STORAGE_KEY,
      JSON.stringify({ ...SKY_TUNING_DEFAULTS, phaseOverride: phase }),
    );

    render(<SkyTunerSection />);

    expect(screen.getByLabelText("Phase override")).toHaveProperty(
      "value",
      phase,
    );
    expect(getSkyTuning().phaseOverride).toBe(phase);
  });

  it("updates the store and storage on change, and resets the store on unmount", () => {
    const phase = SKY_PHASES[0];
    const { unmount } = render(<SkyTunerSection />);

    fireEvent.change(screen.getByLabelText("Phase override"), {
      target: { value: phase },
    });

    expect(getSkyTuning().phaseOverride).toBe(phase);
    expect(
      JSON.parse(window.localStorage.getItem(SKY_STORAGE_KEY) ?? "{}")
        .phaseOverride,
    ).toBe(phase);

    unmount();

    expect(getSkyTuning()).toEqual(SKY_TUNING_DEFAULTS);
  });
});
