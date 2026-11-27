"use client";

import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { audioBands } from "@/components/player/audio-bands";
import { HORIZON_HOME_LISTENING } from "./horizon-preset";
import {
  REST_REACTIVITY,
  SKY_PHASE_PRESET,
  STAR_DRIFT_PER_SECOND,
  createStarPool,
  edgeBlurAt,
  edgeSoften,
  layerDrift,
  mapBands,
  maskGradient,
  nextShootingGap,
  parsePhase,
  resolvePhase,
  starCount,
  twinkle,
} from "./cosmic-sky";
import type { EdgeBlur } from "./cosmic-sky";
import { getSkyTuning, subscribeSkyTuning } from "./sky-tuning";
import "./cosmic-sky.css";

/**
 * The cosmic sky: a decorative layer over the top half of the viewport that
 * shows while the horizon is listening (`<html data-listening="true">`).
 * Night gets faint stars, day gets a pale aurora curtain; dusk and dawn borrow
 * one of them at part strength (cosmic-sky.ts).
 *
 * Plain 2D canvases, no WebGL: the stars are a few hundred dots, and the
 * aurora is drawn into a low-resolution canvas the browser upscales, which is
 * the softness it wants. ~30fps, rAF stops when idle or the tab is hidden, no
 * pointer events.
 *
 * Stacking. The aurora and the stars below the edge blur sit under the viewport
 * edge blur (z-index 40), so the blur softens the aurora into the top edge. The
 * stars inside the blur band are painted on a second canvas just above it
 * (z-index 41) so the 32px blur does not erase them. The band is clamped to the
 * empty content margin (viewport-edge-blur.css), so that canvas only ever draws
 * over empty sky, never over a card or the nav (z-index 50 and 60 stay above).
 *
 * If a 2D context is unavailable the CSS fallback in cosmic-sky.css paints a
 * static version of the same two looks.
 */

const DPR_CAP = 1.5;
const FRAME_MS = 30;
const AURORA_PEAK = 0.5;
/** Frozen clock under reduced motion, so the still frame is a good one. */
const REDUCED_T = 11;
const SPRITE_ROWS = 128;

type Rgb = readonly [number, number, number];

type Curtain = {
  /** Where the sharp lower edge sits, as a fraction of the layer height. */
  hem: number;
  /** How far above the layer top the rays extend, as a fraction of height. */
  reach: number;
  /** Radians per second of the fold; 0.31 is a 20s cycle. */
  rate: number;
  folds: number;
  phase: number;
  weight: number;
  /** Seconds between brightness pulses travelling along the curtain. */
  pulse: number;
};

const CURTAINS: readonly Curtain[] = [
  {
    hem: 0.62,
    reach: 0.32,
    rate: 0.33,
    folds: 1.3,
    phase: 0.6,
    weight: 1,
    pulse: 16,
  },
  {
    hem: 0.42,
    reach: 0.3,
    rate: 0.45,
    folds: 1.9,
    phase: 3.1,
    weight: 0.7,
    pulse: 23,
  },
];

type Colors = { top: Rgb; mid: Rgb; base: Rgb };

const mixRgb = (a: Rgb, b: Rgb, t: number): Rgb => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];

/** How far the phase colours are washed toward white, so they read pastel. */
const PASTEL = 0.45;

const pastel = (c: Rgb, wash: number): Rgb => mixRgb(c, [255, 255, 255], wash);

let probe: CanvasRenderingContext2D | null = null;

/** Resolve any CSS colour string (rgb, color(), oklch) to sRGB bytes. */
function toRgb(value: string): Rgb | null {
  if (!value.trim()) return null;

  probe ??= Object.assign(document.createElement("canvas"), {
    width: 1,
    height: 1,
  }).getContext("2d", { willReadFrequently: true });

  if (!probe) return null;

  probe.clearRect(0, 0, 1, 1);
  probe.fillStyle = "#000";
  probe.fillStyle = value;
  probe.fillRect(0, 0, 1, 1);

  const d = probe.getImageData(0, 0, 1, 1).data;

  return d[3] ? [d[0], d[1], d[2]] : null;
}

/**
 * The aurora palette for the current phase, read live from the same tokens the
 * horizon and the nav orb use: --orb-1 and --orb-3 are the ends of
 * --orb-gradient (day: #60a8e2 and #0071c1), --horizon-1 is the blob hue.
 * Nothing is copied here, so a token edit carries through. Washed toward white
 * so day stays bright.
 */
