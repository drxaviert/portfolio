"use client";

import { useEffect, useRef } from "react";
import type {
  HorizonMotionTuning,
  HorizonMotionVariant,
} from "./horizon-background";
import {
  alternateProgress,
  baseStrength,
  breatheIntensity,
} from "./horizon-intensity";
import "./horizon-motion.css";

/**
 * WebGL twin of HorizonBackground.
 *
 * One full-screen quad and one fragment shader: the backdrop gradient and the
 * two glow ellipses are composited per pixel, then the colour is computed in
 * highp float and dithered by a fraction of an 8-bit LSB before it is written.
 *
 * The blurred blob alphas are not approximated in the shader. They are rendered
 * once into a small 2D canvas with the browser's own canvas blur (half scale,
 * plus a three-blur-radius margin so the viewport edge keeps the mass CSS would
 * blur in from outside), then sampled as one RGBA texture (R = blob 1,
 * G = blob 2). That makes the shader's soft edge the same blurred shape the CSS
 * renderer paints, including the curvature of the ellipses, instead of an
 * analytic falloff that misses the CSS alpha by a couple of levels.
 *
 * Phase colours, alphas and geometry still come from the computed --horizon-*
 * tokens, re-read every frame while data-phase-switching is set (so the shader
 * follows the browser's interpolated custom properties), and on mutation
 * otherwise.
 *
 * The motion clock starts from the CSS layer's own animation time so the two
 * renderers are in phase when the canvas fades in, and it advances only while
 * frames run (hidden tabs and static mode freeze it, like animation-play-state).
 *
 * The rAF loop is demand-driven: it runs while a motion variant is active, is
 * cancelled while the tab is hidden, and in static mode only renders when a
 * token, resize or parameter change asks for a frame.
 */

const DEFAULT_TUNING: Required<HorizonMotionTuning> = {
  driftPeriod: 110,
  driftTravelX: 1.5,
  driftTravelY: 1,
  breathePeriod: 16,
  breatheScale: 2,
  breatheDepth: 13,
  intensityAmp: 0,
  nightIntensityScale: 0.6,
  intensityPeak: "core",
  baseIntensity: 1,
  nightBaseIntensity: 1,
};

/** Blob 2's loop differs so the pair never syncs (mirrors the CSS version). */
const SECOND_BLOB_PERIOD_RATIO = 0.82;
const SECOND_BLOB_DELAY_RATIO = 0.37;

/** The blurred coverage texture is built at half CSS resolution. */
const TEXTURE_SCALE = 0.5;
/** Margin around the viewport so the blur keeps the mass CSS sees off-screen. */
const TEXTURE_MARGIN_SIGMAS = 3;

const VERTEX_SOURCE = `
attribute vec2 aPos;
void main() {
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`;

const FRAGMENT_SOURCE = `
precision highp float;

uniform vec2 uRes;
uniform vec3 uBase;
uniform vec3 uMid;
uniform vec3 uHorizon3;
uniform float uMidAt;
uniform sampler2D uBlurTex;
uniform vec2 uBlobUvScale;
uniform vec2 uBlobUvOffset;
uniform vec3 uBlobColor1;
uniform vec3 uBlobColor2;
uniform float uAlpha1;
uniform float uAlpha2;
uniform vec2 uDrift1;
uniform vec2 uDrift2;
uniform float uScale1;
uniform float uScale2;
uniform float uOpacity1;
uniform float uOpacity2;
uniform float uDither;

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

vec2 blobUv(vec2 world, float scale, vec2 drift) {
  vec2 center = uRes * 0.5;
  vec2 local = center + (world - drift - center) / max(scale, 0.0001);
  return local * uBlobUvScale + uBlobUvOffset;
}

void main() {
  vec2 frag = gl_FragCoord.xy;
  float v = clamp(1.0 - frag.y / uRes.y, 0.0, 1.0);
  // The blob boxes are top-down CSS pixels; gl_FragCoord is bottom-up.
  vec2 world = vec2(frag.x, uRes.y - frag.y);

  vec3 color = uBase;
  if (v > 0.7) {
    float t = clamp((v - 0.7) / max(uMidAt - 0.7, 0.0001), 0.0, 1.0);
    color = mix(uBase, uMid, t);
    if (v > uMidAt) {
      color = mix(uMid, uHorizon3, clamp((v - uMidAt) / max(1.0 - uMidAt, 0.0001), 0.0, 1.0));
    }
  }

  vec2 blurred = texture2D(uBlurTex, blobUv(world, uScale1, uDrift1)).rg;
  color = mix(color, uBlobColor1, uAlpha1 * uOpacity1 * blurred.r);
  color = mix(color, uBlobColor2, uAlpha2 * uOpacity2 * blurred.g);

  // Triangular noise (+-1 LSB at amount 1) breaks the 8-bit steps invisibly.
  float ditherNoise = hash21(frag) + hash21(frag + vec2(37.0, 17.0)) - 1.0;
  color += ditherNoise * (uDither / 255.0);

  gl_FragColor = vec4(clamp(color, 0.0, 1.0), 1.0);
}
`;

