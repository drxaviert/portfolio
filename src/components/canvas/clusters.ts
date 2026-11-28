/**
 * Project clusters on the wrapping grid (pf-9cv.23).
 *
 * Each project's items fill one compact blob of neighbouring cells, so a
 * project never interleaves with another. Projects are placed in the order
 * they first appear in the item list, each seeded at the free cell nearest the
 * viewport centre, so the first projects open the first view. When every
 * project is placed the list repeats until the grid is full.
 *
 * Every cell holds a tile, so the gallery keeps its density. The clusters read
 * as groups because each tile is pulled toward its blob's centre by part of
 * the gap: the gap inside a blob narrows and the gap between two blobs widens.
 * A pull never exceeds `MAX_PULL` of the gap, so two tiles moving toward each
 * other can never close it.
 *
 * "Nearest the viewport centre" is measured in viewport units, not cells: a
 * landscape window shows more columns than rows, so a cell two columns out is
 * closer to being on screen than one two rows out. The caller passes the
 * visible cell span, so the order follows the window as it is resized.
 */

/** Pull toward the blob centre, in gaps per cell of distance. */
export const CLUSTER_PULL = 0.6;
/** The largest pull on one axis, in gaps. */
export const MAX_PULL = 0.45;

export type ClusterLayout = {
  /** Item index per cell (`row * cols + col`). */
  items: Int32Array;
  /** Which blob fragment holds the cell; fragments of one project differ. */
  blobs: Int32Array;
  /** Offset toward the blob centre, in gaps (multiply by the current gap). */
  pullX: Float32Array;
  pullY: Float32Array;
};

/** Item indices grouped by project, in order of each project's first item. */
export function projectGroups(projects: readonly string[]): number[][] {
  const groups = new Map<string, number[]>();

  projects.forEach((project, index) => {
    const list = groups.get(project);
    if (list) list.push(index);
    else groups.set(project, [index]);
  });

  return [...groups.values()];
}

export function wrapDelta(delta: number, length: number): number {
  const wrapped = ((delta % length) + length) % length;

  return wrapped > length / 2 ? wrapped - length : wrapped;
}

export function clusterLayout(
  projects: readonly string[],
  cols: number,
  rows: number,
  viewCols: number,
  viewRows: number,
): ClusterLayout {
  const total = cols * rows;
  const layout: ClusterLayout = {
    items: new Int32Array(total),
    blobs: new Int32Array(total).fill(-1),
    pullX: new Float32Array(total),
    pullY: new Float32Array(total),
  };
  if (total === 0 || projects.length === 0) return layout;

  const spanX = Math.max(1, viewCols);
  const spanY = Math.max(1, viewRows);
  const cx = (cols - 1) / 2;
  const cy = (rows - 1) / 2;
  const order = Array.from({ length: total }, (_, cell) => {
    const dx = ((cell % cols) - cx) / spanX;
    const dy = (Math.floor(cell / cols) - cy) / spanY;

    return { cell, distance: dx * dx + dy * dy, angle: Math.atan2(dy, dx) };
  })
    .sort(
      (a, b) => a.distance - b.distance || a.angle - b.angle || a.cell - b.cell,
    )
    .map((entry) => entry.cell);
  const rank = new Int32Array(total);
  order.forEach((cell, index) => {
    rank[cell] = index;
  });

  const { items, blobs } = layout;
  const seeds: number[] = [];
  let free = total;
  let cursor = 0;
  const nextFree = () => {
    while (blobs[order[cursor]] !== -1) cursor += 1;
    return order[cursor];
  };

  const groups = projectGroups(projects);

  while (free > 0) {
    for (const group of groups) {
      if (free === 0) break;

      let blob = -1;
      let frontier = new Set<number>();
      let seedCol = 0;
      let seedRow = 0;

      for (const itemIndex of group) {
        if (free === 0) break;

        let cell = -1;
        let best = Infinity;
        for (const candidate of frontier) {
          const dx = wrapDelta((candidate % cols) - seedCol, cols) / spanX;
          const dy =
            wrapDelta(Math.floor(candidate / cols) - seedRow, rows) / spanY;
          const score = dx * dx + dy * dy;
          if (
            score < best ||
            (score === best && rank[candidate] < rank[cell])
          ) {
            best = score;
            cell = candidate;
          }
        }

        // The first item, or a blob boxed in by its neighbours, starts a new
        // fragment at the free cell nearest the centre.
        if (cell === -1) {
          cell = nextFree();
          blob = seeds.length;
          seeds.push(cell);
          frontier = new Set();
          seedCol = cell % cols;
          seedRow = Math.floor(cell / cols);
        }

        blobs[cell] = blob;
        items[cell] = itemIndex;
        free -= 1;
        frontier.delete(cell);

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
          if (blobs[near] === -1) frontier.add(near);
        }
      }
    }
  }

  // Each fragment's centre, from offsets relative to its seed so a blob that
  // straddles the wrap seam still averages correctly.
  const sumX = new Float64Array(seeds.length);
  const sumY = new Float64Array(seeds.length);
  const count = new Int32Array(seeds.length);
  const offsetX = new Float64Array(total);
  const offsetY = new Float64Array(total);

  for (let cell = 0; cell < total; cell += 1) {
    const blob = blobs[cell];
    const seed = seeds[blob];
    offsetX[cell] = wrapDelta((cell % cols) - (seed % cols), cols);
    offsetY[cell] = wrapDelta(
      Math.floor(cell / cols) - Math.floor(seed / cols),
      rows,
    );
    sumX[blob] += offsetX[cell];
    sumY[blob] += offsetY[cell];
    count[blob] += 1;
  }

  const clamp = (value: number) =>
    Math.max(-MAX_PULL, Math.min(MAX_PULL, value));
  for (let cell = 0; cell < total; cell += 1) {
    const blob = blobs[cell];
    layout.pullX[cell] = clamp(
      (sumX[blob] / count[blob] - offsetX[cell]) * CLUSTER_PULL,
    );
    layout.pullY[cell] = clamp(
      (sumY[blob] / count[blob] - offsetY[cell]) * CLUSTER_PULL,
    );
  }

  return layout;
}
