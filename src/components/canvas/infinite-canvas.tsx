"use client";

/* eslint-disable @next/next/no-img-element -- the no-WebGL fallback needs a
   plain poster <img>; the WebGL path never renders one. */

/**
 * Technique referenced from cathydolle.com/playground (three.js plane grid,
 * shader cover UVs, per-plane wrap, momentum, wheel and drag zoom). All media,
 * copy and design tokens are this site's; no assets or branding are taken from
 * the reference.
 */

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import * as THREE from "three";
import { useReducedMotion } from "@/components/home/use-reduced-motion";
import { MediaImage } from "@/components/media/media-image";
import {
  fullResSource,
  type ImageMedia,
  type MediaManifest,
} from "@/lib/media-types";
import type { Box } from "@/components/work/morph";
import {
  gridMetrics,
  INTRO_GAP,
  orientationRatio,
} from "./grid";
import { clusterLayout } from "./clusters";
import {
  INTRO,
  introCameraZ,
  introEnded,
  introGapProgress,
  introGray,
  introPlaneOpacity,
  introVideosReady,
  introZoom,
  reducedIntroEnded,
  reducedOpacity,
} from "./intro";
import {
  TRANSITION,
  boxInsideViewport,
  canClose,
  canOpen,
  closeComplete,
  closeFadeProgress,
  closeScrollOffset,
  closeShrinkProgress,
  closeSiblingFadeProgress,
  fadeOutProgress,
  fitBox,
  glideProgress,
  growProgress,
  handoffProgress,
  nextPhase,
  resizeOpenScroll,
  viewerOpenNeedsFrames,
} from "./transition";
import type { TransitionPhase } from "./transition";
import { LENS, lensProject, lensTargetStrength, lensUnproject } from "./lens";
import type { LensMode } from "./lens";
import {
  BREATH,
  breathEnvelope,
  breathPhase,
  easeBreathLevel,
} from "./breathing";
import type { BreathSettings } from "./breathing";
import { hoverIntentReady, hoverValue, retargetHover } from "./hover";
import type { HoverSettings, HoverTween } from "./hover";
import { projectLabel } from "./items";
import { adjacentCell, keyboardGlideProgress } from "./keyboard-nav";
import { usePan } from "./use-pan";
import { centrePlaneScroll, planePosition } from "./wrap";
import {
  beginPerf,
  instrumentWebGL,
  markFirstOpenFrame,
  markPerf,
  perfEnabled,
} from "./perf";
import {
  EDGE_BLUR,
  EDGE_MASK_GLSL,
  edgeBlurDepthPx,
  edgeBlurRadiusPx,
} from "./edge-blur";
import "./infinite-canvas.css";

export type CanvasItem = {
  /** Unique per copy in the cycled list, not the media id. */
  key: string;
  /** Source subfolder under `Optimized`, used for the opened-view chip. */
  project: string;
  media: MediaManifest;
};

export type CloseTarget = {
  /** The resting tile rect the viewer should land on, or null to cancel. */
  rect: Box | null;
  /** The canvas tile (video frame included) is ready to be revealed. */
  prepared: Promise<void>;
};

export type InfiniteCanvasHandle = {
  /** The current screen rect of an item's plane, for the focus viewer's FLIP. */
  rectForIndex: (index: number) => Box | null;
  /** Restore the plane hidden for a focused item, before the close flight. */
  reveal: () => void;
  /** The viewer has a decoded frame; start the canvas handoff fade. */
  handoff: () => void;
  /**
   * The viewer stepped to a DOM slide. Drop the canvas-owned focus plane from
   * the canvas while keeping the grid faded exactly as the open left it, so
   * no plane shows around the new slide and the background does not change.
   * The open phase stays, so the stepped close still flies to the current
   * item's tile.
   */
  releaseOpen: () => void;
  /**
   * Start a close immediately: return the target tile rect synchronously while
   * the tile's texture/frame prepares in parallel. Null means the close was
   * cancelled before anything was shown.
   */
  closeTo: (
    index: number,
    time?: number,
    canvasOwned?: boolean,
  ) => CloseTarget | null;
  /** The viewer is shrinking again; put the hidden plane back in place. */
  cancelClose: () => void;
  /** The viewer landed; reveal the prepared tile and resume the grid. */
  landClose: () => void;
};

export type LensSettings = {
  mode: LensMode;
  strength: number;
  boost: number;
  vignette: number;
};

export type InfiniteCanvasProps = {
  items: CanvasItem[];
  paused: boolean;
  lens: LensSettings;
  breath: BreathSettings;
  hover: HoverSettings;
  /**
   * The in-canvas progressive edge blur. `?edgeblur=off` passes false, which
   * leaves the render targets unmipmapped and the effect at zero.
   */
  edgeBlur?: boolean;
  /**
   * A focused tile owns the screen. The edge effect fades out over
   * `EDGE_BLUR.fadeMs` and returns after the close lands.
   */
  edgeBlurSuppressed?: boolean;
  onOpen: (
    index: number,
    startAt?: number,
    openRect?: Box,
    canvasOwned?: boolean,
  ) => void;
  /** The canvas-owned open has settled; reveal the viewer chrome. */
  onCanvasOpened: () => void;
  /** The intro clock has started (posters ready, or the wait timed out). */
  onIntroStart?: () => void;
};

const CAMERA_Z = INTRO.cameraToZ;
const CAMERA_DRAG_Z = 475;
const FRAME_MS = 1000 / 60;
/** Above this many target pixels, the 1.6x downsample replaces MSAA. */
const RT_MSAA_MAX_PIXELS = 10_000_000;
const TEXTURE_TARGET_WIDTH = 640;
const TEXTURE_ZOOM = 1.06;
const PARALLAX_LIMIT = 0.025;

/**
 * One capability probe for the process, and the probe's context is released:
 * a discarded canvas that keeps a live WebGL context is a real leak on every
 * mount (and Strict Mode mounts twice).
 */
let webglSupported: boolean | null = null;

function hasWebgl(): boolean {
  if (webglSupported !== null) return webglSupported;

  let supported = false;

  try {
    const probe = document.createElement("canvas");
    const gl = probe.getContext("webgl2") ?? probe.getContext("webgl");

    supported = Boolean(gl);
    gl?.getExtension("WEBGL_lose_context")?.loseContext();
  } catch {
    supported = false;
  }

  webglSupported = supported;

  return supported;
}

/**
 * Canvas video budget. Videos already playing stay playing until their plane
 * leaves the viewport plus margin; new starts are rate-limited so a fast drag
 * never opens a dozen decoders in one frame.
 */
const VIDEO_TUNING = {
  desktopPlaying: 24,
  mobilePlaying: 6,
  /** The visible set is recomputed this often, starting at most one video. */
  checkMs: 80,
  /** Extra screen px around the viewport that counts as visible. */
  margin: 160,
  /**
   * New starts wait out fast motion. Videos already playing are never paused
   * for speed; this only keeps decoder starts off the fast-drag path.
   */
  startFreezeEnterSpeed: 3,
  startFreezeExitSpeed: 0.4,
  startFreezeSettleMs: 220,
} as const;

/** Hovering across the grid must not start 88 downloads. */
const MAX_PRELOADS = 6;
/** The clicked tile's hold size while its full-res source loads. */
const OPEN_PRESS_SCALE = 0.94;
/**
 * During a close the featured plane is the one leaving the focus. It must
 * paint after every sibling for the whole shrink, or a sibling whose plane
 * overlaps the large focus rect can cover the media being closed.
 */
const CLOSE_TARGET_RENDER_ORDER = 2;

const VERTEX_SHADER = /* glsl */ `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FRAGMENT_SHADER = /* glsl */ `
  uniform sampler2D uTexture;
  uniform vec2 uImageSizes;
  uniform vec2 uPlaneSizes;
  uniform vec2 uParallax;
  uniform float uZoom;
  uniform float uZoomFactor;
  uniform float uGray;
  uniform float uOpacity;
  /**
   * Video frames are uploaded as straight RGBA, not SRGB8_ALPHA8 (three forces
   * a linear transfer for video textures), so their sRGB values must be
   * decoded here. Images are hardware-decoded, so they must skip this.
   */
  uniform float uDecodeVideo;

  varying vec2 vUv;

  void main() {
    vec2 planeSize = max(uPlaneSizes, vec2(0.0001));
    vec2 imageSize = max(uImageSizes, vec2(0.0001));
    float planeAspect = planeSize.x / planeSize.y;
    float imageAspect = imageSize.x / imageSize.y;

    // Cover: show the sub-rectangle of the image with the plane's ratio.
    vec2 scale = vec2(1.0);
    if (planeAspect > imageAspect) scale.y = imageAspect / planeAspect;
    else scale.x = planeAspect / imageAspect;

    vec2 uv = (vUv - 0.5) * scale + 0.5;
    uv = (uv - 0.5) / (uZoom * uZoomFactor) + 0.5;
    uv += uParallax;

    vec4 texel = texture2D(uTexture, uv);

    if (uDecodeVideo > 0.5) {
      texel = sRGBTransferEOTF(texel);
    }

    // Grayscale in linear light, matching the decode above.
    float luma = dot(texel.rgb, vec3(0.2126, 0.7152, 0.0722));
    texel.rgb = mix(texel.rgb, vec3(luma), uGray);

    // Analytic 1px edge coverage for high-DPI targets without MSAA, so the
    // slow breath does not make the quad edge hop whole pixels. The lens pass
    // then filters the already-antialiased edge linearly.
    vec2 edge = min(vUv, 1.0 - vUv);
    vec2 edgeStep = max(fwidth(vUv), vec2(0.00001));
    float edgeAlpha =
      smoothstep(0.0, 1.0, edge.x / edgeStep.x) *
      smoothstep(0.0, 1.0, edge.y / edgeStep.y);

    float alpha = uOpacity * edgeAlpha;

    // Linear premultiplied for the render target; the lens pass does the one
    // sRGB encode when it draws to the canvas.
    gl_FragColor = vec4(texel.rgb * alpha, alpha);
  }
`;

const POST_VERTEX_SHADER = /* glsl */ `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

/**
 * Full-screen globe lens. Reads the linear premultiplied scene target, samples
 * it through the barrel map, then encodes once into sRGB when it draws to the
 * canvas. The vignette fades to the page background by lowering alpha.
 *
 * When the edge blur is on, this pass renders into a linear screen target and
 * the composite pass below does the sRGB encode plus the edge mix. The same
 * shader still draws straight to the canvas for `?edgeblur=off`.
 */
const POST_FRAGMENT_SHADER = /* glsl */ `
  uniform sampler2D uScene;
  uniform float uStrength;
  uniform float uVignette;
  uniform float uAspect;
  uniform float uSourceScale;

  varying vec2 vUv;

  void main() {
    vec2 q = vUv * 2.0 - 1.0;
    float rMax = length(vec2(uAspect, 1.0));
    float r = length(vec2(q.x * uAspect, q.y)) / rMax;
    float f = 1.0 + uStrength * r * r;
    vec2 t = q * uSourceScale * f;
    vec2 uv = 0.5 + t * 0.5;

    vec4 c = texture2D(uScene, uv);
    vec3 linear = c.a > 0.0001 ? c.rgb / c.a : c.rgb;

    gl_FragColor = vec4(linear, c.a);

    #include <colorspace_fragment>

    // Premultiplied for the canvas / the linear screen target.
    gl_FragColor.rgb *= gl_FragColor.a;

    float edge = smoothstep(0.72, 1.05, r);
    gl_FragColor *= 1.0 - uVignette * edge;
  }
`;

/**
 * The horizontal half of the separable edge blur, at half resolution. Each
 * bilinear read of the full-resolution screen target also averages the 2x2
 * block, so this pass doubles as the downsample. The screen-space edge mask
 * scales the radius per fragment; the composite below finishes the vertical
 * half against the same mask.
 */
const EDGE_H_FRAGMENT_SHADER = /* glsl */ `
  uniform sampler2D uSource;
  uniform vec2 uTexel;
  uniform float uRadius;
  uniform vec2 uEdgeDepth;
  uniform float uWeights[7];

  varying vec2 vUv;
  ${EDGE_MASK_GLSL}
  void main() {
    float edge = edgeMask(vUv, uEdgeDepth);

    float radius = uRadius * edge;
    vec4 sum = texture2D(uSource, vUv) * uWeights[0];
    float total = uWeights[0];

    for (int i = 1; i <= 6; i += 1) {
      float offset = float(i) / 6.0;
      vec2 d = vec2(uTexel.x, 0.0) * radius * offset;
      vec4 a = texture2D(uSource, vUv + d);
      vec4 b = texture2D(uSource, vUv - d);
      float weight = uWeights[i];
      sum += (a + b) * weight;
      total += 2.0 * weight;
    }

    gl_FragColor = sum / total;
  }
`;

/**
 * The edge composite, used only when the effect is on. It reads the linear
 * screen target (lens applied, premultiplied) and the horizontal half of the
 * separable blur, applies the vertical half in this draw, mixes by the
 * screen-space edge mask, adds the theme tint, then does the one sRGB encode
 * and the vignette on the way to the canvas.
 *
 * The mask is EDGE_MASK_GLSL, the shared source of `edgeBlurMask()` in
 * edge-blur.ts, which tests pin.
 */
const COMPOSITE_FRAGMENT_SHADER = /* glsl */ `
  uniform sampler2D uScene;
  uniform sampler2D uEdgeScene;
  uniform vec2 uEdgeTexel;
  uniform float uEdgeRadius;
  uniform float uWeights[7];
  uniform vec2 uEdgeDepth;
  uniform float uEdgeAmount;
  uniform vec3 uEdgeTint;
  uniform float uEdgeTintStrength;
  uniform float uVignette;
  uniform float uAspect;

  varying vec2 vUv;
  ${EDGE_MASK_GLSL}
  void main() {
    float edge = edgeMask(vUv, uEdgeDepth) * uEdgeAmount;

    vec4 sharp = texture2D(uScene, vUv);
    vec4 c = sharp;

    if (edge > 0.0) {
      // The horizontal pass already ran at half resolution; finish the
      // separable Gaussian here with seven mirrored vertical taps.
      float radius = uEdgeRadius * edge;
      vec4 sum = texture2D(uEdgeScene, vUv) * uWeights[0];
      float total = uWeights[0];

      for (int i = 1; i <= 6; i += 1) {
        float offset = float(i) / 6.0;
        vec2 d = vec2(0.0, uEdgeTexel.y) * radius * offset;
        vec4 a = texture2D(uEdgeScene, vUv + d);
        vec4 b = texture2D(uEdgeScene, vUv - d);
        float weight = uWeights[i];
        sum += (a + b) * weight;
        total += 2.0 * weight;
      }

      c = mix(sharp, sum / total, edge);
    }

    vec3 linear = c.a > 0.0001 ? c.rgb / c.a : c.rgb;
    linear = mix(linear, uEdgeTint, uEdgeTintStrength * edge);

    gl_FragColor = vec4(linear, c.a);

    #include <colorspace_fragment>

    // Premultiplied sRGB for the premultiplied canvas.
    gl_FragColor.rgb *= gl_FragColor.a;

    vec2 q = vUv * 2.0 - 1.0;
    float r =
      length(vec2(q.x * uAspect, q.y)) / length(vec2(uAspect, 1.0));
    gl_FragColor *= 1.0 - uVignette * smoothstep(0.72, 1.05, r);
  }
`;

type TextureEntry = {
  texture: THREE.Texture;
  loaded: boolean;
  failed: boolean;
};

type Plane = {
  mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;
  material: THREE.ShaderMaterial;
  itemIndex: number;
  col: number;
  row: number;
  /** Staggered start for the intro opacity, 500-1250ms. */
  opacityDelay: number;
  /** Cell centre in screen px relative to the viewport centre, before scroll. */
  baseX: number;
  baseY: number;
  /** The resting tile size, before the idle breath scale. */
  tileWidth: number;
  tileHeight: number;
  /** Pointer hover lift, 0-1, retargeted from its current value. */
  hover: HoverTween;
  hoverLevel: number;
  textureUrl: string;
  isVideo: boolean;
  loaded: boolean;
  opacity: number;
};

type CanvasTransition = {
  phase: TransitionPhase;
  startedAt: number;
  /** The item being opened or stepped to. */
  index: number;
  /** The plane that grows on open. */
  plane: Plane | null;
  /** The plane the close lands on (may differ after stepping). */
  target: Plane | null;
  fromScrollX: number;
  fromScrollY: number;
  toScrollX: number;
  toScrollY: number;
  fromCameraZ: number;
  tileWidth: number;
  tileHeight: number;
  /** The tile's resting size (no hover/breath), which the close lands on. */
  restWidth: number;
  restHeight: number;
  focusWidth: number;
  focusHeight: number;
  /** performance.now when the grow handed off to the viewer, or -1. */
  handoffAt: number;
  /** The grow is done and the viewer is preparing its first decoded frame. */
  waitingForViewer: boolean;
  /** The close target is at the focus and synced; the timeline has started. */
  prepared: boolean;
  /** The DOM viewer owns the zoom; the canvas only fades the other planes. */
  viewerOwned: boolean;
};

type VideoEntry = {
  element: HTMLVideoElement;
  texture: THREE.Texture | null;
  ready: boolean;
  playing: boolean;
  failed: boolean;
  /** The video texture is bound to the planes (not just loaded). */
  bound: boolean;
  /** performance.now of the last manual upload. */
  lastUpload: number;
  /** Pending requestVideoFrameCallback, if the browser has it. */
  frameRequest: number | null;
};

/**
 * A full-res video frame warmed from the hover preload. The texture is uploaded
 * before the open, so the glide can show the full-res frame without paying the
 * first upload. The element is paused through the glide and plays at open-ready.
 */
type FocusVideoEntry = {
  index: number;
  element: HTMLVideoElement;
  texture: THREE.Texture;
  ready: boolean;
  playing: boolean;
  lastUpload: number;
  frameRequest: number | null;
  /** Pending seek fallback while the paused preload settles on a time. */
  seekTimer: number;
  /** Pending warm texture upload (idle/rAF). */
  upload: { id: number; idle: boolean } | null;
  /** Measured warm upload duration, for the dev probe. */
  warmMs: number | null;
  warmAt: number;
};

