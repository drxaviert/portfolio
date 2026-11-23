import { describe, expect, it } from "vitest";
import { Spring } from "./springs";

function run(seconds: number, fps: number): Spring {
  const spring = new Spring(1);

  spring.target = 1.25;

  for (let frame = 0; frame < Math.round(seconds * fps); frame += 1) {
    spring.step(1 / fps);
  }

  return spring;
}

describe("hover spring", () => {
  it("keeps its velocity when the target changes mid-flight", () => {
    const spring = new Spring(1);

    spring.target = 1.25;

    for (let frame = 0; frame < 5; frame += 1) {
      spring.step(1 / 60);
    }

    const value = spring.value;
    const velocity = spring.velocity;

    expect(velocity).toBeGreaterThan(0);

    spring.target = 1;
    spring.step(0.000_001);

    expect(spring.velocity).toBeGreaterThan(0);
    expect(spring.value - value).toBeCloseTo(velocity * 0.000_001, 8);
  });

  it("settles to the same value at 30, 60 and 144 fps", () => {
    const at30 = run(0.5, 30).value;
    const at60 = run(0.5, 60).value;
    const at144 = run(0.5, 144).value;

    expect(Math.abs(at60 - at30)).toBeLessThan(0.002);
    expect(Math.abs(at144 - at30)).toBeLessThan(0.002);
    expect(at30).toBeCloseTo(1.25, 2);
  });
});
