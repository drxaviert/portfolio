/**
 * Project clusters on the wrapping grid (pf-9cv.23).
 *
 * Each project's items fill one compact blob of neighbouring cells, so a
 * project never interleaves with another. Projects are placed in the order
 * they first appear in the item list, each seeded at the free cell nearest the
 * viewport centre, so the first projects open the first view. When every
 * project is placed the list repeats until the grid is full.
 *
 * Every cell holds a tile and every tile sits on its cell with the uniform
 * gutter: no offsets, no empty cells. A project reads as one patch only
 * because its items take adjacent cells.
 *
 * "Nearest the viewport centre" is measured in viewport units, not cells: a
 * landscape window shows more columns than rows, so a cell two columns out is
 * closer to being on screen than one two rows out. The caller passes the
 * visible cell span, so the order follows the window as it is resized.
 */

const NEIGHBOURS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const;

export type ClusterLayout = {
  /** Item index per cell (`row * cols + col`). */
  items: Int32Array;
  /** Which blob fragment holds the cell; fragments of one project differ. */
  blobs: Int32Array;
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
  let blobCount = 0;
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
      // Running centre of the fragment, relative to its seed so a fragment
      // that straddles the wrap seam still averages correctly.
      let seedCol = 0;
      let seedRow = 0;
      let sumX = 0;
      let sumY = 0;
      let size = 0;

      for (const itemIndex of group) {
        if (free === 0) break;

        let cell = -1;
        let best = Infinity;
        for (const candidate of frontier) {
          const col = candidate % cols;
          const row = Math.floor(candidate / cols);
          const dx = wrapDelta(col - seedCol, cols) - sumX / size;
          const dy = wrapDelta(row - seedRow, rows) - sumY / size;
          let touching = 0;
          for (const [nx, ny] of NEIGHBOURS) {
            const near =
              ((row + ny + rows) % rows) * cols + ((col + nx + cols) % cols);
            if (blobs[near] === blob) touching += 1;
          }
          const score = dx * dx + dy * dy - touching;
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
          blob = blobCount;
          blobCount += 1;
          frontier = new Set();
          seedCol = cell % cols;
          seedRow = Math.floor(cell / cols);
          sumX = 0;
          sumY = 0;
          size = 0;
        }

        blobs[cell] = blob;
        items[cell] = itemIndex;
        free -= 1;
        frontier.delete(cell);

        const col = cell % cols;
        const row = Math.floor(cell / cols);
        sumX += wrapDelta(col - seedCol, cols);
        sumY += wrapDelta(row - seedRow, rows);
        size += 1;
        for (const [dx, dy] of NEIGHBOURS) {
          const near =
            ((row + dy + rows) % rows) * cols + ((col + dx + cols) % cols);
          if (blobs[near] === -1) frontier.add(near);
        }
      }
    }
  }

  return layout;
}