type BlobBox = { cx: number; cy: number; hw: number; hh: number };

type Tokens = {
  base: [number, number, number];
  mid: [number, number, number];
  horizon3: [number, number, number];
  midAt: number;
  blob1: BlobBox;
  blob2: BlobBox;
  color1: [number, number, number];
  color2: [number, number, number];
  alpha1: number;
  alpha2: number;
  /** CSS blur radius in px after the responsive scale. */
  blur: number;
};

function parseColor(value: string): [number, number, number] {
  const match = value.match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/i);

  if (!match) return [0, 0, 0];

  return [
    Number(match[1]) / 255,
    Number(match[2]) / 255,
    Number(match[3]) / 255,
  ];
}

function effectiveBlur(blur: number, width: number): number {
  // Same breakpoint scaling the CSS background applies to the 1440 value.
  if (width >= 1280) return blur;
  if (width >= 1024) return blur * 0.7111;
  if (width >= 768) return blur * 0.5333;
  return blur * 0.45;
}

function readTokens(): Tokens {
  const style = getComputedStyle(document.documentElement);
  const num = (name: string, fallback: number): number => {
    const value = Number.parseFloat(style.getPropertyValue(name));

    return Number.isFinite(value) ? value : fallback;
  };
  const width = window.innerWidth;
  const height = window.innerHeight;
  const box = (blob: 1 | 2): BlobBox => {
    const left = num(`--horizon-blob-${blob}-left`, 0);
    const top = num(`--horizon-blob-${blob}-top`, 0);
    const w = num(`--horizon-blob-${blob}-width`, 50);
    const h = num(`--horizon-blob-${blob}-height`, 50);

    return {
      cx: ((left + w / 2) / 100) * width,
      cy: ((top + h / 2) / 100) * height,
      hw: (w / 200) * width,
      hh: (h / 200) * height,
    };
  };

  return {
    base: parseColor(style.getPropertyValue("--horizon-base")),
    mid: parseColor(style.getPropertyValue("--horizon-mid")),
    horizon3: parseColor(style.getPropertyValue("--horizon-3")),
    midAt: num("--horizon-mid-at", 82) / 100,
    blob1: box(1),
    blob2: box(2),
    color1: parseColor(style.getPropertyValue("--horizon-1")),
    color2: parseColor(style.getPropertyValue("--horizon-2")),
    alpha1: num("--horizon-1-alpha", 0.06),
    alpha2: num("--horizon-2-alpha", 0.06),
    blur: effectiveBlur(num("--horizon-blob-blur", 180), width),
  };
}

function compile(
  gl: WebGLRenderingContext,
  type: number,
  source: string,
): { shader: WebGLShader | null; error?: string } {
  const shader = gl.createShader(type);

  if (!shader) return { shader: null, error: "Could not create a shader." };

  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const error = gl.getShaderInfoLog(shader) ?? "Unknown shader error.";
    gl.deleteShader(shader);
    return { shader: null, error };
  }

  return { shader };
}

type MotionUniforms = {
  drift1: [number, number];
  drift2: [number, number];
  scale1: number;
  scale2: number;
  opacity1: number;
  opacity2: number;
  intensity1: number;
  intensity2: number;
  /** Rest strength, eased towards the night base over the phase fade. */
  base: number;
};