function readPalette(wash: number): readonly Colors[] | null {
  const style = getComputedStyle(document.documentElement);
  const read = (name: string) => toRgb(style.getPropertyValue(name));
  const a = read("--orb-1") ?? read("--horizon-1");
  const b = read("--orb-3") ?? read("--horizon-2") ?? a;

  if (!a || !b) return null;

  const [pa, pb] = [pastel(a, wash), pastel(b, wash)];

  return [
    { base: pa, mid: mixRgb(pa, pb, 0.5), top: pb },
    { base: mixRgb(pa, pb, 0.3), mid: pa, top: mixRgb(pa, pb, 0.7) },
  ];
}

const STAR_COLORS: readonly Rgb[] = [
  [196, 212, 255],
  [220, 230, 255],
  [255, 247, 238],
];

const smooth = (edge0: number, edge1: number, x: number) => {
  const v = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));

  return v * v * (3 - 2 * v);
};

/**
 * One ray, top to bottom: the pastel gradient with a faint haze up top, rising
 * toward a bright, sharp lower edge. Pre-rendered once per curtain.
 */
function makeCurtainSprite(curtain: Colors): HTMLCanvasElement {
  const sprite = document.createElement("canvas");

  sprite.width = 1;
  sprite.height = SPRITE_ROWS;

  const context = sprite.getContext("2d");

  if (!context) return sprite;

  for (let i = 0; i < SPRITE_ROWS; i += 1) {
    const v = i / (SPRITE_ROWS - 1);
    const color =
      v < 0.55
        ? mixRgb(curtain.top, curtain.mid, v / 0.55)
        : mixRgb(curtain.mid, curtain.base, (v - 0.55) / 0.45);
    const body = 0.22 + 0.78 * Math.pow(v, 1.7);
    const hem = 1 - smooth(0.955, 1, v);
    const alpha = body * hem;

    context.fillStyle = `rgba(${color[0] | 0},${color[1] | 0},${color[2] | 0},${alpha.toFixed(4)})`;
    context.fillRect(0, i, 1, 1);
  }

  return sprite;
}

