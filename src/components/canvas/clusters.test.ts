import { describe, expect, it } from "vitest";
import { clusterLayout, projectGroups, wrapDelta } from "./clusters";
import { gridMetrics } from "./grid";
import { CANVAS_MEDIA, FEATURED_PROJECTS } from "./items";

const projects = CANVAS_MEDIA.map((item) => item.project);

function layoutAt(width: number, height: number) {
  const grid = gridMetrics(width, height);
  const layout = clusterLayout(
    projects,
    grid.cols,
    grid.rows,
    width / grid.pitchX,
    height / grid.pitchY,
  );

  return { grid, layout };
}

describe("projectGroups", () => {
  it("groups item indices by project in first-seen order", () => {
    expect(projectGroups(["a", "b", "a", "c", "b"])).toEqual([
      [0, 2],
      [1, 4],
      [3],
    ]);
  });
});

describe("wrapDelta", () => {
  it("takes the short way round the seam", () => {
    expect(wrapDelta(9, 10)).toBe(-1);
    expect(wrapDelta(-9, 10)).toBe(1);
    expect(wrapDelta(3, 10)).toBe(3);
  });
});

describe("clusterLayout", () => {
  const { grid, layout } = layoutAt(1440, 900);
  const { cols, rows } = grid;

  it("fills every cell with an item and places every item", () => {
    const placed = new Set<number>();

    for (let cell = 0; cell < cols * rows; cell += 1) {
      expect(layout.blobs[cell]).toBeGreaterThanOrEqual(0);
      placed.add(layout.items[cell]);
    }

    expect(placed.size).toBe(Math.min(projects.length, cols * rows));
  });

  it.each([
    [1440, 900],
    [1024, 768],
    [390, 844],
    [2560, 1440],
  ])("keeps every blob to one project, 4-connected, at %ix%i", (w, h) => {
    const { grid, layout } = layoutAt(w, h);
    const { cols, rows } = grid;
    const blobProject = new Map<number, string>();
    for (let cell = 0; cell < cols * rows; cell += 1) {
      const project = projects[layout.items[cell]];
      const seen = blobProject.get(layout.blobs[cell]);
      if (seen !== undefined) expect(project).toBe(seen);
      blobProject.set(layout.blobs[cell], project);
    }

    for (const blob of blobProject.keys()) {
      const cells: number[] = [];
      for (let cell = 0; cell < cols * rows; cell += 1) {
        if (layout.blobs[cell] === blob) cells.push(cell);
      }

      const members = new Set(cells);
      const reached = new Set([cells[0]]);
      const queue = [cells[0]];
      while (queue.length > 0) {
        const cell = queue.pop()!;
        const col = cell % cols;
        const row = Math.floor(cell / cols);
        for (const [dx, dy] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ]) {
          const near =
            ((row + dy + rows) % rows) * cols + ((col + dx + cols) % cols);
          if (members.has(near) && !reached.has(near)) {
            reached.add(near);
            queue.push(near);
          }
        }
      }

      expect(reached.size).toBe(cells.length);
    }
  });

  it("opens the featured projects in the first view at 1440x900", () => {
    const cx = (cols - 1) / 2;
    const cy = (rows - 1) / 2;
    const near = new Set<string>();

    for (let cell = 0; cell < cols * rows; cell += 1) {
      const dx = Math.abs((cell % cols) - cx);
      const dy = Math.abs(Math.floor(cell / cols) - cy);
      if (dx <= 2 && dy <= 1) near.add(projects[layout.items[cell]]);
    }

    for (const project of FEATURED_PROJECTS) expect(near).toContain(project);
  });

  it("sits every tile on its grid cell, with no offset", () => {
    expect(Object.keys(layout).sort()).toEqual(["blobs", "items"]);
  });

  it("returns an empty layout for an empty grid", () => {
    expect(clusterLayout(projects, 0, 0, 1, 1).items).toHaveLength(0);
  });
});
