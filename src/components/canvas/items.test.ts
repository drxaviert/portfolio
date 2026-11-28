import { describe, expect, it } from "vitest";
import {
  CANVAS_MEDIA,
  CANVAS_MEDIA_COUNT,
  CANVAS_MEDIA_IDS,
  projectLabel,
} from "./items";

const PROJECT_COUNTS: Record<string, number> = {
  Attitude: 1,
  "Cash App": 1,
  Celixir: 5,
  "Good Form Rebrand": 1,
  Google: 1,
  Infiniti: 1,
  Klaris: 5,
  Linksys: 4,
  "London Public Library": 3,
  Lullavibes: 1,
  NIOD: 5,
  Ordinary: 1,
  Personal: 26,
  "Shapes In Motion": 5,
  "Tribeca Film Festival": 1,
  "Urban Decay": 5,
  Xylo: 1,
};

const CENTRE_PROJECTS = new Set([
  "Google",
  "Cash App",
  "Ordinary",
  "Tribeca Film Festival",
  "NIOD",
  "Shapes In Motion",
]);

function projectRuns() {
  const runs: { project: string; start: number; end: number }[] = [];

  for (const [index, item] of CANVAS_MEDIA.entries()) {
    const last = runs[runs.length - 1];
    if (last?.project === item.project) last.end = index;
    else runs.push({ project: item.project, start: index, end: index });
  }

  return runs;
}

describe("canvas media order", () => {
  it("lists every canvas file in the Optimized folder once", () => {
    expect(CANVAS_MEDIA_IDS).toHaveLength(67);
    expect(new Set(CANVAS_MEDIA_IDS).size).toBe(67);
    expect(CANVAS_MEDIA_COUNT).toBe(67);
  });

  it("maps every id to its source project", () => {
    const counts: Record<string, number> = {};

    for (const item of CANVAS_MEDIA) {
      expect(item.project).not.toBe("");
      counts[item.project] = (counts[item.project] ?? 0) + 1;
    }

    expect(counts).toEqual(PROJECT_COUNTS);
  });

  it("starts with the six centre projects", () => {
    const first = new Set(
      CANVAS_MEDIA.slice(0, 14).map((item) => item.project),
    );

    expect(first).toEqual(CENTRE_PROJECTS);
    expect(CANVAS_MEDIA[0].project).toBe("Google");
  });

  it("keeps whole-project groups, splitting only Personal", () => {
    const runs = projectRuns();
    const split = [
      ...new Set(
        runs
          .map((run) => run.project)
          .filter(
            (project, index, all) =>
              all.indexOf(project) !== all.lastIndexOf(project),
          ),
      ),
    ];
    const personal = runs
      .filter((run) => run.project === "Personal")
      .map((run) => run.end - run.start + 1);

    expect(split).toEqual(["Personal"]);
    expect(personal).toEqual([13, 13]);
  });

  it("does not butt the same project across the infinite repeat", () => {
    expect(CANVAS_MEDIA[0].project).not.toBe(
      CANVAS_MEDIA[CANVAS_MEDIA.length - 1].project,
    );
  });

  it("uses folder display names for the opened-view chip", () => {
    expect(projectLabel("Attitdue")).toBe("Attitude");
    expect(projectLabel("Shapes In Motion")).toBe("Shapes In Motion");
    expect(projectLabel("Cash App")).toBe("Cash App");
  });
});
