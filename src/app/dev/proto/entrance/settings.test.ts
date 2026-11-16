import { describe, expect, it } from "vitest";
import {
  BUDGET_MS,
  CALM_EASING,
  DEFAULT_SETTINGS,
  DEFAULT_SOFT_METHOD,
  SOFT_METHODS,
  SOFT_METHOD_PATCH,
  EASINGS,
  copyBlock,
  cssVars,
  defaultEasing,
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
    expect(totalMs("grain", DEFAULT_SETTINGS)).toBe(672);
    expect(totalMs("grow", DEFAULT_SETTINGS)).toBe(560);
    expect(totalMs("breath", DEFAULT_SETTINGS)).toBe(1200);

    for (const variant of [
      "scale",
      "rise",
      "ring",
      "sky",
      "clear",
      "step",
      "grain",
      "grow",
    ] as const) {
      expect(totalMs(variant, DEFAULT_SETTINGS)).toBeLessThanOrEqual(BUDGET_MS);
    }
  });

  it("lets the breath settle on whichever of glow or cards ends last", () => {
    const breath = DEFAULT_SETTINGS.breath;

    // Cards land exactly with the inhale at the defaults.
    expect(breath.delay + 6 * breath.stagger + breath.duration).toBe(
      breath.inhale,
    );

    // A long inhale holds the sequence open past the cards.
    expect(
      totalMs("breath", patch(DEFAULT_SETTINGS, "breath", "inhale", 2000)),
    ).toBe(2000);

    // A late card streak outlasts a short inhale.
    expect(
      totalMs(
        "breath",
        patch(
          patch(
            patch(DEFAULT_SETTINGS, "breath", "inhale", 600),
            "breath",
            "delay",
            400,
          ),
          "breath",
          "duration",
          800,
        ),
      ),
    ).toBe(400 + 6 * breath.stagger + 800);
  });

  it("defaults the calm family to the proposed calm curve only", () => {
    expect(defaultEasing("breath")).toBe(CALM_EASING);
    expect(defaultEasing("scale")).toBeNull();
    expect(EASINGS.some((entry) => entry.value === CALM_EASING)).toBe(true);
    expect(
      EASINGS.find((entry) => entry.value === CALM_EASING)?.label,
    ).toContain("not in motion.md");
  });

  it("settles the mist on whichever of haze or cards ends last", () => {
    const mist = DEFAULT_SETTINGS.mist;

    expect(totalMs("mist", DEFAULT_SETTINGS)).toBe(1100);

    // A short haze leaves the last card to close the entrance.
    expect(
      totalMs("mist", patch(DEFAULT_SETTINGS, "mist", "duration", 500)),
    ).toBe(6 * mist.stagger + mist.cardDuration);

    // A long haze holds it open past the cards.
    expect(
      totalMs("mist", patch(DEFAULT_SETTINGS, "mist", "duration", 2000)),
    ).toBe(2000);
  });

  it("settles the dawn on the bloom or the last content row", () => {
    const dawn = DEFAULT_SETTINGS.dawn;

    // The content starts halfway through the bloom and lands with it.
    expect(dawn.contentDelay).toBe(dawn.bloomDuration / 2);
    expect(totalMs("dawn", DEFAULT_SETTINGS)).toBe(dawn.bloomDuration);
    expect(dawn.contentDelay + 2 * dawn.stagger + dawn.contentDuration).toBe(
      dawn.bloomDuration,
    );

    // A long bloom holds it open.
    expect(totalMs("dawn", DEFAULT_SETTINGS)).toBe(1300);
    expect(
      totalMs("dawn", patch(DEFAULT_SETTINGS, "dawn", "bloomDuration", 2500)),
    ).toBe(2500);

    // A slow content streak outlives a short bloom.
    expect(
      totalMs(
        "dawn",
        patch(
          patch(DEFAULT_SETTINGS, "dawn", "bloomDuration", 500),
          "dawn",
          "contentDuration",
          300,
        ),
      ),
    ).toBe(dawn.contentDelay + 2 * dawn.stagger + 300);
  });

  it("settles soft focus on the dissolve or the last staggered card", () => {
    const soft = DEFAULT_SETTINGS.soft;
    const cardsEnd = soft.cardDelay + 6 * soft.stagger + soft.cardDuration;

    // Dat's final sheet: 250ms + 6 x 60 + 1100 = 1710ms, past the 1400ms blur.
    expect(cardsEnd).toBe(1710);
    expect(totalMs("soft", DEFAULT_SETTINGS)).toBe(1710);
    expect(cardsEnd).toBeGreaterThan(soft.duration);

    // Without a stagger the cards land inside the dissolve, so the blur ends it.
    expect(totalMs("soft", patch(DEFAULT_SETTINGS, "soft", "stagger", 0))).toBe(
      soft.duration,
    );

    // A long dissolve outlasts the cards once they are quicker.
    expect(
      totalMs(
        "soft",
        patch(
          patch(DEFAULT_SETTINGS, "soft", "duration", 2000),
          "soft",
          "cardDuration",
          800,
        ),
      ),
    ).toBe(2000);
  });

  it("staggers the grow by row, bottom row first", () => {
    const grow = DEFAULT_SETTINGS.grow;

    // Row 3 (nav) has no delay, row 1 waits two rows.
    expect(totalMs("grow", DEFAULT_SETTINGS)).toBe(
      2 * grow.stagger + grow.duration,
    );
    expect(totalMs("grow", patch(DEFAULT_SETTINGS, "grow", "stagger", 0))).toBe(
      grow.duration,
    );
  });

  it("settles the grain sky on whichever ends later: grain or cards", () => {
    const grain = DEFAULT_SETTINGS.grain;
    const cards = grain.delay + 6 * grain.stagger + grain.itemDuration;

    // The default cards (672ms) outlast the grain (460ms).
    expect(totalMs("grain", DEFAULT_SETTINGS)).toBe(cards);
    expect(cards).toBeGreaterThan(grain.duration);

    // A long grain holds the sequence open past the cards.
    const long = patch(DEFAULT_SETTINGS, "grain", "duration", 900);
    expect(totalMs("grain", long)).toBe(900);
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

    const grain = cssVars("grain", DEFAULT_SETTINGS, EASINGS[0].value);

    expect(grain["--grain-strength"]).toBe("0.08");
    expect(grain["--grain-jitter"]).toBe("3px");
    expect(grain["--grain-rate"]).toBe("100ms");
    expect(grain["--grain-duration"]).toBe("460ms");
    expect(grain["--grain-item-duration"]).toBe("320ms");

    const grow = cssVars("grow", DEFAULT_SETTINGS, EASINGS[0].value);

    expect(grow["--grow-from"]).toBe("0.6");
    expect(grow["--grow-rise"]).toBe("12px");
    expect(grow["--grow-duration"]).toBe("420ms");
    expect(grow["--grow-stagger"]).toBe("70ms");

    const breath = cssVars("breath", DEFAULT_SETTINGS, CALM_EASING);

    expect(breath["--breath-inhale"]).toBe("1200ms");
    expect(breath["--breath-swell"]).toBe("0.9");
    expect(breath["--breath-delay"]).toBe("480ms");
    expect(breath["--breath-duration"]).toBe("540ms");
    expect(breath["--breath-blur"]).toBe("2.5px");
    expect(breath["--entrance-ease"]).toBe(CALM_EASING);

    const mist = cssVars("mist", DEFAULT_SETTINGS, CALM_EASING);

    expect(mist["--mist-density"]).toBe("0.9");
    expect(mist["--mist-lift"]).toBe("4%");
    expect(mist["--mist-duration"]).toBe("1100ms");
    expect(mist["--mist-card-duration"]).toBe("900ms");
    expect(mist["--mist-stagger"]).toBe("30ms");

    const dawn = cssVars("dawn", DEFAULT_SETTINGS, CALM_EASING);

    expect(dawn["--dawn-dim"]).toBe("0.6");
    expect(dawn["--dawn-bloom-duration"]).toBe("1300ms");
    expect(dawn["--dawn-bloom-scale"]).toBe("0.96");
    expect(dawn["--dawn-content-delay"]).toBe("650ms");
    expect(dawn["--dawn-rise"]).toBe("4px");
    expect(dawn["--dawn-content-duration"]).toBe("600ms");
    expect(dawn["--dawn-stagger"]).toBe("25ms");

    const soft = cssVars("soft", DEFAULT_SETTINGS, CALM_EASING);

    expect(soft["--soft-blur"]).toBe("8px");
    expect(soft["--soft-veil"]).toBe("0.24");
    expect(soft["--soft-duration"]).toBe("1400ms");
    expect(soft["--soft-card-delay"]).toBe("250ms");
    expect(soft["--soft-card-duration"]).toBe("1100ms");
    expect(soft["--soft-rise"]).toBe("7px");
    expect(soft["--soft-stagger"]).toBe("60ms");
  });

  it("carries the blur method into Copy values and defaults to split", () => {
    expect(DEFAULT_SOFT_METHOD).toBe("split");
    expect(SOFT_METHODS.map((entry) => entry.id)).toEqual([
      "split",
      "lighter",
      "grain",
      "overlay",
    ]);
    expect(SOFT_METHOD_PATCH.lighter).toEqual({ blur: 4, veil: 32 });
    expect(SOFT_METHOD_PATCH.split).toEqual({ blur: 8, veil: 24 });

    const block = copyBlock(
      "soft",
      DEFAULT_SETTINGS,
      CALM_EASING,
      totalMs("soft", DEFAULT_SETTINGS),
      "split",
    );

    expect(block).toContain("/* blur method: split");
    expect(block).toContain("--soft-rise: 7px;");
    expect(block).toContain("--soft-stagger: 60ms;");
    expect(block).toContain("/* settles by 1710ms */");
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