function motionUniforms(
  motion: HorizonMotionVariant,
  tuning: HorizonMotionTuning | undefined,
  time: number,
  width: number,
  height: number,
  nightBlend: number,
  reducedMotion: boolean,
): MotionUniforms {
  const t = { ...DEFAULT_TUNING, ...tuning };
  const driftOn = motion === "drift" || motion === "drift-breathe";
  const breatheOn = motion === "breathe" || motion === "drift-breathe";
  const driftPeriod2 = t.driftPeriod * SECOND_BLOB_PERIOD_RATIO;
  const driftDelay2 = -driftPeriod2 * SECOND_BLOB_DELAY_RATIO;
  const breatheDelay2 = -t.breathePeriod / 2;

  const travelX = (t.driftTravelX / 100) * width;
  const travelY = (t.driftTravelY / 100) * height;

  const drift1 = driftOn ? alternateProgress(time, t.driftPeriod, 0) : 0;
  const drift2 = driftOn
    ? alternateProgress(time, driftPeriod2, driftDelay2)
    : 0;
  const breathe1 = breatheOn ? alternateProgress(time, t.breathePeriod, 0) : 0;
  const breathe2 = breatheOn
    ? alternateProgress(time, t.breathePeriod, breatheDelay2)
    : 0;

  // One envelope per blob, from that blob's own breathe progress, so a blob's
  // strength peaks with its own breath even though the two run half a cycle
  // apart.
  const intensity = (progress: number) =>
    breatheOn
      ? breatheIntensity({
          progress,
          amp: t.intensityAmp,
          nightScale: t.nightIntensityScale,
          nightBlend,
          peak: t.intensityPeak,
          reducedMotion,
        })
      : 1;

  return {
    drift1: [travelX * drift1, -travelY * drift1],
    drift2: [-travelX * drift2, travelY * drift2],
    scale1: 1 + (t.breatheScale / 100) * breathe1,
    scale2: 1 + (t.breatheScale / 100) * breathe2,
    opacity1: 1 - (t.breatheDepth / 100) * breathe1,
    opacity2: 1 - (t.breatheDepth / 100) * breathe2,
    intensity1: intensity(breathe1),
    intensity2: intensity(breathe2),
    base: baseStrength({
      base: t.baseIntensity,
      nightBase: t.nightBaseIntensity,
      nightBlend,
    }),
  };
}

/**
 * How far the current phase has faded towards Night, 0..1. The CSS layer
 * transitions its own registered property over the existing phase fade, so the
 * shader reads that interpolated number rather than re-deriving the curve (and
 * both renderers damp intensity on the same timeline).
 */
function readNightBlend(element: HTMLElement): number {
  const value = Number.parseFloat(
    getComputedStyle(element).getPropertyValue("--horizon-night-blend"),
  );

  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
}

/**
 * The CSS layer is already animating when the canvas mounts; starting the
 * shader from that animation's clock keeps the two pictures in phase through
 * the 300ms fade.
 */
function readCssMotionOffset(): number {
  const wrapper = document.querySelector<HTMLElement>(".horizon-motion-drift");
  const current = wrapper?.getAnimations()[0]?.currentTime;

  return typeof current === "number" ? current / 1000 : 0;
}

type BlurTexture = {
  texture: WebGLTexture;
  worldWidth: number;
  worldHeight: number;
  margin: number;
};

/**
 * A real blur probe. Safari exposes `ctx.filter` (or accepts it as a plain
 * expando) but ignores it unless the Canvas Filters feature is enabled, so the
 * read-back check that used to live here passed and produced hard-edged
 * ellipses. Draw a dot, blur it, and look for light where the unblurred dot
 * cannot reach.
 */
let canvasBlurSupport: boolean | null = null;

function supportsCanvasBlur(): boolean {
  if (canvasBlurSupport !== null) return canvasBlurSupport;

  const probe = document.createElement("canvas");

  probe.width = 32;
  probe.height = 32;

  const ctx = probe.getContext("2d");

  if (!ctx) {
    canvasBlurSupport = false;
    return false;
  }

  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, 32, 32);
  ctx.filter = "blur(4px)";
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(15, 15, 2, 2);

  try {
    const [red] = ctx.getImageData(13, 16, 1, 1).data;

    canvasBlurSupport = red > 0;
  } catch {
    canvasBlurSupport = false;
  }

  return canvasBlurSupport;
}

