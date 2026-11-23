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
import type { MediaManifest } from "@/lib/media-types";
import type { Box } from "@/components/work/morph";
import { gridMetrics, INTRO_GAP, orientationRatio } from "./grid";
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
  canClose,
  canOpen,
  closeComplete,
  closeFadeProgress,
  closeShrinkProgress,
  fadeOutProgress,
  fitBox,
  glideProgress,
  growProgress,
  handoffProgress,
  nextPhase,
} from "./transition";
import type { TransitionPhase } from "./transition";
import { LENS, lensProject, lensTargetStrength } from "./lens";
import type { LensMode } from "./lens";
import {
  BREATH,
  breathEnvelope,
  breathPhase,
  easeBreathLevel,
} from "./breathing";
import type { BreathSettings } from "./breathing";
import { usePan } from "./use-pan";
import { planePosition } from "./wrap";

export type CanvasItem = {
  /** Unique per copy in the cycled list, not the media id. */
  key: string;
  media: MediaManifest;
};

export type InfiniteCanvasHandle = {
  /** The current screen rect of an item's plane, for the focus viewer's FLIP. */
  rectForIndex: (index: number) => Box | null;
  /** Restore the plane hidden for a focused item, before the close flight. */
  reveal: () => void;
  /** The viewer has a decoded frame; start the canvas handoff fade. */
  handoff: () => void;
  /** Centre and prepare the current piece; resolve when the canvas owns it. */
  closeTo: (index: number, time?: number) => Promise<void>;
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
  onOpen: (index: number, startAt?: number) => void;
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
 * Canvas video budget. Videos already playing stay playing until their plane
 * leaves the viewport plus margin; new starts are rate-limited so a fast drag
 * never opens a dozen decoders in one frame.
 */
const VIDEO_TUNING = {
  desktopPlaying: 12,
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

    // Linear premultiplied for the render target; the lens pass does the one
    // sRGB encode when it draws to the canvas.
    gl_FragColor = vec4(texel.rgb * uOpacity, uOpacity);
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
 * it through the barrel map, then encodes once into the sRGB canvas. The
 * vignette fades to the page background by lowering alpha.
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

    // Premultiplied sRGB for the premultiplied canvas.
    gl_FragColor.rgb *= gl_FragColor.a;

    float edge = smoothstep(0.72, 1.05, r);
    gl_FragColor *= 1.0 - uVignette * edge;
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
  focusWidth: number;
  focusHeight: number;
  /** performance.now when the grow handed off to the viewer, or -1. */
  handoffAt: number;
  /** The grow is done and the viewer is preparing its first decoded frame. */
  waitingForViewer: boolean;
  /** The close target is at the focus and synced; the timeline has started. */
  prepared: boolean;
};

type VideoEntry = {
  element: HTMLVideoElement;
  texture: THREE.Texture | null;
  ready: boolean;
  playing: boolean;
  failed: boolean;
  /** performance.now of the last manual upload. */
  lastUpload: number;
  /** Pending requestVideoFrameCallback, if the browser has it. */
  frameRequest: number | null;
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
  renderedFrames: number;
  transition: TransitionPhase;
  transitionMs: number;
  waitingForViewer: boolean;
  prepared: boolean;
  targetWidth: number;
  targetHeight: number;
  targetOpacity: number;
  targetZoom: number;
  scroll: { x: number; y: number };
  dragging: boolean;
  hidden: boolean;
  videosPlaying: number;
  videoEntries: number;
  videoTextures: number;
  videoPlanesBound: number;
  videoUploads: number;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** Prefer the WebP around 640w; videos use their JPG poster. */
function textureUrl(media: MediaManifest): string {
  if (media.kind === "video") return media.poster.jpg;

  const webp = media.sources.filter((source) => source.format === "webp");
  const pool = webp.length > 0 ? webp : media.sources;

  return pool.reduce((best, source) => {
    const currentDistance = Math.abs(source.width - TEXTURE_TARGET_WIDTH);
    const bestDistance = Math.abs(best.width - TEXTURE_TARGET_WIDTH);

    return currentDistance < bestDistance ? source : best;
  }).url;
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
>(function InfiniteCanvas({ items, paused, lens, breath, onOpen }, ref) {
  const canvasHostRef = useRef<HTMLDivElement | null>(null);
  const [webglFailed, setWebglFailed] = useState(false);
  const [introReady, setIntroReady] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const lensRef = useRef(lens);
  const breathRef = useRef(breath);
  const reduceMotion = useReducedMotion();

  const apiRef = useRef<InfiniteCanvasHandle>({
    rectForIndex: () => null,
    reveal: () => {},
    handoff: () => {},
    closeTo: async () => {},
  });
  const wakeRef = useRef<() => void>(() => {});
  const pickRef = useRef<(x: number, y: number) => void>(() => {});
  const centerRef = useRef<() => void>(() => {});
  const restoreRef = useRef<() => void>(() => {});
  const pauseVideosRef = useRef<() => void>(() => {});
  const pausedRef = useRef(paused);
  const onOpenRef = useRef(onOpen);

  useImperativeHandle(ref, () => apiRef.current, []);

  useEffect(() => {
    onOpenRef.current = onOpen;
  }, [onOpen]);

  useEffect(() => {
    lensRef.current = lens;
    wakeRef.current();
  }, [lens]);

  useEffect(() => {
    breathRef.current = breath;
    wakeRef.current();
  }, [breath]);

  useEffect(() => {
    pausedRef.current = paused;

    if (paused) {
      pauseVideosRef.current();
    } else {
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
    let supported = false;

    try {
      const probe = document.createElement("canvas");
      supported = Boolean(
        probe.getContext("webgl2") || probe.getContext("webgl"),
      );
    } catch {
      supported = false;
    }

    if (!supported) {
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

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    renderer.setPixelRatio(dpr);
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NoToneMapping;
    renderer.domElement.className = "cv-webgl";
    hostElement.appendChild(renderer.domElement);

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

    const postScene = new THREE.Scene();
    const postCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const postGeometry = new THREE.PlaneGeometry(2, 2);
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

    function renderScene(): void {
      // The lens RT is a wider view of the same scene at the same position, so
      // the viewport part of the target matches the flat view 1:1.
      renderCamera.position.copy(camera.position);
      renderCamera.updateMatrixWorld();
      renderer.setRenderTarget(renderTarget);
      renderer.render(scene, renderCamera);
      renderer.setRenderTarget(null);
      renderer.render(postScene, postCamera);
    }

    const geometry = new THREE.PlaneGeometry(1, 1);
    const parallaxUniform = { value: new THREE.Vector2() };
    const introZoomUniform: { value: number } = { value: INTRO.zoomFrom };
    const grayUniform: { value: number } = { value: 1 };
    const loader = new THREE.TextureLoader();
    const raycaster = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    const corner = new THREE.Vector3();
    const projected = new THREE.Vector3();
    const textures = new Map<string, TextureEntry>();
    const planeByMesh = new Map<THREE.Object3D, Plane>();
    const videoEntries = new Map<number, VideoEntry>();
    const preloaded = new Map<
      string,
      HTMLVideoElement | HTMLImageElement
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
    let renderedFrames = 0;
    /** The last frame was only breathing, so it may be held to 30fps. */
    let breathOnly = false;
    let lastRenderAt = 0;

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
      focusWidth: 0,
      focusHeight: 0,
      handoffAt: -1,
      waitingForViewer: false,
      prepared: false,
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
            rects: [],
            breathActive: false,
            breathAmplitude: 0,
            breathIdleMs: 0,
            renderedFrames: 0,
            transition: "idle",
            transitionMs: 0,
            waitingForViewer: false,
            prepared: false,
            targetWidth: 0,
            targetHeight: 0,
            targetOpacity: 0,
            targetZoom: 1,
            scroll: { x: 0, y: 0 },
            dragging: false,
            hidden: false,
            videosPlaying: 0,
            videoEntries: 0,
            videoTextures: 0,
            videoPlanesBound: 0,
            videoUploads: 0,
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
          renderer.initTexture(texture);

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

        plane.material.uniforms.uTexture.value = entry.texture;
        plane.material.uniforms.uDecodeVideo.value = 1;
        plane.loaded = true;
      }
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

      void entry.element.play().catch(() => {
        entry.failed = true;
        entry.playing = false;
      });
    }

    /** Browsers without requestVideoFrameCallback upload on a 33ms cadence. */
    function updateVideoFallback(now: number): void {
      for (const entry of videoEntries.values()) {
        if (!entry.texture || entry.texture.needsUpdate) continue;
        if (entry.element.paused) continue;
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
        applyVideoTexture(itemIndex, entry);
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
      if (videoOff || document.hidden || pausedRef.current) {
        pauseAllVideos();
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
            if (
              itemIndex !== transition.index &&
              !entry.element.paused
            ) {
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
        } else if (
          now - startsSettledAt >=
          VIDEO_TUNING.startFreezeSettleMs
        ) {
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

      for (let row = 0; row < rows; row += 1) {
        for (let col = 0; col < cols; col += 1) {
          const itemIndex = (row * cols + col) % items.length;
          const media = items[itemIndex].media;
          const aspect = media.width / Math.max(1, media.height);
          const planeWidth = baseWidth;
          const planeHeight = baseWidth * orientationRatio(aspect);
          const url = urls[itemIndex];
          const entry = ensureTexture(url);
          const videoEntry = videoEntries.get(itemIndex);
          const videoTexture = videoEntry?.ready ? videoEntry.texture : null;
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
              uGray: grayUniform,
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
      debug.rects = planes
        .filter((plane) => plane.mesh.visible && plane.opacity > 0.5)
        .map((plane) => {
          const rect = projectPlane(plane);

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
      debug.renderedFrames = renderedFrames;
      debug.transition = transition.phase;
      debug.transitionMs =
        transition.phase === "idle"
          ? 0
          : Math.round(performance.now() - transition.startedAt);
      debug.waitingForViewer = transition.waitingForViewer;
      debug.prepared = transition.prepared;

      const target = transition.target ?? transition.plane;
      debug.targetWidth = target
        ? Number(target.mesh.scale.x.toFixed(1))
        : 0;
      debug.targetHeight = target
        ? Number(target.mesh.scale.y.toFixed(1))
        : 0;
      debug.targetOpacity = target ? Number(target.opacity.toFixed(3)) : 0;
      debug.targetZoom = target
        ? Number(target.material.uniforms.uZoom.value.toFixed(3))
        : 1;
      debug.scroll.x = scrollRef.current.x;
      debug.scroll.y = scrollRef.current.y;
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

    function hidePlane(plane: Plane): void {
      hiddenPlane = plane;
      plane.mesh.visible = false;
      plane.opacity = 0;
      plane.material.uniforms.uOpacity.value = 0;
      renderScene();
      updateDebug();
    }

    function revealPlane(): void {
      if (!hiddenPlane) return;

      const plane = hiddenPlane;
      hiddenPlane = null;
      plane.mesh.visible = true;
      plane.opacity = 1;
      plane.material.uniforms.uOpacity.value = 1;
      renderScene();
      updateDebug();
      wake();
    }

    function preloadItem(itemIndex: number): void {
      const media = items[itemIndex]?.media;
      if (!media) return;

      if (media.kind === "video") {
        const key = `video:${media.id}`;
        if (preloaded.has(key)) return;

        const video = document.createElement("video");
        video.muted = true;
        video.playsInline = true;
        video.crossOrigin = "anonymous";
        video.preload = "auto";
        video.src = media.mp4.url;
        video.setAttribute("aria-hidden", "true");
        videoHost.appendChild(video);
        preloaded.set(key, video);
        return;
      }

      for (const format of ["avif", "webp"] as const) {
        const source = media.sources
          .filter((candidate) => candidate.format === format)
          .sort((a, b) => b.width - a.width)[0];
        if (!source) continue;

        const key = `image:${source.url}`;
        if (preloaded.has(key)) continue;

        const image = new Image();
        image.decoding = "async";
        image.src = source.url;
        preloaded.set(key, image);
        void image.decode().catch(() => {
          // The viewer falls back to its own decode.
        });
      }
    }

    function openPlane(plane: Plane): void {
      if (!introEndedFlag || pausedRef.current) return;
      if (!canOpen(transition.phase)) return;

      const media = items[plane.itemIndex]?.media;
      if (!media) return;

      panHalt();
      preloadItem(plane.itemIndex);

      const focus = fitBox(media.width, media.height, width, height);
      const fromScrollX = scrollRef.current.x;
      const fromScrollY = scrollRef.current.y;
      const px = planePosition(plane.baseX, fromScrollX, halfX);
      const py = planePosition(plane.baseY, fromScrollY, halfY);
      const now = performance.now();
      const base = {
        startedAt: now,
        index: plane.itemIndex,
        plane,
        target: plane,
        fromScrollX,
        fromScrollY,
        toScrollX: fromScrollX - px,
        toScrollY: fromScrollY - py,
        fromCameraZ: camera.position.z,
        tileWidth: plane.mesh.scale.x,
        tileHeight: plane.mesh.scale.y,
        focusWidth: focus.width,
        focusHeight: focus.height,
        handoffAt: -1,
        waitingForViewer: false,
        prepared: false,
      };

      if (reduced) {
        // No glide: the viewer's own 120ms fade is the whole transition.
        transition = { ...base, phase: "open" };
        setTransitioning(true);
        const video = videoEntries.get(plane.itemIndex);
        onOpenRef.current(plane.itemIndex, video?.element.currentTime);
        return;
      }

      transition = { ...base, phase: nextPhase("idle", "open") };
      setTransitioning(true);
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

    function pick(x: number, y: number): void {
      const plane = planeAt(x, y);
      if (plane) openPlane(plane);
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
      const plane = centrePlane();
      if (plane) openPlane(plane);
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

    function updateCamera(dt: number): boolean {
      if (!introEndedFlag) {
        camera.position.z = introCamera;
        return true;
      }

      if (transition.phase === "opening") {
        return true;
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
      postMaterial.uniforms.uVignette.value =
        settings.mode === "globe" ? settings.vignette * factor : 0;

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

      const elapsed =
        transition.phase === "idle" ? 0 : now - transition.startedAt;

      if (transition.phase === "opening") {
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

        return transition.waitingForViewer || transition.handoffAt >= 0;
      }

      if (transition.phase === "closing") {
        const target = transition.target;
        const elapsed = transition.prepared
          ? now - transition.startedAt
          : 0;
        const shrink = reduced ? 0 : closeShrinkProgress(elapsed);
        const fade = transition.prepared
          ? reduced
            ? reducedOpacity(elapsed)
            : closeFadeProgress(elapsed)
          : 0;

        for (const plane of planes) {
          if (plane === target && target) {
            if (!reduced) {
              const w =
                transition.focusWidth +
                (transition.tileWidth - transition.focusWidth) * shrink;
              const h =
                transition.focusHeight +
                (transition.tileHeight - transition.focusHeight) * shrink;

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
        const alpha = introElapsed < 0
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
        introEndedFlag &&
        transition.phase === "idle" &&
        !pausedRef.current;

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

      for (const plane of planes) {
        const scale =
          1 +
          amplitude *
            Math.sin(breathPhase(now, plane.col, plane.row, config));

        plane.mesh.scale.set(
          plane.tileWidth * scale,
          plane.tileHeight * scale,
          1,
        );
      }

      breathActive = !moving;
      breathAmplitude = amplitude;
      breathIdleMs = moving ? 0 : idleMs;

      if (moving) breathIdleSince = now;

      return !moving;
    }

    function handoff(): void {
      const t = transition;

      if (t.phase !== "open" || !t.waitingForViewer) return;

      t.waitingForViewer = false;
      t.handoffAt = performance.now();
      wake();
    }

    function updateTransition(now: number): boolean {
      const t = transition;

      if (t.phase === "idle") return false;

      const elapsed = now - t.startedAt;

      if (t.phase === "opening") {
        const p = glideProgress(elapsed);
        scrollRef.current.x =
          t.fromScrollX + (t.toScrollX - t.fromScrollX) * p;
        scrollRef.current.y =
          t.fromScrollY + (t.toScrollY - t.fromScrollY) * p;
        camera.position.z =
          t.fromCameraZ + (CAMERA_Z - t.fromCameraZ) * p;

        if (
          elapsed >= TRANSITION.growDelayMs + TRANSITION.growMs &&
          !t.waitingForViewer
        ) {
          t.waitingForViewer = true;
          t.phase = nextPhase(t.phase, "opened");
          const video = videoEntries.get(t.index);
          onOpenRef.current(t.index, video?.element.currentTime);
        }

        return true;
      }

      if (t.phase === "open") {
        if (t.waitingForViewer) return true;

        if (
          t.handoffAt >= 0 &&
          now - t.handoffAt >= TRANSITION.handoffMs
        ) {
          if (t.plane) hidePlane(t.plane);
          t.handoffAt = -1;
          return false;
        }

        return t.handoffAt >= 0;
      }

      if (t.phase === "closing") {
        if (!t.prepared) return true;

        const done = reduced
          ? elapsed >= TRANSITION.reducedFadeMs
          : closeComplete(elapsed);

        if (done) {
          t.phase = nextPhase(t.phase, "closed");
          t.index = -1;
          t.plane = null;
          t.target = null;
          t.prepared = false;
          t.handoffAt = -1;

          for (const plane of planes) {
            const opacity =
              plane.loaded && plane.mesh.visible ? 1 : 0;
            plane.opacity = opacity;
            plane.material.uniforms.uOpacity.value = opacity;
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

    async function seekVideo(
      entry: VideoEntry,
      time: number,
    ): Promise<void> {
      const video = entry.element;

      if (!(video.duration > 0)) return;

      const target = ((time % video.duration) + video.duration) % video.duration;

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

    async function closeTo(index: number, time?: number): Promise<void> {
      if (!canClose(transition.phase)) return;

      panHalt();
      const t = transition;
      const media = items[index]?.media;
      if (!media) return;

      const focus = fitBox(media.width, media.height, width, height);
      const opened = t.plane;
      let target: Plane | null = null;

      if (opened && opened.itemIndex === index) target = opened;
      else target = findPlane(index) ?? opened;

      if (!target) return;

      t.phase = nextPhase(t.phase, "close");
      t.index = index;
      t.target = target;
      t.handoffAt = -1;
      t.waitingForViewer = false;
      t.prepared = false;
      t.focusWidth = focus.width;
      t.focusHeight = focus.height;

      const aspect = media.width / Math.max(1, media.height);
      t.tileWidth = baseWidth;
      t.tileHeight = baseWidth * orientationRatio(aspect);

      // Reposition under the viewer (the other planes are at zero opacity).
      const px = planePosition(target.baseX, scrollRef.current.x, halfX);
      const py = planePosition(target.baseY, scrollRef.current.y, halfY);
      scrollRef.current.x -= px;
      scrollRef.current.y -= py;
      placePlanes();

      // The opened copy may be a different item after stepping; put it back
      // at its tile and let it join the fade-in.
      if (opened && opened !== target) {
        const openedMedia = items[opened.itemIndex]?.media;
        const openedAspect = openedMedia
          ? openedMedia.width / Math.max(1, openedMedia.height)
          : 1;
        const openedH = baseWidth * orientationRatio(openedAspect);

        opened.mesh.scale.set(baseWidth, openedH, 1);
        opened.material.uniforms.uPlaneSizes.value.set(baseWidth, openedH);
        opened.material.uniforms.uZoom.value = TEXTURE_ZOOM;
        opened.mesh.visible = true;
        opened.opacity = 0;
        opened.material.uniforms.uOpacity.value = 0;
      }

      hiddenPlane = null;

      // The target sits exactly under the viewer, at the same contain crop.
      target.mesh.visible = true;
      if (!reduced) {
        target.mesh.scale.set(focus.width, focus.height, 1);
        target.material.uniforms.uPlaneSizes.value.set(
          focus.width,
          focus.height,
        );
        target.material.uniforms.uZoom.value = 1;
      }
      target.opacity = 1;
      target.material.uniforms.uOpacity.value = 1;

      for (const plane of planes) {
        if (plane === target) continue;

        // Normalize the others while they are hidden, so the first breath
        // after the close cannot snap a leftover scale.
        plane.mesh.scale.set(plane.tileWidth, plane.tileHeight, 1);
        plane.material.uniforms.uPlaneSizes.value.set(
          plane.tileWidth,
          plane.tileHeight,
        );
        plane.opacity = 0;
        plane.material.uniforms.uOpacity.value = 0;
      }

      // Keep the target's persistent texture. A stepped-to video may not have
      // an entry yet; load it while the viewer still covers the centre.
      if (media.kind === "video") {
        let entry: VideoEntry | null = videoEntries.get(index) ?? null;
        if (!entry) entry = ensureVideoEntry(index);

        if (entry) {
          entry.element.pause();

          if (entry.texture) {
            applyVideoTexture(index, entry);
          } else {
            await waitForVideoEntry(entry, 500);
            if (entry.texture) applyVideoTexture(index, entry);
          }

          if (entry.texture && time !== undefined) {
            await seekVideo(entry, time);
            entry.texture.needsUpdate = true;
            entry.lastUpload = performance.now();
            await waitFrames(2);
          }
        }
      }

      t.prepared = true;
      t.startedAt = performance.now();
      setTransitioning(true);
      wake();
    }

    function updateIntro(now: number, dtMs: number): boolean {
      if (introElapsed < 0) {
        // Wait for the posters (or a failed one) before starting the clock.
        if (textureLoadMs !== null || now - textureStartedAt > 2500) {
          introElapsed = 0;
        } else {
          grayUniform.value = 1;
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
        introGrayValue = introGray(introElapsed);
        introZoomValue = introZoom(introElapsed);
        introVideos = introVideosReady(introElapsed);
        introEndedFlag = introEnded(introElapsed);
      }

      grayUniform.value = introGrayValue;
      introZoomUniform.value = introZoomValue;

      if (introEndedFlag && !introAnnounced) {
        introAnnounced = true;
        setIntroReady(true);
      }

      return !introEndedFlag;
    }

    function renderFrame(now: number): void {
      raf = 0;

      if (document.hidden) {
        last = 0;
        return;
      }

      const transitionActive =
        transition.phase === "opening" ||
        transition.phase === "closing" ||
        (transition.phase === "open" &&
          (transition.waitingForViewer || transition.handoffAt >= 0));

      if (pausedRef.current && !transitionActive) {
        last = 0;
        return;
      }

      if (breathOnly && now - lastRenderAt < BREATH.frameMs) {
        raf = requestAnimationFrame(renderFrame);
        return;
      }

      lastRenderAt = now;

      const dtMs = last ? Math.min(48, Math.max(0, now - last)) : FRAME_MS;
      const dt = dtMs / FRAME_MS;
      last = now;

      const introActive = updateIntro(now, dtMs);
      const transitionRunning = updateTransition(now);
      const moving = panTick(now);
      const zooming = updateCamera(dt);
      const fading = updatePlanes(dt, now);
      const videosActive = syncVideos(now);
      const lensActive = updateLens(dt, now);
      const breathMoving =
        panIsDragging() || panSpeed() > BREATH.settleSpeed;
      const breathing = updateBreathing(now, breathMoving, dtMs);

      updateVideoFallback(now);
      renderedFrames += 1;
      renderScene();
      updateDebug();

      const otherActive =
        moving ||
        zooming ||
        fading ||
        videosActive ||
        lensActive ||
        introActive ||
        transitionRunning ||
        transitionActive;

      breathOnly = breathing && !otherActive;

      if (otherActive || breathing) {
        raf = requestAnimationFrame(renderFrame);
      } else {
        last = 0;
      }
    }

    function wake(): void {
      if (disposed || document.hidden) {
        return;
      }

      breathOnly = false;

      if (raf !== 0) {
        return;
      }

      const transitionActive =
        transition.phase === "opening" ||
        transition.phase === "closing" ||
        (transition.phase === "open" &&
          (transition.waitingForViewer || transition.handoffAt >= 0));

      if (pausedRef.current && !transitionActive) {
        return;
      }

      last = 0;
      raf = requestAnimationFrame(renderFrame);
    }

    function resize(): void {
      const rect = hostElement.getBoundingClientRect();
      const nextWidth = Math.max(1, Math.round(rect.width));
      const nextHeight = Math.max(1, Math.round(rect.height));

      if (planes.length > 0 && nextWidth === width && nextHeight === height) {
        return;
      }

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

      buildPlanes();
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
    document.addEventListener("visibilitychange", onVisibilityChange);
    motionQuery.addEventListener("change", onMotionChange);

    const surface = containerRef.current;
    const onPreloadPointerDown = (event: PointerEvent) => {
      if (event.button !== 0 || pausedRef.current || !introEndedFlag) return;
      if (!canOpen(transition.phase)) return;

      const plane = planeAt(event.clientX, event.clientY);
      if (plane) preloadItem(plane.itemIndex);
    };
    surface?.addEventListener("pointerdown", onPreloadPointerDown, {
      passive: true,
    });

    wakeRef.current = wake;
    pickRef.current = pick;
    centerRef.current = openCentred;
    restoreRef.current = revealPlane;
    pauseVideosRef.current = pauseAllVideos;
    api.rectForIndex = rectForIndex;
    api.reveal = revealPlane;
    api.handoff = handoff;
    api.closeTo = closeTo;

    resize();

    return () => {
      disposed = true;

      if (raf !== 0) cancelAnimationFrame(raf);
      if (resizeFrame !== 0) cancelAnimationFrame(resizeFrame);

      resizeObserver.disconnect();
      document.removeEventListener("visibilitychange", onVisibilityChange);
      motionQuery.removeEventListener("change", onMotionChange);
      surface?.removeEventListener("pointerdown", onPreloadPointerDown);

      wakeRef.current = () => {};
      pickRef.current = () => {};
      centerRef.current = () => {};
      restoreRef.current = () => {};
      pauseVideosRef.current = () => {};
      api.rectForIndex = () => null;
      api.reveal = () => {};
      api.handoff = () => {};
      api.closeTo = async () => {};

      pauseAllVideos();

      for (const itemIndex of [...videoEntries.keys()]) {
        disposeVideoEntry(itemIndex);
      }

      for (const element of preloaded.values()) {
        if (element instanceof HTMLVideoElement) {
          element.pause();
          element.removeAttribute("src");
          element.load();
          element.remove();
        }
      }
      preloaded.clear();

      videoHost.remove();
      disposePlanes();
      geometry.dispose();
      renderTarget.dispose();
      postGeometry.dispose();
      postMaterial.dispose();

      for (const entry of textures.values()) {
        entry.texture.dispose();
      }

      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    };
  }, [items, panHalt, panIsDragging, panSpeed, panTick, scrollRef, containerRef]);

  return (
    <div
      ref={containerRef}
      className="cv-surface"
      data-canvas-surface
      tabIndex={0}
      role="region"
      aria-label="WebGL media canvas. Drag or scroll to move, hold the arrow keys to pan, and press Enter to open the centred media."
      inert={paused}
      {...handlers}
      onDragStart={(event) => event.preventDefault()}
      onContextMenu={(event) => event.preventDefault()}
    >
      <div ref={canvasHostRef} className="cv-webgl-host" aria-hidden="true" />

      {webglFailed ? <StaticFallback items={items} /> : null}

      {items.length === 0 ? (
        <p className="cv-empty">
          No media manifests found. Run <code>pnpm post</code> first.
        </p>
      ) : null}
    </div>
  );
});
