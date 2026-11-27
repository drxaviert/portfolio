"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { BreathSettings } from "@/components/canvas/breathing";
import { FocusViewer } from "@/components/canvas/focus-viewer";
import type { HoverSettings } from "@/components/canvas/hover";
import { InfiniteCanvas } from "@/components/canvas/infinite-canvas";
import type {
  CanvasItem,
  InfiniteCanvasHandle,
  LensSettings,
} from "@/components/canvas/infinite-canvas";
import type { Box } from "@/components/work/morph";
import type { WorkMeta } from "@/lib/work";
import { PerfHud } from "@/components/canvas/perf-hud";
import { markPerf, perfEnabled } from "@/components/canvas/perf";
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
  openRect?: Box;
  /** The media is the focused WebGL plane; the viewer is chrome only. */
  canvasOwned?: boolean;
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
  const [viewerStepped, setViewerStepped] = useState(false);
  const [canvasPending, setCanvasPending] = useState(false);
  const [chromeIn, setChromeIn] = useState(false);
  const canvasRef = useRef<InfiniteCanvasHandle | null>(null);
  const pathname = usePathname();
  const active = pathname === `/work/${meta.slug}`;
  const shownViewer = active ? viewer : null;
  const canvasViewing = Boolean(shownViewer?.canvasOwned) && !viewerStepped;

  const openViewer = useCallback(
    (index: number, startAt?: number, openRect?: Box, canvasOwned?: boolean) => {
      if (perfEnabled) {
        markPerf("react-open-state", { index, canvasOwned: Boolean(canvasOwned) });
      }
      setViewerClosing(false);
      setViewerStepped(false);
      setCanvasPending(Boolean(canvasOwned));
      setViewer({ index, startAt, openRect, canvasOwned });
    },
    [],
  );

  const closeViewer = useCallback(() => {
    setViewer(null);
    setViewerClosing(false);
    setViewerStepped(false);
    setCanvasPending(false);
  }, []);

  const markCanvasOpened = useCallback(() => {
    if (perfEnabled) markPerf("chrome-visible");
    setCanvasPending(false);
  }, []);

  const markIntroStarted = useCallback(() => {
    setChromeIn(true);
  }, []);

  // A canvas that cannot start its clock (no WebGL, or a failed effect) still
  // needs its chrome. The intro start arrives by 2.5s at the latest; this is
  // the no-intro fallback, not a second entrance beat.
  useEffect(() => {
    const timer = window.setTimeout(() => setChromeIn(true), 3000);
    return () => window.clearTimeout(timer);
  }, []);

  const markViewerClosing = useCallback(
    (index: number, time?: number, canvasOwned?: boolean) => {
      setViewerClosing(true);
      return canvasRef.current?.closeTo(index, time, canvasOwned) ?? null;
    },
    [],
  );

  const markViewerLanded = useCallback(() => {
    canvasRef.current?.landClose();
  }, []);

  const markViewerReopened = useCallback(() => {
    canvasRef.current?.cancelClose();
  }, []);

  const markViewerReopenLanded = useCallback(() => {
    setViewerClosing(false);
  }, []);

  const markViewerReady = useCallback(() => {
    canvasRef.current?.handoff();
  }, []);

  return (
    <div
      className="cv-reader"
      data-viewing={shownViewer && !viewerClosing ? "" : undefined}
      data-canvas-viewing={canvasViewing ? "" : undefined}
      data-closing={viewerClosing || undefined}
      data-chrome={
        items.length === 0 ? undefined : chromeIn ? "in" : "pending"
      }
    >
      <h1 id={READER_TITLE_ID} tabIndex={-1} className="cv-reader__title">
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
          onCanvasOpened={markCanvasOpened}
          onIntroStart={markIntroStarted}
        />
      </div>

      <div className="cv-reader__pill cv-reader__bottom-bar">
        <Breadcrumb title={meta.title} />
        <span className="cv-reader__bottom-divider" aria-hidden="true" />
        <span className="cv-reader__bottom-hint">
          Drag or scroll <span aria-hidden="true">·</span> Click to open
        </span>
      </div>

      <PerfHud />

      {items.length > 0 ? (
        <FocusViewer
          open={shownViewer !== null}
          items={items}
          initialIndex={shownViewer?.index ?? 0}
          startAt={shownViewer?.startAt}
          openRect={shownViewer?.openRect}
          canvasOwned={shownViewer?.canvasOwned}
          pending={canvasPending}
          onReady={markViewerReady}
          onClosing={markViewerClosing}
          onCloseLanded={markViewerLanded}
          onReopen={markViewerReopened}
          onReopenLanded={markViewerReopenLanded}
          onClosed={closeViewer}
          onStep={() => {
            setViewerStepped(true);
            canvasRef.current?.releaseOpen();
          }}
        />
      ) : null}
    </div>
  );
}
