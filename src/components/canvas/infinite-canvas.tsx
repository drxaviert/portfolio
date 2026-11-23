"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { useReducedMotion } from "@/components/home/use-reduced-motion";
import { MediaImage } from "@/components/media/media-image";
import { MediaVideo } from "@/components/media/media-video";
import type { MediaManifest } from "@/lib/media-types";
import { layoutFor } from "./layouts";
import type { LayoutName, LayoutRect } from "./layouts";
import { usePan } from "./use-pan";
import { tileKey, visibleTiles } from "./wrap";
import type { VisibleTile } from "./wrap";

export type CanvasItem = {
  /** Unique per copy in the cycled list, not the media id. */
  key: string;
  media: MediaManifest;
};

export type ViewportSize = {
  width: number;
  height: number;
};

/** Mount tiles this far outside the viewport, so a fling never lands on blank. */
const VISIBLE_MARGIN = 240;

/** One arrow-key step, in world px: the layout's cell plus its gap. */
const STEPS: Record<LayoutName, { x: number; y: number }> = {
  grid: { x: 304, y: 304 },
  masonry: { x: 304, y: 304 },
  scatter: { x: 328, y: 328 },
};

/**
 * The initial view does not split a tile at the top edge: grid and masonry
 * centre onto their cell stride, scatter (which has no stride) centres on its
 * world. Null means "no snap".
 */
const SNAP: Record<LayoutName, number | null> = {
  grid: 304,
  masonry: 304,
  scatter: null,
};

function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));

  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

/**
 * The moving plane.
 *
 * React owns which copies of the world are mounted; the rAF loop owns where
 * they are. Every frame it reads the pan ref, walks the visible copy set and
 * writes `transform` straight to the pooled tile elements. A React render
 * happens only when that copy set changes (a new tile entering the margin),
 * never because the pointer moved. The loop stops as soon as there is no drag,
 * glide or key tween, and while the document is hidden.
 */
