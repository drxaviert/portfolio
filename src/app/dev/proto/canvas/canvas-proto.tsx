"use client";

import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { FocusViewer } from "@/components/canvas/focus-viewer";
import { InfiniteCanvas } from "@/components/canvas/infinite-canvas";
import type { CanvasItem } from "@/components/canvas/infinite-canvas";
import type { LayoutName } from "@/components/canvas/layouts";
import "@/components/media/media.css";
import "./canvas.css";

const LAYOUTS: { value: LayoutName; label: string }[] = [
  { value: "grid", label: "Grid" },
  { value: "masonry", label: "Masonry" },
  { value: "scatter", label: "Scatter" },
];

type ViewerState = {
  index: number;
  origin: HTMLElement;
};

/**
 * Dev-only shell for the drag-canvas prototype.
 *
 * The server page owns the media list and the initial layout; this component
 * owns the layout switch, the autoplay toggle and the focus viewer. The canvas
 * itself is keyed by layout, so changing layouts is a clean new world rather
 * than a relayout under the reader's current pan.
 */
export function CanvasProto({
  initialLayout,
  items,
}: {
  initialLayout: LayoutName;
  items: CanvasItem[];
}) {
  const router = useRouter();
  const [layout, setLayout] = useState<LayoutName>(initialLayout);
  const [autoplayVideos, setAutoplayVideos] = useState(false);
  const [viewer, setViewer] = useState<ViewerState | null>(null);
  const [viewerClosing, setViewerClosing] = useState(false);
  const groupRef = useRef<HTMLDivElement | null>(null);

  const openViewer = useCallback((index: number, origin: HTMLElement) => {
    setViewerClosing(false);
    setViewer({ index, origin });
  }, []);

  const closeViewer = useCallback(() => {
    setViewer(null);
    setViewerClosing(false);
  }, []);

  const markViewerClosing = useCallback(() => {
    setViewerClosing(true);
  }, []);

  function changeLayout(next: LayoutName) {
    if (next === layout) return;

    setLayout(next);

    const url = new URL(window.location.href);
    url.searchParams.set("layout", next);

    router.replace(`${url.pathname}${url.search}${url.hash}`, {
      scroll: false,
    });
  }

  function onLayoutKeyDown(
    event: KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) {
    let next = index;

    switch (event.key) {
      case "ArrowRight":
      case "ArrowDown":
        next = (index + 1) % LAYOUTS.length;
        break;
      case "ArrowLeft":
      case "ArrowUp":
        next = (index + LAYOUTS.length - 1) % LAYOUTS.length;
        break;
      case "Home":
        next = 0;
        break;
      case "End":
        next = LAYOUTS.length - 1;
        break;
      default:
        return;
    }

    event.preventDefault();
    changeLayout(LAYOUTS[next].value);
    groupRef.current
      ?.querySelectorAll<HTMLButtonElement>('[role="radio"]')
      [next]?.focus();
  }

  return (
    <main
      className="cv-root"
      data-viewing={viewer && !viewerClosing ? "" : undefined}
    >
      <div className="cv-stage">
        <InfiniteCanvas
          key={layout}
          items={items}
          layout={layout}
          autoplayVideos={autoplayVideos}
          paused={viewer !== null}
          onOpen={openViewer}
        />
      </div>

      <div className="cv-chrome" inert={viewer !== null}>
        <p className="cv-hint">
          Drag to explore <span aria-hidden="true">·</span> Click a tile to
          focus <span aria-hidden="true">·</span> Arrow keys pan
        </p>

        <div className="cv-switcher" role="group" aria-label="Canvas options">
          <div
            ref={groupRef}
            className="cv-seg"
            role="radiogroup"
            aria-label="Layout"
          >
            {LAYOUTS.map((option, index) => {
              const active = option.value === layout;

              return (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  tabIndex={active ? 0 : -1}
                  className="cv-seg__item"
                  data-on={active || undefined}
                  onClick={() => changeLayout(option.value)}
                  onKeyDown={(event) => onLayoutKeyDown(event, index)}
                >
                  {option.label}
                </button>
              );
            })}
          </div>

          <span className="cv-switcher__divider" aria-hidden="true" />

          <button
            type="button"
            role="switch"
            aria-checked={autoplayVideos}
            aria-label="Autoplay videos on canvas"
            className="cv-autoplay"
            data-on={autoplayVideos || undefined}
            onClick={() => setAutoplayVideos((current) => !current)}
          >
            <span className="cv-autoplay__track" aria-hidden="true">
              <span className="cv-autoplay__thumb" />
            </span>
            <span>Autoplay</span>
          </button>
        </div>
      </div>

      {viewer ? (
        <FocusViewer
          items={items}
          initialIndex={viewer.index}
          origin={viewer.origin}
          onClosing={markViewerClosing}
          onClosed={closeViewer}
        />
      ) : null}
    </main>
  );
}
