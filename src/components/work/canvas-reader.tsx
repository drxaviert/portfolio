"use client";

import { usePathname } from "next/navigation";
import { useCallback, useRef, useState } from "react";
import type { BreathSettings } from "@/components/canvas/breathing";
import { FocusViewer } from "@/components/canvas/focus-viewer";
import type { HoverSettings } from "@/components/canvas/hover";
import { InfiniteCanvas } from "@/components/canvas/infinite-canvas";
import type {
  CanvasItem,
  InfiniteCanvasHandle,
  LensSettings,
} from "@/components/canvas/infinite-canvas";
import type { WorkMeta } from "@/lib/work";
import { Breadcrumb } from "./breadcrumb";
import { READER_TITLE_ID } from "./parts";
import "./canvas-reader.css";

const LOCKED_LENS: LensSettings = {
  mode: "globe",
  strength: 0.23,
  boost: 0.3,
  vignette: 0.25,
};

const LOCKED_BREATH: BreathSettings = {
  amplitude: 0.06,
  periodMs: 5000,
};

const LOCKED_HOVER: HoverSettings = {
  scale: 1.08,
};

type ViewerState = {
  index: number;
  startAt?: number;
};

/**
 * The live Motion & Stills study: the approved canvas prototype inside the
 * existing WorkDrawer, with the dev panel removed and the locked defaults.
 *
 * The canvas fills the panel, not the viewport, so the drawer's inset, radius,
 * morph and close all still own the surface. The viewer is the same full-screen
 * FocusViewer the prototype used. The route's Activity copy stops the canvas
 * (paused) whenever this study is not the current route, and the InfiniteCanvas
 * effect disposes the WebGL context on unmount.
 */
export function CanvasReader({
  meta,
  items,
}: {
  meta: WorkMeta;
  items: CanvasItem[];
}) {
  const [viewer, setViewer] = useState<ViewerState | null>(null);
  const [viewerClosing, setViewerClosing] = useState(false);
  const canvasRef = useRef<InfiniteCanvasHandle | null>(null);
  const pathname = usePathname();
  const active = pathname === `/work/${meta.slug}`;
  const shownViewer = active ? viewer : null;

  const openViewer = useCallback((index: number, startAt?: number) => {
    setViewerClosing(false);
    setViewer({ index, startAt });
  }, []);

  const closeViewer = useCallback(() => {
    setViewer(null);
    setViewerClosing(false);
  }, []);

  const markViewerClosing = useCallback((index: number, time?: number) => {
    setViewerClosing(true);
    return canvasRef.current?.closeTo(index, time);
  }, []);

  const markViewerReady = useCallback(() => {
    canvasRef.current?.handoff();
  }, []);

  return (
    <div
      className="cv-reader"
      data-viewing={shownViewer && !viewerClosing ? "" : undefined}
    >
      <h1
        id={READER_TITLE_ID}
        tabIndex={-1}
        className="cv-reader__title"
      >
        {meta.title}
      </h1>

      <div className="cv-reader__stage">
        <InfiniteCanvas
          ref={canvasRef}
          items={items}
          paused={shownViewer !== null || !active}
          lens={LOCKED_LENS}
          breath={LOCKED_BREATH}
          hover={LOCKED_HOVER}
          onOpen={openViewer}
        />
      </div>

      <div className="cv-reader__back">
        <Breadcrumb title={meta.title} />
      </div>

      <p className="cv-reader__hint">
        Drag or scroll <span aria-hidden="true">·</span> Click to open
      </p>

      <p className="cv-reader__credit">
        Interaction after{" "}
        <a
          href="https://www.cathydolle.com/playground"
          target="_blank"
          rel="noopener noreferrer"
        >
          Cathy Dolle
        </a>
      </p>

      {shownViewer ? (
        <FocusViewer
          items={items}
          initialIndex={shownViewer.index}
          startAt={shownViewer.startAt}
          onReady={markViewerReady}
          onClosing={markViewerClosing}
          onClosed={closeViewer}
        />
      ) : null}
    </div>
  );
}