/** A white-ish soft disc, for the softened stars at the very top edge. */
function makeGlowSprite(color: Rgb): HTMLCanvasElement {
  const size = 32;
  const sprite = document.createElement("canvas");

  sprite.width = size;
  sprite.height = size;

  const context = sprite.getContext("2d");

  if (!context) return sprite;

  const gradient = context.createRadialGradient(16, 16, 0, 16, 16, 16);

  for (let i = 0; i <= 6; i += 1) {
    const t = i / 6;
    const alpha = (1 - t) * (1 - t) * (3 - 2 * (1 - t));

    gradient.addColorStop(
      t,
      `rgba(${color[0]},${color[1]},${color[2]},${alpha.toFixed(3)})`,
    );
  }

  context.fillStyle = gradient;
  context.fillRect(0, 0, size, size);
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
  const topStarsRef = useRef<HTMLCanvasElement | null>(null);
  const [fallback, setFallback] = useState(false);

  useEffect(() => {
    const root = rootRef.current;
    const starsCanvasMaybe = starsRef.current;
    const auroraCanvasMaybe = auroraRef.current;
    const topCanvasMaybe = topStarsRef.current;
    const starsCtxMaybe = starsCanvasMaybe?.getContext("2d") ?? null;
    const auroraCtxMaybe = auroraCanvasMaybe?.getContext("2d") ?? null;
    const topCtxMaybe = topCanvasMaybe?.getContext("2d") ?? null;

    if (
      !root ||
      !starsCanvasMaybe ||
      !auroraCanvasMaybe ||
      !topCanvasMaybe ||
      !starsCtxMaybe ||
      !auroraCtxMaybe ||
      !topCtxMaybe
    ) {
      setFallback(true);
      return;
    }

    const rootEl: HTMLDivElement = root;
    const starsCanvas: HTMLCanvasElement = starsCanvasMaybe;
    const auroraCanvas: HTMLCanvasElement = auroraCanvasMaybe;
    const topCanvas: HTMLCanvasElement = topCanvasMaybe;
    const starsCtx: CanvasRenderingContext2D = starsCtxMaybe;
    const auroraCtx: CanvasRenderingContext2D = auroraCtxMaybe;
    const topCtx: CanvasRenderingContext2D = topCtxMaybe;

    const html = document.documentElement;
    const reducedQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const pool = createStarPool();
    let curtainSprites: HTMLCanvasElement[] = [];
    let paletteKey = "";
    const glowSprites = STAR_COLORS.map(makeGlowSprite);
    let edgeEl: Element | null = null;

    /** The live top-band blur, which ramps on its own CSS transition. */
    const readEdgeBlur = (): EdgeBlur => {
      if (!edgeEl || !edgeEl.isConnected) {
        edgeEl = document.querySelector(".wd-edge-blur--top");
      }

      if (!edgeEl) return { height: 0, max: 0 };

      const style = getComputedStyle(edgeEl);

      return {
        height:
          parseFloat(style.getPropertyValue("--edge-blur-frame-height")) || 0,
        max: parseFloat(style.getPropertyValue("--edge-blur-frame-max")) || 0,
      };
    };

    let width = 0;
    let height = 0;
    let dpr = 1;
    let auroraScale = 4;
    let frame = 0;
    let clock = 0;
    let last = 0;
    let stars = 0;
    let aurora = 0;
    let shooting: Shooting | null = null;
    let nextShot = 25 + Math.random() * 20;
    let cleared = true;

    const resize = () => {
      const rect = root.getBoundingClientRect();

      width = Math.max(1, Math.round(rect.width));
      height = Math.max(1, Math.round(rect.height));
      dpr = Math.min(window.devicePixelRatio || 1, DPR_CAP);
      auroraScale = Math.max(3, Math.round(width / 640));
      starsCanvas.width = Math.round(width * dpr);
      starsCanvas.height = Math.round(height * dpr);
      topCanvas.width = starsCanvas.width;
      topCanvas.height = starsCanvas.height;
      auroraCanvas.width = Math.max(2, Math.round(width / auroraScale));
      auroraCanvas.height = Math.max(2, Math.round(height / auroraScale));
      cleared = false;
      // A resize clears the canvases, so repaint in the same frame.
      draw(0);
      wake();
    };

    const clear = () => {
      if (cleared) return;

      for (const [ctx, canvas] of [
        [starsCtx, starsCanvas],
        [topCtx, topCanvas],
      ] as const) {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }

      auroraCtx.clearRect(0, 0, auroraCanvas.width, auroraCanvas.height);
      cleared = true;
    };

    /**
     * A folded curtain: a sinuous, bright lower edge with a smooth silky body
     * fading upward, mint at the hem shading to lilac and rose. Brightness only
     * varies as wide, slow swells along the curtain (no per-column texture), so
     * there are no lines or bands. Bass deepens the folds, mid brightens the
     * body and hem, a slow pulse travels along each curtain.
     */
    const drawAurora = (
      t: number,
      alpha: number,
      fold: number,
      bright: number,
      shimmer: number,
    ) => {
      const w = auroraCanvas.width;
      const h = auroraCanvas.height;

      auroraCtx.clearRect(0, 0, w, h);

      CURTAINS.forEach((curtain, index) => {
        const sprite = curtainSprites[index];
        const pulsePos = ((t / curtain.pulse) % 1) * 1.8 - 0.4;

        for (let x = 0; x < w; x += 1) {
          const u = x / w;
          const swing =
            0.1 * Math.sin(u * 6.283 * curtain.folds + t * curtain.rate + curtain.phase) +
            0.05 * Math.sin(u * 6.283 * curtain.folds * 2.2 - t * curtain.rate * 1.4) +
            0.022 * Math.sin(u * 6.283 * curtain.folds * 4.6 + t * curtain.rate * 2.1);
          const edge = (curtain.hem + swing * fold) * h;
          // Two wide swells drifting sideways at different speeds.
          const swell =
            1 +
            0.16 * Math.sin(u * 6.283 * 1.2 + t * 0.21 + curtain.phase * 2) +
            (0.08 + shimmer * 0.12) *
              Math.sin(u * 6.283 * 2.1 - t * 0.29 + curtain.phase);
          const pulse = 1 + 0.45 * Math.exp(-(((u - pulsePos) / 0.14) ** 2));
          const sides = 0.65 + 0.35 * Math.sin(Math.PI * u);
          const a = alpha * bright * curtain.weight * swell * pulse * sides;

          if (a < 0.004) continue;

          const length = (edge + curtain.reach * h) * (1 + 0.05 * swell);

          auroraCtx.globalAlpha = Math.min(1, a);
          auroraCtx.drawImage(sprite, 0, 0, 1, SPRITE_ROWS, x, edge - length, 1, length);
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
      topCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      topCtx.clearRect(0, 0, width, height);

      const tuning = getSkyTuning();
      const count = starCount(width, height, tuning.starDensity);
      const edge = readEdgeBlur();

      for (let i = 0; i < count; i += 1) {
        const star = pool[i];
        const x = drift
          ? ((star.x + t * STAR_DRIFT_PER_SECOND * layerDrift(star.layer)) % 1) * width
          : star.x * width;
        const y = star.y * height;
        const base =
          star.baseAlpha * twinkle(star, t, depth) * tuning.starBrightness * lift * alpha;

        if (base < 0.01) continue;

        const color = STAR_COLORS[star.layer];
        const inBand = y < edge.height;
        // Stars in the blur band are painted above it so the blur cannot erase
        // them; the rest stay below, like the aurora.
        const ctx = inBand ? topCtx : starsCtx;
        const soft = inBand
          ? edgeSoften(edgeBlurAt(y, edge), edge.max)
          : { alpha: 1, soften: 0 };
        const a = Math.min(1, base * soft.alpha);

        if (soft.soften > 0.08) {
          const size = (star.radius + soft.soften) * 2.6;

          ctx.globalAlpha = a;
          ctx.drawImage(glowSprites[star.layer], x - size / 2, y - size / 2, size, size);
          ctx.globalAlpha = 1;
        } else {
          ctx.fillStyle = `rgba(${color[0]},${color[1]},${color[2]},${a.toFixed(3)})`;
          ctx.beginPath();
          ctx.arc(x, y, star.radius, 0, Math.PI * 2);
          ctx.fill();
        }
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

      // A phase change is a snap: the theme switch is one view-transition
      // crossfade of the whole page (150ms), so the sky just has to repaint in
      // the new phase inside it. Colours are re-read from the new phase tokens.
      stars = target.stars;
      aurora = target.aurora;

      const key = `${html.dataset.phase ?? ""}`;

      if (key !== paletteKey || curtainSprites.length === 0) {
        const palette = readPalette(target.wash ?? PASTEL);

        if (palette) {
          curtainSprites = palette.map(makeCurtainSprite);
          paletteKey = key;
        }
      }

      // The fade is the CSS opacity transition on the layer roots (same tokens
      // and curve as the horizon swell), read here only to know when to stop.
      const opacity = parseFloat(getComputedStyle(rootEl).opacity);
      const visible = opacity > 0.001;

      if (!visible) {
        clear();
        return listening;
      }

      cleared = false;
      clock += reduced ? 0 : dt;

      const t = reduced ? REDUCED_T : clock;
      const bands = reduced ? null : audioBands.getBands();
      const react = bands ? mapBands(bands, tuning) : REST_REACTIVITY;
      const starAlpha = stars * (target.starGain ?? 1);
      const auroraAlpha = aurora;

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
        for (const [ctx, canvas] of [
          [starsCtx, starsCanvas],
          [topCtx, topCanvas],
        ] as const) {
          ctx.setTransform(1, 0, 0, 1, 0, 0);
          ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
      }

      if (auroraAlpha > 0.003) {
        drawAurora(
          t * tuning.auroraSpeed,
          AURORA_PEAK * auroraAlpha * tuning.auroraOpacity * react.lift,
          react.sway,
          react.auroraBright,
          react.shimmer,
        );
      } else {
        auroraCtx.clearRect(0, 0, auroraCanvas.width, auroraCanvas.height);
      }

      // Under reduced motion the picture is still once the fade has finished.
      return !(reduced && listening && opacity >= 0.999);
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
      // Repaint synchronously so a phase change lands inside the theme
      // view-transition's snapshot instead of a frame after it.
      draw(0);
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

  const mask = maskGradient();
  /* The same timing tokens the horizon fallback layer carries, from the same preset. */
  const timing = {
    "--horizon-listen-in": `${HORIZON_HOME_LISTENING.inDuration}s`,
    "--horizon-listen-out": `${HORIZON_HOME_LISTENING.outDuration}s`,
    "--horizon-listen-reduced": `${HORIZON_HOME_LISTENING.reducedDuration}s`,
  } as CSSProperties;

  return (
    <>
      <div
        ref={rootRef}
        aria-hidden="true"
        data-cosmic-sky=""
        data-fallback={fallback ? "" : undefined}
        className="cosmic-sky pointer-events-none fixed inset-x-0 top-0"
        style={{ ...timing, maskImage: mask, WebkitMaskImage: mask }}
      >
        <canvas ref={auroraRef} className="cosmic-sky-canvas" />
        <canvas ref={starsRef} className="cosmic-sky-canvas" />
        {fallback ? <div className="cosmic-sky-fallback" /> : null}
      </div>
      <div
        aria-hidden="true"
        data-cosmic-sky-top=""
        className="cosmic-sky cosmic-sky--top pointer-events-none fixed inset-x-0 top-0"
        style={{ ...timing, maskImage: mask, WebkitMaskImage: mask }}
      >
        <canvas ref={topStarsRef} className="cosmic-sky-canvas" />
      </div>
    </>
  );
}
