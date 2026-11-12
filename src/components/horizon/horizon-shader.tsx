"use client";

import { useEffect, useRef } from "react";
import type {
  HorizonMotionTuning,
  HorizonMotionVariant,
} from "./horizon-background";

/**
 * WebGL twin of HorizonBackground.
 *
 * One full-screen quad and one fragment shader: the backdrop gradient and the
 * two glow ellipses are evaluated per pixel instead of being rasterised and
 * blurred by the compositor. The point of the prototype is the final step:
 * the colour is computed in highp float and dithered by a fraction of an 8-bit
 * LSB before it is written, so the Night glow never has to step between two
 * quantised values. CSS can only approximate that with a visible grain layer.
 *
 * The shader reads the same computed --horizon-* tokens as the CSS background,
 * so phase colours, blob geometry and alphas stay single-sourced. During a
 * phase switch the tokens are re-read every frame while data-phase-switching
 * is set, which reproduces the CSS crossfade.
 *
 * The rAF loop is demand-driven: it runs while a motion variant is active, is
 * cancelled while the tab is hidden, and in static mode only renders when a
 * token or resize change asks for a frame.
 */

const DEFAULT_TUNING = {
  driftPeriod: 110,
  driftTravelX: 1.5,
  driftTravelY: 1,
  breathePeriod: 16,
  breatheScale: 2,
  breatheDepth: 13,
};

/** Blob 2's loop differs so the pair never syncs (mirrors the CSS version). */
const SECOND_BLOB_PERIOD_RATIO = 0.82;
const SECOND_BLOB_DELAY_RATIO = 0.37;

/**
 * CSS blur(radius) behaves like a gaussian with sigma close to the radius; the
 * 1.0 factor was calibrated against the Night profile of the CSS renderer.
 */
const BLUR_SIGMA_FACTOR = 1;

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
uniform vec4 uBlob1;
uniform vec4 uBlob2;
uniform vec3 uBlobColor1;
uniform vec3 uBlobColor2;
uniform float uAlpha1;
uniform float uAlpha2;
uniform float uSigma;
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

/*
 * A CSS-blurred ellipse is a sharp ellipse convolved with a gaussian, so the
 * coverage at the ellipse edge is 0.5 and settles to 1/0 a few sigma away. The
 * logistic below is the gaussian step response (0.846 / 0.5 / 0.154 at
 * -1 / 0 / +1 sigma), which is indistinguishable from the blurred edge here.
 */
float blobCoverage(vec2 world, vec4 box, float scale, vec2 drift) {
  vec2 center = uRes * 0.5;
  vec2 local = center + (world - drift - center) / max(scale, 0.0001);
  vec2 d = local - box.xy;
  vec2 halfSize = max(box.zw, vec2(1.0));
  float k = length(d / halfSize);
  float gradientLength = length(d / (halfSize * halfSize)) / max(k, 0.00001);
  float edgeDistance = (k - 1.0) / max(gradientLength, 0.00001);
  float x = clamp(1.702 * edgeDistance / max(uSigma, 0.001), -30.0, 30.0);
  return 1.0 / (1.0 + exp(x));
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

  float a1 = uAlpha1 * uOpacity1 * blobCoverage(world, uBlob1, uScale1, uDrift1);
  color = mix(color, uBlobColor1, a1);

  float a2 = uAlpha2 * uOpacity2 * blobCoverage(world, uBlob2, uScale2, uDrift2);
  color = mix(color, uBlobColor2, a2);

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
  sigma: number;
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
    sigma:
      effectiveBlur(num("--horizon-blob-blur", 180), width) * BLUR_SIGMA_FACTOR,
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
};

function tri(progress: number): number {
  const f = progress - Math.floor(progress);

  return 1 - Math.abs(2 * f - 1);
}

/** CSS ease-in-out is close enough to smoothstep over a 30s+ ambient loop. */
function easeInOut(t: number): number {
  return t * t * (3 - 2 * t);
}

