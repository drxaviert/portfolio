"use client";

import { useEffect, useRef } from "react";
import "./frame-line-spotlight.css";

/**
 * Spotlight hover for the four 1px page frame lines.
 *
 * The real lines stay in place; this adds one primary-coloured glow per line,
 * sampled from a single round pool of light around the cursor. Values are the
 * chosen prototype settings (see the frame-line hover handoff).
 *
 * One window pointermove listener batched in rAF; mask/opacity only; no React
 * state per frame. Reduced motion replaces the moving mask with a whole-line
 * opacity fade. The root is inert, aria-hidden and pointer-events-none.
 */

const PROXIMITY = 80;
const POOL_RADIUS = 200; // chosen size 400px / 2
const BLEED_FALLOFF = 3;
const JUNCTION_SNAP = 48;
const BLEND_SOFTNESS = 120;
const REDUCED_STRENGTH = 0.4;

type FrameLine = {
  host: HTMLDivElement;
  glow: HTMLSpanElement;
  vertical: boolean;
  /** Line centre in viewport coordinates. */
  x: number;
  y: number;
  /** Extent along the line in viewport coordinates. */
  start: number;
  end: number;
  /** Start of the line in viewport coordinates (mask origin). */
  viewportStart: number;
  /** Line length, px. */
  length: number;
};

type LineSample = {
  line: FrameLine;
  weight: number;
  point: { x: number; y: number } | null;
};

function smoothstep(value: number): number {
  const t = Math.min(1, Math.max(0, value));

  return t * t * (3 - 2 * t);
}

/** Gaussian falloff with a smooth window so the pool reaches zero at R. */
function bleedFalloff(x: number): number {
  if (x >= 1) return 0;
  if (x <= 0) return 1;

  return Math.exp(-BLEED_FALLOFF * x * x) * smoothstep(1 - x);
}

