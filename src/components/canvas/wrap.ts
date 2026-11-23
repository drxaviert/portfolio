/**
 * The repeating-world arithmetic behind the drag canvas.
 *
 * Pan is the world coordinate at the viewport's top-left. A tile at world
 * `(x, y)` exists again at `(x + kx*worldW, y + ky*worldH)` for every integer
 * pair, so the visible set is found by walking only the copies that can touch
 * the viewport. This is also why the world can be smaller than the viewport: the
 * copies are the replication, not a special case.
 */

export type WrapRect = {
  x: number;
  y: number;
  w: number;
  h: number;
};

export type WrapWorld = {
  worldW: number;
  worldH: number;
};

export type WrapPan = {
  x: number;
  y: number;
};

export type WrapViewport = {
  width: number;
  height: number;
};

export type VisibleTile = {
  /** Index into the rects array passed to `visibleTiles`. */
  rectIndex: number;
  /** Position relative to the viewport. */
  screenX: number;
  screenY: number;
  /** World-space top-left of this copy. Stable while panning. */
  worldX: number;
  worldY: number;
  /** Which copy this is, relative to the first world. */
  copyX: number;
  copyY: number;
};

/**
 * Positive modulo. `%` keeps the sign of the dividend, which turns a negative
 * pan into a negative remainder and makes the wrap jump.
 */
export function mod(value: number, length: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(length) || length === 0) {
    return 0;
  }

  return ((value % length) + length) % length;
}

/** A stable React key for a visible copy. */
export function tileKey(
  tile: Pick<VisibleTile, "rectIndex" | "copyX" | "copyY">,
): string {
  return `${tile.rectIndex}:${tile.copyX}:${tile.copyY}`;
}

/**
 * Every rect copy that intersects the viewport, plus `margin` px of slack on
 * every side so a fast fling has a frame or two of mounted tiles to land on.
 */
export function visibleTiles(
  rects: readonly WrapRect[],
  world: WrapWorld,
  pan: WrapPan,
  viewport: WrapViewport,
  margin = 0,
): VisibleTile[] {
  if (
    world.worldW <= 0 ||
    world.worldH <= 0 ||
    viewport.width <= 0 ||
    viewport.height <= 0
  ) {
    return [];
  }

  const left = pan.x - margin;
  const top = pan.y - margin;
  const right = pan.x + viewport.width + margin;
  const bottom = pan.y + viewport.height + margin;
  const visible: VisibleTile[] = [];

  rects.forEach((rect, rectIndex) => {
    if (rect.w <= 0 || rect.h <= 0) return;

    const copyXStart = Math.ceil((left - (rect.x + rect.w)) / world.worldW);
    const copyXEnd = Math.floor((right - rect.x) / world.worldW);
    const copyYStart = Math.ceil((top - (rect.y + rect.h)) / world.worldH);
    const copyYEnd = Math.floor((bottom - rect.y) / world.worldH);

    for (let copyX = copyXStart; copyX <= copyXEnd; copyX += 1) {
      const worldX = rect.x + copyX * world.worldW;

      if (worldX + rect.w <= left || worldX >= right) continue;

      for (let copyY = copyYStart; copyY <= copyYEnd; copyY += 1) {
        const worldY = rect.y + copyY * world.worldH;

        if (worldY + rect.h <= top || worldY >= bottom) continue;

        visible.push({
          rectIndex,
          screenX: worldX - pan.x,
          screenY: worldY - pan.y,
          worldX,
          worldY,
          copyX,
          copyY,
        });
      }
    }
  });

  return visible;
}
