"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { LensMode } from "@/components/canvas/lens";
import { LENS, clamp } from "@/components/canvas/lens";
import { BREATH } from "@/components/canvas/breathing";
import type { BreathSettings } from "@/components/canvas/breathing";
import { HOVER } from "@/components/canvas/hover";
import type { HoverSettings } from "@/components/canvas/hover";
import { FocusViewer } from "@/components/canvas/focus-viewer";
import { InfiniteCanvas } from "@/components/canvas/infinite-canvas";
import type {
  CanvasItem,
  InfiniteCanvasHandle,
  LensSettings,
} from "@/components/canvas/infinite-canvas";
import type { Box } from "@/components/work/morph";
import "@/components/media/media.css";
import "./canvas.css";

type ViewerState = {
  index: number;
  startAt?: number;
  openRect?: Box;
  canvasOwned?: boolean;
};

/** The dev-only label; the slider stays a fraction of the shader strength. */
const MAX = {
  strength: LENS.maxStrength,
  boost: LENS.maxBoost,
  vignette: LENS.maxVignette,
} as const;

function valuesQuery(
  lens: LensSettings,
  breath: BreathSettings,
  hover: HoverSettings,
): string {
  return `lens=${lens.mode}&strength=${lens.strength.toFixed(2)}&boost=${lens.boost.toFixed(2)}&vignette=${lens.vignette.toFixed(2)}&breath=${breath.amplitude.toFixed(3)}&breathPeriod=${Math.round(breath.periodMs)}&hover=${hover.scale.toFixed(2)}`;
}

/** Clipboard with the dev server's older/denied-permission fallback. */
function writeClipboard(text: string): Promise<void> {
  const fallback = () => {
    const area = document.createElement("textarea");

    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    try {
      document.execCommand("copy");
    } finally {
      area.remove();
    }
  };

  if (navigator.clipboard?.writeText) {
    return navigator.clipboard.writeText(text).catch(fallback);
  }

  fallback();
  return Promise.resolve();
}

/**
 * Dev-only shell for the WebGL drag canvas.
 *
 * The uniform plane grid is the only layout left: masonry and scatter were
 * dropped with the DOM tile pool rather than kept as a second renderer. The
 * focus viewer keeps its DOM media and chrome; the canvas supplies the clicked
 * plane's projected rect for the FLIP and the current rect on close.
 *
 * The lens panel keeps the flat/globe A/B, its three strengths, the idle
 * breathing amplitude/period and the hover lift in the URL, so a dialled-in
 * look can be linked or pasted back to another session.
 */
