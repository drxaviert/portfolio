"use client";

import { useEffect, useRef, useState } from "react";
import { audioBands } from "@/components/player/audio-bands";
import {
  REST_REACTIVITY,
  SKY_PHASE_PRESET,
  SKY_RAMP,
  STAR_DRIFT_PER_SECOND,
  createStarPool,
  easeCalm,
  layerDrift,
  mapBands,
  maskGradient,
  nextShootingGap,
  parsePhase,
  resolvePhase,
  starCount,
  stepRamp,
  twinkle,
} from "./cosmic-sky";
import { getSkyTuning, subscribeSkyTuning } from "./sky-tuning";
import "./cosmic-sky.css";

/**
 * The cosmic sky: a decorative layer over the top half of the viewport that
 * shows while the horizon is listening (`<html data-listening="true">`).
 * Night gets faint stars, day gets a pale aurora; dusk and dawn borrow one of
 * them at part strength (cosmic-sky.ts).
 *
 * Two small 2D canvases, no WebGL: the stars are a few dozen dots, and the
 * aurora is drawn into a quarter-resolution canvas that the browser upscales,
 * which is exactly the softness it wants. It runs at ~30fps (everything moves
 * over seconds), stops its rAF when not listening or the tab is hidden, and
 * stays behind the content with no pointer events.
 *
 * If a 2D context is unavailable the CSS fallback in cosmic-sky.css paints a
 * static version of the same two looks.
 */

const AURORA_SCALE = 4;
const DPR_CAP = 1.5;
const FRAME_MS = 30;
/** Seconds the phase strengths take to follow a phase change. */
const PHASE_TAU = 0.8;
const AURORA_PEAK = 0.5;
/** Frozen clock under reduced motion, so the still frame is a good one. */
const REDUCED_T = 11;

type Rgb = readonly [number, number, number];

/** Pastel on #f1f3f6: mint, sky, lilac, a breath of rose. Low alpha does the rest. */
const RIBBONS: readonly {
  color: Rgb;
  y: number;
  height: number;
  rate: number;
  fold: number;
  phase: number;
  weight: number;
}[] = [
  { color: [92, 222, 182], y: -0.18, height: 0.85, rate: 0.31, fold: 2.2, phase: 0.4, weight: 1 },
  { color: [104, 172, 252], y: -0.12, height: 0.8, rate: 0.42, fold: 2.9, phase: 2.1, weight: 0.9 },
  { color: [168, 140, 248], y: -0.2, height: 0.75, rate: 0.36, fold: 3.4, phase: 4.0, weight: 0.8 },
  { color: [252, 158, 204], y: -0.08, height: 0.65, rate: 0.5, fold: 2.5, phase: 5.3, weight: 0.5 },
];

const STAR_COLORS: readonly Rgb[] = [
  [196, 212, 255],
  [220, 230, 255],
  [255, 247, 238],
];

/** One column of a ribbon, top to bottom: soft rise, brightest low, gone at the hem. */
function makeSprite(color: Rgb): HTMLCanvasElement {
  const sprite = document.createElement("canvas");

  sprite.width = 1;
  sprite.height = 64;

  const context = sprite.getContext("2d");

  if (!context) return sprite;

  const smooth = (edge0: number, edge1: number, x: number) => {
    const v = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));

    return v * v * (3 - 2 * v);
  };

  for (let i = 0; i < 64; i += 1) {
    const v = i / 63;
    const alpha = smooth(0, 0.4, v) * (1 - smooth(0.5, 1, v));

    context.fillStyle = `rgba(${color[0]},${color[1]},${color[2]},${alpha.toFixed(4)})`;
    context.fillRect(0, i, 1, 1);
  }

  return sprite;
}

type Shooting = {
  start: number;
  x: number;
  y: number;
  dx: number;
  dy: number;
};

