"use client";

import { useEffect, useRef } from "react";
import "./frame-line-spotlight.css";

/**
 * Spotlight hover for the four 1px page frame lines.
 *
 * The real lines stay in place; this adds a primary-coloured glow per line,
 * sampled from one round pool of light that follows the cursor. Values are the
 * chosen prototype settings (see the frame-line hover handoff).
 *
 * One window pointermove listener batched in rAF. Each line clips a fixed
 * 400px radial-gradient pool (its falloff is the mask in
 * frame-line-spotlight.css) to its own 1px strip, so a pointer frame only
 * writes one transform and one inherited opacity — both composited — instead of
 * rebuilding four mask-image gradients (a paint property) under the WebGL
 * horizon. Reduced motion hides the pools and fades the whole line instead.
 * The root is inert, aria-hidden and pointer-events-none.
 */

const PROXIMITY = 80;
const POOL_RADIUS = 200; // chosen size 400px / 2 (= .frame-spot-pool's size)
const JUNCTION_SNAP = 48;
const BLEND_SOFTNESS = 120;
const REDUCED_STRENGTH = 0.4;

type FrameLine = {
  host: HTMLDivElement;
  glow: HTMLSpanElement;
  pool: HTMLSpanElement;
  vertical: boolean;
  /** Line centre in viewport coordinates. */
  x: number;
  y: number;
  /** Extent along the line in viewport coordinates. */
  start: number;
  end: number;
  /** Host box origin in viewport coordinates (the pool's origin). */
  originLeft: number;
  originTop: number;
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

export function FrameLineSpotlight() {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const hostRefs = useRef<Array<HTMLDivElement | null>>([]);
  const glowRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const poolRefs = useRef<Array<HTMLSpanElement | null>>([]);

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
    const pools = poolRefs.current.filter(
      (pool): pool is HTMLSpanElement => pool !== null,
    );

    if (hosts.length !== 4 || glows.length !== 4 || pools.length !== 4) return;

    const lines: FrameLine[] = hosts.map((host, index) => ({
      host,
      glow: glows[index],
      pool: pools[index],
      vertical: index < 2,
      x: 0,
      y: 0,
      start: 0,
      end: 0,
      originLeft: 0,
      originTop: 0,
    }));

    const hoverQuery = window.matchMedia("(hover: hover) and (pointer: fine)");
    const reducedQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

    let pointer: { x: number; y: number } | null = null;
    let frame = 0;
    let measureFrame = 0;
    let reduced = reducedQuery.matches;
    /** Last opacity written to the root, so idle frames skip the style write. */
    let lastLight = "";

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
        } else {
          line.y = rect.top + 0.5;
          line.start = rect.left;
          line.end = rect.left + rect.width;
        }

        line.originLeft = rect.left;
        line.originTop = rect.top;
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

    /** Puts every pool out: both the shared opacity and the reduced fades. */
    function clearLights() {
      if (lastLight !== "0") {
        lastLight = "0";
        rootEl.style.setProperty("--frame-spot-light", "0");
      }

      for (const line of lines) {
        line.glow.style.setProperty("--frame-spot-light", "0");
      }
    }

    function apply() {
      frame = 0;

      if (!pointer || window.innerWidth < 1440) {
        clearLights();
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
        clearLights();
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

      // One light for all four lines: the pool's own falloff supplies each
      // line's chord, exactly as the per-line mask gradient did.
      const lightText = light.toFixed(4);

      if (lightText !== lastLight) {
        lastLight = lightText;
        rootEl.style.setProperty("--frame-spot-light", lightText);
      }

      for (const line of lines) {
        // Centre the fixed pool on the shared light; the strip clips the rest.
        const poolX = (sx - line.originLeft - POOL_RADIUS).toFixed(2);
        const poolY = (sy - line.originTop - POOL_RADIUS).toFixed(2);

        line.pool.style.transform = `translate3d(${poolX}px, ${poolY}px, 0)`;
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
          <span
            className="frame-spot-pool"
            ref={(element) => {
              poolRefs.current[index] = element;
            }}
          />
        </div>
      ))}
    </div>
  );
}