export function FrameLineSpotlight() {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const hostRefs = useRef<Array<HTMLDivElement | null>>([]);
  const glowRefs = useRef<Array<HTMLSpanElement | null>>([]);

  useEffect(() => {
    const root = rootRef.current;

    if (!root) return;

    const scope = root.closest("main");

    if (!scope) return;

    const rootEl = root;
    const scopeEl = scope;

    const hosts = hostRefs.current.filter(
      (host): host is HTMLDivElement => host !== null,
    );
    const glows = glowRefs.current.filter(
      (glow): glow is HTMLSpanElement => glow !== null,
    );

    if (hosts.length !== 4 || glows.length !== 4) return;

    const lines: FrameLine[] = hosts.map((host, index) => ({
      host,
      glow: glows[index],
      vertical: index < 2,
      x: 0,
      y: 0,
      start: 0,
      end: 0,
      viewportStart: 0,
      length: 0,
    }));

    const hoverQuery = window.matchMedia("(hover: hover) and (pointer: fine)");
    const reducedQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

    let pointer: { x: number; y: number } | null = null;
    let frame = 0;
    let measureFrame = 0;
    let reduced = reducedQuery.matches;

    function measure() {
      if (window.innerWidth < 1440) return;

      const rootRect = rootEl.getBoundingClientRect();
      const originals = Array.from(
        scopeEl.querySelectorAll<HTMLElement>("[data-frame-line]"),
      );

      if (originals.length < 4) return;

      const rects = originals.map((element) =>
        element.getBoundingClientRect(),
      );
      const visible = rects.filter(
        (rect) => rect.width > 0 && rect.height > 0,
      );
      const verticals = visible.filter((rect) => rect.height > rect.width);
      const horizontals = visible.filter((rect) => rect.height <= rect.width);
      const ordered = [...verticals, ...horizontals];

      ordered.slice(0, lines.length).forEach((rect, index) => {
        const line = lines[index];

        if (!line) return;

        line.vertical = rect.height > rect.width;

        if (line.vertical) {
          line.x = rect.left + 0.5;
          line.start = rect.top;
          line.end = rect.top + rect.height;
          line.viewportStart = rect.top;
          line.length = rect.height;
        } else {
          line.y = rect.top + 0.5;
          line.start = rect.left;
          line.end = rect.left + rect.width;
          line.viewportStart = rect.left;
          line.length = rect.width;
        }

        line.host.style.left = `${rect.left - rootRect.left}px`;
        line.host.style.top = `${rect.top - rootRect.top}px`;
        line.host.style.width = `${rect.width}px`;
        line.host.style.height = `${rect.height}px`;
      });
    }

    function scheduleMeasure() {
      if (measureFrame) return;

      measureFrame = requestAnimationFrame(() => {
        measureFrame = 0;
        measure();

        if (pointer) schedule();
      });
    }

    function proximity(line: FrameLine, point: { x: number; y: number }) {
      if (line.vertical) {
        return {
          distance: Math.abs(point.x - line.x),
          within: point.y >= line.start && point.y <= line.end,
          projection: { x: line.x, y: point.y },
        };
      }

      return {
        distance: Math.abs(point.y - line.y),
        within: point.x >= line.start && point.x <= line.end,
        projection: { x: point.x, y: line.y },
      };
    }

    function apply() {
      frame = 0;

      if (!pointer || window.innerWidth < 1440) {
        for (const line of lines) {
          line.glow.style.setProperty("--frame-spot-light", "0");
        }
        return;
      }

      const point = pointer;
      const samples: LineSample[] = lines.map((line) => {
        const info = proximity(line, point);
        const near = info.within && info.distance <= PROXIMITY;
        const weight = near
          ? smoothstep(1 - info.distance / PROXIMITY)
          : 0;

        return {
          line,
          weight,
          point: near ? info.projection : null,
        };
      });

      if (reduced) {
        for (const sample of samples) {
          sample.line.glow.style.setProperty("mask-image", "none");
          sample.line.glow.style.setProperty("-webkit-mask-image", "none");
          sample.line.glow.style.setProperty(
            "--frame-spot-light",
            (sample.weight * REDUCED_STRENGTH).toFixed(4),
          );
        }
        return;
      }

      let weightSum = 0;
      let lx = 0;
      let ly = 0;
      let light = 0;

      for (const sample of samples) {
        if (sample.weight <= 0 || !sample.point) continue;

        weightSum += sample.weight;
        lx += sample.point.x * sample.weight;
        ly += sample.point.y * sample.weight;
        light = Math.max(light, sample.weight);
      }

      if (weightSum <= 0 || light <= 0) {
        for (const line of lines) {
          line.glow.style.setProperty("--frame-spot-light", "0");
        }
        return;
      }

      lx /= weightSum;
      ly /= weightSum;

      // Pull the shared light to a corner when it is near two lines.
      let junction: { x: number; y: number; s: number } | null = null;

      if (JUNCTION_SNAP > 0) {
        for (let i = 0; i < samples.length; i += 1) {
          for (let j = i + 1; j < samples.length; j += 1) {
            if (samples[i].weight <= 0 || samples[j].weight <= 0) continue;

            const a = samples[i].line;
            const b = samples[j].line;

            if (a.vertical === b.vertical) continue;

            const vertical = a.vertical ? a : b;
            const horizontal = a.vertical ? b : a;
            const jx = vertical.x;
            const jy = horizontal.y;

            if (
              jx < horizontal.start ||
              jx > horizontal.end ||
              jy < vertical.start ||
              jy > vertical.end
            ) {
              continue;
            }

            const distance = Math.hypot(point.x - jx, point.y - jy);
            const falloff = smoothstep(
              Math.min(
                1,
                Math.max(
                  0,
                  (JUNCTION_SNAP - distance) / BLEND_SOFTNESS,
                ),
              ),
            );
            const s = Math.min(samples[i].weight, samples[j].weight) * falloff;

            if (s > 0 && (!junction || s > junction.s)) {
              junction = { x: jx, y: jy, s };
            }
          }
        }
      }

      let sx = lx;
      let sy = ly;

      if (junction) {
        sx = lx + (junction.x - lx) * junction.s;
        sy = ly + (junction.y - ly) * junction.s;
      }

      // Every line samples the same circle of radius R centred on L.
      for (const sample of samples) {
        const line = sample.line;
        const px = line.vertical
          ? line.x
          : Math.min(Math.max(sx, line.start), line.end);
        const py = line.vertical
          ? Math.min(Math.max(sy, line.start), line.end)
          : line.y;
        const distance = Math.hypot(sx - px, sy - py);
        const peak = bleedFalloff(distance / POOL_RADIUS);

        if (peak <= 0.001) {
          line.glow.style.setProperty("--frame-spot-light", "0");
          continue;
        }

        const halfChord = Math.sqrt(
          Math.max(0, POOL_RADIUS * POOL_RADIUS - distance * distance),
        );
        const localPeak = line.vertical ? py - line.viewportStart : px - line.viewportStart;
        const positions = new Set<number>([0, line.length]);

        for (const fraction of [-1, -0.75, -0.5, -0.25, 0, 0.25, 0.5, 0.75, 1]) {
          const position = localPeak + fraction * halfChord;

          if (position >= 0 && position <= line.length) {
            positions.add(Math.round(position * 100) / 100);
          }
        }

        const stops = [...positions]
          .sort((a, b) => a - b)
          .map((position) => {
            const pointDistance = line.vertical
              ? Math.hypot(sx - line.x, sy - (line.viewportStart + position))
              : Math.hypot(
                  sx - (line.viewportStart + position),
                  sy - line.y,
                );
            const alpha = Math.min(
              1,
              Math.max(0, bleedFalloff(pointDistance / POOL_RADIUS) / peak),
            );

            return `rgba(0, 0, 0, ${alpha.toFixed(3)}) ${position.toFixed(2)}px`;
          });
        const direction = line.vertical ? "to bottom" : "to right";
        const gradient = `linear-gradient(${direction}, ${stops.join(", ")})`;

        line.glow.style.setProperty("-webkit-mask-image", gradient);
        line.glow.style.setProperty("mask-image", gradient);
        line.glow.style.setProperty(
          "--frame-spot-light",
          (light * peak).toFixed(4),
        );
      }
    }

    function schedule() {
      if (!frame) frame = requestAnimationFrame(apply);
    }

    function onPointerMove(event: PointerEvent) {
      pointer = { x: event.clientX, y: event.clientY };
      schedule();
    }

    function clearPointer() {
      pointer = null;
      schedule();
    }

    function onPointerOut(event: PointerEvent) {
      if (!event.relatedTarget) clearPointer();
    }

    function onVisibilityChange() {
      if (document.hidden) clearPointer();
    }

    function onReducedChange() {
      reduced = reducedQuery.matches;
      schedule();
    }

    measure();

    window.addEventListener("resize", scheduleMeasure);
    window.addEventListener("scroll", scheduleMeasure, { passive: true });
    reducedQuery.addEventListener("change", onReducedChange);

    if (document.fonts) {
      void document.fonts.ready.then(scheduleMeasure);
    }

    if (hoverQuery.matches) {
      window.addEventListener("pointermove", onPointerMove, { passive: true });
      window.addEventListener("pointerout", onPointerOut);
      window.addEventListener("blur", clearPointer);
      document.addEventListener("visibilitychange", onVisibilityChange);
    }

    return () => {
      if (frame) cancelAnimationFrame(frame);
      if (measureFrame) cancelAnimationFrame(measureFrame);
      window.removeEventListener("resize", scheduleMeasure);
      window.removeEventListener("scroll", scheduleMeasure);
      reducedQuery.removeEventListener("change", onReducedChange);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerout", onPointerOut);
      window.removeEventListener("blur", clearPointer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  return (
    <div ref={rootRef} className="frame-spot-root" aria-hidden="true">
      {[0, 1, 2, 3].map((index) => (
        <div
          key={index}
          className="frame-spot-line"
          data-orientation={index < 2 ? "v" : "h"}
          ref={(element) => {
            hostRefs.current[index] = element;
          }}
        >
          <span
            className="frame-spot-glow"
            ref={(element) => {
              glowRefs.current[index] = element;
            }}
          />
        </div>
      ))}
    </div>
  );
}