/**
 * Rasterise both ellipses into one blurred RGBA texture: R is blob 1's
 * coverage, G is blob 2's. The canvas blur is the same implementation the CSS
 * filter uses, so the shader gets the exact soft edge instead of an analytic
 * approximation of it.
 */
function buildBlurTexture(
  gl: WebGLRenderingContext,
  tokens: Tokens,
  width: number,
  height: number,
): BlurTexture | { error: string } {
  if (!supportsCanvasBlur()) {
    return { error: "Canvas blur is not applied by this browser." };
  }

  const margin = Math.ceil(tokens.blur * TEXTURE_MARGIN_SIGMAS);
  const worldWidth = width + margin * 2;
  const worldHeight = height + margin * 2;
  const canvasWidth = Math.max(8, Math.round(worldWidth * TEXTURE_SCALE));
  const canvasHeight = Math.max(8, Math.round(worldHeight * TEXTURE_SCALE));
  const canvas = document.createElement("canvas");

  canvas.width = canvasWidth;
  canvas.height = canvasHeight;

  const ctx = canvas.getContext("2d");

  if (!ctx) return { error: "A 2D canvas is not available." };

  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);
  ctx.globalCompositeOperation = "lighter";

  const scaleX = canvasWidth / worldWidth;
  const scaleY = canvasHeight / worldHeight;

  const drawBlob = (box: BlobBox, color: string) => {
    ctx.save();
    ctx.filter = `blur(${tokens.blur * scaleX}px)`;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(
      (box.cx + margin) * scaleX,
      (box.cy + margin) * scaleY,
      box.hw * scaleX,
      box.hh * scaleY,
      0,
      0,
      Math.PI * 2,
    );
    ctx.fill();
    ctx.restore();
  };

  drawBlob(tokens.blob1, "#ff0000");
  drawBlob(tokens.blob2, "#00ff00");

  const texture = gl.createTexture();

  if (!texture) return { error: "Could not create the blur texture." };

  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  return { texture, worldWidth, worldHeight, margin };
}

