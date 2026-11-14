import { describe, expect, it } from "vitest";
import {
  BUDGET_MS,
  DEFAULT_SETTINGS,
  EASINGS,
  copyBlock,
  cssVars,
  edgeFades,
  patch,
  resetVariant,
  stepFirstMs,
  stepsTiming,
  totalMs,
} from "./settings";

describe("entrance settings", () => {
  it("ships the 76f8961 timings, all inside the budget", () => {
    expect(totalMs("scale", DEFAULT_SETTINGS)).toBe(660);
    expect(totalMs("rise", DEFAULT_SETTINGS)).toBe(500);
    expect(totalMs("ring", DEFAULT_SETTINGS)).toBe(620);
    expect(totalMs("sky", DEFAULT_SETTINGS)).toBe(696);
    expect(totalMs("clear", DEFAULT_SETTINGS)).toBe(680);
    expect(totalMs("step", DEFAULT_SETTINGS)).toBe(600);

    for (const variant of [
      "scale",
      "rise",
      "ring",
      "sky",
      "clear",
      "step",
    ] as const) {
      expect(totalMs(variant, DEFAULT_SETTINGS)).toBeLessThanOrEqual(BUDGET_MS);
    }
  });

  it("ends the step cut when the last card's markers have faded", () => {
    const step = DEFAULT_SETTINGS.step;
    const first = stepFirstMs(step);

    // 180ms over 3 cuts is 60ms each; the markers outlive the card.
    expect(first).toBe(60);
    expect(totalMs("step", DEFAULT_SETTINGS)).toBe(
      6 * step.stagger + first + step.markerHold + step.markerFade,
    );

    // Short markers on a long card: the card itself sets the total.
    const slow = patch(
      patch(
        patch(DEFAULT_SETTINGS, "step", "duration", 400),
        "step",
        "markerFade",
        0,
      ),
      "step",
      "markerHold",
      0,
    );
    expect(totalMs("step", slow)).toBe(6 * step.stagger + 400);

    // Fewer cuts makes each one longer, so the marker arrival moves later.
    const twoCuts = patch(DEFAULT_SETTINGS, "step", "count", 2);
    expect(stepFirstMs(twoCuts.step)).toBe(90);
    expect(totalMs("step", twoCuts)).toBe(
      6 * step.stagger + 90 + step.markerHold + step.markerFade,
    );
  });

  it("adds the clear reveal's delay to its single mask animation", () => {
    const delayed = patch(DEFAULT_SETTINGS, "clear", "delay", 200);

    expect(totalMs("clear", delayed)).toBe(880);
    expect(totalMs("clear", patch(delayed, "clear", "duration", 400))).toBe(
      600,
    );
  });

  it("splits the ring edge into symmetric fades around the hold", () => {
    expect(edgeFades(DEFAULT_SETTINGS.ring)).toEqual({
      inMs: 102.5,
      outMs: 102.5,
    });

    // A hold longer than the edge clamps both fades, and the total follows
    // the edge that actually plays rather than the nominal duration.
    const clamped = {
      ...DEFAULT_SETTINGS.ring,
      edgeDuration: 120,
      edgeHold: 300,
    };
    expect(edgeFades(clamped)).toEqual({ inMs: 20, outMs: 20 });
    expect(totalMs("ring", { ...DEFAULT_SETTINGS, ring: clamped })).toBe(
      6 * clamped.stagger + 20 + 300 + 20,
    );
  });

  it("patches one field without mutating the current settings", () => {
    const next = patch(DEFAULT_SETTINGS, "scale", "duration", 800);

    expect(next.scale.duration).toBe(800);
    expect(DEFAULT_SETTINGS.scale.duration).toBe(360);
    expect(resetVariant(next, "scale").scale.duration).toBe(360);
  });

  it("writes every var the stylesheet reads, with units", () => {
    const vars = cssVars("ring", DEFAULT_SETTINGS, EASINGS[0].value);

    expect(vars["--ring-edge-in"]).toBe("102.5ms");
    expect(vars["--ring-fill-duration"]).toBe("240ms");
    expect(vars["--entrance-ease"]).toBe(EASINGS[0].value);
    expect(
      cssVars("scale", DEFAULT_SETTINGS, EASINGS[0].value)["--scale-blur"],
    ).toBe("6px");
    expect(
      cssVars("sky", DEFAULT_SETTINGS, EASINGS[0].value)["--sky-from"],
    ).toBe("0.98");

    const clear = cssVars("clear", DEFAULT_SETTINGS, EASINGS[0].value);

    expect(clear["--clear-blur"]).toBe("20px");
    expect(clear["--clear-duration"]).toBe("680ms");
    expect(clear["--clear-feather"]).toBe("25vh");
    expect(clear["--clear-delay"]).toBe("0ms");

    const step = cssVars("step", DEFAULT_SETTINGS, EASINGS[0].value);

    expect(step["--step-count"]).toBe("3");
    expect(step["--step-distance"]).toBe("5px");
    expect(step["--step-duration"]).toBe("180ms");
    expect(step["--step-marker-size"]).toBe("6px");
    // The picker still drives the marker fade.
    expect(step["--entrance-ease"]).toBe(EASINGS[0].value);
  });

  it("shows steps(n) instead of a curve for the step cut", () => {
    expect(stepsTiming("step", DEFAULT_SETTINGS)).toBe("steps(3, end)");
    expect(stepsTiming("scale", DEFAULT_SETTINGS)).toBeNull();

    const block = copyBlock(
      "step",
      DEFAULT_SETTINGS,
      EASINGS[0].value,
      totalMs("step", DEFAULT_SETTINGS),
    );

    expect(block).toContain(
      "/* home entrance · step · cards steps(3, end) · markers on entrance */",
    );
    expect(block).toContain("--step-count: 3;");
    expect(block).toContain("/* settles by 600ms */");
  });

  it("copies a paste-ready block with the total", () => {
    const block = copyBlock("scale", DEFAULT_SETTINGS, EASINGS[0].value, 660);

    expect(block).toContain("/* home entrance · scale · easing entrance */");
    expect(block).toContain("--scale-duration: 360ms;");
    expect(block).toContain("/* settles by 660ms */");
  });
});
