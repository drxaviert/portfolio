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
import { gridMetrics, orientationRatio } from "./grid";
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
};

export type InfiniteCanvasProps = {
  items: CanvasItem[];
  paused: boolean;
  onOpen: (index: number, rect: Box) => void;
};

const CAMERA_Z = 500;
const CAMERA_DRAG_Z = 475;
const FRAME_MS = 1000 / 60;
const TEXTURE_TARGET_WIDTH = 640;
const TEXTURE_ZOOM = 1.06;
const PARALLAX_LIMIT = 0.025;

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
  uniform float uOpacity;

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
    uv = (uv - 0.5) / uZoom + 0.5;
    uv += uParallax;

    vec4 texel = texture2D(uTexture, uv);
    gl_FragColor = vec4(texel.rgb, uOpacity);

    #include <colorspace_fragment>
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
  /** Cell centre in screen px relative to the viewport centre, before scroll. */
  baseX: number;
  baseY: number;
  textureUrl: string;
  loaded: boolean;
  opacity: number;
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
  scroll: { x: number; y: number };
  dragging: boolean;
  hidden: boolean;
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
>(function InfiniteCanvas({ items, paused, onOpen }, ref) {
  const canvasHostRef = useRef<HTMLDivElement | null>(null);
  const [webglFailed, setWebglFailed] = useState(false);
  const reduceMotion = useReducedMotion();

  const apiRef = useRef<InfiniteCanvasHandle>({
    rectForIndex: () => null,
    reveal: () => {},
  });
  const wakeRef = useRef<() => void>(() => {});
  const pickRef = useRef<(x: number, y: number) => void>(() => {});
  const centerRef = useRef<() => void>(() => {});
  const restoreRef = useRef<() => void>(() => {});
  const pausedRef = useRef(paused);
  const onOpenRef = useRef(onOpen);

  useImperativeHandle(ref, () => apiRef.current, []);

  useEffect(() => {
    onOpenRef.current = onOpen;
  }, [onOpen]);

  useEffect(() => {
    pausedRef.current = paused;

    if (!paused) {
      restoreRef.current();
      wakeRef.current();
    }
  }, [paused]);

  const pan = usePan({
    reduceMotion,
    disabled: paused,
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
    renderer.domElement.className = "cv-webgl";
    hostElement.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 2000);
    camera.position.set(0, 0, CAMERA_Z);
    camera.lookAt(0, 0, 0);

    const geometry = new THREE.PlaneGeometry(1, 1);
    const parallaxUniform = { value: new THREE.Vector2() };
    const zoomUniform = { value: TEXTURE_ZOOM };
    const loader = new THREE.TextureLoader();
    const raycaster = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    const corner = new THREE.Vector3();
    const projected = new THREE.Vector3();
    const textures = new Map<string, TextureEntry>();
    const planeByMesh = new Map<THREE.Object3D, Plane>();
    const textureStartedAt = performance.now();
    let textureLoadMs: number | null = null;

    let planes: Plane[] = [];
    let cols = 0;
    let rows = 0;
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
    let resizeFrame = 0;
    let reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

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
            scroll: { x: 0, y: 0 },
            dragging: false,
            hidden: false,
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
      const { baseWidth } = grid;

      pitchX = grid.pitchX;
      pitchY = grid.pitchY;
      cols = grid.cols;
      rows = grid.rows;
      halfX = grid.halfX;
      halfY = grid.halfY;

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
          const opacity = entry.loaded ? 1 : 0;

          const material = new THREE.ShaderMaterial({
            uniforms: {
              uTexture: { value: entry.texture },
              uImageSizes: {
                value: new THREE.Vector2(media.width, media.height),
              },
              uPlaneSizes: {
                value: new THREE.Vector2(planeWidth, planeHeight),
              },
              uParallax: parallaxUniform,
              uZoom: zoomUniform,
              uOpacity: { value: opacity },
            },
            vertexShader: VERTEX_SHADER,
            fragmentShader: FRAGMENT_SHADER,
            transparent: true,
            depthTest: false,
            depthWrite: false,
            toneMapped: false,
          });

          const mesh = new THREE.Mesh(geometry, material);
          mesh.scale.set(planeWidth, planeHeight, 1);
          mesh.position.set(
            (col - (cols - 1) / 2) * pitchX,
            -((row - (rows - 1) / 2) * pitchY),
            0,
          );
          mesh.frustumCulled = true;
          scene.add(mesh);

          const plane: Plane = {
            mesh,
            material,
            itemIndex,
            baseX: (col - (cols - 1) / 2) * pitchX,
            baseY: (row - (rows - 1) / 2) * pitchY,
            textureUrl: url,
            loaded: entry.loaded,
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
      debug.scroll.x = scrollRef.current.x;
      debug.scroll.y = scrollRef.current.y;
      debug.dragging = panIsDragging();
      debug.hidden = hiddenPlane !== null;
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
      renderer.render(scene, camera);
      updateDebug();
    }

    function revealPlane(): void {
      if (!hiddenPlane) return;

      const plane = hiddenPlane;
      hiddenPlane = null;
      plane.mesh.visible = true;
      plane.opacity = 1;
      plane.material.uniforms.uOpacity.value = 1;
      renderer.render(scene, camera);
      updateDebug();
      wake();
    }

    function openPlane(plane: Plane): void {
      const rect = projectPlane(plane);
      if (rect.width < 1 || rect.height < 1) return;

      hidePlane(plane);
      onOpenRef.current(plane.itemIndex, rect);
    }

    function pick(x: number, y: number): void {
      const rect = hostElement.getBoundingClientRect();
      if (rect.width < 1 || rect.height < 1) return;

      ndc.set(
        ((x - rect.left) / rect.width) * 2 - 1,
        -(((y - rect.top) / rect.height) * 2 - 1),
      );

      camera.updateMatrixWorld();
      scene.updateMatrixWorld(true);
      raycaster.setFromCamera(ndc, camera);

      const meshes = planes
        .filter((plane) => plane.mesh.visible && plane.opacity > 0.5)
        .map((plane) => plane.mesh);
      const hit = raycaster.intersectObjects(meshes, false)[0];

      if (!hit) return;

      const plane = planeByMesh.get(hit.object);
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

    function updateCamera(dt: number): boolean {
      const targetZ = panIsDragging() && !reduced ? CAMERA_DRAG_Z : CAMERA_Z;
      const ease = 1 - Math.pow(0.975, dt);

      camera.position.z += (targetZ - camera.position.z) * ease;

      if (Math.abs(targetZ - camera.position.z) < 0.001) {
        camera.position.z = targetZ;
      }

      return Math.abs(targetZ - camera.position.z) > 0.001;
    }

    function updatePlanes(dt: number): boolean {
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

      let active =
        Math.abs(targetX - parallaxUniform.value.x) > 0.0005 ||
        Math.abs(targetY - parallaxUniform.value.y) > 0.0005;

      const opacityEase = 1 - Math.pow(0.72, dt);

      for (const plane of planes) {
        const x = planePosition(plane.baseX, scroll.x, halfX);
        const y = planePosition(plane.baseY, scroll.y, halfY);
        plane.mesh.position.set(x, -y, 0);

        const target = plane.loaded && plane.mesh.visible ? 1 : 0;

        if (Math.abs(plane.opacity - target) > 0.002) {
          plane.opacity += (target - plane.opacity) * opacityEase;
          active = true;
        } else if (plane.opacity !== target) {
          plane.opacity = target;
        }

        plane.material.uniforms.uOpacity.value = plane.opacity;
      }

      return active;
    }

    function renderFrame(now: number): void {
      raf = 0;

      if (document.hidden || pausedRef.current) {
        last = 0;
        return;
      }

      const dtMs = last ? Math.min(48, Math.max(0, now - last)) : FRAME_MS;
      const dt = dtMs / FRAME_MS;
      last = now;

      const moving = panTick(now);
      const zooming = updateCamera(dt);
      const fading = updatePlanes(dt);

      renderer.render(scene, camera);
      updateDebug();

      if (moving || zooming || fading) {
        raf = requestAnimationFrame(renderFrame);
      } else {
        last = 0;
      }
    }

    function wake(): void {
      if (disposed || raf !== 0 || document.hidden || pausedRef.current) {
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

    wakeRef.current = wake;
    pickRef.current = pick;
    centerRef.current = openCentred;
    restoreRef.current = revealPlane;
    api.rectForIndex = rectForIndex;
    api.reveal = revealPlane;

    resize();

    return () => {
      disposed = true;

      if (raf !== 0) cancelAnimationFrame(raf);
      if (resizeFrame !== 0) cancelAnimationFrame(resizeFrame);

      resizeObserver.disconnect();
      document.removeEventListener("visibilitychange", onVisibilityChange);
      motionQuery.removeEventListener("change", onMotionChange);

      wakeRef.current = () => {};
      pickRef.current = () => {};
      centerRef.current = () => {};
      restoreRef.current = () => {};
      api.rectForIndex = () => null;
      api.reveal = () => {};

      disposePlanes();
      geometry.dispose();

      for (const entry of textures.values()) {
        entry.texture.dispose();
      }

      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    };
  }, [items, panIsDragging, panTick, scrollRef]);

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