export function HorizonShader({
  motion,
  tuning,
  ditherLsb = 1,
  dprCap = 1.5,
  onFallback,
}: {
  motion: HorizonMotionVariant;
  tuning?: HorizonMotionTuning;
  ditherLsb?: number;
  dprCap?: number;
  onFallback?: (reason: string) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const layerRef = useRef<HTMLDivElement | null>(null);
  const requestFrameRef = useRef<() => void>(() => {});
  const paramsRef = useRef({ motion, tuning, ditherLsb, dprCap });

  useEffect(() => {
    const canvas = canvasRef.current;
    const layer = layerRef.current;

    if (!canvas || !layer) return;

    // jsdom and very old engines have no WebGL global at all; leave the CSS
    // layer in place silently instead of asking for a context they cannot make.
    if (typeof WebGLRenderingContext === "undefined") return;

    const gl = canvas.getContext("webgl", {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      premultipliedAlpha: false,
      powerPreference: "high-performance",
    });

    if (!gl) {
      onFallback?.("WebGL is not available in this browser.");
      return;
    }

    const vertex = compile(gl, gl.VERTEX_SHADER, VERTEX_SOURCE);
    const fragment = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT_SOURCE);
    const program = gl.createProgram();

    if (!vertex.shader || !fragment.shader || !program) {
      onFallback?.(
        vertex.error ??
          fragment.error ??
          "The WebGL program could not be created.",
      );
      return;
    }

    gl.attachShader(program, vertex.shader);
    gl.attachShader(program, fragment.shader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      onFallback?.(
        gl.getProgramInfoLog(program) ??
          "The WebGL program could not be linked.",
      );
      return;
    }

    gl.useProgram(program);

    const buffer = gl.createBuffer();

    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
      gl.STATIC_DRAW,
    );

    const position = gl.getAttribLocation(program, "aPos");

    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

    const uniform = (name: string) => gl.getUniformLocation(program, name);
    const uniforms = {
      res: uniform("uRes"),
      base: uniform("uBase"),
      mid: uniform("uMid"),
      horizon3: uniform("uHorizon3"),
      midAt: uniform("uMidAt"),
      blurTex: uniform("uBlurTex"),
      uvScale: uniform("uBlobUvScale"),
      uvOffset: uniform("uBlobUvOffset"),
      color1: uniform("uBlobColor1"),
      color2: uniform("uBlobColor2"),
      alpha1: uniform("uAlpha1"),
      alpha2: uniform("uAlpha2"),
      drift1: uniform("uDrift1"),
      drift2: uniform("uDrift2"),
      scale1: uniform("uScale1"),
      scale2: uniform("uScale2"),
      opacity1: uniform("uOpacity1"),
      opacity2: uniform("uOpacity2"),
      dither: uniform("uDither"),
    };

    const root = document.documentElement;
    const reduceQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    let tokens = readTokens();
    let nightBlend = readNightBlend(canvas);
    let blurTexture: BlurTexture | null = null;
    let textureTimer: number | null = null;
    let dirty = true;
    let frame = 0;
    let disposed = false;
    let clock = readCssMotionOffset();
    let lastTimestamp: number | null = null;

    const rebuildTexture = () => {
      tokens = readTokens();

      const next = buildBlurTexture(
        gl,
        tokens,
        window.innerWidth,
        window.innerHeight,
      );

      if ("error" in next) {
        onFallback?.(next.error);
        return;
      }

      if (blurTexture) gl.deleteTexture(blurTexture.texture);

      blurTexture = next;
      dirty = true;
    };

    const scheduleTexture = () => {
      if (textureTimer !== null) window.clearTimeout(textureTimer);

      textureTimer = window.setTimeout(() => {
        textureTimer = null;
        rebuildTexture();
        requestFrame();
      }, 120);
    };

    const resize = () => {
      const dpr = Math.min(
        window.devicePixelRatio || 1,
        paramsRef.current.dprCap,
      );
      const width = Math.max(1, Math.round(canvas.clientWidth * dpr));
      const height = Math.max(1, Math.round(canvas.clientHeight * dpr));

      if (canvas.width === width && canvas.height === height) return;

      canvas.width = width;
      canvas.height = height;
      gl.viewport(0, 0, width, height);
      dirty = true;
    };

    const draw = () => {
      if (disposed || !blurTexture) return;

      if (dirty || root.dataset.phaseSwitching) {
        tokens = readTokens();
        nightBlend = readNightBlend(canvas);
        dirty = false;
      }

      const width = canvas.width;
      const height = canvas.height;
      const dpr = width / Math.max(window.innerWidth, 1);
      const params = paramsRef.current;
      const animated = motionUniforms(
        params.motion,
        params.tuning,
        clock,
        window.innerWidth,
        window.innerHeight,
        nightBlend,
        reduceQuery.matches,
      );

      gl.uniform2f(uniforms.res, width, height);
      gl.uniform3fv(uniforms.base, tokens.base);
      gl.uniform3fv(uniforms.mid, tokens.mid);
      gl.uniform3fv(uniforms.horizon3, tokens.horizon3);
      gl.uniform1f(uniforms.midAt, tokens.midAt);
      gl.uniform3fv(uniforms.color1, tokens.color1);
      gl.uniform3fv(uniforms.color2, tokens.color2);
      // Rest strength, then the breathe envelope: both are alpha multipliers,
      // so they compose here exactly as the CSS tint and pulse layer do.
      gl.uniform1f(
        uniforms.alpha1,
        tokens.alpha1 * animated.base * animated.intensity1,
      );
      gl.uniform1f(
        uniforms.alpha2,
        tokens.alpha2 * animated.base * animated.intensity2,
      );
      gl.uniform2f(
        uniforms.uvScale,
        1 / (blurTexture.worldWidth * dpr),
        1 / (blurTexture.worldHeight * dpr),
      );
      gl.uniform2f(
        uniforms.uvOffset,
        blurTexture.margin / blurTexture.worldWidth,
        blurTexture.margin / blurTexture.worldHeight,
      );
      gl.uniform2f(
        uniforms.drift1,
        animated.drift1[0] * dpr,
        animated.drift1[1] * dpr,
      );
      gl.uniform2f(
        uniforms.drift2,
        animated.drift2[0] * dpr,
        animated.drift2[1] * dpr,
      );
      gl.uniform1f(uniforms.scale1, animated.scale1);
      gl.uniform1f(uniforms.scale2, animated.scale2);
      gl.uniform1f(uniforms.opacity1, animated.opacity1);
      gl.uniform1f(uniforms.opacity2, animated.opacity2);
      gl.uniform1f(uniforms.dither, params.ditherLsb);

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, blurTexture.texture);
      gl.uniform1i(uniforms.blurTex, 0);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    };

    const tick = (timestamp: number) => {
      frame = 0;

      if (lastTimestamp !== null) {
        // A long gap means the tab was hidden or the loop was idle; the CSS
        // animation was frozen then too, so do not jump the shader clock.
        clock += Math.min(Math.max((timestamp - lastTimestamp) / 1000, 0), 0.1);
      }

      lastTimestamp = timestamp;
      resize();
      draw();

      const animating =
        !document.hidden &&
        !reduceQuery.matches &&
        paramsRef.current.motion !== "none";

      // Keep going while the ambient loop runs or a phase fade is in flight.
      if (animating || root.dataset.phaseSwitching) {
        frame = requestAnimationFrame(tick);
      } else {
        lastTimestamp = null;
      }
    };

    const requestFrame = () => {
      if (!frame && !document.hidden) frame = requestAnimationFrame(tick);
    };

    const onFirstFrame = () => {
      // Let the 0-opacity state paint once so the fade has a start value.
      requestAnimationFrame(() => {
        layer.dataset.ready = "true";
      });
    };

    const observer = new MutationObserver(() => {
      dirty = true;
      requestFrame();
    });

    observer.observe(root, {
      attributes: true,
      attributeFilter: [
        "data-phase",
        "data-mode",
        "data-phase-switching",
        "class",
      ],
    });

    const onVisibility = () => {
      if (document.hidden) {
        if (frame) cancelAnimationFrame(frame);
        frame = 0;
        lastTimestamp = null;
        return;
      }

      requestFrame();
    };

    const onContextLost = (event: Event) => {
      event.preventDefault();
      onFallback?.("The WebGL context was lost.");
    };

    const onReducedMotion = () => requestFrame();
    const onResize = () => {
      resize();
      scheduleTexture();
      requestFrame();
    };

    rebuildTexture();

    if (!blurTexture) return;

    resize();
    draw();
    onFirstFrame();
    requestFrameRef.current = requestFrame;
    requestFrame();

    canvas.addEventListener("webglcontextlost", onContextLost);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("resize", onResize);
    reduceQuery.addEventListener("change", onReducedMotion);

    return () => {
      disposed = true;
      requestFrameRef.current = () => {};

      if (frame) cancelAnimationFrame(frame);
      if (textureTimer !== null) window.clearTimeout(textureTimer);

      observer.disconnect();
      canvas.removeEventListener("webglcontextlost", onContextLost);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("resize", onResize);
      reduceQuery.removeEventListener("change", onReducedMotion);
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
      gl.deleteShader(vertex.shader);
      gl.deleteShader(fragment.shader);

      if (blurTexture) gl.deleteTexture(blurTexture.texture);

      // React's dev double-mount runs cleanup between two setups on the same
      // canvas; losing the context there would poison the remount (and a lost
      // context can never be recreated). Only drop it once the canvas is gone.
      const context = gl;

      window.setTimeout(() => {
        if (!canvas.isConnected) {
          context.getExtension("WEBGL_lose_context")?.loseContext();
        }
      }, 0);
    };
    // Motion params live in paramsRef; the GL context is created once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A parameter change needs a frame; motion needs the running loop.
  useEffect(() => {
    paramsRef.current = { motion, tuning, ditherLsb, dprCap };
    requestFrameRef.current();
  }, [motion, tuning, ditherLsb, dprCap]);

  return (
    <div
      ref={layerRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 horizon-canvas-layer"
    >
      {/* Carries the phase's night-blend property; see horizon-motion.css. */}
      <canvas
        ref={canvasRef}
        className="horizon-night-scope block h-full w-full"
      />
    </div>
  );
}