export function CanvasProto({
  items,
  initialLens,
  initialBreath,
  initialHover,
}: {
  items: CanvasItem[];
  initialLens: LensSettings;
  initialBreath: BreathSettings;
  initialHover: HoverSettings;
}) {
  const [viewer, setViewer] = useState<ViewerState | null>(null);
  const [viewerClosing, setViewerClosing] = useState(false);
  const [canvasPending, setCanvasPending] = useState(false);
  const [lens, setLens] = useState<LensSettings>(initialLens);
  const [breath, setBreath] = useState<BreathSettings>(initialBreath);
  const [hover, setHover] = useState<HoverSettings>(initialHover);
  const [copied, setCopied] = useState(false);
  const canvasRef = useRef<InfiniteCanvasHandle | null>(null);
  const copyTimer = useRef(0);

  const openViewer = useCallback(
    (index: number, startAt?: number, openRect?: Box, canvasOwned?: boolean) => {
      setViewerClosing(false);
      setCanvasPending(Boolean(canvasOwned));
      setViewer({ index, startAt, openRect, canvasOwned });
    },
    [],
  );

  const closeViewer = useCallback(() => {
    setViewer(null);
    setViewerClosing(false);
    setCanvasPending(false);
  }, []);

  const markCanvasOpened = useCallback(() => {
    setCanvasPending(false);
  }, []);

  const markViewerClosing = useCallback(
    (index: number, time?: number, canvasOwned?: boolean) => {
      setViewerClosing(true);
      // Return the landing rect immediately; the tile prepares in parallel.
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

  useEffect(() => {
    const url = new URL(window.location.href);

    url.searchParams.set("lens", lens.mode);
    url.searchParams.set("strength", lens.strength.toFixed(2));
    url.searchParams.set("boost", lens.boost.toFixed(2));
    url.searchParams.set("vignette", lens.vignette.toFixed(2));
    url.searchParams.set("breath", breath.amplitude.toFixed(3));
    url.searchParams.set("breathPeriod", String(Math.round(breath.periodMs)));
    url.searchParams.set("hover", hover.scale.toFixed(2));
    window.history.replaceState(window.history.state, "", url);
  }, [breath, hover, lens]);

  useEffect(() => () => window.clearTimeout(copyTimer.current), []);

  const setMode = useCallback((mode: LensMode) => {
    setLens((current) => ({ ...current, mode }));
  }, []);

  const setValue = useCallback(
    (key: "strength" | "boost" | "vignette", raw: string) => {
      const value = Number(raw);

      if (!Number.isFinite(value)) return;

      setLens((current) => ({
        ...current,
        [key]: clamp(value, 0, MAX[key]),
      }));
    },
    [],
  );

  const setBreathValue = useCallback(
    (key: keyof BreathSettings, raw: string) => {
      const value = Number(raw);

      if (!Number.isFinite(value)) return;

      setBreath((current) => ({
        ...current,
        [key]:
          key === "amplitude"
            ? clamp(value, BREATH.minAmplitude, BREATH.maxAmplitude)
            : clamp(value, BREATH.minPeriodMs, BREATH.maxPeriodMs),
      }));
    },
    [],
  );

  const setHoverScale = useCallback((raw: string) => {
    const value = Number(raw);

    if (!Number.isFinite(value)) return;

    setHover({
      scale: clamp(value, HOVER.minScale, HOVER.maxScale),
    });
  }, []);

  const copyValues = useCallback(() => {
    const done = () => {
      setCopied(true);
      window.clearTimeout(copyTimer.current);
      copyTimer.current = window.setTimeout(() => setCopied(false), 1500);
    };

    void writeClipboard(valuesQuery(lens, breath, hover)).then(done, done);
  }, [breath, hover, lens]);

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
          lens={lens}
          breath={breath}
          hover={hover}
          onOpen={openViewer}
          onCanvasOpened={markCanvasOpened}
        />
      </div>

      <div className="cv-chrome" inert={viewer !== null}>
        <p className="cv-hint">
          Drag or scroll <span aria-hidden="true">·</span> Hold arrows to pan{" "}
          <span aria-hidden="true">·</span> Click opens
        </p>

        <div
          className="cv-lens"
          role="group"
          aria-label="Lens, breathing and hover controls"
        >
          <div className="cv-lens__head">
            <span className="cv-lens__title">Lens</span>
            <div className="cv-lens__seg" role="group" aria-label="Lens mode">
              <button
                type="button"
                aria-pressed={lens.mode === "flat"}
                onClick={() => setMode("flat")}
              >
                Flat
              </button>
              <button
                type="button"
                aria-pressed={lens.mode === "globe"}
                onClick={() => setMode("globe")}
              >
                Globe
              </button>
            </div>
          </div>

          <label className="cv-lens__field">
            <span>Strength</span>
            <input
              type="range"
              min={0}
              max={MAX.strength}
              step={0.01}
              value={lens.strength}
              onChange={(event) => setValue("strength", event.target.value)}
            />
            <output>{lens.strength.toFixed(2)}</output>
          </label>

          <label className="cv-lens__field">
            <span>Drag boost</span>
            <input
              type="range"
              min={0}
              max={MAX.boost}
              step={0.01}
              value={lens.boost}
              onChange={(event) => setValue("boost", event.target.value)}
            />
            <output>{lens.boost.toFixed(2)}</output>
          </label>

          <label className="cv-lens__field">
            <span>Vignette</span>
            <input
              type="range"
              min={0}
              max={MAX.vignette}
              step={0.01}
              value={lens.vignette}
              onChange={(event) => setValue("vignette", event.target.value)}
            />
            <output>{lens.vignette.toFixed(2)}</output>
          </label>

          <div className="cv-lens__divider" aria-hidden="true" />
          <span className="cv-lens__subhead">Breathing</span>

          <label className="cv-lens__field">
            <span>Amplitude</span>
            <input
              type="range"
              min={BREATH.minAmplitude}
              max={BREATH.maxAmplitude}
              step={0.005}
              value={breath.amplitude}
              onChange={(event) =>
                setBreathValue("amplitude", event.target.value)
              }
            />
            <output>{(breath.amplitude * 100).toFixed(1)}%</output>
          </label>

          <label className="cv-lens__field">
            <span>Period</span>
            <input
              type="range"
              min={BREATH.minPeriodMs}
              max={BREATH.maxPeriodMs}
              step={250}
              value={breath.periodMs}
              onChange={(event) =>
                setBreathValue("periodMs", event.target.value)
              }
            />
            <output>{(breath.periodMs / 1000).toFixed(1)}s</output>
          </label>

          <div className="cv-lens__divider" aria-hidden="true" />
          <span className="cv-lens__subhead">Hover</span>

          <label className="cv-lens__field">
            <span>Scale</span>
            <input
              type="range"
              min={HOVER.minScale}
              max={HOVER.maxScale}
              step={0.01}
              value={hover.scale}
              onChange={(event) => setHoverScale(event.target.value)}
            />
            <output>{hover.scale.toFixed(2)}×</output>
          </label>

          <div className="cv-lens__foot">
            <button
              type="button"
              className="cv-lens__copy"
              onClick={copyValues}
            >
              {copied ? "Copied" : "Copy values"}
            </button>
            <code className="cv-lens__values">
              ?{valuesQuery(lens, breath, hover)}
            </code>
          </div>
        </div>
      </div>

      {viewer ? (
        <FocusViewer
          items={items}
          initialIndex={viewer.index}
          startAt={viewer.startAt}
          openRect={viewer.openRect}
          canvasOwned={viewer.canvasOwned}
          pending={canvasPending}
          onReady={markViewerReady}
          onClosing={markViewerClosing}
          onCloseLanded={markViewerLanded}
          onReopen={markViewerReopened}
          onReopenLanded={markViewerReopenLanded}
          onClosed={closeViewer}
        />
      ) : null}
    </main>
  );
}
