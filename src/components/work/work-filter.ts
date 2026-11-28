import type { WorkMeta } from "@/lib/work";

/** The study every filter leaves in place, at the top of the list. */
export const PINNED_SLUG = "motion-and-stills";

/** The one role the index can toggle. */
export const MOTION_3D = "Motion/3D";

/**
 * The rows the index shows. With Motion/3D off, every Motion/3D study drops
 * out except the pinned one.
 */
export function filterWork(works: WorkMeta[], motion3d: boolean): WorkMeta[] {
  if (motion3d) return works;

  return works.filter(
    (work) => work.slug === PINNED_SLUG || work.role !== MOTION_3D,
  );
}

/** A row's part in a filter change: leaving, or arriving, at stagger step i. */
export type RowMotion = { kind: "out" | "in"; i: number };

/**
 * The filter's timing (work-list.css plays it). Out is quicker than in, and
 * both stagger top-down, capped so a long list never waits on its tail.
 */
export const FILTER_OUT_MS = 360;
export const FILTER_OUT_STEP_MS = 24;
export const FILTER_IN_MS = 700;
export const FILTER_IN_STEP_MS = 40;
export const FILTER_STAGGER_CAP = 10;
export const FILTER_REDUCED_MS = 150;

/** When the last staggered row finishes. */
export function filterDuration(
  count: number,
  ms: number,
  step: number,
): number {
  return ms + Math.min(Math.max(count - 1, 0), FILTER_STAGGER_CAP) * step;
}