export function InfiniteCanvas({
  items,
  layout,
  autoplayVideos,
  paused,
  onOpen,
}: {
  items: CanvasItem[];
  layout: LayoutName;
  autoplayVideos: boolean;
  paused: boolean;
  onOpen: (index: number, origin: HTMLElement) => void;
}) {
  const layoutResult = useMemo(
    () =>
      layoutFor(
        layout,
        items.map((item) => ({
          id: item.key,
          w: item.media.width,
          h: item.media.height,
        })),
      ),
    [items, layout],
  );

  const [visible, setVisible] = useState<VisibleTile[]>([]);
  const viewportRef = useRef<ViewportSize | null>(null);
  const layoutRef = useRef(layoutResult);
  const pausedRef = useRef(paused);
  const elementsRef = useRef(new Map<string, HTMLDivElement>());
  const wakeRef = useRef<() => void>(() => {});
  const renderCountRef = useRef(0);
  const reduceMotion = useReducedMotion();

  // Props that only the frame loop reads are synced after commit, never written
  // during render. The loop itself is the only thing that runs per frame.
  useEffect(() => {
    layoutRef.current = layoutResult;
  }, [layoutResult]);

  useEffect(() => {
    renderCountRef.current += 1;

    if (process.env.NODE_ENV === "production") return;

    const stats = {
      renders: renderCountRef.current,
      tiles: visible.length,
      layout,
      paused,
    };

    (window as Window & { __canvasProto?: typeof stats }).__canvasProto = stats;
  });

  const pan = usePan({
    step: STEPS[layout],
    reduceMotion,
    disabled: paused,
    onTap: (target) => {
      if (pausedRef.current) return;

      const tile = target?.closest<HTMLElement>("[data-canvas-tile]");
      if (!tile) return;

      const index = Number(tile.dataset.tileIndex);
      if (Number.isFinite(index)) onOpen(index, tile);
    },
    onWake: () => wakeRef.current(),
  });

  const { containerRef, panRef, handlers, tick, isActive, halt, setPan } = pan;

  // The one frame loop. It is recreated only with the layout, and reads every
  // changing value from a ref so it never closes over a stale pan or viewport.
  useEffect(() => {
    let frame = 0;
    let previousSignature = "";

    const renderFrame = () => {
      const size = viewportRef.current;
      if (!size) return;

      const current = layoutRef.current;
      const tiles = visibleTiles(
        current.rects,
        { worldW: current.worldW, worldH: current.worldH },
        panRef.current,
        size,
        VISIBLE_MARGIN,
      );

      // Write positions before the set update: tiles already mounted move this
      // frame, and tiles that are about to mount get their current position
      // from the React render below.
      for (const tile of tiles) {
        const element = elementsRef.current.get(tileKey(tile));
        if (!element) continue;

        element.style.transform = `translate3d(${tile.screenX}px, ${tile.screenY}px, 0)`;
      }

      const signature = tiles.map(tileKey).join(",");

      if (signature !== previousSignature) {
        previousSignature = signature;
        setVisible(tiles);
      }
    };

    const loop = (now: number) => {
      frame = 0;

      if (document.hidden || pausedRef.current) return;

      tick(now);
      renderFrame();

      if (isActive()) frame = requestAnimationFrame(loop);
    };

    const wake = () => {
      if (frame !== 0 || document.hidden || pausedRef.current) return;
      frame = requestAnimationFrame(loop);
    };

    wakeRef.current = wake;

    const onVisibilityChange = () => {
      if (document.hidden) {
        if (frame !== 0) cancelAnimationFrame(frame);
        frame = 0;
        return;
      }

      wake();
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    wake();

    return () => {
      if (frame !== 0) cancelAnimationFrame(frame);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      wakeRef.current = () => {};
    };
  }, [isActive, panRef, tick]);

  // Measure once and then keep the centre stable as the window changes. The
  // canvas is a fixed full-viewport surface, so `innerWidth`/`innerHeight` are
  // the same box the tile maths uses.
  useEffect(() => {
    const measure = () => {
      const next = {
        width: window.innerWidth,
        height: window.innerHeight,
      };
      const previous = viewportRef.current;

      if (
        previous &&
        previous.width === next.width &&
        previous.height === next.height
      ) {
        return;
      }

      viewportRef.current = next;

      if (previous) {
        // Keep the point at the centre of the viewport under the centre.
        panRef.current.x += (next.width - previous.width) / 2;
        panRef.current.y += (next.height - previous.height) / 2;
      } else {
        const current = layoutRef.current;
        const stride = SNAP[layout];
        const centreX = (current.worldW - next.width) / 2;
        const centreY = (current.worldH - next.height) / 2;

        setPan(
          stride ? Math.round(centreX / stride) * stride : centreX,
          stride ? Math.round(centreY / stride) * stride : centreY,
        );
      }

      wakeRef.current();
    };

    measure();
    window.addEventListener("resize", measure);

    return () => window.removeEventListener("resize", measure);
  }, [layout, panRef, setPan]);

  useEffect(() => {
    pausedRef.current = paused;

    if (paused) {
      halt();
      return;
    }

    wakeRef.current();
  }, [halt, paused]);

  return (
    <div
      ref={containerRef}
      className="cv-surface"
      data-canvas-surface
      tabIndex={0}
      role="region"
      aria-label="Draggable media canvas. Drag to pan, use the arrow keys to move, or open a tile."
      inert={paused}
      {...handlers}
      onDragStart={(event) => event.preventDefault()}
      onContextMenu={(event) => event.preventDefault()}
    >
      {visible.map((tile) => {
        const rect = layoutResult.rects[tile.rectIndex];
        if (!rect) return null;

        const item = items[rect.index];
        if (!item) return null;

        const label =
          item.media.caption ||
          item.media.alt ||
          `Open media ${rect.index + 1}`;

        return (
          <Tile
            key={tileKey(tile)}
            tile={tile}
            rect={rect}
            item={item}
            autoplayVideos={autoplayVideos}
            label={label}
            onMount={(element) => {
              if (element) elementsRef.current.set(tileKey(tile), element);
              else elementsRef.current.delete(tileKey(tile));
            }}
            onOpen={onOpen}
            paused={paused}
          />
        );
      })}

      {items.length === 0 ? (
        <p className="cv-empty">
          No media manifests found. Run <code>pnpm post</code> first.
        </p>
      ) : null}
    </div>
  );
}

/**
 * One positioned copy. The wrapper is the element the frame loop transforms;
 * the button inside owns focus, the click target and the accessible name.
 */
function Tile({
  tile,
  rect,
  item,
  autoplayVideos,
  label,
  paused,
  onMount,
  onOpen,
}: {
  tile: VisibleTile;
  rect: LayoutRect;
  item: CanvasItem;
  autoplayVideos: boolean;
  label: string;
  paused: boolean;
  onMount: (element: HTMLDivElement | null) => void;
  onOpen: (index: number, origin: HTMLElement) => void;
}) {
  const style: CSSProperties = {
    width: rect.w,
    height: rect.h,
    transform: `translate3d(${tile.screenX}px, ${tile.screenY}px, 0)`,
  };

  return (
    <div ref={onMount} className="cv-tile" style={style}>
      <button
        type="button"
        className="cv-tile__button"
        data-canvas-tile
        data-tile-index={rect.index}
        aria-label={label}
        onClick={(event) => {
          // Pointer taps are resolved by the pan hook after its 6px test;
          // only keyboard and assistive-tech activation arrives here.
          if (event.detail !== 0 || paused) return;
          onOpen(rect.index, event.currentTarget);
        }}
      >
        {item.media.kind === "image" ? (
          <MediaImage
            media={item.media}
            alt=""
            className="cv-tile__media"
            sizes={`${Math.ceil(rect.w)}px`}
          />
        ) : autoplayVideos ? (
          <MediaVideo media={item.media} alt="" className="cv-tile__media" />
        ) : (
          <picture className="cv-tile__poster">
            <source type="image/avif" srcSet={item.media.poster.avif} />
            <img
              src={item.media.poster.jpg}
              alt=""
              width={item.media.width}
              height={item.media.height}
              draggable={false}
              loading="lazy"
              decoding="async"
            />
          </picture>
        )}

        {item.media.kind === "video" ? (
          <span className="cv-tile__duration" aria-hidden="true">
            {formatDuration(item.media.duration)}
          </span>
        ) : null}
      </button>
    </div>
  );
}
