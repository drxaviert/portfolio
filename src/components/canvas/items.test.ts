import { describe, expect, it } from "vitest";
import { CANVAS_MEDIA, CANVAS_MEDIA_COUNT, CANVAS_MEDIA_IDS } from "./items";

const PROJECT_COUNTS: Record<string, number> = {
  Attitdue: 1,
  Base: 1,
  "Cash App": 1,
  Celixir: 6,
  "Good Form Rebrand": 1,
  Google: 1,
  Infiniti: 2,
  Klaris: 5,
  Linksys: 6,
  "London Public Library": 3,
  Lullavibes: 3,
  NIOD: 6,
  Ordinary: 2,
  Personal: 41,
  "Shapes In Motion": 1,
  "Urban Decay": 4,
  Xylo: 4,
};

describe("canvas media order", () => {
  it("lists every current manifest once", () => {
    expect(CANVAS_MEDIA_IDS).toHaveLength(88);
    expect(new Set(CANVAS_MEDIA_IDS).size).toBe(88);
    expect(CANVAS_MEDIA_COUNT).toBe(88);
  });

  it("maps every id to its source project", () => {
    const counts: Record<string, number> = {};

    for (const item of CANVAS_MEDIA) {
      expect(item.project).not.toBe("");
      counts[item.project] = (counts[item.project] ?? 0) + 1;
    }

    expect(counts).toEqual(PROJECT_COUNTS);
  });

  it("keeps each project in loose clusters of at most three", () => {
    const runs: { project: string; n: number }[] = [];

    for (const item of CANVAS_MEDIA) {
      const last = runs[runs.length - 1];
      if (last?.project === item.project) last.n += 1;
      else runs.push({ project: item.project, n: 1 });
    }

    expect(Math.max(...runs.map((run) => run.n))).toBeLessThanOrEqual(3);
    for (const [project, count] of Object.entries(PROJECT_COUNTS)) {
      if (count < 2) continue;

      expect(
        runs.some((run) => run.project === project && run.n > 1),
        `${project} needs at least one adjacent pair`,
      ).toBe(true);
    }
  });

  it("does not butt the same project across the infinite repeat", () => {
    expect(CANVAS_MEDIA[0].project).not.toBe(
      CANVAS_MEDIA[CANVAS_MEDIA.length - 1].project,
    );
  });
});