export function CosmicSky() {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const starsRef = useRef<HTMLCanvasElement | null>(null);
  const auroraRef = useRef<HTMLCanvasElement | null>(null);
  const [fallback, setFallback] = useState(false);

  useEffect(() => {
    const root = rootRef.current;
    const starsCanvasMaybe = starsRef.current;
    const auroraCanvasMaybe = auroraRef.current;
    const starsCtxMaybe = starsCanvasMaybe?.getContext("2d") ?? null;
    const auroraCtxMaybe = auroraCanvasMaybe?.getContext("2d") ?? null;

    if (
      !root ||
      !starsCanvasMaybe ||
      !auroraCanvasMaybe ||
      !starsCtxMaybe ||
      !auroraCtxMaybe
    ) {
      setFallback(true);
      return;
    }

    const starsCanvas: HTMLCanvasElement = starsCanvasMaybe;
    const auroraCanvas: HTMLCanvasElement = auroraCanvasMaybe;
    const starsCtx: CanvasRenderingContext2D = starsCtxMaybe;
    const auroraCtx: CanvasRenderingContext2D = auroraCtxMaybe;

    const html = document.documentElement;
    const reducedQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const pool = createStarPool();
    const sprites = RIBBONS.map((ribbon) => makeSprite(ribbon.color));

    let width = 0;
    let height = 0;
    let dpr = 1;
    let frame = 0;
    let clock = 0;
    let last = 0;
    let progress = html.dataset.listening === "true" ? 1 : 0;
    let stars = 0;
    let aurora = 0;
    let dirty = true;
    let snap = true;
    let shooting: Shooting | null = null;
    let nextShot = 25 + Math.random() * 20;
    let cleared = true;

    const resize = () => {
      const rect = root.getBoundingClientRect();

      width = Math.max(1, Math.round(rect.width));
      height = Math.max(1, Math.round(rect.height));
      dpr = Math.min(window.devicePixelRatio || 1, DPR_CAP);
      starsCanvas.width = Math.round(width * dpr);
      starsCanvas.height = Math.round(height * dpr);
      auroraCanvas.width = Math.max(2, Math.round(width / AURORA_SCALE));
      auroraCanvas.height = Math.max(2, Math.round(height / AURORA_SCALE));
      dirty = true;
      cleared = false;
      // A resize clears the canvases, so repaint in the same frame.
      draw(0);
      wake();
    };

    const clear = () => {
      if (cleared) return;

      starsCtx.setTransform(1, 0, 0, 1, 0, 0);
      starsCtx.clearRect(0, 0, starsCanvas.width, starsCanvas.height);
      auroraCtx.clearRect(0, 0, auroraCanvas.width, auroraCanvas.height);
      cleared = true;
    };

    const drawAurora = (
      t: number,
      alpha: number,
      sway: number,
      shimmer: number,
    ) => {
      const w = auroraCanvas.width;
      const h = auroraCanvas.height;

      auroraCtx.clearRect(0, 0, w, h);

      RIBBONS.forEach((ribbon, index) => {
        const sprite = sprites[index];

        for (let x = 0; x < w; x += 1) {
          const u = x / w;
          const swing =
            Math.sin(u * ribbon.fold + t * ribbon.rate + ribbon.phase) * 0.07 +
            Math.sin(u * ribbon.fold * 2.1 - t * ribbon.rate * 0.6) * 0.035;
          const top = (ribbon.y + swing * sway) * h;
          const fold =
            0.5 +
            0.5 *
              Math.sin(
                u * (ribbon.fold + 1.3) + t * ribbon.rate * 0.7 + ribbon.phase,
              );
          const hem = ribbon.height * h * (0.7 + 0.5 * fold);
          const fine =
            1 + shimmer * 0.25 * Math.sin(u * 40 + t * 1.3 + ribbon.phase);
          const edge = Math.sin(Math.PI * u) ** 0.6;
          const a = alpha * ribbon.weight * (0.25 + 0.75 * fold * fold) * edge * fine;

          if (a < 0.003) continue;

          auroraCtx.globalAlpha = Math.min(1, a);
          auroraCtx.drawImage(sprite, 0, 0, 1, 64, x, top - hem * 0.1, 1, hem);
        }
      });

      auroraCtx.globalAlpha = 1;
    };

    const drawStars = (
      t: number,
      alpha: number,
      lift: number,
      depth: number,
      drift: boolean,
    ) => {
      starsCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      starsCtx.clearRect(0, 0, width, height);

      const tuning = getSkyTuning();
      const count = starCount(width, height, tuning.starDensity);

      for (let i = 0; i < count; i += 1) {
        const star = pool[i];
        const x = drift
          ? ((star.x + t * STAR_DRIFT_PER_SECOND * layerDrift(star.layer)) % 1) * width
          : star.x * width;
        const a =
          star.baseAlpha * twinkle(star, t, depth) * tuning.starBrightness * lift * alpha;

        if (a < 0.01) continue;

        const color = STAR_COLORS[star.layer];

        starsCtx.fillStyle = `rgba(${color[0]},${color[1]},${color[2]},${Math.min(1, a).toFixed(3)})`;
        starsCtx.beginPath();
        starsCtx.arc(x, star.y * height, star.radius, 0, Math.PI * 2);
        starsCtx.fill();
      }

      if (shooting) {
        const p = (t - shooting.start) / 1.2;

        if (p >= 1) {
          shooting = null;
        } else {
          const headX = shooting.x + shooting.dx * p;
          const headY = shooting.y + shooting.dy * p;
          const tail = 0.16;
          const gradient = starsCtx.createLinearGradient(
            headX,
            headY,
            headX - shooting.dx * tail,
            headY - shooting.dy * tail,
          );
          const peak = 0.34 * Math.sin(Math.PI * p) * alpha * tuning.starBrightness;

          gradient.addColorStop(0, `rgba(230,238,255,${peak.toFixed(3)})`);
          gradient.addColorStop(1, "rgba(230,238,255,0)");
          starsCtx.strokeStyle = gradient;
          starsCtx.lineWidth = 1;
          starsCtx.lineCap = "round";
          starsCtx.beginPath();
          starsCtx.moveTo(headX, headY);
          starsCtx.lineTo(headX - shooting.dx * tail, headY - shooting.dy * tail);
          starsCtx.stroke();
        }
      }
    };

    /** Returns true while something is still moving and another frame is needed. */
    function draw(dt: number): boolean {
      const reduced = reducedQuery.matches;
      const tuning = getSkyTuning();
      const listening = html.dataset.listening === "true";
      const phase = resolvePhase(parsePhase(html.dataset.phase), tuning.phaseOverride);
      const target = SKY_PHASE_PRESET[phase];
      const ease = 1 - Math.exp(-dt / (reduced ? 0.15 : PHASE_TAU));

      // Snap on first paint and while fully hidden; ease phase changes otherwise.
      const follow = snap || (!listening && progress <= 0) ? 1 : ease;

      snap = false;
      stars += (target.stars - stars) * follow;
      aurora += (target.aurora - aurora) * follow;
      progress = stepRamp(
        progress,
        listening,
        dt,
        reduced ? SKY_RAMP.reducedDuration : SKY_RAMP.inDuration,
        reduced ? SKY_RAMP.reducedDuration : SKY_RAMP.outDuration,
      );

      const level = easeCalm(progress);


      if (level <= 0.001) {
        clear();
        // Idle only when nothing is listening; a swell-in starts at level 0.
        return listening || progress > 0;
      }

      cleared = false;
      clock += reduced ? 0 : dt;

      const t = reduced ? REDUCED_T : clock;
      const bands = reduced ? null : audioBands.getBands();
      const react = bands ? mapBands(bands, tuning) : REST_REACTIVITY;
      const starAlpha = stars * level;
      const auroraAlpha = aurora * level;

      if (starAlpha > 0.003) {
        if (!reduced && !shooting && starAlpha > 0.4 && clock >= nextShot) {
          const angle = Math.PI / 8 + Math.random() * 0.3;

          shooting = {
            start: clock,
            x: width * (0.15 + Math.random() * 0.5),
            y: height * (0.05 + Math.random() * 0.25),
            dx: Math.cos(angle) * width * 0.22,
            dy: Math.sin(angle) * width * 0.22,
          };
          nextShot = clock + 1.2 + nextShootingGap(Math.random);
        }

        drawStars(t, starAlpha, react.lift, react.twinkleDepth, !reduced);
      } else {
        starsCtx.setTransform(1, 0, 0, 1, 0, 0);
        starsCtx.clearRect(0, 0, starsCanvas.width, starsCanvas.height);
      }

      if (auroraAlpha > 0.003) {
        drawAurora(
          t * tuning.auroraSpeed,
          AURORA_PEAK * auroraAlpha * tuning.auroraOpacity * react.auroraBright * react.lift,
          react.sway,
          react.shimmer,
        );
      } else {
        auroraCtx.clearRect(0, 0, auroraCanvas.width, auroraCanvas.height);
      }

      const settled =
        Math.abs(stars - target.stars) < 0.002 &&
        Math.abs(aurora - target.aurora) < 0.002 &&
        (listening ? progress >= 1 : progress <= 0);

      dirty = false;
      // Under reduced motion the picture is still once it has settled.
      return !(reduced && settled);
    }

    const tick = (now: number) => {
      frame = 0;

      if (document.hidden) return;

      const elapsed = now - last;

      if (last !== 0 && elapsed < FRAME_MS) {
        frame = requestAnimationFrame(tick);
        return;
      }

      const dt = last === 0 ? 0 : Math.min(elapsed / 1000, 0.1);

      last = now;

      if (draw(dt)) frame = requestAnimationFrame(tick);
      else last = 0;
    };

    function wake() {
      if (frame || document.hidden) return;

      last = 0;
      frame = requestAnimationFrame(tick);
    }

    const onChange = () => {
      dirty = true;
      wake();
    };

    const observer = new MutationObserver(onChange);

    observer.observe(html, {
      attributes: true,
      attributeFilter: ["data-listening", "data-phase"],
    });

    const resizeObserver = new ResizeObserver(resize);

    resizeObserver.observe(root);
    document.addEventListener("visibilitychange", onChange);
    reducedQuery.addEventListener("change", onChange);

    const unsubscribe = subscribeSkyTuning(onChange);

    resize();
    wake();

    return () => {
      cancelAnimationFrame(frame);
      frame = 0;
      observer.disconnect();
      resizeObserver.disconnect();
      document.removeEventListener("visibilitychange", onChange);
      reducedQuery.removeEventListener("change", onChange);
      unsubscribe();
    };
  }, []);

  return (
    <div
      ref={rootRef}
      aria-hidden="true"
      data-cosmic-sky=""
      data-fallback={fallback ? "" : undefined}
      className="cosmic-sky pointer-events-none fixed inset-x-0 top-0"
      style={{ maskImage: maskGradient(), WebkitMaskImage: maskGradient() }}
    >
      <canvas ref={auroraRef} className="cosmic-sky-canvas" />
      <canvas ref={starsRef} className="cosmic-sky-canvas" />
      {fallback ? <div className="cosmic-sky-fallback" /> : null}
    </div>
  );
}