type CanvasDebug = {
  mode: "webgl";
  planes: number;
  drawCalls: number;
  textures: number;
  texturesLoaded: number;
  texturesTotal: number;
  textureLoadMs: number | null;
  cameraZ: number;
  panSpeed: number;
  introEnded: boolean;
  introMs: number;
  gap: number;
  gray: number;
  introZoom: number;
  lens: "flat" | "globe";
  lensApplied: number;
  lensTarget: number;
  rtWidth: number;
  rtHeight: number;
  rtSamples: number;
  edgeBlur: boolean;
  edgeBlurAmount: number;
  edgeBlurRadius: number;
  edgeBlurDepth: number;
  rects: {
    index: number;
    id: string;
    left: number;
    top: number;
    width: number;
    height: number;
  }[];
  breathActive: boolean;
  breathAmplitude: number;
  breathIdleMs: number;
  breathSample: number;
  renderedFrames: number;
  hoverIndex: number;
  hoverLevel: number;
  transition: TransitionPhase;
  transitionMs: number;
  waitingForViewer: boolean;
  prepared: boolean;
  viewerOwned: boolean;
  targetWidth: number;
  targetHeight: number;
  targetOpacity: number;
  targetZoom: number;
  scroll: { x: number; y: number };
  /** The in-flight transition's scroll path and plane base (dev tracing). */
  openScroll: { x: number; y: number } | null;
  openTarget: { x: number; y: number } | null;
  openBase: { x: number; y: number } | null;
  openRect: {
    left: number;
    top: number;
    width: number;
    height: number;
  } | null;
  /** Wrap half-periods, so a trace can compare equivalent scroll targets. */
  half: { x: number; y: number };
  dragging: boolean;
  hidden: boolean;
  videosPlaying: number;
  videoEntries: number;
  videoTextures: number;
  videoPlanesBound: number;
  videoUploads: number;
  focusVideo: {
    index: number;
    ready: boolean;
    playing: boolean;
    width: number;
    height: number;
    warmMs: number | null;
    warmAt: number;
    currentTime: number;
    bound: boolean;
    version: number;
    src: string;
  } | null;
  /** Live hi-res image textures, to prove they are released. */
  focusTextures: number;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** The pool an image texture is picked from: WebP when present. */
function imageSources(media: ImageMedia) {
  const webp = media.sources.filter((source) => source.format === "webp");
  return webp.length > 0 ? webp : media.sources;
}

/** The source the tile texture is loaded from (nearest 640w). */
function imageTextureSource(media: ImageMedia) {
  return imageSources(media).reduce((best, source) => {
    const currentDistance = Math.abs(source.width - TEXTURE_TARGET_WIDTH);
    const bestDistance = Math.abs(best.width - TEXTURE_TARGET_WIDTH);

    return currentDistance < bestDistance ? source : best;
  });
}

/**
 * The focus wants the smallest source that covers the device pixels, and the
 * old DOM used AVIF. Prefer AVIF at that width; keep a WebP variant for a
 * browser that cannot decode AVIF.
 */
function pickFocusImage(media: ImageMedia, neededWidth: number) {
  const pick = (pool: ImageMedia["sources"]) => {
    const sorted = pool
      .filter((source) => source.width >= neededWidth)
      .sort(
        (a, b) =>
          a.width - b.width ||
          (a.format === "avif" ? -1 : 1) - (b.format === "avif" ? -1 : 1),
      );

    if (sorted.length > 0) return sorted[0];

    return [...pool].sort(
      (a, b) =>
        b.width - a.width ||
        (a.format === "avif" ? -1 : 1) - (b.format === "avif" ? -1 : 1),
    )[0];
  };

  const primary = pick(media.sources);
  if (!primary) return null;

  const webp = media.sources.filter((source) => source.format === "webp");
  const fallback =
    primary.format === "avif" && webp.length > 0 ? pick(webp) : null;

  return { primary, fallback };
}

/** The tile picks the WebP nearest 640w; videos use their JPG poster. */
function textureUrl(media: MediaManifest): string {
  if (media.kind === "video") return media.poster.jpg;

  return imageTextureSource(media).url;
}

function clippedArea(rect: Box, width: number, height: number): number {
  const overlapWidth =
    Math.min(rect.left + rect.width, width) - Math.max(rect.left, 0);
  const overlapHeight =
    Math.min(rect.top + rect.height, height) - Math.max(rect.top, 0);

  return overlapWidth > 0 && overlapHeight > 0
    ? overlapWidth * overlapHeight
    : 0;
}

/** The no-WebGL path: a plain static grid, no animation and no DOM loop. */
function StaticFallback({ items }: { items: CanvasItem[] }) {
  return (
    <div className="cv-fallback" aria-hidden="true">
      <p className="cv-fallback__note">WebGL unavailable · static grid</p>
      <div className="cv-fallback__grid">
        {items.slice(0, 12).map((item) => (
          <div key={item.key} className="cv-fallback__item">
            {item.media.kind === "image" ? (
              <MediaImage
                media={item.media}
                alt=""
                sizes="(min-width: 768px) 280px, 50vw"
              />
            ) : (
              <img
                src={item.media.poster.jpg}
                alt=""
                width={item.media.width}
                height={item.media.height}
                loading="lazy"
                decoding="async"
                draggable={false}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * A three.js plane grid over the page background.
 *
 * The DOM version's cost was the media itself: one <img> per visible copy, a
 * shadow layer per tile, and React mounts whenever the copy set changed. Here a
 * fixed set of planes is uploaded once; a frame writes a dozen positions and
 * uniforms and issues one draw per visible plane. The canvas never owns a React
 * state update per frame, and the loop stops when nothing is moving.
 */
export const InfiniteCanvas = forwardRef<
  InfiniteCanvasHandle,
  InfiniteCanvasProps
>(function InfiniteCanvas(
  {
    items,
    paused,
    lens,
    breath,
    hover,
    edgeBlur = true,
    edgeBlurSuppressed = false,
    onOpen,
    onCanvasOpened,
    onIntroStart,
  },
  ref,
) {
  const canvasHostRef = useRef<HTMLDivElement | null>(null);
  const hoverLabelRef = useRef<HTMLSpanElement | null>(null);
  const [webglFailed, setWebglFailed] = useState(false);
  const [introReady, setIntroReady] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const lensRef = useRef(lens);
  const breathRef = useRef(breath);
  const hoverRef = useRef(hover);
  const reduceMotion = useReducedMotion();

  const apiRef = useRef<InfiniteCanvasHandle>({
    rectForIndex: () => null,
    reveal: () => {},
    handoff: () => {},
    releaseOpen: () => {},
    closeTo: () => null,
    cancelClose: () => {},
    landClose: () => {},
  });
  const wakeRef = useRef<() => void>(() => {});
  const pickRef = useRef<(x: number, y: number) => void>(() => {});
  const centerRef = useRef<() => void>(() => {});
  const restoreRef = useRef<() => void>(() => {});
  const pauseVideosRef = useRef<() => void>(() => {});
  const clearHoverRef = useRef<() => void>(() => {});
  const pausedRef = useRef(paused);
  const canvasOwnedRef = useRef(false);
  const onOpenRef = useRef(onOpen);
  const onCanvasOpenedRef = useRef(onCanvasOpened);
  const onIntroStartRef = useRef(onIntroStart);
  const edgeBlurSuppressedRef = useRef(edgeBlurSuppressed);

  useImperativeHandle(ref, () => apiRef.current, []);

  useEffect(() => {
    onOpenRef.current = onOpen;
  }, [onOpen]);

  useEffect(() => {
    onCanvasOpenedRef.current = onCanvasOpened;
  }, [onCanvasOpened]);

  useEffect(() => {
    onIntroStartRef.current = onIntroStart;
  }, [onIntroStart]);

  useEffect(() => {
    lensRef.current = lens;
    wakeRef.current();
  }, [lens]);

  useEffect(() => {
    breathRef.current = breath;
    wakeRef.current();
  }, [breath]);

  useEffect(() => {
    hoverRef.current = hover;
    wakeRef.current();
  }, [hover]);

  useEffect(() => {
    edgeBlurSuppressedRef.current = edgeBlurSuppressed;
    wakeRef.current();
  }, [edgeBlurSuppressed]);

  useEffect(() => {
    pausedRef.current = paused;

    if (paused) {
      if (!canvasOwnedRef.current) {
        pauseVideosRef.current();
      }
      // A canvas-owned open keeps the already-loaded textures live through
      // the glide; other decoders pause once the open lands, while the focused
      // one stays live on the canvas-owned viewer.
      clearHoverRef.current();
    } else {
      canvasOwnedRef.current = false;
      restoreRef.current();
      wakeRef.current();
    }
  }, [paused]);

  const pan = usePan({
    reduceMotion,
    disabled: paused || !introReady || transitioning,
    onTap: (x, y) => {
      if (!pausedRef.current) pickRef.current(x, y);
    },
    onActivate: () => {
      if (!pausedRef.current) centerRef.current();
    },
    onWake: () => wakeRef.current(),
  });

  const {
    containerRef,
    scrollRef,
    handlers,
    tick: panTick,
    isDragging: panIsDragging,
    speed: panSpeed,
    halt: panHalt,
  } = pan;

  useEffect(() => {
    const host = canvasHostRef.current;
    if (!host || items.length === 0) return;

    // Keep the non-null narrowing across the hoisted callbacks below.
    const hostElement: HTMLDivElement = host;
    const api = apiRef.current;

    // Probe before constructing three's renderer: its constructor logs a
    // console error when the context is unavailable, and a missing context is
    // a supported path here, not an error.
    if (!hasWebgl()) {
      queueMicrotask(() => setWebglFailed(true));
      return;
    }

    let renderer: THREE.WebGLRenderer;

    try {
      renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: true,
        powerPreference: "high-performance",
      });
    } catch {
      // Let the effect finish before the fallback renders.
      queueMicrotask(() => setWebglFailed(true));
      return;
    }

    if (perfEnabled) instrumentWebGL(renderer.getContext());

    const readDpr = () => Math.min(window.devicePixelRatio || 1, 2);
    let dpr = readDpr();
    renderer.setPixelRatio(dpr);
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NoToneMapping;
    renderer.domElement.className = "cv-webgl";
    hostElement.appendChild(renderer.domElement);

    const edgeBlurEnabled = edgeBlur;
    let edgeAmount = edgeBlurEnabled && !edgeBlurSuppressedRef.current ? 1 : 0;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 2000);
    camera.position.set(0, 0, CAMERA_Z);
    camera.lookAt(0, 0, 0);

    // The lens render target is larger than the viewport by LENS.margin on
    // every side, so warped edge samples never run out of content. The render
    // camera is the same scene camera with a wider fov for that margin; the
    // normal camera still drives projections and the flat focus rects.
    const renderCamera = new THREE.PerspectiveCamera(50, 1, 0.1, 2000);
    renderCamera.position.set(0, 0, CAMERA_Z);
    renderCamera.lookAt(0, 0, 0);

    const renderTarget = new THREE.WebGLRenderTarget(1, 1, {
      samples: 4,
      depthBuffer: false,
      stencilBuffer: false,
    });

    renderTarget.texture.colorSpace = THREE.NoColorSpace;
    renderTarget.texture.minFilter = THREE.LinearFilter;
    renderTarget.texture.magFilter = THREE.LinearFilter;
    renderTarget.texture.generateMipmaps = false;

    // The edge pipeline renders the lens pass into a linear screen target at
    // canvas resolution, then runs the horizontal half of a separable blur into
    // a half-resolution target. The composite finishes the vertical half in
    // its own draw by the screen-space edge mask. Screen-space keeps the band
    // depth exactly where it is measured, after the lens warp.
    // The targets hold linear premultiplied colour, so half-float avoids
    // 8-bit banding in the blur; fall back to 8-bit when the driver cannot
    // render to it.
    const edgeTargetType =
      renderer.extensions.has("EXT_color_buffer_float") ||
      renderer.extensions.has("EXT_color_buffer_half_float")
        ? THREE.HalfFloatType
        : THREE.UnsignedByteType;
    const screenTarget = edgeBlurEnabled
      ? new THREE.WebGLRenderTarget(1, 1, {
          type: edgeTargetType,
          depthBuffer: false,
          stencilBuffer: false,
        })
      : null;
    const edgeTargetA = edgeBlurEnabled
      ? new THREE.WebGLRenderTarget(1, 1, {
          type: edgeTargetType,
          depthBuffer: false,
          stencilBuffer: false,
        })
      : null;

    for (const target of [screenTarget, edgeTargetA]) {
      if (!target) continue;
      target.texture.colorSpace = THREE.NoColorSpace;
      target.texture.minFilter = THREE.LinearFilter;
      target.texture.magFilter = THREE.LinearFilter;
      target.texture.generateMipmaps = false;
    }

    const postScene = new THREE.Scene();
    const postCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const postGeometry = new THREE.PlaneGeometry(2, 2);
    const edgeDepth = new THREE.Vector2(0.08, 0.08);
    const postMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uScene: { value: renderTarget.texture },
        uStrength: { value: 0 },
        uVignette: { value: 0 },
        uAspect: { value: 1 },
        uSourceScale: { value: LENS.sourceScale },
      },
      vertexShader: POST_VERTEX_SHADER,
      fragmentShader: POST_FRAGMENT_SHADER,
      depthTest: false,
      depthWrite: false,
      transparent: true,
      premultipliedAlpha: true,
      toneMapped: false,
    });
    const postQuad = new THREE.Mesh(postGeometry, postMaterial);
    postScene.add(postQuad);

    // The separable Gaussian's seven mirrored weights: sigma is 1/3 of the
    // radius, so the last tap is three sigmas out.
    const edgeWeights = Array.from({ length: 7 }, (_, index) => {
      const t = index / 6;
      return Math.exp(-0.5 * Math.pow(t * 3, 2));
    });

    const edgeScene = new THREE.Scene();
    const edgeHMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uSource: {
          value: screenTarget?.texture ?? renderTarget.texture,
        },
        uTexel: { value: new THREE.Vector2() },
        uRadius: { value: 1 },
        uEdgeDepth: { value: edgeDepth },
        uWeights: { value: edgeWeights },
      },
      vertexShader: POST_VERTEX_SHADER,
      fragmentShader: EDGE_H_FRAGMENT_SHADER,
      depthTest: false,
      depthWrite: false,
      transparent: false,
      blending: THREE.NoBlending,
      toneMapped: false,
    });
    const edgeQuad = new THREE.Mesh(postGeometry, edgeHMaterial);
    edgeScene.add(edgeQuad);

    const compositeMaterial = edgeBlurEnabled
      ? new THREE.ShaderMaterial({
          uniforms: {
            uScene: {
              value: screenTarget?.texture ?? renderTarget.texture,
            },
            uEdgeScene: {
              value: edgeTargetA?.texture ?? renderTarget.texture,
            },
            uEdgeTexel: { value: new THREE.Vector2() },
            uEdgeRadius: { value: 1 },
            uWeights: { value: edgeWeights },
            uEdgeDepth: { value: edgeDepth },
            uEdgeAmount: { value: edgeAmount },
            uEdgeTint: { value: new THREE.Color(0x000000) },
            uEdgeTintStrength: { value: EDGE_BLUR.tintStrength },
            uVignette: { value: 0 },
            uAspect: { value: 1 },
          },
          vertexShader: POST_VERTEX_SHADER,
          fragmentShader: COMPOSITE_FRAGMENT_SHADER,
          depthTest: false,
          depthWrite: false,
          transparent: true,
          premultipliedAlpha: true,
          toneMapped: false,
        })
      : null;
    const compositeScene = new THREE.Scene();
    if (compositeMaterial) {
      compositeScene.add(new THREE.Mesh(postGeometry, compositeMaterial));
    }

    /**
     * The vignette lands in the composite when the edge blur is on, and in the
     * lens pass when it is off (the direct-to-canvas path).
     */
    function setVignette(value: number): void {
      postMaterial.uniforms.uVignette.value = edgeBlurEnabled ? 0 : value;
      if (compositeMaterial) {
        compositeMaterial.uniforms.uVignette.value = value;
      }
    }

    /**
     * The theme surface as a linear THREE.Color. The theme tokens are CSS
     * custom properties (often oklch), so resolve the actual painted colour
     * through a hidden probe and a 2D canvas rather than parsing CSS in JS.
     */
    let tintProbe: HTMLSpanElement | null = null;
    let tintContext: CanvasRenderingContext2D | null = null;

    function readSurfaceTint(): THREE.Color {
      if (!tintProbe) {
        tintProbe = document.createElement("span");
        tintProbe.style.cssText =
          "position:absolute;left:0;top:0;width:0;height:0;visibility:hidden;pointer-events:none;color:var(--surface)";
        document.body.appendChild(tintProbe);
      }
      const css = getComputedStyle(tintProbe).color;

      if (!tintContext) {
        const swatch = document.createElement("canvas");
        swatch.width = 1;
        swatch.height = 1;
        tintContext = swatch.getContext("2d", { willReadFrequently: true });
      }
      const context2d = tintContext;
      if (!context2d) return new THREE.Color(0x000000);

      context2d.clearRect(0, 0, 1, 1);
      context2d.fillStyle = css;
      context2d.fillRect(0, 0, 1, 1);
      const [r, g, b] = context2d.getImageData(0, 0, 1, 1).data;

      return new THREE.Color().setRGB(
        r / 255,
        g / 255,
        b / 255,
        THREE.SRGBColorSpace,
      );
    }

    compositeMaterial?.uniforms.uEdgeTint.value.copy(readSurfaceTint());

    // Theme changes flip data-phase / data-mode / .dark on <html>; keep the
    // tint in step without re-creating the canvas.
    const themeObserver = new MutationObserver(() => {
      compositeMaterial?.uniforms.uEdgeTint.value.copy(readSurfaceTint());
      wake();
    });
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-phase", "data-mode", "class"],
    });

    function renderScene(): void {
      // The lens RT is a wider view of the same scene at the same position, so
      // the viewport part of the target matches the flat view 1:1.
      renderCamera.position.copy(camera.position);
      renderCamera.updateMatrixWorld();
      renderer.setRenderTarget(renderTarget);
      renderer.render(scene, renderCamera);

      if (screenTarget && edgeTargetA && compositeMaterial) {
        // Lens + barrel into a linear screen target.
        renderer.setRenderTarget(screenTarget);
        renderer.render(postScene, postCamera);

        // Horizontal half of the separable blur, at half resolution. The
        // bilinear reads of the screen target also do the 2x2 downsample.
        edgeHMaterial.uniforms.uSource.value = screenTarget.texture;
        renderer.setRenderTarget(edgeTargetA);
        renderer.render(edgeScene, postCamera);

        // The composite finishes the vertical half and the sRGB encode.
        renderer.setRenderTarget(null);
        renderer.render(compositeScene, postCamera);

        return;
      }

      renderer.setRenderTarget(null);
      renderer.render(postScene, postCamera);
    }

    const geometry = new THREE.PlaneGeometry(1, 1);
    const parallaxUniform = { value: new THREE.Vector2() };
    const introZoomUniform: { value: number } = { value: INTRO.zoomFrom };
    const loader = new THREE.TextureLoader();
    const raycaster = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    const corner = new THREE.Vector3();
    const projected = new THREE.Vector3();
    const textures = new Map<string, TextureEntry>();
    const focusTextures = new Map<number, THREE.Texture>();
    const planeByMesh = new Map<THREE.Object3D, Plane>();
    const videoEntries = new Map<number, VideoEntry>();
    const preloaded = new Map<
      string,
      {
        elements: (HTMLVideoElement | HTMLImageElement)[];
        ready: Promise<boolean>;
      }
    >();
    const videoHost = document.createElement("div");
    videoHost.style.cssText =
      "position:absolute;left:0;top:0;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none";
    videoHost.setAttribute("aria-hidden", "true");
    hostElement.appendChild(videoHost);
    const textureStartedAt = performance.now();
    let textureLoadMs: number | null = null;

    let planes: Plane[] = [];
    let cols = 0;
    let rows = 0;
    let baseWidth = 0;
    let cellHeight = 0;
    let finalGap = 0;
    let pitchX = 0;
    let pitchY = 0;
    let halfX = 0;
    let halfY = 0;
    let width = 1;
    let height = 1;
    let hiddenPlane: Plane | null = null;
    /** The clicked tile stays visible (pressed) until the viewer is ready. */
    let loadingIndex: number | null = null;
    /** Guards the async close prep against a reopen or a newer close. */
    let closeRun = 0;
    let disposed = false;
    let raf = 0;
    let last = 0;
    let lastScroll = { x: 0, y: 0 };
    let videoCheckAt = 0;
    let videoUploads = 0;
    let startsFrozen = false;
    let startsSettledAt = 0;
    const videoOff =
      new URLSearchParams(window.location.search).get("video") === "0";
    let resizeFrame = 0;
    let reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    /** -1 while waiting for the posters, then ms since the intro started. */
    let introElapsed = -1;
    let introEndedFlag = false;
    let introCamera: number = INTRO.cameraFromZ;
    let introGap = 0;
    let introGrayValue = 1;
    let introZoomValue: number = INTRO.zoomFrom;
    let introVideos = false;
    let introAnnounced = false;
    let introStartAnnounced = false;
    /** The barrel strength currently drawn; picking uses this same value. */
    let lensBase = 0;
    let lensApplied = 0;
    let lensWanted = 0;
    /** Breathing stays at rest until the canvas has been settled for a beat. */
    let breathIdleSince = 0;
    let breathActive = false;
    let breathLevel = 0;
    let breathAmplitude = 0;
    let breathIdleMs = 0;
    let breathSample = 1;
    /** Pointer hover, sampled once per frame through the inverse lens. */
    let hoverPoint: { x: number; y: number } | null = null;
    let hoverDirty = false;
    let hoverWasAllowed = false;
    let hoveredPlane: Plane | null = null;
    /** The tile the pointer is resting on, waiting out the 200ms intent. */
    let hoverIntentPlane: Plane | null = null;
    let hoverIntentAt = 0;
    /**
     * The keyboard's tile selection. The canvas is one focusable region, so
     * the selection is visual only: the focused plane takes the hover lift,
     * arrows step it, Enter opens it and Escape clears it. A pointer press or
     * pointer move hands the surface back to continuous pan and pointer hover.
     */
    let lastInput: "keyboard" | "pointer" = "pointer";
    let keyboardFocused = false;
    let focusedPlane: Plane | null = null;
    /** The tile a viewer close should focus when the surface takes focus back. */
    let focusCandidate: Plane | null = null;
    /** The 700ms power3.inOut scroll step between adjacent focused tiles. */
    let keyGlide: {
      fromX: number;
      fromY: number;
      toX: number;
      toY: number;
      startedAt: number;
    } | null = null;
    let renderedFrames = 0;
    /** A queued hi-res focus texture upgrade, cancelled on close/unmount. */
    let focusUpgrade: { id: number; idle: boolean } | null = null;
    /** Invalidates an in-flight hi-res image load across close/step. */
    let focusTextureRequest = 0;
    /** The hovered/opened full-res video frame and its texture. */
    const focusVideos = new Map<number, FocusVideoEntry>();
    /** Keep the hovered video's preload entry alive while it is warm. */
    let focusWarmKey: string | null = null;

    const idleTransition = (): CanvasTransition => ({
      phase: "idle",
      startedAt: 0,
      index: -1,
      plane: null,
      target: null,
      fromScrollX: 0,
      fromScrollY: 0,
      toScrollX: 0,
      toScrollY: 0,
      fromCameraZ: CAMERA_Z,
      tileWidth: 0,
      tileHeight: 0,
      restWidth: 0,
      restHeight: 0,
      focusWidth: 0,
      focusHeight: 0,
      handoffAt: -1,
      waitingForViewer: false,
      prepared: false,
      viewerOwned: false,
    });
    let transition = idleTransition();

    const debug: CanvasDebug | null =
      process.env.NODE_ENV === "production"
        ? null
        : {
            mode: "webgl",
            planes: 0,
            drawCalls: 0,
            textures: 0,
            texturesLoaded: 0,
            texturesTotal: 0,
            textureLoadMs: null,
            cameraZ: CAMERA_Z,
            panSpeed: 0,
            introEnded: false,
            introMs: -1,
            gap: INTRO_GAP,
            gray: 1,
            introZoom: INTRO.zoomFrom,
            lens: "flat",
            lensApplied: 0,
            lensTarget: 0,
            rtWidth: 0,
            rtHeight: 0,
            rtSamples: 0,
            edgeBlur: edgeBlurEnabled,
            edgeBlurAmount: edgeAmount,
            edgeBlurRadius: 0,
            edgeBlurDepth: 0,
            rects: [],
            breathActive: false,
            breathAmplitude: 0,
            breathIdleMs: 0,
            breathSample: 1,
            renderedFrames: 0,
            hoverIndex: -1,
            hoverLevel: 0,
            transition: "idle",
            transitionMs: 0,
            waitingForViewer: false,
            prepared: false,
            viewerOwned: false,
            targetWidth: 0,
            targetHeight: 0,
            targetOpacity: 0,
            targetZoom: 1,
            scroll: { x: 0, y: 0 },
            openScroll: null,
            openTarget: null,
            openBase: null,
            openRect: null,
            half: { x: 0, y: 0 },
            dragging: false,
            hidden: false,
            videosPlaying: 0,
            videoEntries: 0,
            videoTextures: 0,
            videoPlanesBound: 0,
            videoUploads: 0,
            focusVideo: null,
            focusTextures: 0,
          };

    if (debug) {
      (window as Window & { __canvasProto?: CanvasDebug }).__canvasProto =
        debug;
    }

    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

    function markLoaded(url: string): void {
      for (const plane of planes) {
        if (plane.textureUrl === url) plane.loaded = true;
      }
    }

    function ensureTexture(url: string): TextureEntry {
      const existing = textures.get(url);
      if (existing) return existing;

      let entry: TextureEntry | null = null;
      const texture = loader.load(
        url,
        () => {
          if (disposed) {
            texture.dispose();
            return;
          }

          if (entry) entry.loaded = true;
          markLoaded(url);
          // Upload every poster as it arrives, not when its plane first flies
          // into view during a drag. Already-uploaded textures are a no-op.
          if (perfEnabled) {
            const endUpload = beginPerf("texture-upload", { url });
            renderer.initTexture(texture);
            endUpload();
          } else {
            renderer.initTexture(texture);
          }

          if (textureLoadMs === null) {
            let loaded = 0;
            for (const texture of textures.values()) {
              if (texture.loaded) loaded += 1;
            }

            if (loaded === textures.size) {
              textureLoadMs = performance.now() - textureStartedAt;
            }
          }

          wake();
        },
        undefined,
        () => {
          if (entry) entry.failed = true;
        },
      );

      texture.colorSpace = THREE.SRGBColorSpace;
      texture.minFilter = THREE.LinearMipmapLinearFilter;
      texture.magFilter = THREE.LinearFilter;
      texture.generateMipmaps = true;
      texture.anisotropy = Math.min(
        4,
        renderer.capabilities.getMaxAnisotropy(),
      );

      entry = { texture, loaded: false, failed: false };
      textures.set(url, entry);

      return entry;
    }

    function applyPosterTexture(itemIndex: number): void {
      const poster = textures.get(
        items[itemIndex] ? textureUrl(items[itemIndex].media) : "",
      );

      for (const plane of planes) {
        if (plane.itemIndex !== itemIndex || !plane.isVideo || !poster) {
          continue;
        }

        plane.material.uniforms.uTexture.value = poster.texture;
        plane.material.uniforms.uDecodeVideo.value = 0;
        plane.loaded = poster.loaded;
      }
    }

    function applyVideoTexture(itemIndex: number, entry: VideoEntry): void {
      if (!entry.texture) return;

      for (const plane of planes) {
        if (plane.itemIndex !== itemIndex || !plane.isVideo) continue;

        // Keep the glide's chosen focus texture; the 480p fallback takes over
        // at open-ready only when the full-res warm frame is not available.
        if (
          transition.phase === "opening" &&
          !transition.viewerOwned &&
          transition.index === itemIndex
        ) {
          continue;
        }

        plane.material.uniforms.uTexture.value = entry.texture;
        plane.material.uniforms.uDecodeVideo.value = 1;
        plane.loaded = true;
      }

      if (perfEnabled) {
        markPerf("video-texture-swap", {
          index: itemIndex,
          src: entry.element.currentSrc,
        });
      }

      entry.bound = true;
    }

    /** Last-resort fill when neither the warm focus nor the 480p is ready. */
    function applyPosterToPlane(plane: Plane): void {
      const media = items[plane.itemIndex]?.media;
      if (!media || media.kind !== "video") return;

      const poster = textures.get(textureUrl(media));
      if (!poster) return;

      plane.material.uniforms.uTexture.value = poster.texture;
      plane.material.uniforms.uDecodeVideo.value = 0;
      plane.loaded = poster.loaded;
      if (perfEnabled) {
        markPerf("poster-swap", {
          index: plane.itemIndex,
          width: media.width,
          height: media.height,
        });
      }
    }

    function bindPlaneTexture(plane: Plane, texture: THREE.Texture): void {
      plane.material.uniforms.uTexture.value = texture;
      plane.material.uniforms.uDecodeVideo.value = 1;
      plane.loaded = true;
    }

    function cancelFocusUpload(entry: FocusVideoEntry): void {
      if (!entry.upload) return;
      if (entry.upload.idle) window.cancelIdleCallback?.(entry.upload.id);
      else window.clearTimeout(entry.upload.id);
      entry.upload = null;
    }

    function cancelFocusFrame(entry: FocusVideoEntry): void {
      if (entry.frameRequest === null) return;
      entry.element.cancelVideoFrameCallback?.(entry.frameRequest);
      entry.frameRequest = null;
    }

    function disposeFocusVideo(index: number): void {
      const entry = focusVideos.get(index);
      if (!entry) return;

      cancelFocusUpload(entry);
      window.clearTimeout(entry.seekTimer);
      cancelFocusFrame(entry);
      entry.element.pause();
      entry.texture.dispose();
      focusVideos.delete(index);
    }

    /**
     * The viewer owns the slides now: drop the full-res decoder, its texture
     * and the warm preload source. The grid tile has already been rebound.
     */
    function releaseFocusVideo(index: number): void {
      const entry = focusVideos.get(index);
      if (!entry) return;

      const media = items[index]?.media;
      disposeFocusVideo(index);

      if (!media || media.kind !== "video") return;
      const key = `video:${media.id}`;
      const preload = preloaded.get(key);
      if (preload) {
        preloaded.delete(key);
        cancelPreload(preload);
      }
      if (focusWarmKey === key) focusWarmKey = null;
    }

    function scheduleFocusFrame(entry: FocusVideoEntry, index: number): void {
      if (entry.frameRequest !== null) return;
      if (typeof entry.element.requestVideoFrameCallback !== "function") {
        return;
      }

      entry.frameRequest = entry.element.requestVideoFrameCallback(() => {
        entry.frameRequest = null;
        if (disposed || focusVideos.get(index) !== entry || !entry.playing) {
          return;
        }

        const now = performance.now();
        if (now - entry.lastUpload >= 30) {
          entry.lastUpload = now;
          entry.texture.needsUpdate = true;
          wake();
        }

        scheduleFocusFrame(entry, index);
      });
    }

    function scheduleFocusWarmUpload(
      entry: FocusVideoEntry,
      index: number,
    ): void {
      if (entry.upload) return;

      const run = () => {
        entry.upload = null;
        if (disposed || focusVideos.get(index) !== entry) return;
        if (entry.element.readyState < 2) return;

        const endUpload = beginPerf("focus-video-warm", {
          index,
          width: entry.element.videoWidth,
          height: entry.element.videoHeight,
          at: Number(entry.element.currentTime.toFixed(2)),
        });
        const startedAt = performance.now();
        entry.texture.needsUpdate = true;
        renderer.initTexture(entry.texture);
        entry.warmMs = performance.now() - startedAt;
        entry.warmAt = entry.element.currentTime;
        entry.ready = true;
        entry.lastUpload = performance.now();
        endUpload();

        markPerf("focus-video-warm-ready", {
          index,
          width: entry.element.videoWidth,
          height: entry.element.videoHeight,
          phase: transition.phase,
        });

        // The open may already be running if the hover/pointerdown warm was
        // late. Bind the frame when it lands; the 480p stayed until now.
        if (
          (transition.phase === "opening" || transition.phase === "open") &&
          transition.index === index &&
          !transition.viewerOwned
        ) {
          applyFocusVideoTexture(index, entry);
        }
        if (transition.phase === "open" && transition.index === index) {
          startFocusVideo(entry, index);
        }
      };

      if (typeof window.requestIdleCallback === "function") {
        entry.upload = {
          id: window.requestIdleCallback(run, { timeout: 90 }),
          idle: true,
        };
      } else {
        entry.upload = { id: window.setTimeout(run, 0), idle: false };
      }
    }

    function scheduleFocusWarmSeek(
      entry: FocusVideoEntry,
      index: number,
    ): void {
      const grid = videoEntries.get(index);
      const gridTime = grid?.element.currentTime;
      const seekTo =
        gridTime !== undefined && Number.isFinite(gridTime)
          ? gridTime
          : entry.element.currentTime;

      window.clearTimeout(entry.seekTimer);

      if (
        entry.element.readyState >= 2 &&
        Math.abs(entry.element.currentTime - seekTo) < 0.04
      ) {
        scheduleFocusWarmUpload(entry, index);
        return;
      }

      const onSeeked = () => {
        entry.element.removeEventListener("seeked", onSeeked);
        scheduleFocusWarmUpload(entry, index);
      };

      entry.element.addEventListener("seeked", onSeeked, { once: true });
      try {
        entry.element.currentTime = seekTo;
      } catch {
        onSeeked();
        return;
      }

      // A paused seek can miss its event on a partially buffered clip.
      entry.seekTimer = window.setTimeout(() => {
        entry.element.removeEventListener("seeked", onSeeked);
        if (entry.element.readyState >= 2) {
          scheduleFocusWarmUpload(entry, index);
        }
      }, 300);
    }

    function warmFocusVideo(index: number): void {
      const media = items[index]?.media;
      if (!media || media.kind !== "video" || videoOff) return;

      const key = `video:${media.id}`;
      focusWarmKey = key;

      for (const [otherIndex] of focusVideos) {
        if (otherIndex !== index) disposeFocusVideo(otherIndex);
      }

      const existing = focusVideos.get(index);
      if (existing) {
        if (!existing.playing) scheduleFocusWarmSeek(existing, index);
        return;
      }

      const preload = preloaded.get(key);
      if (!preload) {
        void preloadItem(index).then((ok) => {
          if (ok) warmFocusVideo(index);
        });
        return;
      }

      const element = preload.elements[0];
      if (!(element instanceof HTMLVideoElement)) return;

      // The grid entries set these before creating their texture; a video
      // element left at 0x0 layout can upload a black WebGL frame.
      if (element.videoWidth > 0) {
        element.width = element.videoWidth;
        element.height = element.videoHeight;
      }
      element.addEventListener(
        "loadedmetadata",
        () => {
          element.width = element.videoWidth;
          element.height = element.videoHeight;
        },
        { once: true },
      );

      const texture = new THREE.Texture(element);
      texture.colorSpace = THREE.NoColorSpace;
      texture.minFilter = THREE.LinearFilter;
      texture.magFilter = THREE.LinearFilter;
      texture.generateMipmaps = false;

      const entry: FocusVideoEntry = {
        index,
        element,
        texture,
        ready: false,
        playing: false,
        lastUpload: 0,
        frameRequest: null,
        seekTimer: 0,
        upload: null,
        warmMs: null,
        warmAt: 0,
      };
      focusVideos.set(index, entry);

      void preload.ready.then((ok) => {
        if (!ok || disposed || focusVideos.get(index) !== entry) return;
        scheduleFocusWarmSeek(entry, index);
      });

      if (element.readyState >= 2) scheduleFocusWarmSeek(entry, index);
    }

    function applyFocusVideoTexture(
      index: number,
      entry: FocusVideoEntry,
    ): void {
      if (transition.phase !== "opening" && transition.phase !== "open") {
        return;
      }
      if (
        transition.viewerOwned ||
        transition.index !== index ||
        !transition.plane
      ) {
        return;
      }

      bindPlaneTexture(transition.plane, entry.texture);
      markPerf("focus-video-swap", {
        index,
        width: entry.element.videoWidth,
        height: entry.element.videoHeight,
        at: Number(entry.element.currentTime.toFixed(2)),
        phase: transition.phase,
      });
      renderScene();
      updateDebug();
    }

    function startFocusVideo(entry: FocusVideoEntry, index: number): void {
      if (!entry.ready || entry.playing) {
        if (entry.playing) scheduleFocusFrame(entry, index);
        return;
      }

      entry.playing = true;
      entry.lastUpload = performance.now();
      entry.element.muted = true;
      entry.element.loop = true;
      entry.element.playsInline = true;

      // The full-res focus owns the plane; stop the 480p grid decoder.
      const grid = videoEntries.get(index);
      if (grid && !grid.element.paused) {
        grid.element.pause();
        grid.playing = false;
      }

      void entry.element.play().catch(() => {
        entry.playing = false;
      });
      scheduleFocusFrame(entry, index);
      wake();
    }

    function pauseFocusVideo(index: number): void {
      const entry = focusVideos.get(index);
      if (!entry) return;
      entry.playing = false;
      entry.element.pause();
      cancelFocusFrame(entry);
    }

    /**
     * Progressive image upgrade: the tile texture is already on screen. Load
     * the smallest source that covers the focused plane's device pixels.
     */
    function upgradeFocusTexture(index: number): void {
      const media = items[index]?.media;
      if (!media || media.kind !== "image") return;
      if (transition.phase !== "open" || transition.index !== index) return;

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const neededWidth = Math.round(transition.focusWidth * dpr);
      const loadedWidth = imageTextureSource(media).width;

      if (neededWidth <= loadedWidth) {
        markPerf("hi-res-skip", {
          index,
          dpr,
          neededWidth,
          loadedWidth,
          reason: "covered",
        });
        return;
      }

      const existing = focusTextures.get(index);
      if (existing) {
        applyFocusTexture(index, existing);
        return;
      }

      const picked = pickFocusImage(media, neededWidth);
      if (!picked) return;
      const { primary, fallback } = picked;

      // No source beats the tile texture; re-uploading it is pure cost.
      if (primary.width <= loadedWidth) {
        markPerf("hi-res-skip", {
          index,
          dpr,
          neededWidth,
          loadedWidth,
          reason: "no-larger-source",
        });
        return;
      }

      markPerf("hi-res-load", {
        index,
        dpr,
        neededWidth,
        loadedWidth,
        width: primary.width,
        format: primary.format,
        fallback: fallback?.format,
        fallbackWidth: fallback?.width,
        url: primary.url,
      });

      const request = ++focusTextureRequest;
      const loadSource = (
        source: ImageMedia["sources"][number],
        next: ImageMedia["sources"][number] | null,
      ): void => {
        const texture = loader.load(
          source.url,
          () => {
            if (
              disposed ||
              request !== focusTextureRequest ||
              transition.phase !== "open" ||
              transition.viewerOwned ||
              transition.index !== index
            ) {
              texture.dispose();
              return;
            }

            texture.colorSpace = THREE.SRGBColorSpace;
            texture.minFilter = THREE.LinearMipmapLinearFilter;
            texture.magFilter = THREE.LinearFilter;
            texture.generateMipmaps = true;
            texture.anisotropy = Math.min(
              4,
              renderer.capabilities.getMaxAnisotropy(),
            );

            // Upload once, after the motion, then swap the focused plane.
            if (perfEnabled) {
              const endUpload = beginPerf("texture-upload", {
                url: source.url,
                stage: "hi-res",
                format: source.format,
              });
              renderer.initTexture(texture);
              endUpload();
            } else {
              renderer.initTexture(texture);
            }
            focusTextures.set(index, texture);
            applyFocusTexture(index, texture);
          },
          undefined,
          () => {
            texture.dispose();
            if (request !== focusTextureRequest) return;
            if (next && next.url !== source.url) {
              markPerf("hi-res-fallback", {
                index,
                from: source.format,
                to: next.format,
                width: next.width,
              });
              loadSource(next, null);
              return;
            }
            markPerf("hi-res-error", {
              index,
              url: source.url,
            });
          },
        );
      };

      loadSource(primary, fallback);
    }

    function cancelFocusUpgrade(): void {
      focusTextureRequest += 1;
      if (!focusUpgrade) return;
      if (focusUpgrade.idle) window.cancelIdleCallback?.(focusUpgrade.id);
      else window.clearTimeout(focusUpgrade.id);
      focusUpgrade = null;
    }

    /**
     * Queue the hi-res upgrade for browser idle time, after the chrome has
     * settled. The timeout keeps it from being starved on a busy page; Safari
     * without requestIdleCallback falls back to the old fixed delay.
     */
    function scheduleFocusUpgrade(index: number): void {
      cancelFocusUpgrade();

      const run = () => {
        focusUpgrade = null;
        upgradeFocusTexture(index);
      };

      if (typeof window.requestIdleCallback === "function") {
        focusUpgrade = {
          id: window.requestIdleCallback(run, { timeout: 1200 }),
          idle: true,
        };
      } else {
        focusUpgrade = { id: window.setTimeout(run, 250), idle: false };
      }
    }

    function applyFocusTexture(index: number, texture: THREE.Texture): void {
      if (
        transition.phase !== "open" ||
        transition.viewerOwned ||
        transition.index !== index ||
        !transition.plane
      ) {
        return;
      }

      transition.plane.material.uniforms.uTexture.value = texture;
      transition.plane.material.uniforms.uDecodeVideo.value = 0;
      transition.plane.loaded = true;
      if (perfEnabled) markPerf("hi-res-swap", { index });
      renderScene();
      updateDebug();
    }

    function disposeFocusTexture(index: number): void {
      const texture = focusTextures.get(index);
      if (!texture) return;

      focusTextures.delete(index);
      texture.dispose();
    }

    function restoreVideoTexture(index: number): void {
      const media = items[index]?.media;
      if (!media || media.kind !== "video") return;

      const entry = videoEntries.get(index);
      if (entry?.texture) applyVideoTexture(index, entry);
      else applyPosterTexture(index);
    }

    /** Put the tile's normal grid texture back on every copy of an item. */
    function restoreGridTexture(index: number): void {
      const media = items[index]?.media;
      if (!media) return;

      if (media.kind === "video") {
        restoreVideoTexture(index);
        return;
      }

      for (const plane of planes) {
        if (plane.itemIndex !== index) continue;
        const entry = textures.get(plane.textureUrl);
        if (!entry) continue;

        plane.material.uniforms.uTexture.value = entry.texture;
        plane.material.uniforms.uDecodeVideo.value = 0;
        plane.loaded = entry.loaded;
      }
    }

    /** The canvas-owned viewer is showing a video on the focused plane. */
    function openVideoIsLive(): boolean {
      if (transition.phase !== "open" || transition.viewerOwned) return false;

      const media =
        transition.index >= 0 ? items[transition.index]?.media : undefined;
      return media?.kind === "video";
    }

    /** The motion landed: swap the 480p fallback for the live full-res clip. */
    function resumeOpenVideo(index: number): void {
      const media = items[index]?.media;
      if (!media || media.kind !== "video") return;

      const focus = focusVideos.get(index);
      if (focus?.ready) {
        applyFocusVideoTexture(index, focus);
        startFocusVideo(focus, index);

        const grid = videoEntries.get(index);
        if (grid && !grid.element.paused) {
          grid.element.pause();
          grid.playing = false;
        }

        markPerf("open-video-live", {
          index,
          source: "focus",
          width: focus.element.videoWidth,
          height: focus.element.videoHeight,
          at: Number(focus.element.currentTime.toFixed(2)),
        });
        wake();
        return;
      }

      const entry = videoEntries.get(index) ?? ensureVideoEntry(index);
      if (!entry) return;

      if (entry.ready) applyVideoTexture(index, entry);

      startVideo(entry);
      markPerf("open-video-live", {
        index,
        source: "canvas",
        ready: entry.ready,
        paused: entry.element.paused,
      });
      wake();
    }

    function disposeVideoEntry(itemIndex: number): void {
      const entry = videoEntries.get(itemIndex);
      if (!entry) return;

      entry.element.pause();

      if (
        entry.frameRequest !== null &&
        typeof entry.element.cancelVideoFrameCallback === "function"
      ) {
        entry.element.cancelVideoFrameCallback(entry.frameRequest);
        entry.frameRequest = null;
      }

      entry.element.removeAttribute("src");
      entry.element.load();
      entry.element.remove();
      entry.texture?.dispose();
      videoEntries.delete(itemIndex);
      applyPosterTexture(itemIndex);
    }

    function pauseAllVideos(): void {
      for (const entry of videoEntries.values()) {
        if (!entry.element.paused) entry.element.pause();
        entry.playing = false;
      }

      updateDebug();
    }

    function hasPlayingVideos(): boolean {
      for (const entry of videoEntries.values()) {
        if (entry.playing || !entry.element.paused) return true;
      }

      return false;
    }

    function startVideo(entry: VideoEntry): void {
      if (!entry.element.paused) return;

      if (perfEnabled) {
        const endPlay = beginPerf("video-play", {
          src: entry.element.currentSrc,
          tile: true,
        });
        void entry.element.play().then(
          () => endPlay({ ok: true }),
          () => {
            entry.failed = true;
            entry.playing = false;
            endPlay({ ok: false });
          },
        );
        return;
      }

      void entry.element.play().catch(() => {
        entry.failed = true;
        entry.playing = false;
      });
    }

    /** Browsers without requestVideoFrameCallback upload on a 33ms cadence. */
    function updateVideoFallback(now: number): void {
      for (const [itemIndex, entry] of videoEntries) {
        if (!entry.texture || entry.texture.needsUpdate) continue;
        if (entry.element.paused) continue;
        if (typeof entry.element.requestVideoFrameCallback === "function") {
          continue;
        }
        if (now - entry.lastUpload < 33) continue;

        entry.lastUpload = now;
        entry.texture.needsUpdate = true;
        if (!entry.bound) applyVideoTexture(itemIndex, entry);
      }

      for (const entry of focusVideos.values()) {
        if (entry.element.paused || !entry.playing) continue;
        if (typeof entry.element.requestVideoFrameCallback === "function") {
          continue;
        }
        if (now - entry.lastUpload < 33) continue;

        entry.lastUpload = now;
        entry.texture.needsUpdate = true;
      }
    }

    function ensureVideoEntry(itemIndex: number): VideoEntry | null {
      const existing = videoEntries.get(itemIndex);
      if (existing) return existing;
      if (videoOff) return null;

      const media = items[itemIndex]?.media;
      if (!media || media.kind !== "video") return null;

      const element = document.createElement("video");
      element.muted = true;
      element.loop = true;
      element.playsInline = true;
      element.crossOrigin = "anonymous";
      element.preload = "auto";
      element.src = (media.canvas ?? media.mp4).url;
      element.setAttribute("aria-hidden", "true");
      element.setAttribute("playsinline", "");
      videoHost.appendChild(element);

      const entry: VideoEntry = {
        element,
        texture: null,
        ready: false,
        playing: false,
        failed: false,
        bound: false,
        lastUpload: 0,
        frameRequest: null,
      };
      videoEntries.set(itemIndex, entry);

      const scheduleFrame = () => {
        if (entry.frameRequest !== null) return;
        if (typeof element.requestVideoFrameCallback !== "function") return;

        entry.frameRequest = element.requestVideoFrameCallback(() => {
          entry.frameRequest = null;
          if (disposed || videoEntries.get(itemIndex) !== entry) return;

          if (entry.texture && performance.now() - entry.lastUpload >= 30) {
            entry.lastUpload = performance.now();
            entry.texture.needsUpdate = true;
            if (!entry.bound) applyVideoTexture(itemIndex, entry);
            wake();
          }

          scheduleFrame();
        });
      };

      const markReady = () => {
        if (
          disposed ||
          entry.failed ||
          entry.texture ||
          element.readyState < 2 ||
          videoEntries.get(itemIndex) !== entry
        ) {
          return;
        }

        // A plain Texture (not VideoTexture) uploads only when needsUpdate is
        // set. Three allocates from width/height, so mirror the intrinsic size.
        element.width = element.videoWidth;
        element.height = element.videoHeight;

        const texture = new THREE.Texture(element);
        // Source frames are sRGB. The upload stays RGBA8 and the shader
        // decodes manually (uDecodeVideo), so the colors are not encoded twice.
        texture.colorSpace = THREE.NoColorSpace;
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;
        texture.generateMipmaps = false;
        texture.needsUpdate = true;
        texture.onUpdate = () => {
          videoUploads += 1;
          if (debug) debug.videoUploads = videoUploads;
        };

        entry.texture = texture;
        entry.lastUpload = performance.now();
        entry.ready = true;
        scheduleFrame();
        wake();
      };

      element.addEventListener("loadedmetadata", () => {
        element.width = element.videoWidth;
        element.height = element.videoHeight;
      });
      element.addEventListener("loadeddata", markReady);
      element.addEventListener("canplay", markReady);
      element.addEventListener("seeked", () => {
        if (!entry.texture) return;

        entry.texture.needsUpdate = true;
        entry.lastUpload = performance.now();
        wake();
      });
      element.addEventListener("playing", () => {
        entry.playing = true;
        scheduleFrame();
        wake();
      });
      element.addEventListener("pause", () => {
        entry.playing = false;
      });
      element.addEventListener("error", () => {
        entry.failed = true;
        entry.playing = false;
      });

      return entry;
    }

    function syncVideos(now: number): boolean {
      if (videoOff || document.hidden) {
        pauseAllVideos();
        return false;
      }

      if (pausedRef.current) {
        // The canvas-owned open keeps the clicked clip live through the glide
        // so no decoder restarts on the landing frame.
        if (transition.phase === "opening" && !transition.viewerOwned) {
          return false;
        }

        // The landed open shows one video on the focused plane. The full-res
        // warm focus owns it when ready; otherwise the 480p decoder falls back.
        if (openVideoIsLive()) {
          const focus = focusVideos.get(transition.index);
          if (focus?.ready) {
            for (const entry of videoEntries.values()) {
              if (!entry.element.paused) {
                entry.element.pause();
                entry.playing = false;
              }
            }
            startFocusVideo(focus, transition.index);
            return true;
          }

          for (const [itemIndex, entry] of videoEntries) {
            if (itemIndex !== transition.index && !entry.element.paused) {
              entry.element.pause();
            }
          }

          const entry = videoEntries.get(transition.index);
          if (entry && !entry.failed) {
            startVideo(entry);
            return true;
          }
        }

        pauseAllVideos();
        for (const [index] of focusVideos) pauseFocusVideo(index);
        return false;
      }

      // Posters lead the intro; videos join once the last opacity tween has
      // finished (or the reduced-motion fade).
      if (!introVideos) {
        if (videoEntries.size > 0) pauseAllVideos();
        return false;
      }

      // Only leaving the viewport plus margin pauses a video. During the open
      // transition the clicked clip keeps playing; the rest pause once faded.
      if (transition.phase === "opening") {
        if (now - transition.startedAt >= TRANSITION.fadeOutMs) {
          for (const [itemIndex, entry] of videoEntries) {
            if (itemIndex !== transition.index && !entry.element.paused) {
              entry.element.pause();
            }
          }
        }

        return hasPlayingVideos();
      }

      if (now - videoCheckAt < VIDEO_TUNING.checkMs) {
        return hasPlayingVideos();
      }

      videoCheckAt = now;

      const scale = CAMERA_Z / camera.position.z;
      const margin = VIDEO_TUNING.margin;
      const candidates = new Map<number, number>();

      for (const plane of planes) {
        if (!plane.isVideo || !plane.mesh.visible || plane.opacity < 0.05) {
          continue;
        }

        const centreX = width / 2 + plane.mesh.position.x * scale;
        const centreY = height / 2 - plane.mesh.position.y * scale;
        const halfWidth = (plane.mesh.scale.x * scale) / 2;
        const halfHeight = (plane.mesh.scale.y * scale) / 2;

        if (
          centreX + halfWidth < -margin ||
          centreX - halfWidth > width + margin ||
          centreY + halfHeight < -margin ||
          centreY - halfHeight > height + margin
        ) {
          continue;
        }

        const distance = Math.hypot(centreX - width / 2, centreY - height / 2);
        const previous = candidates.get(plane.itemIndex);

        if (previous === undefined || distance < previous) {
          candidates.set(plane.itemIndex, distance);
        }
      }

      const sorted = [...candidates.entries()].sort((a, b) => a[1] - b[1]);
      const mobile = width < 768;
      const maxPlaying = mobile
        ? VIDEO_TUNING.mobilePlaying
        : VIDEO_TUNING.desktopPlaying;

      // Leaving the viewport plus margin is the only reason a playing video
      // stops. Everything still visible stays in the set, even when a drag
      // brings new planes in.
      const kept = new Set(candidates.keys());

      for (const itemIndex of [...videoEntries.keys()]) {
        if (!kept.has(itemIndex)) disposeVideoEntry(itemIndex);
      }

      // Create at most one new element per check, nearest the centre first.
      for (const [itemIndex] of sorted) {
        if (!videoEntries.has(itemIndex)) {
          ensureVideoEntry(itemIndex);
          break;
        }
      }

      let active = 0;
      for (const entry of videoEntries.values()) {
        if (entry.playing || !entry.element.paused) active += 1;
      }

      const speed = panSpeed();
      const fast =
        panIsDragging() || speed > VIDEO_TUNING.startFreezeEnterSpeed;

      if (fast) {
        startsSettledAt = 0;
        startsFrozen = true;
      } else if (startsFrozen) {
        if (speed > VIDEO_TUNING.startFreezeExitSpeed) {
          startsSettledAt = 0;
        } else if (startsSettledAt === 0) {
          startsSettledAt = now;
        } else if (now - startsSettledAt >= VIDEO_TUNING.startFreezeSettleMs) {
          startsFrozen = false;
        }
      }

      // At most one new decoder per check, nearest the centre first. If the
      // cap is full the entry waits for a plane to leave rather than pausing
      // one that is already playing.
      if (active < maxPlaying && !startsFrozen) {
        for (const [itemIndex] of sorted) {
          const entry = videoEntries.get(itemIndex);
          if (!entry || entry.failed || !entry.element.paused) continue;

          startVideo(entry);
          break;
        }
      }

      return hasPlayingVideos();
    }

    function disposePlanes(): void {
      for (const plane of planes) {
        scene.remove(plane.mesh);
        planeByMesh.delete(plane.mesh);
        plane.material.dispose();
      }

      planes = [];
      hiddenPlane = null;
    }

    function buildPlanes(): void {
      disposePlanes();
      hoveredPlane = null;
      hoverDirty = true;
      setHoverCursor(false);

      const grid = gridMetrics(width, height);
      baseWidth = grid.baseWidth;
      cellHeight = grid.cellHeight;
      finalGap = grid.gap;
      cols = grid.cols;
      rows = grid.rows;

      const gap = INTRO_GAP + (finalGap - INTRO_GAP) * introGap;
      pitchX = baseWidth + gap;
      pitchY = cellHeight + gap;
      halfX = (cols * pitchX) / 2;
      halfY = (rows * pitchY) / 2;

      const urls = items.map((item) => textureUrl(item.media));
      const layout = clusterLayout(
        items.map((item) => item.project),
        cols,
        rows,
        width / grid.pitchX,
        height / grid.pitchY,
      );

      for (let row = 0; row < rows; row += 1) {
        for (let col = 0; col < cols; col += 1) {
          const cellIndex = row * cols + col;
          const itemIndex = layout.items[cellIndex];
          const media = items[itemIndex].media;
          const aspect = media.width / Math.max(1, media.height);
          const planeWidth = baseWidth;
          const planeHeight = baseWidth * orientationRatio(aspect);
          const url = urls[itemIndex];
          const entry = ensureTexture(url);
          const videoEntry = videoEntries.get(itemIndex);
          const videoTexture =
            videoEntry?.ready && videoEntry.bound ? videoEntry.texture : null;
          const loaded = Boolean(videoTexture || entry.loaded);
          const opacity = loaded && introEndedFlag ? 1 : 0;
          const opacityDelay =
            INTRO.opacityDelayMinMs +
            ((col * 73 + row * 37 + itemIndex * 19) %
              (INTRO.opacityDelayMaxMs - INTRO.opacityDelayMinMs + 1));

          const material = new THREE.ShaderMaterial({
            uniforms: {
              uTexture: { value: videoTexture ?? entry.texture },
              uImageSizes: {
                value: new THREE.Vector2(media.width, media.height),
              },
              uPlaneSizes: {
                value: new THREE.Vector2(planeWidth, planeHeight),
              },
              uParallax: parallaxUniform,
              uZoom: { value: TEXTURE_ZOOM },
              uZoomFactor: introZoomUniform,
              // Per-plane: each tile starts its colour reveal on its own
              // opacity delay, not one global grayscale clock.
              uGray: { value: 1 },
              uOpacity: { value: opacity },
              uDecodeVideo: { value: videoTexture ? 1 : 0 },
            },
            vertexShader: VERTEX_SHADER,
            fragmentShader: FRAGMENT_SHADER,
            transparent: true,
            premultipliedAlpha: true,
            depthTest: false,
            depthWrite: false,
            toneMapped: false,
          });

          const baseX = (col - (cols - 1) / 2) * pitchX;
          const baseY = (row - (rows - 1) / 2) * pitchY;
          const mesh = new THREE.Mesh(geometry, material);
          mesh.scale.set(planeWidth, planeHeight, 1);
          mesh.position.set(baseX, -baseY, 0);
          mesh.frustumCulled = true;
          scene.add(mesh);

          const plane: Plane = {
            mesh,
            material,
            itemIndex,
            col,
            row,
            opacityDelay,
            baseX,
            baseY,
            tileWidth: planeWidth,
            tileHeight: planeHeight,
            hover: { from: 0, to: 0, startedAt: 0, durationMs: 0 },
            hoverLevel: 0,
            textureUrl: url,
            isVideo: media.kind === "video",
            loaded,
            opacity,
          };

          planes.push(plane);
          planeByMesh.set(mesh, plane);
        }
      }
    }

    function updateDebug(): void {
      if (!debug) return;

      let loadedTextures = 0;
      for (const texture of textures.values()) {
        if (texture.loaded) loadedTextures += 1;
      }

      debug.planes = planes.length;
      debug.drawCalls = renderer.info.render.calls;
      debug.textures = renderer.info.memory.textures;
      debug.texturesLoaded = loadedTextures;
      debug.texturesTotal = textures.size;
      debug.textureLoadMs = textureLoadMs;
      debug.cameraZ = camera.position.z;
      debug.panSpeed = Number(panSpeed().toFixed(2));
      debug.introEnded = introEndedFlag;
      debug.introMs = Math.round(introElapsed);
      debug.gap = Number(pitchX ? (pitchX - baseWidth).toFixed(1) : INTRO_GAP);
      debug.gray = Number(introGrayValue.toFixed(3));
      debug.introZoom = Number(introZoomValue.toFixed(3));
      debug.lens = lensRef.current.mode;
      debug.lensApplied = Number(lensApplied.toFixed(3));
      debug.lensTarget = Number(lensWanted.toFixed(3));
      debug.rtWidth = renderTarget.width;
      debug.rtHeight = renderTarget.height;
      debug.rtSamples = renderTarget.samples;
      debug.edgeBlur = edgeBlurEnabled;
      debug.edgeBlurAmount = Number(edgeAmount.toFixed(3));
      debug.edgeBlurRadius = Number(
        (compositeMaterial?.uniforms.uEdgeRadius.value ?? 0).toFixed(2),
      );
      debug.edgeBlurDepth = Number(edgeDepth.x.toFixed(4));
      debug.rects = planes
        .filter((plane) => plane.mesh.visible && plane.opacity > 0.5)
        .map((plane) => {
          const rect = projectPlaneWarped(plane);

          return {
            index: plane.itemIndex,
            id: items[plane.itemIndex]?.media.id ?? "",
            left: Number(rect.left.toFixed(1)),
            top: Number(rect.top.toFixed(1)),
            width: Number(rect.width.toFixed(1)),
            height: Number(rect.height.toFixed(1)),
          };
        });
      debug.breathActive = breathActive;
      debug.breathAmplitude = Number(breathAmplitude.toFixed(4));
      debug.breathIdleMs = Math.round(breathIdleMs);
      debug.breathSample = Number(breathSample.toFixed(6));
      debug.renderedFrames = renderedFrames;
      debug.hoverIndex = hoveredPlane ? hoveredPlane.itemIndex : -1;
      debug.hoverLevel = hoveredPlane
        ? Number(hoveredPlane.hoverLevel.toFixed(3))
        : 0;
      debug.transition = transition.phase;
      debug.transitionMs =
        transition.phase === "idle"
          ? 0
          : Math.round(performance.now() - transition.startedAt);
      debug.waitingForViewer = transition.waitingForViewer;
      debug.prepared = transition.prepared;
      debug.viewerOwned = transition.viewerOwned;

      const target = transition.target ?? transition.plane;
      debug.targetWidth = target ? Number(target.mesh.scale.x.toFixed(1)) : 0;
      debug.targetHeight = target ? Number(target.mesh.scale.y.toFixed(1)) : 0;
      debug.targetOpacity = target ? Number(target.opacity.toFixed(3)) : 0;
      debug.targetZoom = target
        ? Number(target.material.uniforms.uZoom.value.toFixed(3))
        : 1;
      debug.scroll.x = scrollRef.current.x;
      debug.scroll.y = scrollRef.current.y;
      debug.half.x = halfX;
      debug.half.y = halfY;

      const opened = transition.phase === "idle" ? null : transition.plane;
      debug.openScroll =
        transition.phase === "idle"
          ? null
          : { x: transition.fromScrollX, y: transition.fromScrollY };
      debug.openTarget =
        transition.phase === "idle"
          ? null
          : { x: transition.toScrollX, y: transition.toScrollY };
      debug.openBase = opened ? { x: opened.baseX, y: opened.baseY } : null;
      debug.openRect = opened ? projectPlaneWarped(opened) : null;
      debug.dragging = panIsDragging();
      debug.hidden = hiddenPlane !== null;
      debug.videoEntries = videoEntries.size;

      let playingVideos = 0;
      let videoTextures = 0;
      for (const video of videoEntries.values()) {
        if (video.playing) playingVideos += 1;
        if (video.texture) videoTextures += 1;
      }

      debug.videosPlaying = playingVideos;
      debug.videoTextures = videoTextures;
      debug.videoUploads = videoUploads;
      debug.videoPlanesBound = planes.filter((plane) => {
        const video = videoEntries.get(plane.itemIndex);
        return Boolean(
          video?.texture &&
          plane.material.uniforms.uTexture.value === video.texture,
        );
      }).length;

      const focusEntry = focusVideos.values().next().value as
        FocusVideoEntry | undefined;
      debug.focusVideo = focusEntry
        ? {
            index: focusEntry.index,
            ready: focusEntry.ready,
            playing: focusEntry.playing,
            width: focusEntry.element.videoWidth,
            height: focusEntry.element.videoHeight,
            warmMs:
              focusEntry.warmMs === null
                ? null
                : Number(focusEntry.warmMs.toFixed(2)),
            warmAt: Number(focusEntry.warmAt.toFixed(2)),
            currentTime: Number(focusEntry.element.currentTime.toFixed(2)),
            bound: Boolean(
              transition.plane &&
              transition.plane.material.uniforms.uTexture.value ===
                focusEntry.texture,
            ),
            version: focusEntry.texture.version,
            src: focusEntry.element.currentSrc.split("/").slice(-1)[0] ?? "",
          }
        : null;
      debug.focusTextures = focusTextures.size;
    }

    function projectPlane(plane: Plane): Box {
      camera.updateMatrixWorld();
      plane.mesh.updateMatrixWorld();

      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;

      for (const [x, y] of [
        [-0.5, -0.5],
        [0.5, -0.5],
        [-0.5, 0.5],
        [0.5, 0.5],
      ]) {
        corner.set(x, y, 0);
        plane.mesh.localToWorld(corner);
        projected.copy(corner).project(camera);

        const screenX = (projected.x * 0.5 + 0.5) * width;
        const screenY = (-projected.y * 0.5 + 0.5) * height;

        minX = Math.min(minX, screenX);
        minY = Math.min(minY, screenY);
        maxX = Math.max(maxX, screenX);
        maxY = Math.max(maxY, screenY);
      }

      return {
        left: minX,
        top: minY,
        width: maxX - minX,
        height: maxY - minY,
      };
    }

    function rectForIndex(index: number): Box | null {
      if (hiddenPlane && hiddenPlane.itemIndex === index) {
        return projectPlane(hiddenPlane);
      }

      let best: Box | null = null;
      let bestArea = 0;

      for (const plane of planes) {
        if (
          plane.itemIndex !== index ||
          !plane.mesh.visible ||
          plane.opacity < 0.05
        ) {
          continue;
        }

        const rect = projectPlane(plane);
        const area = clippedArea(rect, width, height);

        if (area > bestArea) {
          best = rect;
          bestArea = area;
        }
      }

      return best;
    }

    function projectPlaneWarped(plane: Plane): Box {
      camera.updateMatrixWorld();
      plane.mesh.updateMatrixWorld();

      const aspect = width / Math.max(1, height);
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;

      for (const [x, y] of [
        [-0.5, -0.5],
        [0.5, -0.5],
        [-0.5, 0.5],
        [0.5, 0.5],
      ]) {
        corner.set(x, y, 0);
        plane.mesh.localToWorld(corner);
        projected.copy(corner).project(camera);

        // The render target is 1.6x wider than the viewport, so the plane's
        // camera NDC must be scaled into render-target NDC before inverting
        // the lens. Passing camera NDC here shifts every rect away from the
        // tile the pointer actually hit.
        const screen = lensUnproject(
          projected.x * LENS.sourceScale,
          projected.y * LENS.sourceScale,
          lensApplied,
          aspect,
        );
        const screenX = (screen.x * 0.5 + 0.5) * width;
        const screenY = (-screen.y * 0.5 + 0.5) * height;

        minX = Math.min(minX, screenX);
        minY = Math.min(minY, screenY);
        maxX = Math.max(maxX, screenX);
        maxY = Math.max(maxY, screenY);
      }

      return {
        left: minX,
        top: minY,
        width: maxX - minX,
        height: maxY - minY,
      };
    }

    /** The clicked tile's visible rect in viewport coordinates, for the FLIP. */
    function viewportRectForPlane(plane: Plane): Box {
      const rect = projectPlaneWarped(plane);
      const host = hostElement.getBoundingClientRect();

      return {
        left: rect.left + host.left,
        top: rect.top + host.top,
        width: rect.width,
        height: rect.height,
      };
    }

    function hidePlane(plane: Plane): void {
      hiddenPlane = plane;
      plane.mesh.visible = false;
      plane.opacity = 0;
      plane.material.uniforms.uOpacity.value = 0;
      renderScene();
      updateDebug();
    }

    function revealPlane(): void {
      if (!hiddenPlane) {
        // The canvas-owned close already restored the grid; make sure the
        // viewer unmount leaves a painted frame, not an empty buffer.
        renderScene();
        updateDebug();
        wake();
        return;
      }

      const plane = hiddenPlane;
      hiddenPlane = null;
      plane.mesh.visible = true;
      plane.opacity = 1;
      plane.material.uniforms.uOpacity.value = 1;
      renderScene();
      updateDebug();
      wake();
    }

    function cancelPreload(entry: {
      elements: (HTMLVideoElement | HTMLImageElement)[];
    }): void {
      for (const element of entry.elements) {
        if (element instanceof HTMLVideoElement) {
          element.pause();
          element.removeAttribute("src");
          element.load();
          element.remove();
        } else {
          element.src = "";
        }
      }
    }

    function trimPreloads(keepKey: string): void {
      while (preloaded.size > MAX_PRELOADS) {
        let removed = false;
        for (const [key, entry] of preloaded) {
          if (key === keepKey || key === focusWarmKey) continue;
          preloaded.delete(key);
          cancelPreload(entry);
          removed = true;
          break;
        }
        if (!removed) break;
      }
    }

    function preloadItem(itemIndex: number): Promise<boolean> {
      const media = items[itemIndex]?.media;
      if (!media) return Promise.resolve(false);

      if (media.kind === "video") {
        const key = `video:${media.id}`;
        const existing = preloaded.get(key);
        if (existing) return existing.ready;

        const video = document.createElement("video");
        video.muted = true;
        video.loop = true;
        video.playsInline = true;
        video.crossOrigin = "anonymous";
        video.preload = "auto";
        video.src = media.mp4.url;
        video.setAttribute("aria-hidden", "true");
        videoHost.appendChild(video);
        // A preload element with a 0x0 layout uploads a black WebGL frame.
        // Give it the intrinsic size before any texture is created from it.
        const sizeVideo = () => {
          if (video.videoWidth > 0) {
            video.width = video.videoWidth;
            video.height = video.videoHeight;
          }
        };
        video.addEventListener("loadedmetadata", sizeVideo, { once: true });

        const ready = new Promise<boolean>((resolve) => {
          let done = false;
          let timer = 0;
          const finish = (ok: boolean) => {
            if (done) return;
            done = true;
            window.clearTimeout(timer);
            video.removeEventListener("loadeddata", onReady);
            video.removeEventListener("canplay", onReady);
            video.removeEventListener("error", onError);
            resolve(ok);
          };
          const onReady = () => finish(true);
          const onError = () => finish(false);
          timer = window.setTimeout(() => finish(video.readyState >= 2), 2500);

          video.addEventListener("loadeddata", onReady);
          video.addEventListener("canplay", onReady);
          video.addEventListener("error", onError);
        });

        preloaded.set(key, { elements: [video], ready });
        trimPreloads(key);
        return ready;
      }

      // Warm exactly the file the opened MediaImage (fullRes) will draw.
      const top = fullResSource(media.sources);
      if (!top) return Promise.resolve(false);
      const sources = [top];

      const key = `image:${media.id}`;
      const existing = preloaded.get(key);
      if (existing) return existing.ready;

      const images = sources.map((source) => {
        const image = new Image();
        image.decoding = "async";
        image.src = source.url;
        return image;
      });

      const ready
 = Promise.all(
        images.map((image) =>
          image.decode().then(
            () => true,
            () => false,
          ),
        ),
      ).then((results) => results.some(Boolean));

      preloaded.set(key, { elements: images, ready });
      trimPreloads(key);
      return ready;
    }

    function openPlane(plane: Plane): void {
      if (!introEndedFlag || pausedRef.current) return;
      if (!canOpen(transition.phase)) return;

      const media = items[plane.itemIndex]?.media;
      if (!media) return;

      cancelFocusUpgrade();

      if (perfEnabled) {
        markPerf("open-start", {
          index: plane.itemIndex,
          kind: media.kind,
        });
      }

      // Open inside the WebGL scene: the clicked plane keeps its already-loaded
      // texture, glides to the centre and grows to the focus box. The viewer
      // chrome mounts immediately but stays hidden; no DOM media or full-res
      // decode runs on this path.
      panHalt();
      keyGlide = null;
      canvasOwnedRef.current = true;

      const focus = fitBox(media.width, media.height, width, height);
      const video = videoEntries.get(plane.itemIndex);
      const startAt = video?.element.currentTime;
      const now = performance.now();
      const fromScrollX = scrollRef.current.x;
      const fromScrollY = scrollRef.current.y;
      // The grid wraps, so `-base + k * period` centres the same tile. Target
      // the equivalent nearest the current scroll: the canonical `-base`
      // would make a panned canvas fly back to the first-load offset before
      // the clicked tile opened.
      const toScrollX = centrePlaneScroll(plane.baseX, fromScrollX, halfX);
      const toScrollY = centrePlaneScroll(plane.baseY, fromScrollY, halfY);
      // The open starts from the lifted mesh (hover + breath) so the click
      // does not snap the tile down. The close must land on the resting tile
      // instead: the idle handoff clears hover and starts breath at 0, so a
      // snapshot of the lifted mesh would leave the tile a few percent too
      // big until the first idle frame, which is the close snap.
      const restWidth = plane.tileWidth;
      const restHeight = plane.tileHeight;
      const tileWidth = plane.mesh.scale.x;
      const tileHeight = plane.mesh.scale.y;

      // Full-res-first: use the warm 1080p frame if the hover preload paid the
      // first upload. Otherwise keep the live 480p texture (the task's fallback)
      // and fall back to the poster only when even that is not ready.
      if (media.kind === "video") {
        const focus = focusVideos.get(plane.itemIndex);
        if (focus?.ready) {
          bindPlaneTexture(plane, focus.texture);
          const grid = videoEntries.get(plane.itemIndex);
          if (grid && !grid.element.paused) {
            grid.element.pause();
            grid.playing = false;
          }
          markPerf("focus-video-open", {
            index: plane.itemIndex,
            width: focus.element.videoWidth,
            height: focus.element.videoHeight,
            at: Number(focus.element.currentTime.toFixed(2)),
          });
        } else {
          const grid = videoEntries.get(plane.itemIndex);
          if (grid?.texture) {
            bindPlaneTexture(plane, grid.texture);
          } else {
            applyPosterToPlane(plane);
          }
        }
      }

      if (reduced) {
        scrollRef.current.x = -plane.baseX;
        scrollRef.current.y = -plane.baseY;
        placePlanes();
        plane.mesh.visible = true;
        plane.mesh.scale.set(focus.width, focus.height, 1);
        plane.material.uniforms.uPlaneSizes.value.set(
          focus.width,
          focus.height,
        );
        plane.material.uniforms.uZoom.value = 1;
        plane.opacity = 1;
        plane.material.uniforms.uOpacity.value = 1;

        for (const other of planes) {
          if (other === plane) continue;
          other.opacity = 0;
          other.material.uniforms.uOpacity.value = 0;
        }

        transition = {
          ...idleTransition(),
          phase: "open",
          startedAt: now,
          index: plane.itemIndex,
          plane,
          target: plane,
          tileWidth,
          tileHeight,
          restWidth,
          restHeight,
          focusWidth: focus.width,
          focusHeight: focus.height,
          viewerOwned: false,
        };
        loadingIndex = null;
        setTransitioning(false);
        renderScene();
        updateDebug();
        onOpenRef.current(plane.itemIndex, startAt, undefined, true);
        onCanvasOpenedRef.current();
        resumeOpenVideo(plane.itemIndex);
        return;
      }

      loadingIndex = plane.itemIndex;
      transition = {
        phase: "opening",
        startedAt: now,
        index: plane.itemIndex,
        plane,
        target: plane,
        fromScrollX,
        fromScrollY,
        toScrollX,
        toScrollY,
        fromCameraZ: camera.position.z,
        tileWidth,
        tileHeight,
        restWidth,
        restHeight,
        focusWidth: focus.width,
        focusHeight: focus.height,
        handoffAt: -1,
        waitingForViewer: false,
        prepared: false,
        viewerOwned: false,
      };
      setTransitioning(true);
      onOpenRef.current(plane.itemIndex, startAt, undefined, true);
      wake();
    }

    function planeAt(x: number, y: number): Plane | null {
      const rect = hostElement.getBoundingClientRect();
      if (rect.width < 1 || rect.height < 1) return null;

      const screenX = ((x - rect.left) / rect.width) * 2 - 1;
      const screenY = -(((y - rect.top) / rect.height) * 2 - 1);
      const source = lensProject(
        screenX,
        screenY,
        lensApplied,
        width / Math.max(1, height),
      );

      ndc.set(source.x, source.y);
      camera.updateMatrixWorld();
      renderCamera.position.copy(camera.position);
      renderCamera.updateMatrixWorld();
      scene.updateMatrixWorld(true);
      raycaster.setFromCamera(ndc, renderCamera);

      const meshes = planes
        .filter((plane) => plane.mesh.visible && plane.opacity > 0.5)
        .map((plane) => plane.mesh);
      const hit = raycaster.intersectObjects(meshes, false)[0];

      return hit ? (planeByMesh.get(hit.object) ?? null) : null;
    }

    /** A still pointer already has a raycast plane from the hover sampler. */
    function planeForPointer(x: number, y: number): Plane | null {
      if (
        hoveredPlane &&
        hoverPoint &&
        Math.hypot(hoverPoint.x - x, hoverPoint.y - y) < 3
      ) {
        return hoveredPlane;
      }

      return planeAt(x, y);
    }

    function pick(x: number, y: number): void {
      const plane = planeForPointer(x, y);
      if (plane) void openPlane(plane);
    }

    function centrePlane(): Plane | null {
      const scroll = scrollRef.current;
      let best: Plane | null = null;
      let bestDistance = Infinity;

      for (const plane of planes) {
        if (!plane.mesh.visible || plane.opacity < 0.5) continue;

        const x = planePosition(plane.baseX, scroll.x, halfX);
        const y = planePosition(plane.baseY, scroll.y, halfY);
        const distance = x * x + y * y;

        if (distance < bestDistance) {
          best = plane;
          bestDistance = distance;
        }
      }

      return best;
    }

    function openCentred(): void {
      const plane =
        keyboardFocused && focusedPlane ? focusedPlane : centrePlane();
      if (plane) void openPlane(plane);
    }

    function placePlanes(): void {
      const scroll = scrollRef.current;

      for (const plane of planes) {
        plane.baseX = (plane.col - (cols - 1) / 2) * pitchX;
        plane.baseY = (plane.row - (rows - 1) / 2) * pitchY;

        const x = planePosition(plane.baseX, scroll.x, halfX);
        const y = planePosition(plane.baseY, scroll.y, halfY);
        plane.mesh.position.set(x, -y, 0);
      }
    }

    function findPlane(index: number): Plane | null {
      const scroll = scrollRef.current;
      let best: Plane | null = null;
      let bestDistance = Infinity;

      for (const plane of planes) {
        if (plane.itemIndex !== index) continue;

        const x = planePosition(plane.baseX, scroll.x, halfX);
        const y = planePosition(plane.baseY, scroll.y, halfY);
        const distance = x * x + y * y;

        if (distance < bestDistance) {
          best = plane;
          bestDistance = distance;
        }
      }

      return best;
    }

    /** Prefer a copy of the item whose whole tile is already on screen. */
    function fullyVisibleCopy(index: number): Plane | null {
      let best: Plane | null = null;
      let bestArea = 0;

      for (const plane of planes) {
        if (plane.itemIndex !== index) continue;

        const rect = viewportRectForPlane(plane);
        if (!boxInsideViewport(rect, width, height)) continue;

        const area = clippedArea(rect, width, height);
        if (area > bestArea) {
          best = plane;
          bestArea = area;
        }
      }

      return best;
    }

    function updateCamera(dt: number): boolean {
      if (!introEndedFlag) {
        camera.position.z = introCamera;
        return true;
      }

      if (transition.phase === "opening") {
        // The viewer-owned open holds the camera still while the full-res
        // source decodes; only the legacy glide/grow moves the camera.
        return !transition.viewerOwned;
      }

      const targetZ = panIsDragging() && !reduced ? CAMERA_DRAG_Z : CAMERA_Z;
      const ease = 1 - Math.pow(0.975, dt);

      camera.position.z += (targetZ - camera.position.z) * ease;

      if (Math.abs(targetZ - camera.position.z) < 0.001) {
        camera.position.z = targetZ;
      }

      return Math.abs(targetZ - camera.position.z) > 0.001;
    }

    function updateLens(dt: number, now: number): boolean {
      const settings = lensRef.current;
      const target = lensTargetStrength({
        mode: settings.mode,
        base: settings.strength,
        boost: settings.boost,
        speed: panSpeed(),
        reduced,
      });

      // The DOM viewer starts at the clicked tile's lens-warped rect. Freeze
      // the lens until it takes over, and keep it frozen through the reverse
      // FLIP so the landing rect cannot drift underneath the viewer.
      if (
        (transition.phase === "opening" || transition.phase === "closing") &&
        transition.viewerOwned
      ) {
        return false;
      }

      // Hand the flat projection back for the whole glide + grow, and restore
      // the warp with the other planes on close. The intro ramps it with the
      // camera push-in so opening the page never pops. Reduced motion keeps a
      // constant base strength instead: there is no glide or grow to match.
      let factor = 1;

      if (!reduced) {
        if (transition.phase === "opening") {
          factor = 1 - glideProgress(now - transition.startedAt);
        } else if (transition.phase === "open") {
          factor = 0;
        } else if (transition.phase === "closing") {
          factor = transition.prepared
            ? closeFadeProgress(now - transition.startedAt)
            : 0;
        }

        if (!introEndedFlag) {
          factor *= clamp(
            (INTRO.cameraFromZ - introCamera) /
              (INTRO.cameraFromZ - INTRO.cameraToZ),
            0,
            1,
          );
        }
      }

      const want = target * factor;
      const ease = 1 - Math.pow(1 - LENS.easePerFrame, dt);

      // Ease the base strength (the drag response), then scale it by the
      // transition factor. Scaling after the ease makes the flat handoff
      // exact: factor 0 means strength 0, not an eased tail of it.
      lensBase += (target - lensBase) * ease;

      if (Math.abs(target - lensBase) < 0.0005) lensBase = target;

      lensApplied = lensBase * factor;
      lensWanted = want;

      postMaterial.uniforms.uStrength.value = lensApplied;
      setVignette(settings.mode === "globe" ? settings.vignette * factor : 0);

      return (
        Math.abs(target - lensBase) > 0.0005 ||
        Math.abs(want - lensApplied) > 0.0005
      );
    }

    function updatePlanes(dt: number, now: number): boolean {
      const scroll = scrollRef.current;
      const deltaX = scroll.x - lastScroll.x;
      const deltaY = scroll.y - lastScroll.y;
      lastScroll = { x: scroll.x, y: scroll.y };

      const targetX = clamp(-deltaX * 0.012, -PARALLAX_LIMIT, PARALLAX_LIMIT);
      const targetY = clamp(deltaY * 0.012, -PARALLAX_LIMIT, PARALLAX_LIMIT);
      const parallaxEase = 1 - Math.pow(0.82, dt);

      parallaxUniform.value.x +=
        (targetX - parallaxUniform.value.x) * parallaxEase;
      parallaxUniform.value.y +=
        (targetY - parallaxUniform.value.y) * parallaxEase;

      // The focus crop must be exact at the handoff, so the glide's parallax
      // does not ride along.
      if (transition.phase !== "idle") {
        parallaxUniform.value.x = 0;
        parallaxUniform.value.y = 0;
      }

      let active =
        Math.abs(targetX - parallaxUniform.value.x) > 0.0005 ||
        Math.abs(targetY - parallaxUniform.value.y) > 0.0005;

      // The intro packs the grid at 8 and spreads it to the measured gap, so
      // the pitch and wrap extents are recomputed while it runs.
      const gap = INTRO_GAP + (finalGap - INTRO_GAP) * introGap;
      pitchX = baseWidth + gap;
      pitchY = cellHeight + gap;
      halfX = (cols * pitchX) / 2;
      halfY = (rows * pitchY) / 2;
      placePlanes();

      // The colour reveal is per plane: a tile starts grey at its own opacity
      // delay and finishes 900ms later. After the intro every plane is colour.
      for (const plane of planes) {
        const gray = reduced
          ? 0
          : introElapsed < 0
            ? 1
            : introGray(introElapsed, plane.opacityDelay);

        plane.material.uniforms.uGray.value = gray;
      }

      if (planes[0]) {
        introGrayValue = planes[0].material.uniforms.uGray.value;
      }

      const elapsed =
        transition.phase === "idle" ? 0 : now - transition.startedAt;

      if (transition.phase === "opening") {
        if (transition.viewerOwned) {
          // The DOM viewer owns the zoom; updateTransition sets the tile press
          // and the other planes' fade. Do not grow the WebGL plane, and let
          // the loop idle once that fade has settled.
          return viewerOpenNeedsFrames(elapsed);
        }

        const fade = 1 - fadeOutProgress(elapsed);
        const grow = growProgress(elapsed);
        const hand =
          transition.handoffAt >= 0
            ? 1 - handoffProgress(now - transition.handoffAt)
            : 1;
        const opened = transition.plane;

        for (const plane of planes) {
          const opacity = plane === opened ? hand : fade;
          plane.opacity = opacity;
          plane.material.uniforms.uOpacity.value = opacity;

          if (plane === opened) {
            const w =
              transition.tileWidth +
              (transition.focusWidth - transition.tileWidth) * grow;
            const h =
              transition.tileHeight +
              (transition.focusHeight - transition.tileHeight) * grow;

            plane.mesh.scale.set(w, h, 1);
            plane.material.uniforms.uPlaneSizes.value.set(w, h);
            plane.material.uniforms.uZoom.value =
              TEXTURE_ZOOM + (1 - TEXTURE_ZOOM) * grow;
          }
        }

        return true;
      }

      if (transition.phase === "open") {
        if (transition.plane) {
          const hand =
            transition.handoffAt >= 0
              ? 1 - handoffProgress(now - transition.handoffAt)
              : 1;
          transition.plane.opacity = hand;
          transition.plane.material.uniforms.uOpacity.value = hand;
        }

        // A fast viewer handoff can arrive before the 900ms grid fade ends.
        // Finish it here so the tiles behind the opened frame cannot freeze
        // half-visible for the whole time the viewer is open.
        const fadeEase = 1 - Math.pow(0.72, dt);
        let fading = false;

        for (const plane of planes) {
          if (plane === transition.plane) continue;

          if (plane.opacity > 0.002) {
            plane.opacity += (0 - plane.opacity) * fadeEase;
            plane.material.uniforms.uOpacity.value = plane.opacity;
            fading = true;
          } else if (plane.opacity !== 0) {
            plane.opacity = 0;
            plane.material.uniforms.uOpacity.value = 0;
          }
        }

        return (
          transition.waitingForViewer || transition.handoffAt >= 0 || fading
        );
      }

      if (transition.phase === "closing") {
        // The viewer owns the reverse FLIP. Do not move or fade the WebGL
        // grid underneath it; the canvas only paints the landed tile.
        if (transition.viewerOwned) return false;

        const target = transition.target;
        const elapsed = transition.prepared ? now - transition.startedAt : 0;
        const shrink = reduced ? 0 : closeShrinkProgress(elapsed);
        const fade = transition.prepared
          ? reduced
            ? reducedOpacity(elapsed)
            : closeSiblingFadeProgress(elapsed)
          : 0;

        for (const plane of planes) {
          if (plane === target && target) {
            if (!reduced) {
              // Land on the resting tile, not the hover/breath snapshot the
              // open started from; the idle handoff will have both at 0.
              const w =
                transition.focusWidth +
                (transition.restWidth - transition.focusWidth) * shrink;
              const h =
                transition.focusHeight +
                (transition.restHeight - transition.focusHeight) * shrink;

              plane.mesh.scale.set(w, h, 1);
              plane.material.uniforms.uPlaneSizes.value.set(w, h);
              plane.material.uniforms.uZoom.value =
                1 + (TEXTURE_ZOOM - 1) * shrink;
            }

            plane.opacity = 1;
            plane.material.uniforms.uOpacity.value = 1;
          } else {
            plane.opacity = fade;
            plane.material.uniforms.uOpacity.value = fade;
          }
        }

        return true;
      }

      const opacityEase = 1 - Math.pow(0.72, dt);
      const introRunning = introElapsed >= 0 && !introEndedFlag;

      for (const plane of planes) {
        const alpha =
          introElapsed < 0
            ? 0
            : introRunning
              ? reduced
                ? reducedOpacity(introElapsed)
                : introPlaneOpacity(introElapsed, plane.opacityDelay)
              : 1;
        const target = plane.loaded && plane.mesh.visible ? alpha : 0;

        if (introRunning || introElapsed < 0) {
          plane.opacity = target;
        } else if (Math.abs(plane.opacity - target) > 0.002) {
          plane.opacity += (target - plane.opacity) * opacityEase;
          active = true;
        } else if (plane.opacity !== target) {
          plane.opacity = target;
        }

        plane.material.uniforms.uOpacity.value = plane.opacity;
      }

      return active;
    }

    function resetBreathScales(): void {
      for (const plane of planes) {
        plane.mesh.scale.set(plane.tileWidth, plane.tileHeight, 1);
      }
    }

    /**
     * The whole tile breathes around its centre while the canvas is settled.
     * The grid col/row keys the phase, so a wrap across the seam cannot jump.
     * The level is the only thing that fades; the phase keeps running, and a
     * move takes the level to 0 over a short fade instead of freezing it.
     */
    function updateBreathing(
      now: number,
      moving: boolean,
      dtMs: number,
    ): boolean {
      const idle =
        introEndedFlag && transition.phase === "idle" && !pausedRef.current;

      if (!idle) {
        breathLevel = 0;
        breathIdleSince = now;
        breathActive = false;
        breathAmplitude = 0;
        breathIdleMs = 0;
        return false;
      }

      if (!breathIdleSince) breathIdleSince = now;

      const settings = breathRef.current;
      const config = {
        ...BREATH,
        amplitude: settings.amplitude,
        periodMs: settings.periodMs,
      };

      if (reduced) {
        breathLevel = 0;
        breathIdleSince = now;
        breathActive = false;
        breathAmplitude = 0;
        breathIdleMs = 0;
        resetBreathScales();
        return false;
      }

      const idleMs = now - breathIdleSince;
      const envelope = breathEnvelope(idleMs, {
        moving,
        enabled: true,
        reduced: false,
        config,
      });

      breathLevel = easeBreathLevel(breathLevel, envelope, dtMs, config);

      const amplitude = settings.amplitude * breathLevel;
      const hoverScale = Math.max(1, hoverRef.current.scale);

      for (const plane of planes) {
        const scale =
          1 +
          amplitude * Math.sin(breathPhase(now, plane.col, plane.row, config));
        const hover = 1 + (hoverScale - 1) * plane.hoverLevel;

        plane.mesh.scale.set(
          plane.tileWidth * scale * hover,
          plane.tileHeight * scale * hover,
          1,
        );
      }

      breathActive = !moving;
      breathAmplitude = amplitude;
      breathIdleMs = moving ? 0 : idleMs;
      breathSample = planes[0]
        ? 1 +
          amplitude *
            Math.sin(breathPhase(now, planes[0].col, planes[0].row, config))
        : 1;

      if (moving) breathIdleSince = now;

      return !moving;
    }

    function setHoverCursor(active: boolean): void {
      const surface = containerRef.current;

      if (!surface) return;

      if (active) surface.dataset.hover = "true";
      else delete surface.dataset.hover;
    }

    function setTileFocusAttribute(active: boolean): void {
      const surface = containerRef.current;

      if (!surface) return;

      if (active) surface.dataset.tileFocus = "true";
      else delete surface.dataset.tileFocus;
    }

    /** The tag's width, measured when its text changes. */
    let hoverLabelWidth = 0;

    /**
     * Show or hide the pointer tag. Showing names the plane's project (the
     * viewer chip's label) and re-clamps, since the name sets the tag's width.
     */
    function setHoverLabel(visible: boolean, plane?: Plane | null): void {
      const label = hoverLabelRef.current;

      if (!label) return;

      if (!visible) {
        delete label.dataset.visible;
        return;
      }

      const item = plane ? items[plane.itemIndex] : undefined;
      if (item) {
        const text = projectLabel(item.project);
        if (label.textContent !== text) {
          label.textContent = text;
          hoverLabelWidth = label.offsetWidth;
        }
      }
      if (hoverPoint) positionHoverLabel(hoverPoint.x, hoverPoint.y);
      label.dataset.visible = "true";
    }

    /** Move the tag with the pointer, clamped inside the canvas surface. */
    function positionHoverLabel(clientX: number, clientY: number): void {
      const surface = containerRef.current;
      const label = hoverLabelRef.current;

      if (!surface || !label) return;

      const rect = surface.getBoundingClientRect();
      const x = Math.min(
        Math.max(0, clientX - rect.left + 14),
        Math.max(0, rect.width - hoverLabelWidth),
      );
      const y = Math.min(
        Math.max(0, clientY - rect.top + 18),
        Math.max(0, rect.height - 36),
      );

      label.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    }

    /** Leaving or changing tiles cancels a pending intent immediately. */
    function cancelHoverIntent(): void {
      hoverIntentPlane = null;
      setHoverLabel(false);
      setHoverCursor(false);
    }

    function clearKeyboardFocus(): void {
      if (!keyboardFocused && !focusedPlane && !keyGlide) return;

      keyboardFocused = false;
      focusedPlane = null;
      keyGlide = null;
      setTileFocusAttribute(false);
      hoverDirty = true;
      wake();
    }

    function focusTileFromCentre(): void {
      if (pausedRef.current || !introEndedFlag) return;

      const plane =
        focusCandidate && planes.includes(focusCandidate)
          ? focusCandidate
          : centrePlane();

      focusCandidate = null;
      if (!plane) return;

      keyboardFocused = true;
      focusedPlane = plane;
      setTileFocusAttribute(true);
      cancelHoverIntent();
      hoverDirty = true;
      wake();
    }

    function startKeyGlide(dx: number, dy: number): void {
      if (!focusedPlane) return;

      // Gap cells between clusters hold no plane; step over them.
      let cell = { col: focusedPlane.col, row: focusedPlane.row };
      let next: Plane | null = null;
      for (let step = 0; step < Math.max(cols, rows) && !next; step += 1) {
        cell = adjacentCell(cell, dx, dy, cols, rows);
        next =
          planes.find(
            (plane) => plane.col === cell.col && plane.row === cell.row,
          ) ?? null;
      }

      if (!next) return;

      // The key step owns the scroll while it runs; a held arrow must not add
      // pan velocity on top of it.
      panHalt();

      const scroll = scrollRef.current;
      const toX = centrePlaneScroll(next.baseX, scroll.x, halfX);
      const toY = centrePlaneScroll(next.baseY, scroll.y, halfY);

      focusedPlane = next;
      hoverDirty = true;

      if (reduced) {
        scroll.x = toX;
        scroll.y = toY;
        keyGlide = null;
        wake();
        return;
      }

      keyGlide = {
        fromX: scroll.x,
        fromY: scroll.y,
        toX,
        toY,
        startedAt: performance.now(),
      };
      wake();
    }

    function updateKeyGlide(now: number): boolean {
      if (!keyGlide) return false;

      const progress = keyboardGlideProgress(keyGlide.startedAt, now);
      scrollRef.current.x =
        keyGlide.fromX + (keyGlide.toX - keyGlide.fromX) * progress;
      scrollRef.current.y =
        keyGlide.fromY + (keyGlide.toY - keyGlide.fromY) * progress;

      if (progress >= 1) keyGlide = null;

      return true;
    }

    /**
     * One raycast per frame at the last pointer position, through the inverse
     * lens. Only the idle state hovers; each plane's tween retargets from its
     * current value so fast passes and interruptions never jump. Keyboard
     * focus borrows the same lift, so the selected tile is the lifted one.
     */
    function updateHover(now: number, moving: boolean): boolean {
      const keyboard =
        keyboardFocused &&
        focusedPlane !== null &&
        introEndedFlag &&
        transition.phase === "idle" &&
        !pausedRef.current;
      const allowed =
        !keyboard &&
        !keyGlide &&
        introEndedFlag &&
        transition.phase === "idle" &&
        !pausedRef.current &&
        !moving;

      if (allowed !== hoverWasAllowed) {
        hoverWasAllowed = allowed;
        hoverDirty = true;
      }

      if (hoverDirty) {
        hoverDirty = false;

        const next = keyboard
          ? focusedPlane
          : allowed && hoverPoint
            ? planeAt(hoverPoint.x, hoverPoint.y)
            : null;

        if (next !== hoveredPlane) {
          if (hoveredPlane) {
            hoveredPlane.hover = retargetHover(hoveredPlane.hover, 0, now);
          }

          hoveredPlane = next;

          if (next) {
            next.hover = retargetHover(next.hover, 1, now);
            void preloadItem(next.itemIndex);
            warmFocusVideo(next.itemIndex);

            // The lift starts now; the cursor and label wait out the intent.
            if (!keyboard) {
              hoverIntentPlane = next;
              hoverIntentAt = now;
            }
            setHoverLabel(false);
            setHoverCursor(false);
          } else {
            cancelHoverIntent();
          }
        }
      }

      if (hoverIntentPlane) {
        if (!allowed || keyboard || hoverIntentPlane !== hoveredPlane) {
          cancelHoverIntent();
        } else if (hoverIntentReady(hoverIntentAt, now)) {
          hoverIntentPlane = null;
          setHoverCursor(true);
          setHoverLabel(true, hoveredPlane);

          if (perfEnabled) {
            markPerf("cursor-change", { hover: true });
          }
        }
      }

      const intentPending = hoverIntentPlane !== null;
      const closeTarget =
        transition.phase === "closing" ? transition.target : null;
      let active = false;

      for (const plane of planes) {
        if (reduced) {
          plane.hoverLevel = 0;
          plane.hover = { from: 0, to: 0, startedAt: now, durationMs: 0 };
          plane.mesh.renderOrder =
            closeTarget && plane === closeTarget
              ? CLOSE_TARGET_RENDER_ORDER
              : 0;
          continue;
        }

        plane.hoverLevel = hoverValue(plane.hover, now);

        if (
          plane.hover.durationMs > 0 &&
          now < plane.hover.startedAt + plane.hover.durationMs
        ) {
          active = true;
        }

        plane.mesh.renderOrder = closeTarget
          ? plane === closeTarget
            ? CLOSE_TARGET_RENDER_ORDER
            : 0
          : plane === hoveredPlane || plane.hoverLevel > 0.001
            ? 1
            : 0;
      }

      return active || intentPending;
    }

    function clearHoverNow(): void {
      if (perfEnabled) markPerf("hover-clear");
      hoverPoint = null;
      hoverDirty = false;
      hoverWasAllowed = false;
      hoveredPlane = null;
      keyboardFocused = false;
      focusedPlane = null;
      keyGlide = null;
      hoverIntentPlane = null;
      setTileFocusAttribute(false);
      setHoverLabel(false);
      setHoverCursor(false);

      for (const plane of planes) {
        plane.hover = { from: 0, to: 0, startedAt: 0, durationMs: 0 };
        plane.hoverLevel = 0;
        plane.mesh.renderOrder = 0;
      }
    }

    function handoff(): void {
      const t = transition;

      if (loadingIndex !== null) {
        const plane = t.plane ?? findPlane(loadingIndex);
        if (plane) hidePlane(plane);
        loadingIndex = null;
      }

      if (t.phase === "opening" || t.phase === "open") {
        t.phase = "open";
        t.waitingForViewer = false;
        t.handoffAt = -1;
        setTransitioning(false);
        wake();
        // The canvas is paused behind the viewer, so this frame will not run;
        // keep the dev probe's phase in step with the handoff.
        updateDebug();
      }
    }

    function releaseOpen(): void {
      const t = transition;
      if (t.phase !== "open" || t.viewerOwned) return;

      cancelFocusUpgrade();
      const openedIndex = t.index;
      // The viewer now owns the slides. Drop the focused plane from the
      // canvas but keep the rest of the grid faded out, exactly as the
      // canvas-owned open left it; the stage behind the DOM slide must not
      // suddenly show a grid. The planes stay in place at tile size so the
      // close can pick the current item's tile.
      for (const plane of planes) {
        resetPlaneToTile(plane);
        plane.opacity = 0;
        plane.material.uniforms.uOpacity.value = 0;
      }
      if (openedIndex >= 0) {
        restoreGridTexture(openedIndex);
        const media = items[openedIndex]?.media;
        if (media?.kind === "video") releaseFocusVideo(openedIndex);
        else disposeFocusTexture(openedIndex);
      }
      // openVideoIsLive() must go false or the paused loop keeps uploading the
      // old focus video behind the slides. Keep the phase open for the close.
      t.viewerOwned = true;

      // The canvas-owned open flattened the lens to carry the focus box. The
      // grid is invisible behind the DOM slide, so restore the resting warp
      // now: the close freezes the lens and computes its landing rect from it,
      // and restoring it on the landing frame instead snapped the tile.
      if (!reduced) {
        const strength = lensTargetStrength({
          mode: lensRef.current.mode,
          base: lensRef.current.strength,
          boost: lensRef.current.boost,
          speed: 0,
          reduced,
        });

        lensBase = strength;
        lensApplied = strength;
        lensWanted = strength;
        postMaterial.uniforms.uStrength.value = strength;
        setVignette(
          lensRef.current.mode === "globe" ? lensRef.current.vignette : 0,
        );
      }

      renderScene();
      updateDebug();
    }

    function updateTransition(now: number): boolean {
      const t = transition;

      if (t.phase === "idle") return false;

      const elapsed = now - t.startedAt;

      if (t.phase === "opening") {
        if (t.viewerOwned) {
          const fade = 1 - fadeOutProgress(elapsed);

          for (const plane of planes) {
            if (plane === t.plane) {
              plane.mesh.scale.set(
                t.tileWidth * OPEN_PRESS_SCALE,
                t.tileHeight * OPEN_PRESS_SCALE,
                1,
              );
              plane.material.uniforms.uPlaneSizes.value.set(
                t.tileWidth * OPEN_PRESS_SCALE,
                t.tileHeight * OPEN_PRESS_SCALE,
              );
              plane.opacity = 1;
              plane.material.uniforms.uOpacity.value = 1;
            } else {
              plane.opacity = fade;
              plane.material.uniforms.uOpacity.value = fade;
            }
          }

          return viewerOpenNeedsFrames(elapsed);
        }

        const p = glideProgress(elapsed);
        scrollRef.current.x = t.fromScrollX + (t.toScrollX - t.fromScrollX) * p;
        scrollRef.current.y = t.fromScrollY + (t.toScrollY - t.fromScrollY) * p;
        camera.position.z = t.fromCameraZ + (CAMERA_Z - t.fromCameraZ) * p;

        if (
          elapsed >= TRANSITION.growDelayMs + TRANSITION.growMs &&
          !t.waitingForViewer
        ) {
          t.waitingForViewer = false;
          t.phase = nextPhase(t.phase, "opened");
          loadingIndex = null;
          setTransitioning(false);
          onCanvasOpenedRef.current();
          // A video open keeps the poster through the glide, then hands the
          // focused plane back to the live clip. Images stay as they are.
          resumeOpenVideo(t.index);
          if (perfEnabled) {
            markPerf("open-ready", {
              index: t.index,
              kind: items[t.index]?.media.kind,
            });
          }
          // The 640 texture carried the motion; upgrade it in an idle slot
          // once the chrome has settled. The hidden decoders stay live until
          // the close; any teardown here costs more than the open budget.
          scheduleFocusUpgrade(t.index);
        }

        return t.phase === "opening";
      }

      if (t.phase === "open") {
        if (t.waitingForViewer) return true;

        if (t.handoffAt >= 0 && now - t.handoffAt >= TRANSITION.handoffMs) {
          if (t.plane) hidePlane(t.plane);
          t.handoffAt = -1;
          return false;
        }

        return t.handoffAt >= 0;
      }

      if (t.phase === "closing") {
        // The DOM viewer owns the shrink; the canvas waits for landClose.
        if (t.viewerOwned) return false;
        if (!t.prepared) return true;

        // The canvas-owned close retraces the open: the plane shrinks while
        // the grid glides back to the scroll it had before the click. Without
        // this the plane can only shrink in place and the grid reappears
        // recentred, so the tile looks like it jumped into a new slot.
        if (reduced) {
          scrollRef.current.x = t.fromScrollX;
          scrollRef.current.y = t.fromScrollY;
        } else {
          scrollRef.current.x = closeScrollOffset(
            t.fromScrollX,
            t.toScrollX,
            elapsed,
          );
          scrollRef.current.y = closeScrollOffset(
            t.fromScrollY,
            t.toScrollY,
            elapsed,
          );
        }

        const done = reduced
          ? elapsed >= TRANSITION.reducedFadeMs
          : closeComplete(elapsed);

        if (done) {
          const closedIndex = t.index;
          t.phase = nextPhase(t.phase, "closed");
          t.index = -1;
          t.plane = null;
          t.target = null;
          t.prepared = false;
          t.handoffAt = -1;

          for (const plane of planes) {
            const opacity = plane.loaded && plane.mesh.visible ? 1 : 0;
            plane.opacity = opacity;
            plane.material.uniforms.uOpacity.value = opacity;
          }

          if (closedIndex >= 0) {
            restoreGridTexture(closedIndex);
            disposeFocusTexture(closedIndex);
            releaseFocusVideo(closedIndex);
          }
          setTransitioning(false);
          return false;
        }

        return true;
      }

      return false;
    }

    function waitFrames(count: number): Promise<void> {
      return new Promise((resolve) => {
        let remaining = count;

        const step = () => {
          remaining -= 1;
          if (remaining <= 0) resolve();
          else requestAnimationFrame(step);
        };

        requestAnimationFrame(step);
      });
    }

    async function waitForVideoEntry(
      entry: VideoEntry,
      timeoutMs: number,
    ): Promise<void> {
      const start = performance.now();

      while (
        !entry.ready &&
        !entry.failed &&
        performance.now() - start < timeoutMs
      ) {
        await new Promise((resolve) => window.setTimeout(resolve, 16));
      }
    }

    async function seekVideo(entry: VideoEntry, time: number): Promise<void> {
      const video = entry.element;

      if (!(video.duration > 0)) return;

      const target =
        ((time % video.duration) + video.duration) % video.duration;

      if (Math.abs(video.currentTime - target) < 0.04) return;

      await new Promise<void>((resolve) => {
        let settled = false;
        const finish = () => {
          if (settled) return;
          settled = true;
          video.removeEventListener("seeked", finish);
          resolve();
        };

        video.addEventListener("seeked", finish, { once: true });
        try {
          video.currentTime = target;
        } catch {
          finish();
        }
        window.setTimeout(finish, 450);
      });
    }

    /** Put a plane back at its resting tile size and texture crop. */
    function resetPlaneToTile(plane: Plane): void {
      plane.mesh.visible = true;
      plane.mesh.scale.set(plane.tileWidth, plane.tileHeight, 1);
      plane.material.uniforms.uPlaneSizes.value.set(
        plane.tileWidth,
        plane.tileHeight,
      );
      plane.material.uniforms.uZoom.value = TEXTURE_ZOOM;
    }

    function prepareCloseTarget(
      index: number,
      media: MediaManifest,
      time: number | undefined,
      run: number,
    ): Promise<void> {
      if (media.kind !== "video") return Promise.resolve();

      // Let the viewer's first shrink frame get on screen before the seek and
      // texture upload. This still runs in parallel with the FLIP.
      return new Promise<void>((resolve) => {
        requestAnimationFrame(() => {
          void (async () => {
            if (run !== closeRun) {
              resolve();
              return;
            }

            let entry: VideoEntry | null = videoEntries.get(index) ?? null;
            if (!entry) entry = ensureVideoEntry(index);

            if (entry) {
              entry.element.pause();

              if (!entry.texture) await waitForVideoEntry(entry, 500);
              if (entry.texture) applyVideoTexture(index, entry);

              if (entry.texture && time !== undefined) {
                await seekVideo(entry, time);
                entry.texture.needsUpdate = true;
                entry.lastUpload = performance.now();
                await waitFrames(2);
              }
            }

            if (run === closeRun && transition.phase === "closing") {
              transition.prepared = true;
            }
            resolve();
          })();
        });
      });
    }

    function closeTo(
      index: number,
      time?: number,
      canvasOwned = false,
    ): CloseTarget | null {
      const focus = focusVideos.get(index);
      const focusTime =
        canvasOwned && focus?.ready ? focus.element.currentTime : undefined;
      cancelFocusUpgrade();
      for (const focusIndex of focusVideos.keys()) {
        pauseFocusVideo(focusIndex);
      }

      // Closing while the viewer is still waiting for its first decoded
      // frame: cancel the open, restore the grid, and let the viewer unmount.
      if (transition.phase === "opening" && transition.viewerOwned) {
        closeRun += 1;

        for (const plane of planes) {
          resetPlaneToTile(plane);
          plane.opacity = 1;
          plane.material.uniforms.uOpacity.value = 1;
        }

        loadingIndex = null;
        transition = idleTransition();
        setTransitioning(false);
        renderScene();
        updateDebug();
        wake();
        return { rect: null, prepared: Promise.resolve() };
      }

      if (
        canvasOwned &&
        transition.phase === "opening" &&
        !transition.viewerOwned
      ) {
        // Escape during the WebGL glide: cancel the open and restore the grid.
        closeRun += 1;
        const cancelled = transition;

        for (const plane of planes) {
          resetPlaneToTile(plane);
          plane.opacity = plane.loaded ? 1 : 0;
          plane.material.uniforms.uOpacity.value = plane.opacity;
        }

        // The open had started from this scroll; cancelling mid-glide must put
        // it back, or the grid stays shifted even though the media is gone.
        scrollRef.current.x = cancelled.fromScrollX;
        scrollRef.current.y = cancelled.fromScrollY;
        placePlanes();

        loadingIndex = null;
        transition = idleTransition();
        setTransitioning(false);

        // The warmed focus media belongs to the open that was cancelled.
        // Put the tile's grid texture back and release the full-res decoder,
        // texture and preload so Escape mid-glide leaves a live grid tile.
        if (index >= 0) {
          restoreGridTexture(index);
          disposeFocusTexture(index);
          releaseFocusVideo(index);
        }

        renderScene();
        updateDebug();
        wake();
        return null;
      }

      if (!canClose(transition.phase)) return null;

      if (canvasOwned) {
        // The WebGL plane owns the opened media. Shrink it back to its tile
        // with the legacy canvas timeline; the DOM viewer is chrome only.
        panHalt();
        const t = transition;
        const target = t.plane ?? findPlane(index);
        if (!target) return null;

        // The grid decoder was frozen when the full-res focus took the
        // plane. Put it at the frame the viewer actually watched before the
        // tile is shown again, so closing does not jump backwards.
        const media = items[index]?.media;
        if (media?.kind === "video" && focusTime !== undefined) {
          const grid = videoEntries.get(index) ?? ensureVideoEntry(index);
          if (grid) {
            grid.element.pause();
            void seekVideo(grid, focusTime).then(() => {
              if (disposed || !grid.texture) return;
              grid.texture.needsUpdate = true;
              grid.lastUpload = performance.now();
            });
          }
        }

        t.phase = "closing";
        t.index = index;
        t.target = target;
        t.handoffAt = -1;
        t.waitingForViewer = false;
        t.prepared = true;
        t.viewerOwned = false;
        t.startedAt = performance.now();
        setTransitioning(true);
        wake();

        return { rect: null, prepared: Promise.resolve() };
      }

      panHalt();
      const t = transition;
      const media = items[index]?.media;
      if (!media) return null;

      const opened = t.plane;
      const openedVisible =
        opened &&
        opened.itemIndex === index &&
        boxInsideViewport(viewportRectForPlane(opened), width, height);
      const target =
        (openedVisible ? opened : null) ??
        fullyVisibleCopy(index) ??
        findPlane(index) ??
        opened;

      if (!target) return null;

      let rect = viewportRectForPlane(target);

      if (!boxInsideViewport(rect, width, height)) {
        // An Arrow step can land on a rank whose copies are all outside the
        // viewport. The grid is hidden for the close, so centre the target
        // now and fly to the tile the landing will actually reveal.
        // planePosition is base + scroll, so the neutral scroll is -base.
        scrollRef.current.x = -target.baseX;
        scrollRef.current.y = -target.baseY;
        placePlanes();
        rect = viewportRectForPlane(target);
      }

      closeRun += 1;
      const run = closeRun;

      t.phase = "closing";
      t.index = index;
      t.target = target;
      t.handoffAt = -1;
      t.waitingForViewer = false;
      t.prepared = false;
      t.viewerOwned = true;
      t.startedAt = performance.now();

      // The viewer owns the shrink. Return every tile to its resting size and
      // hide the grid while the DOM layer flies back to the clicked tile.
      for (const plane of planes) {
        resetPlaneToTile(plane);
        plane.opacity = 0;
        plane.material.uniforms.uOpacity.value = 0;
      }

      target.mesh.visible = false;
      target.opacity = 0;
      target.material.uniforms.uOpacity.value = 0;
      hiddenPlane = target;

      if (debug) {
        debug.transition = "closing";
        debug.hidden = true;
        debug.targetWidth = Number(target.mesh.scale.x.toFixed(1));
        debug.targetOpacity = 0;
      }

      // The reverse FLIP lands on the (possibly re-centred) target rect.
      const prepared = prepareCloseTarget(index, media, time, run);

      return { rect, prepared };
    }

    function cancelClose(): void {
      const t = transition;
      if (t.phase !== "closing" || !t.viewerOwned) return;

      closeRun += 1;
      const target = t.target;

      for (const plane of planes) {
        resetPlaneToTile(plane);
        plane.opacity = 0;
        plane.material.uniforms.uOpacity.value = 0;
      }

      if (target) {
        target.mesh.visible = false;
        target.opacity = 0;
        target.material.uniforms.uOpacity.value = 0;
      }

      hiddenPlane = target;
      transition = {
        ...idleTransition(),
        phase: "open",
        index: t.index,
        plane: target,
        target,
        viewerOwned: true,
      };
      setTransitioning(false);
      updateDebug();
      // The canvas stays paused behind the viewer; no render is needed.
    }

    function landClose(): void {
      const t = transition;
      if (t.phase !== "closing" || !t.viewerOwned) return;

      closeRun += 1;
      const target = t.target;

      // The viewer returns focus to the canvas surface. The tile that was
      // open is the one to continue from, so a keyboard close lands on it
      // instead of whichever tile happens to sit at the centre.
      focusCandidate = target;

      // The tile is already at its resting transform; show it before the DOM
      // viewer unmounts so the hand-back has no blank frame.
      for (const plane of planes) {
        resetPlaneToTile(plane);
        const opacity = plane === target || reduced ? 1 : 0;
        plane.opacity = opacity;
        plane.material.uniforms.uOpacity.value = opacity;
      }

      hiddenPlane = null;
      const closedIndex = t.index;
      transition = idleTransition();
      // The canvas was paused behind the DOM viewer, so the idle clock still
      // points at the frame before the open. Restart it here: otherwise the
      // first unpaused idle frame sees seconds of "idle" time and jumps the
      // grid to full breathing amplitude in one frame.
      breathIdleSince = 0;
      breathLevel = 0;
      breathActive = false;
      breathAmplitude = 0;
      if (closedIndex >= 0) {
        restoreGridTexture(closedIndex);
        disposeFocusTexture(closedIndex);
        releaseFocusVideo(closedIndex);
      }
      setTransitioning(false);
      renderScene();
      updateDebug();
      wake();
    }

    function updateIntro(now: number, dtMs: number): boolean {
      if (introElapsed < 0) {
        // Wait for the posters (or a failed one) before starting the clock.
        if (textureLoadMs !== null || now - textureStartedAt > 2500) {
          introElapsed = 0;

          // The chrome enters with the canvas, not before it: the pill has
          // nothing to sit on until the intro is running.
          if (!introStartAnnounced) {
            introStartAnnounced = true;
            onIntroStartRef.current?.();
          }
        } else {
          introZoomUniform.value = INTRO.zoomFrom;
          return true;
        }
      }

      const end = reduced ? INTRO.reducedFadeMs : INTRO.endMs;
      introElapsed = Math.min(end, introElapsed + dtMs);

      if (reduced) {
        introCamera = CAMERA_Z;
        introGap = 1;
        introGrayValue = 0;
        introZoomValue = 1;
        introVideos = reducedIntroEnded(introElapsed);
        introEndedFlag = reducedIntroEnded(introElapsed);
      } else {
        introCamera = introCameraZ(introElapsed);
        introGap = introGapProgress(introElapsed);
        introZoomValue = introZoom(introElapsed);
        introVideos = introVideosReady(introElapsed);
        introEndedFlag = introEnded(introElapsed);
      }

      introZoomUniform.value = introZoomValue;

      if (introEndedFlag && !introAnnounced) {
        introAnnounced = true;
        setIntroReady(true);
      }

      return !introEndedFlag;
    }

    function edgeBlurTarget(): number {
      return edgeBlurEnabled && !edgeBlurSuppressedRef.current ? 1 : 0;
    }

    function edgeBlurFading(): boolean {
      return edgeAmount !== edgeBlurTarget();
    }

    /** Move the edge effect toward its target over EDGE_BLUR.fadeMs. */
    function updateEdgeBlur(dtMs: number): boolean {
      const target = edgeBlurTarget();
      if (edgeAmount === target) return false;

      if (reduced) {
        edgeAmount = target;
        if (compositeMaterial)
          compositeMaterial.uniforms.uEdgeAmount.value = edgeAmount;

        return true;
      }

      const step = dtMs / EDGE_BLUR.fadeMs;
      edgeAmount =
        target > edgeAmount
          ? Math.min(target, edgeAmount + step)
          : Math.max(target, edgeAmount - step);
      if (compositeMaterial)
        compositeMaterial.uniforms.uEdgeAmount.value = edgeAmount;

      return true;
    }

    function renderFrame(now: number): void {
      raf = 0;

      if (document.hidden) {
        last = 0;
        return;
      }

      const edgeFading = edgeBlurFading();
      const viewerWaitSettled =
        pausedRef.current &&
        transition.phase === "opening" &&
        transition.viewerOwned &&
        !viewerOpenNeedsFrames(now - transition.startedAt);

      const transitionActive =
        transition.phase === "opening" ||
        (transition.phase === "closing" && !transition.viewerOwned) ||
        (transition.phase === "open" &&
          (transition.waitingForViewer || transition.handoffAt >= 0));

      if (
        pausedRef.current &&
        !transitionActive &&
        !openVideoIsLive() &&
        !edgeFading
      ) {
        last = 0;
        return;
      }

      const dtMs = last ? Math.min(48, Math.max(0, now - last)) : FRAME_MS;
      const dt = dtMs / FRAME_MS;
      last = now;

      const introActive = updateIntro(now, dtMs);
      const edgeUpdated = updateEdgeBlur(dtMs);
      const transitionRunning = updateTransition(now);
      const gliding = updateKeyGlide(now);
      const moving = panTick(now);
      const zooming = updateCamera(dt);
      const fading = updatePlanes(dt, now);
      const videosActive = syncVideos(now);
      const lensActive = updateLens(dt, now);
      const breathMoving =
        gliding || panIsDragging() || panSpeed() > BREATH.settleSpeed;
      const hovering = updateHover(now, breathMoving);
      const breathing = updateBreathing(now, breathMoving, dtMs);

      updateVideoFallback(now);
      renderedFrames += 1;
      renderScene();
      updateDebug();
      if (perfEnabled && transition.phase === "opening") {
        markFirstOpenFrame();
      }

      const otherActive =
        gliding ||
        moving ||
        zooming ||
        fading ||
        videosActive ||
        lensActive ||
        introActive ||
        transitionRunning ||
        transitionActive ||
        hovering ||
        edgeUpdated;

      if (!viewerWaitSettled && (otherActive || breathing)) {
        raf = requestAnimationFrame(renderFrame);
      } else {
        last = 0;
      }
    }

    function wake(): void {
      if (disposed || document.hidden) {
        return;
      }

      if (raf !== 0) {
        return;
      }

      const transitionActive =
        transition.phase === "opening" ||
        (transition.phase === "closing" && !transition.viewerOwned) ||
        (transition.phase === "open" &&
          (transition.waitingForViewer || transition.handoffAt >= 0));

      const viewerWaitSettled =
        pausedRef.current &&
        transition.phase === "opening" &&
        transition.viewerOwned &&
        !viewerOpenNeedsFrames(performance.now() - transition.startedAt);

      if (
        pausedRef.current &&
        !openVideoIsLive() &&
        !edgeBlurFading() &&
        (!transitionActive || viewerWaitSettled)
      ) {
        return;
      }

      last = 0;
      raf = requestAnimationFrame(renderFrame);
    }

    /**
     * A resize disposes and rebuilds every plane. Re-point an in-flight
     * viewer transition at the fresh meshes (the old ones are removed), and
     * re-apply the pose the viewer expects: the held tile while it decodes,
     * or a hidden grid once it owns the screen.
     */
    function rebindTransitionAfterResize(
      planeIndex: number | null,
      targetIndex: number | null,
      previousWidth: number,
      previousHeight: number,
    ): void {
      const t = transition;
      if (t.phase === "idle") return;

      const index = planeIndex ?? (t.index >= 0 ? t.index : null);
      const targetIndexResolved = targetIndex ?? index;
      const previousPlane = t.plane;
      const previousTarget = t.target;
      t.plane = index !== null ? findPlane(index) : null;
      t.target =
        targetIndexResolved !== null ? findPlane(targetIndexResolved) : null;

      if (!t.plane) {
        transition = idleTransition();
        loadingIndex = null;
        hiddenPlane = null;
        return;
      }

      // A resize rebuilds the grid, so the opened plane's base moves with the
      // new pitch. Retarget the open's scroll, pre-open home and focus target:
      // keep the media centred on the new base, and scale the pre-open offset
      // with the viewport so the close still lands in the same relative spot
      // instead of an absolute px offset that can fall off screen.
      if (!t.viewerOwned) {
        const focusPlane = t.phase === "closing" ? t.target : t.plane;
        const previousFocus =
          t.phase === "closing" ? previousTarget : previousPlane;

        if (focusPlane && previousFocus) {
          const x = resizeOpenScroll(
            scrollRef.current.x,
            t.fromScrollX,
            t.toScrollX,
            previousFocus.baseX,
            focusPlane.baseX,
            width / previousWidth,
            halfX,
          );
          const y = resizeOpenScroll(
            scrollRef.current.y,
            t.fromScrollY,
            t.toScrollY,
            previousFocus.baseY,
            focusPlane.baseY,
            height / previousHeight,
            halfY,
          );

          // The held open sits on the focus, so a new wrap period must land
          // the scroll on the retargeted focus; mid-glide/close keep their
          // current pose and continue the retargeted path.
          scrollRef.current.x = t.phase === "open" ? x.to : x.scroll;
          scrollRef.current.y = t.phase === "open" ? y.to : y.scroll;
          t.fromScrollX = x.from;
          t.fromScrollY = y.from;
          t.toScrollX = x.to;
          t.toScrollY = y.to;
        }
      }

      const media = index !== null ? items[index]?.media : undefined;
      if (media) {
        const focus = fitBox(media.width, media.height, width, height);
        t.focusWidth = focus.width;
        t.focusHeight = focus.height;
      }
      t.tileWidth = t.plane.tileWidth;
      t.tileHeight = t.plane.tileHeight;
      t.restWidth = t.plane.tileWidth;
      t.restHeight = t.plane.tileHeight;

      if (t.phase === "opening" && !t.viewerOwned) {
        const elapsed = performance.now() - t.startedAt;
        const fade = 1 - fadeOutProgress(elapsed);
        const grow = growProgress(elapsed);
        loadingIndex = null;

        for (const plane of planes) {
          resetPlaneToTile(plane);

          if (plane === t.plane) {
            const w = t.tileWidth + (t.focusWidth - t.tileWidth) * grow;
            const h = t.tileHeight + (t.focusHeight - t.tileHeight) * grow;
            plane.mesh.visible = true;
            plane.mesh.scale.set(w, h, 1);
            plane.material.uniforms.uPlaneSizes.value.set(w, h);
            plane.material.uniforms.uZoom.value =
              TEXTURE_ZOOM + (1 - TEXTURE_ZOOM) * grow;
            plane.opacity = 1;
          } else {
            plane.opacity = fade;
          }

          plane.material.uniforms.uOpacity.value = plane.opacity;
        }

        hiddenPlane = null;
      } else if (t.phase === "open" && !t.viewerOwned) {
        // Canvas-owned opened view: the focused plane is the media.
        loadingIndex = null;

        for (const plane of planes) {
          resetPlaneToTile(plane);

          if (plane === t.plane) {
            plane.mesh.visible = true;
            plane.mesh.scale.set(t.focusWidth, t.focusHeight, 1);
            plane.material.uniforms.uPlaneSizes.value.set(
              t.focusWidth,
              t.focusHeight,
            );
            plane.material.uniforms.uZoom.value = 1;
            const upgraded = focusTextures.get(index ?? -1);
            if (upgraded) {
              plane.material.uniforms.uTexture.value = upgraded;
              plane.material.uniforms.uDecodeVideo.value = 0;
            }
            const focusVideo =
              index !== null ? focusVideos.get(index) : undefined;
            if (focusVideo?.ready) {
              plane.material.uniforms.uTexture.value = focusVideo.texture;
              plane.material.uniforms.uDecodeVideo.value = 1;
              plane.loaded = true;
            }
            plane.opacity = 1;
          } else {
            plane.opacity = 0;
          }

          plane.material.uniforms.uOpacity.value = plane.opacity;
        }

        hiddenPlane = null;
      } else if (t.phase === "closing" && !t.viewerOwned) {
        const elapsed = performance.now() - t.startedAt;
        const shrink = closeShrinkProgress(elapsed);
        const fade = closeSiblingFadeProgress(elapsed);
        const target = t.target ?? t.plane;
        loadingIndex = null;

        for (const plane of planes) {
          resetPlaneToTile(plane);

          if (plane === target) {
            const w = t.focusWidth + (t.restWidth - t.focusWidth) * shrink;
            const h = t.focusHeight + (t.restHeight - t.focusHeight) * shrink;
            plane.mesh.visible = true;
            plane.mesh.scale.set(w, h, 1);
            plane.material.uniforms.uPlaneSizes.value.set(w, h);
            plane.material.uniforms.uZoom.value =
              1 + (TEXTURE_ZOOM - 1) * shrink;
            plane.opacity = 1;
          } else {
            plane.opacity = fade;
          }

          plane.material.uniforms.uOpacity.value = plane.opacity;
        }

        hiddenPlane = null;
      } else if (t.phase === "opening" && t.viewerOwned) {
        const elapsed = performance.now() - t.startedAt;
        const fade = 1 - fadeOutProgress(elapsed);
        loadingIndex = index;

        for (const plane of planes) {
          resetPlaneToTile(plane);

          if (plane === t.plane) {
            const widthAtPress = t.tileWidth * OPEN_PRESS_SCALE;
            const heightAtPress = t.tileHeight * OPEN_PRESS_SCALE;
            plane.mesh.visible = true;
            plane.mesh.scale.set(widthAtPress, heightAtPress, 1);
            plane.material.uniforms.uPlaneSizes.value.set(
              widthAtPress,
              heightAtPress,
            );
            plane.opacity = 1;
          } else {
            plane.opacity = fade;
          }

          plane.material.uniforms.uOpacity.value = plane.opacity;
        }

        hiddenPlane = null;
      } else {
        // Open or closing with DOM media: the viewer covers the canvas. Keep
        // the fresh grid hidden and let landClose reveal the new target mesh.
        loadingIndex = null;

        for (const plane of planes) {
          resetPlaneToTile(plane);
          plane.opacity = 0;
          plane.material.uniforms.uOpacity.value = 0;
        }

        hiddenPlane = t.target ?? t.plane;
        if (hiddenPlane) {
          hiddenPlane.mesh.visible = false;
          hiddenPlane.opacity = 0;
          hiddenPlane.material.uniforms.uOpacity.value = 0;
        }
      }

      // buildPlanes left the fresh meshes at their unwrapped base; apply the
      // retargeted scroll before painting, or a paused open (image media does
      // not wake the loop) would show the media off centre.
      placePlanes();

      renderScene();
      updateDebug();
    }

    function resize(): void {
      const rect = hostElement.getBoundingClientRect();
      const nextWidth = Math.max(1, Math.round(rect.width));
      const nextHeight = Math.max(1, Math.round(rect.height));

      const nextDpr = readDpr();

      if (
        planes.length > 0 &&
        nextWidth === width &&
        nextHeight === height &&
        nextDpr === dpr
      ) {
        return;
      }

      if (nextDpr !== dpr) {
        dpr = nextDpr;
        renderer.setPixelRatio(dpr);
      }

      const previousWidth = width;
      const previousHeight = height;
      width = nextWidth;
      height = nextHeight;

      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.fov = THREE.MathUtils.radToDeg(
        2 * Math.atan(height / 2 / CAMERA_Z),
      );
      camera.updateProjectionMatrix();

      // The target holds LENS.margin extra on every side, so warped edge
      // samples always land on rendered content. The render camera widens by
      // the same factor, which keeps the target's viewport region identical to
      // the flat view at any strength.
      renderCamera.aspect = width / height;
      renderCamera.fov = THREE.MathUtils.radToDeg(
        2 *
          Math.atan(
            Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) /
              LENS.sourceScale,
          ),
      );
      renderCamera.updateProjectionMatrix();
      const rtWidth = Math.max(1, Math.round((width * dpr) / LENS.sourceScale));
      const rtHeight = Math.max(
        1,
        Math.round((height * dpr) / LENS.sourceScale),
      );

      // The 1.6x target already supersamples plane edges when the post pass
      // samples it back down. MSAA is only kept while the buffer is small
      // enough to be cheap; a 5K retina target would be hundreds of MB.
      const samples = rtWidth * rtHeight <= RT_MSAA_MAX_PIXELS ? 4 : 0;

      if (renderTarget.samples !== samples) {
        renderTarget.samples = samples;
        renderTarget.dispose();
      }

      renderTarget.setSize(rtWidth, rtHeight);
      postMaterial.uniforms.uAspect.value = width / height;
      if (compositeMaterial) {
        compositeMaterial.uniforms.uAspect.value = width / height;
      }

      // The edge depth is the CSS clamp, in screen UV space. The screen target
      // and its mip chain re-derive on every resize.
      const depthPx = edgeBlurDepthPx(window.innerWidth);
      edgeDepth.set(depthPx / width, depthPx / height);

      if (screenTarget && edgeTargetA && compositeMaterial) {
        // Floor, as three's setSize does, so the screen target matches the
        // canvas backing store and the half-res target cannot drift a texel.
        const screenWidth = Math.max(1, Math.floor(width * dpr));
        const screenHeight = Math.max(1, Math.floor(height * dpr));
        const edgeWidth = Math.max(
          1,
          Math.floor(screenWidth * EDGE_BLUR.targetScale),
        );
        const edgeHeight = Math.max(
          1,
          Math.floor(screenHeight * EDGE_BLUR.targetScale),
        );
        const edgeRadius =
          edgeBlurRadiusPx(EDGE_BLUR.maxBlurPx, dpr) * EDGE_BLUR.targetScale;

        screenTarget.setSize(screenWidth, screenHeight);
        edgeTargetA.setSize(edgeWidth, edgeHeight);
        edgeHMaterial.uniforms.uTexel.value.set(1 / edgeWidth, 1 / edgeHeight);
        edgeHMaterial.uniforms.uRadius.value = edgeRadius;
        compositeMaterial.uniforms.uEdgeTexel.value.set(
          1 / edgeWidth,
          1 / edgeHeight,
        );
        compositeMaterial.uniforms.uEdgeRadius.value = edgeRadius;
      }

      const transitionPlaneIndex = transition.plane?.itemIndex ?? null;
      const transitionTargetIndex = transition.target?.itemIndex ?? null;

      buildPlanes();
      rebindTransitionAfterResize(
        transitionPlaneIndex,
        transitionTargetIndex,
        previousWidth,
        previousHeight,
      );
      wake();
    }

    function scheduleResize(): void {
      if (resizeFrame !== 0) return;

      resizeFrame = requestAnimationFrame(() => {
        resizeFrame = 0;
        resize();
      });
    }

    function onVisibilityChange(): void {
      if (document.hidden) {
        if (raf !== 0) cancelAnimationFrame(raf);
        raf = 0;
        pauseAllVideos();
        return;
      }

      last = 0;
      wake();
    }

    function onMotionChange(event: MediaQueryListEvent): void {
      reduced = event.matches;
      wake();
    }

    const resizeObserver = new ResizeObserver(scheduleResize);
    resizeObserver.observe(hostElement);
    // A DPR-only change (monitor move, browser zoom) does not resize the host
    // box, so the observer stays quiet; the window resize event covers it.
    window.addEventListener("resize", scheduleResize);
    document.addEventListener("visibilitychange", onVisibilityChange);
    motionQuery.addEventListener("change", onMotionChange);

    const surface = containerRef.current;
    const onPreloadPointerDown = (event: PointerEvent) => {
      if (event.button !== 0 || pausedRef.current || !introEndedFlag) return;
      if (!canOpen(transition.phase)) return;

      const plane = planeForPointer(event.clientX, event.clientY);
      if (plane) {
        void preloadItem(plane.itemIndex);
        warmFocusVideo(plane.itemIndex);
      }
    };
    surface?.addEventListener("pointerdown", onPreloadPointerDown, {
      passive: true,
    });

    // Keyboard open: the surface is the focus target, so warm whatever is
    // centred (or hovered) before Enter can open it.
    const onPreloadFocus = () => {
      if (pausedRef.current || !introEndedFlag) return;
      const plane = focusCandidate ?? hoveredPlane ?? centrePlane();
      if (plane) {
        void preloadItem(plane.itemIndex);
        warmFocusVideo(plane.itemIndex);
      }
    };
    surface?.addEventListener("focus", onPreloadFocus);

    const onHoverPointerMove = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return;

      // A moving pointer means pointer mode: the keyboard selection hands the
      // surface back to continuous pan and pointer hover.
      clearKeyboardFocus();

      hoverPoint = { x: event.clientX, y: event.clientY };
      positionHoverLabel(event.clientX, event.clientY);
      hoverDirty = true;
      wake();
    };
    const onHoverPointerLeave = () => {
      hoverPoint = null;
      cancelHoverIntent();
      hoverDirty = true;
      wake();
    };

    const onSurfacePointerDown = () => {
      clearKeyboardFocus();
    };

    const onSurfaceWheel = () => {
      clearKeyboardFocus();
    };

    const onSurfaceFocus = () => {
      if (lastInput === "keyboard") focusTileFromCentre();
    };

    const onSurfaceBlur = () => {
      clearKeyboardFocus();
    };

    // Capture before usePan's React handler: while a tile is focused, arrows
    // step the selection and Escape clears it. With no tile focused, the same
    // keys fall through to the continuous pan.
    const onGridKeyDown = (event: KeyboardEvent) => {
      if (!keyboardFocused || pausedRef.current) return;
      if (event.altKey || event.ctrlKey || event.metaKey) return;

      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        clearKeyboardFocus();
        return;
      }

      if (
        event.key !== "ArrowLeft" &&
        event.key !== "ArrowRight" &&
        event.key !== "ArrowUp" &&
        event.key !== "ArrowDown"
      ) {
        return;
      }

      if (!introEndedFlag || transition.phase !== "idle") return;

      event.preventDefault();
      event.stopPropagation();

      if (event.repeat) return;

      const dx =
        event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
      const dy =
        event.key === "ArrowDown" ? 1 : event.key === "ArrowUp" ? -1 : 0;

      startKeyGlide(dx, dy);
    };

    // Focus follows the input that asked for it. A Tab focus selects a tile;
    // a click focus leaves the surface in continuous pan.
    const onWindowPointerDown = () => {
      lastInput = "pointer";
    };
    const onWindowKeyDown = (event: KeyboardEvent) => {
      if (
        event.key === "Tab" ||
        event.key === "Enter" ||
        event.key === "Escape" ||
        event.key === "ArrowLeft" ||
        event.key === "ArrowRight" ||
        event.key === "ArrowUp" ||
        event.key === "ArrowDown"
      ) {
        lastInput = "keyboard";
      }
    };

    window.addEventListener("pointerdown", onWindowPointerDown, true);
    window.addEventListener("keydown", onWindowKeyDown, true);
    surface?.addEventListener("pointerdown", onSurfacePointerDown, true);
    surface?.addEventListener("wheel", onSurfaceWheel, {
      capture: true,
      passive: true,
    });
    surface?.addEventListener("pointermove", onHoverPointerMove, {
      passive: true,
    });
    surface?.addEventListener("pointerleave", onHoverPointerLeave, {
      passive: true,
    });
    surface?.addEventListener("focus", onSurfaceFocus);
    surface?.addEventListener("blur", onSurfaceBlur);
    surface?.addEventListener("keydown", onGridKeyDown, true);

    wakeRef.current = wake;
    pickRef.current = pick;
    centerRef.current = openCentred;
    restoreRef.current = revealPlane;
    pauseVideosRef.current = pauseAllVideos;
    clearHoverRef.current = clearHoverNow;
    api.rectForIndex = rectForIndex;
    api.reveal = revealPlane;
    api.handoff = handoff;
    api.releaseOpen = releaseOpen;
    api.closeTo = closeTo;
    api.cancelClose = cancelClose;
    api.landClose = landClose;

    resize();

    return () => {
      disposed = true;
      cancelFocusUpgrade();

      if (raf !== 0) cancelAnimationFrame(raf);
      if (resizeFrame !== 0) cancelAnimationFrame(resizeFrame);

      resizeObserver.disconnect();
      window.removeEventListener("resize", scheduleResize);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      motionQuery.removeEventListener("change", onMotionChange);
      themeObserver.disconnect();
      tintProbe?.remove();
      surface?.removeEventListener("pointerdown", onPreloadPointerDown);
      surface?.removeEventListener("focus", onPreloadFocus);
      surface?.removeEventListener("pointermove", onHoverPointerMove);
      surface?.removeEventListener("pointerleave", onHoverPointerLeave);
      surface?.removeEventListener("pointerdown", onSurfacePointerDown, true);
      surface?.removeEventListener("wheel", onSurfaceWheel, true);
      surface?.removeEventListener("focus", onSurfaceFocus);
      surface?.removeEventListener("blur", onSurfaceBlur);
      surface?.removeEventListener("keydown", onGridKeyDown, true);
      window.removeEventListener("pointerdown", onWindowPointerDown, true);
      window.removeEventListener("keydown", onWindowKeyDown, true);

      wakeRef.current = () => {};
      pickRef.current = () => {};
      centerRef.current = () => {};
      restoreRef.current = () => {};
      pauseVideosRef.current = () => {};
      clearHoverRef.current = () => {};
      api.rectForIndex = () => null;
      api.reveal = () => {};
      api.handoff = () => {};
      api.releaseOpen = () => {};
      api.closeTo = () => null;
      api.cancelClose = () => {};
      api.landClose = () => {};

      pauseAllVideos();

      for (const itemIndex of [...videoEntries.keys()]) {
        disposeVideoEntry(itemIndex);
      }

      for (const entry of preloaded.values()) cancelPreload(entry);
      preloaded.clear();

      videoHost.remove();
      disposePlanes();
      geometry.dispose();
      renderTarget.dispose();
      screenTarget?.dispose();
      edgeTargetA?.dispose();
      edgeHMaterial.dispose();
      postGeometry.dispose();
      postMaterial.dispose();
      compositeMaterial?.dispose();

      for (const entry of textures.values()) {
        entry.texture.dispose();
      }

      for (const texture of focusTextures.values()) {
        texture.dispose();
      }
      focusTextures.clear();

      for (const index of [...focusVideos.keys()]) {
        disposeFocusVideo(index);
      }
      focusVideos.clear();

      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    };
  }, [
    items,
    edgeBlur,
    panHalt,
    panIsDragging,
    panSpeed,
    panTick,
    scrollRef,
    containerRef,
  ]);

  return (
    <div
      ref={containerRef}
      className="cv-surface"
      data-canvas-surface
      data-lenis-prevent
      tabIndex={0}
      role="region"
      aria-label="WebGL media canvas. Drag or scroll to move, hold the arrow keys to pan, and press Enter to open the centred media. Tab focuses a tile; the arrow keys then move between tiles, Enter opens the focused tile and Escape clears the focus."
      inert={paused}
      {...handlers}
      onDragStart={(event) => event.preventDefault()}
      onContextMenu={(event) => event.preventDefault()}
    >
      <div ref={canvasHostRef} className="cv-webgl-host" aria-hidden="true" />

      <span ref={hoverLabelRef} className="cv-hover-tag" aria-hidden="true" />

      {webglFailed ? <StaticFallback items={items} /> : null}

      {items.length === 0 ? (
        <p className="cv-empty">
          No media manifests found. Run <code>pnpm post</code> first.
        </p>
      ) : null}
    </div>
  );
});