function motionUniforms(
  motion: HorizonMotionVariant,
  tuning: HorizonMotionTuning | undefined,
  time: number,
  width: number,
  height: number,
): MotionUniforms {
  const t = { ...DEFAULT_TUNING, ...tuning };
  const driftOn = motion === "drift" || motion === "drift-breathe";
  const breatheOn = motion === "breathe" || motion === "drift-breathe";
  const driftPeriod2 = t.driftPeriod * SECOND_BLOB_PERIOD_RATIO;
  const driftDelay2 = -driftPeriod2 * SECOND_BLOB_DELAY_RATIO;
  const breatheDelay2 = -t.breathePeriod / 2;

  const driftProgress = (period: number, delay: number) =>
    easeInOut(tri((time - delay) / period));
  const breatheProgress = (delay: number) =>
    easeInOut(tri((time - delay) / t.breathePeriod));

  const travelX = (t.driftTravelX / 100) * width;
  const travelY = (t.driftTravelY / 100) * height;

  const drift1 = driftOn ? driftProgress(t.driftPeriod, 0) : 0;
  const drift2 = driftOn ? driftProgress(driftPeriod2, driftDelay2) : 0;
  const breathe1 = breatheOn ? breatheProgress(0) : 0;
  const breathe2 = breatheOn ? breatheProgress(breatheDelay2) : 0;

  return {
    drift1: [travelX * drift1, -travelY * drift1],
    drift2: [-travelX * drift2, travelY * drift2],
    scale1: 1 + (t.breatheScale / 100) * breathe1,
    scale2: 1 + (t.breatheScale / 100) * breathe2,
    opacity1: 1 - (t.breatheDepth / 100) * breathe1,
    opacity2: 1 - (t.breatheDepth / 100) * breathe2,
  };
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
  const requestFrameRef = useRef<() => void>(() => {});
  const paramsRef = useRef({ motion, tuning, ditherLsb, dprCap });

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas) return;

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
      blob1: uniform("uBlob1"),
      blob2: uniform("uBlob2"),
      color1: uniform("uBlobColor1"),
      color2: uniform("uBlobColor2"),
      alpha1: uniform("uAlpha1"),
      alpha2: uniform("uAlpha2"),
      sigma: uniform("uSigma"),
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
    let dirty = true;
    let frame = 0;
    let disposed = false;

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

    const draw = (timestamp: number) => {
      if (disposed) return;

      if (dirty || root.dataset.phaseSwitching) {
        tokens = readTokens();
        dirty = false;
      }

      const width = canvas.width;
      const height = canvas.height;
      const dpr = width / Math.max(window.innerWidth, 1);
      const params = paramsRef.current;
      const animated = motionUniforms(
        params.motion,
        params.tuning,
        timestamp / 1000,
        window.innerWidth,
        window.innerHeight,
      );

      gl.uniform2f(uniforms.res, width, height);
      gl.uniform3fv(uniforms.base, tokens.base);
      gl.uniform3fv(uniforms.mid, tokens.mid);
      gl.uniform3fv(uniforms.horizon3, tokens.horizon3);
      gl.uniform1f(uniforms.midAt, tokens.midAt);
      gl.uniform4f(
        uniforms.blob1,
        tokens.blob1.cx * dpr,
        tokens.blob1.cy * dpr,
        tokens.blob1.hw * dpr,
        tokens.blob1.hh * dpr,
      );
      gl.uniform4f(
        uniforms.blob2,
        tokens.blob2.cx * dpr,
        tokens.blob2.cy * dpr,
        tokens.blob2.hw * dpr,
        tokens.blob2.hh * dpr,
      );
      gl.uniform3fv(uniforms.color1, tokens.color1);
      gl.uniform3fv(uniforms.color2, tokens.color2);
      gl.uniform1f(uniforms.alpha1, tokens.alpha1);
      gl.uniform1f(uniforms.alpha2, tokens.alpha2);
      gl.uniform1f(uniforms.sigma, tokens.sigma * dpr);
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

      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    };

    const tick = (timestamp: number) => {
      frame = 0;
      resize();
      draw(timestamp);

      const animating =
        !document.hidden &&
        !reduceQuery.matches &&
        paramsRef.current.motion !== "none";

      // Keep going while the ambient loop runs or a phase fade is in flight.
      if (animating || root.dataset.phaseSwitching) {
        frame = requestAnimationFrame(tick);
      }
    };

    const requestFrame = () => {
      if (!frame && !document.hidden) frame = requestAnimationFrame(tick);
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
        return;
      }

      requestFrame();
    };

    const onReducedMotion = () => requestFrame();
    const onResize = () => {
      resize();
      requestFrame();
    };

    resize();
    draw(performance.now());
    requestFrameRef.current = requestFrame;
    requestFrame();

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("resize", onResize);
    reduceQuery.addEventListener("change", onReducedMotion);

    return () => {
      disposed = true;
      requestFrameRef.current = () => {};

      if (frame) cancelAnimationFrame(frame);

      observer.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("resize", onResize);
      reduceQuery.removeEventListener("change", onReducedMotion);
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
      gl.deleteShader(vertex.shader);
      gl.deleteShader(fragment.shader);

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
    <div aria-hidden="true" className="pointer-events-none fixed inset-0">
      <canvas ref={canvasRef} className="block h-full w-full" />
    </div>
  );
}
