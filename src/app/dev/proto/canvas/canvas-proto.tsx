"use client";

import { useCallback, useRef, useState } from "react";
import { FocusViewer } from "@/components/canvas/focus-viewer";
import { InfiniteCanvas } from "@/components/canvas/infinite-canvas";
import type {
  CanvasItem,
  InfiniteCanvasHandle,
} from "@/components/canvas/infinite-canvas";
import type { Box } from "@/components/work/morph";
import "@/components/media/media.css";
import "./canvas.css";

type ViewerState = {
  index: number;
  rect: Box;
};

/**
 * Dev-only shell for the WebGL drag canvas.
 *
 * The uniform plane grid is the only layout left: masonry and scatter were
 * dropped with the DOM tile pool rather than kept as a second renderer. The
 * focus viewer keeps its DOM media and chrome; the canvas supplies the clicked
 * plane's projected rect for the FLIP and the current rect on close.
 */
export function CanvasProto({ items }: { items: CanvasItem[] }) {
  const [viewer, setViewer] = useState<ViewerState | null>(null);
  const [viewerClosing, setViewerClosing] = useState(false);
  const canvasRef = useRef<InfiniteCanvasHandle | null>(null);

  const openViewer = useCallback((index: number, rect: Box) => {
    setViewerClosing(false);
    setViewer({ index, rect });
  }, []);

  const closeViewer = useCallback(() => {
    setViewer(null);
    setViewerClosing(false);
  }, []);

  const markViewerClosing = useCallback(() => {
    setViewerClosing(true);
    // Restore the hidden plane before the reverse flight measures its landing
    // rect, so the close never reveals a one-frame hole.
    canvasRef.current?.reveal();
  }, []);

  const rectForViewer = useCallback(
    (index: number) => canvasRef.current?.rectForIndex(index) ?? null,
    [],
  );

  return (
    <main
      className="cv-root"
      data-viewing={viewer && !viewerClosing ? "" : undefined}
    >
      <div className="cv-stage">
        <InfiniteCanvas
          ref={canvasRef}
          items={items}
          paused={viewer !== null}
          onOpen={openViewer}
        />
      </div>

      <div className="cv-chrome" inert={viewer !== null}>
        <p className="cv-hint">
          Drag or scroll <span aria-hidden="true">·</span> Hold arrows to pan{" "}
          <span aria-hidden="true">·</span> Enter opens
        </p>

        <p className="cv-switcher" aria-hidden="true">
          WebGL grid
        </p>
      </div>

      {viewer ? (
        <FocusViewer
          items={items}
          initialIndex={viewer.index}
          originRect={viewer.rect}
          getTargetRect={rectForViewer}
          onClosing={markViewerClosing}
          onClosed={closeViewer}
        />
      ) : null}
    </main>
  );
}
