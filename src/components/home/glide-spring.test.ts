import { describe, expect, it } from "vitest";
import {
  GLIDE_LEAD_SPRING,
  GLIDE_MAX_STEP_S,
  GLIDE_TRAIL_SPRING,
  createEdge,
  isEdgeAtRest,
  stepEdge,
  type GlideEdge,
} from "./glide-spring";

/** Runs an edge for `seconds` in `step`-second frames. */
function run(
  edge: GlideEdge,
  target: number,
  seconds: number,
  spring = GLIDE_LEAD_SPRING,
  step = 1 / 240,
): GlideEdge {
  let next = edge;

  for (let elapsed = 0; elapsed < seconds; elapsed += step) {
    next = stepEdge(next, target, step, spring);
  }

  return next;
}

/** How long an edge takes to reach the rest thresholds, in ms. */
function settleTime(spring = GLIDE_LEAD_SPRING, target = 90): number {
  let edge = createEdge(0);

  for (let frame = 1; frame <= 2000; frame += 1) {
    edge = stepEdge(edge, target, 1 / 1000, spring);

    if (isEdgeAtRest(edge, target)) return frame;
  }

  return -1;
}

describe("glide edge spring", () => {
  it("keeps its current position when the target changes mid-flight", () => {
    const before = run(createEdge(40), 100, 0.06);

    expect(before.position).toBeGreaterThan(40);
    expect(before.position).toBeLessThan(100);

    const after = stepEdge(before, 200, 0.001, GLIDE_LEAD_SPRING);
    const travelled = after.position - before.position;

    // The edge moves from where it is, at the speed it already had: one
    // millisecond of travel, not a jump to the new target or back to a start.
    expect(Math.abs(travelled)).toBeLessThan(2);
    expect(travelled).toBeCloseTo(before.velocity * 0.001, 1);
  });

  it("keeps its current velocity when the target changes mid-flight", () => {
    const before = run(createEdge(40), 100, 0.06);

    expect(before.velocity).toBeGreaterThan(10);

    // A step small enough that the spring has not had time to accelerate the
    // edge: the velocity coming out is the one that went in. A runner that
    // restarted the flight would drop it to zero here.
    const after = stepEdge(before, 200, 0.000_001, GLIDE_LEAD_SPRING);

    expect(after.velocity).toBeGreaterThan(0);
    expect(Math.abs(after.velocity - before.velocity)).toBeLessThan(1);
  });

  it("does not restart from the point the previous flight began", () => {
    const start = createEdge(40);
    const before = run(start, 100, 0.08);
    const after = run(before, 200, 0.016);

    // A restart would put the edge back near 40 and then re-accelerate; a
    // retarget continues on past where it already was.
    expect(after.position).toBeGreaterThan(before.position);
    expect(after.position - start.position).toBeGreaterThan(
      before.position - start.position,
    );
  });

  it("carries momentum through a reversal instead of flipping instantly", () => {
    const before = run(createEdge(0), 100, 0.08);

    expect(before.velocity).toBeGreaterThan(0);

    const after = stepEdge(before, 0, 0.001, GLIDE_LEAD_SPRING);

    // Still travelling the old way for a frame; the spring has to decelerate
    // it first. This is the continuity a retarget depends on.
    expect(after.position).toBeGreaterThan(before.position);
    expect(after.velocity).toBeGreaterThan(0);
  });

  it("lands on the same place however the interval is split", () => {
    const whole = stepEdge(createEdge(0), 100, 1 / 30, GLIDE_LEAD_SPRING);
    let split = createEdge(0);

    for (let i = 0; i < 8; i += 1) {
      split = stepEdge(split, 100, 1 / 240, GLIDE_LEAD_SPRING);
    }

    expect(split.position).toBeCloseTo(whole.position, 6);
    expect(split.velocity).toBeCloseTo(whole.velocity, 6);
  });

  it("clamps a long frame to the maximum step", () => {
    const stalled = stepEdge(createEdge(0), 100, 1.5, GLIDE_LEAD_SPRING);
    const capped = stepEdge(
      createEdge(0),
      100,
      GLIDE_MAX_STEP_S,
      GLIDE_LEAD_SPRING,
    );

    expect(stalled).toEqual(capped);
    expect(stalled.position).toBeLessThan(100);
  });

  it("settles to rest on the target", () => {
    for (const spring of [GLIDE_LEAD_SPRING, GLIDE_TRAIL_SPRING]) {
      const edge = run(createEdge(0), 120, 1, spring);

      expect(isEdgeAtRest(edge, 120)).toBe(true);
      expect(edge.position).toBeCloseTo(120, 1);
      expect(edge.velocity).toBeCloseTo(0, 6);
    }
  });

  it("settles the lead ahead of the trail", () => {
    // The lead keeps the toggle's ~180ms feel; the trail is the softer edge.
    expect(settleTime(GLIDE_LEAD_SPRING)).toBeLessThan(220);

    const trail = settleTime(GLIDE_TRAIL_SPRING);

    expect(trail).toBeGreaterThan(settleTime(GLIDE_LEAD_SPRING));
    expect(trail).toBeLessThan(340);
  });

  it("runs the lead ahead of the trail on the way", () => {
    let lead = createEdge(0);
    let trail = createEdge(0);

    for (let i = 0; i < 12; i += 1) {
      lead = stepEdge(lead, 90, 1 / 240, GLIDE_LEAD_SPRING);
      trail = stepEdge(trail, 90, 1 / 240, GLIDE_TRAIL_SPRING);
    }

    // The gap between the edges is the capsule's stretch.
    expect(lead.position - trail.position).toBeGreaterThan(2);
  });

  it("does not overshoot the target by more than a fraction of a pixel", () => {
    for (const spring of [GLIDE_LEAD_SPRING, GLIDE_TRAIL_SPRING]) {
      let edge = createEdge(0);
      let peak = 0;

      for (let i = 0; i < 240; i += 1) {
        edge = stepEdge(edge, 90, 1 / 240, spring);
        peak = Math.max(peak, edge.position);
      }

      expect(peak).toBeGreaterThanOrEqual(90);
      expect(peak).toBeLessThan(90.5);
    }
  });

  it("leaves the edge it was given untouched", () => {
    const edge = createEdge(10, 30);
    const after = stepEdge(edge, 100, 1 / 60, GLIDE_LEAD_SPRING);

    expect(edge).toEqual({ position: 10, velocity: 30 });
    expect(after).not.toBe(edge);
  });
});
