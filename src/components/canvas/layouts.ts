/**
 * Pure layouts for the dev drag canvas.
 *
 * A canvas is a world that repeats in both axes: `worldW`/`worldH` are the
 * period, and every rect is placed inside `[0, worldW] x [0, worldH]`. The
 * world is therefore drawn with a trailing gap the same size as the inner gap,
 * so the copy that reappears at the far edge keeps its distance instead of
 * touching the tile it wraps around to.
 *
 * Nothing here reads the DOM. The same input and seed produce the same world on
 * the server and on the client.
 */

export type LayoutName = "grid" | "masonry" | "scatter";

export type LayoutItem = {
  id: string;
  /** Natural width, used for masonry and scatter aspect ratios. */
  w: number;
  /** Natural height, used for masonry and scatter aspect ratios. */
  h: number;
};

export type LayoutRect = {
  /** The item's id, repeated for every copy in the layout. */
  id: string;
  /** The item's index in the array passed to the layout. */
  index: number;
  x: number;
  y: number;
  w: number;
  h: number;
};

export type CanvasLayout = {
  name: LayoutName;
  worldW: number;
  worldH: number;
  rects: LayoutRect[];
};

export type LayoutOptions = {
  /** Grid cell size, masonry column width, or scatter base width. */
  cell?: number;
  /** Space between rects. The trailing seam gap is this same value. */
  gap?: number;
  /** Override the column count (grid and masonry). */
  columns?: number;
  /** Scatter's PRNG seed. */
  seed?: number;
  /** Scatter sizes its world to this aspect; the canvas never changes it. */
  viewportW?: number;
  viewportH?: number;
};

export const GRID_CELL = 280;
export const GRID_GAP = 24;
export const SCATTER_GAP = 48;
export const SCATTER_SEED = 0x5eed_1a2b;

const SCATTER_BUCKETS = [0.78, 1, 1.32] as const;
const SCATTER_AREA_FACTOR = 1.6;
const SCATTER_MAX_TRIES = 700;
const SCATTER_MAX_EXPANSIONS = 8;

