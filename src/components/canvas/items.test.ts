import { describe, expect, it } from "vitest";
import {
  CANVAS_MEDIA,
  CANVAS_MEDIA_COUNT,
  CANVAS_MEDIA_IDS,
  FEATURED_PROJECTS,
  projectHref,
  projectLabel,
} from "./items";
import { listWork } from "@/lib/work";

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

  it("opens with the featured projects, in order", () => {
    const first = projectRuns()
      .slice(0, FEATURED_PROJECTS.length)
      .map((run) => run.project);

    expect(first).toEqual([...FEATURED_PROJECTS]);
  });

  it("keeps every project in one contiguous run", () => {
    const projects = projectRuns().map((run) => run.project);

    expect(new Set(projects).size).toBe(projects.length);
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

  it("links every project with a case study to an existing page", () => {
    const pages = new Set(listWork().map((work) => `/work/${work.slug}`));
    const unlinked: string[] = [];

    for (const project of Object.keys(PROJECT_COUNTS)) {
      const href = projectHref(project);
      if (href === null) unlinked.push(project);
      else expect(pages).toContain(href);
    }

    expect(unlinked.sort()).toEqual(["Infiniti"]);
  });
});