/** Round up to the next 24px step, so scatter's world never lands on a fraction. */
function step(value: number, size = 24): number {
  return Math.ceil(value / size) * size;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** Deterministic 32-bit PRNG. The scatter layout's whole identity depends on it. */
export function mulberry32(seed: number): () => number {
  let state = seed >>> 0;

  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);

    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * A uniform world of square cells, cropped to cover by the canvas.
 *
 * `worldW` includes a trailing gap, so the rightmost cell's right edge sits one
 * gap short of the seam. The copy of the first column that wraps in starts at
 * the seam, which leaves exactly the same gap between them as every other pair.
 */
export function gridLayout(
  items: LayoutItem[],
  options: LayoutOptions = {},
): CanvasLayout {
  const cell = options.cell ?? GRID_CELL;
  const gap = options.gap ?? GRID_GAP;
  const columns = Math.max(
    1,
    Math.round(options.columns ?? Math.ceil(Math.sqrt(items.length || 1))),
  );
  const rows = Math.ceil(items.length / columns);
  const stride = cell + gap;

  const rects = items.map((item, index) => ({
    id: item.id,
    index,
    x: (index % columns) * stride,
    y: Math.floor(index / columns) * stride,
    w: cell,
    h: cell,
  }));

  return {
    name: "grid",
    // The extra gap on the far edge is the seam, not padding.
    worldW: columns * stride,
    worldH: rows * stride,
    rects,
  };
}

/**
 * Fixed-width columns, packed shortest-first, each tile keeping its own ratio.
 *
 * The columns end ragged by nature; the world is the tallest column plus one
 * gap, so the vertical wrap has the same gap as every other row. Shorter
 * columns therefore show a little air below their last tile, but never a
 * collision or a tile cut by the seam.
 */
export function masonryLayout(
  items: LayoutItem[],
  options: LayoutOptions = {},
): CanvasLayout {
  const width = options.cell ?? GRID_CELL;
  const gap = options.gap ?? GRID_GAP;
  const columns = Math.max(
    1,
    Math.round(options.columns ?? Math.ceil(Math.sqrt(items.length || 1))),
  );
  const stride = width + gap;
  const nextY = Array.from({ length: columns }, () => 0);
  const rects: LayoutRect[] = [];
  let tallest = 0;

  for (const [index, item] of items.entries()) {
    let column = 0;
    for (let candidate = 1; candidate < columns; candidate += 1) {
      if (nextY[candidate] < nextY[column]) column = candidate;
    }

    const height = Math.max(1, Math.round(width * (item.h / item.w)));
    const y = nextY[column];

    rects.push({
      id: item.id,
      index,
      x: column * stride,
      y,
      w: width,
      h: height,
    });

    nextY[column] = y + height + gap;
    tallest = Math.max(tallest, y + height);
  }

  return {
    name: "masonry",
    worldW: columns * stride,
    worldH: items.length === 0 ? 0 : tallest + gap,
    rects,
  };
}

/**
 * Seeded rejection placement in three size buckets.
 *
 * The world starts at roughly 1.6x the area the tiles need (including their
 * clearance), then grows if a crowded seed cannot find a hole. A candidate is
 * tested against every placed tile and its copies one world away in both axes,
 * so the min gap holds across the wrap as well as inside the world.
 */
export function scatterLayout(
  items: LayoutItem[],
  options: LayoutOptions = {},
): CanvasLayout {
  if (items.length === 0) {
    return { name: "scatter", worldW: 0, worldH: 0, rects: [] };
  }

  const base = options.cell ?? GRID_CELL;
  const gap = options.gap ?? SCATTER_GAP;
  const seed = options.seed ?? SCATTER_SEED;
  const random = mulberry32(seed);
  const aspect = clamp(
    (options.viewportW ?? 1440) / (options.viewportH ?? 900),
    0.7,
    2.2,
  );

  const sizes = items.map((item, index) => {
    // Cycling the bucket with the index and blending in the PRNG keeps all
    // three sizes present even on a short list.
    const bucket =
      (index + Math.floor(random() * SCATTER_BUCKETS.length)) %
      SCATTER_BUCKETS.length;
    const width = Math.round(base * SCATTER_BUCKETS[bucket]);
    const natural = width * (item.h / item.w);

    return {
      w: width,
      h: Math.round(clamp(natural, 120, base * 1.5)),
    };
  });

  const effectiveArea = sizes.reduce(
    (sum, size) => sum + (size.w + gap) * (size.h + gap),
    0,
  );
  const worldArea = Math.max(effectiveArea * SCATTER_AREA_FACTOR, 1);
  const widest = Math.max(...sizes.map((size) => size.w));
  const tallest = Math.max(...sizes.map((size) => size.h));

  let worldW = step(Math.sqrt(worldArea * aspect));
  let worldH = step(Math.sqrt(worldArea / aspect));
  worldW = Math.max(worldW, widest + gap * 2);
  worldH = Math.max(worldH, tallest + gap * 2);

  const placed: LayoutRect[] = [];

  const collides = (candidate: LayoutRect): boolean => {
    for (const other of placed) {
      for (const shiftX of [-worldW, 0, worldW]) {
        for (const shiftY of [-worldH, 0, worldH]) {
          const x = other.x + shiftX;
          const y = other.y + shiftY;

          if (
            candidate.x < x + other.w + gap &&
            candidate.x + candidate.w + gap > x &&
            candidate.y < y + other.h + gap &&
            candidate.y + candidate.h + gap > y
          ) {
            return true;
          }
        }
      }
    }

    return false;
  };

  for (const [index, size] of sizes.entries()) {
    let tries = 0;
    let expansions = 0;

    for (;;) {
      const x = Math.round(random() * Math.max(0, worldW - size.w));
      const y = Math.round(random() * Math.max(0, worldH - size.h));
      const candidate: LayoutRect = {
        id: items[index].id,
        index,
        x,
        y,
        w: size.w,
        h: size.h,
      };

      if (!collides(candidate)) {
        placed.push(candidate);
        break;
      }

      tries += 1;

      if (tries >= SCATTER_MAX_TRIES) {
        if (expansions >= SCATTER_MAX_EXPANSIONS) {
          // A guaranteed way out after an unlucky seed: a new row below the
          // whole world. It keeps the seam gap because the world grows with it.
          const bottom = placed.reduce(
            (max, rect) => Math.max(max, rect.y + rect.h),
            0,
          );

          worldH = step(bottom + size.h + gap);
          placed.push({
            id: items[index].id,
            index,
            x: 0,
            y: bottom + gap,
            w: size.w,
            h: size.h,
          });
          break;
        }

        worldW = step(worldW * 1.15);
        worldH = step(worldH * 1.15);
        expansions += 1;
        tries = 0;
      }
    }
  }

  return {
    name: "scatter",
    worldW,
    worldH,
    rects: placed,
  };
}

export function layoutFor(
  name: LayoutName,
  items: LayoutItem[],
  options: LayoutOptions = {},
): CanvasLayout {
  switch (name) {
    case "masonry":
      return masonryLayout(items, options);
    case "scatter":
      return scatterLayout(items, options);
    case "grid":
    default:
      return gridLayout(items, options);
  }
}
