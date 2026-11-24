"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { useReducedMotion } from "@/components/home/use-reduced-motion";
import { FILM_LIGHTING, type LightSpec } from "./lighting";
import {
  createWaveConfig,
  sampleWave,
  shadowForLift,
  type WaveConfig,
} from "./motion";
import { createPropSet } from "./props";
import { Spring } from "./springs";

type HumanContactSceneProps = {
  /** The browser could not keep a live context; the still behind it takes over. */
  onFallback?: () => void;
  /** The first frame is on the canvas; the cover can crossfade to it. */
  onReady?: () => void;
  /** The effect is gone (unmount or a hidden Activity copy): show the still. */
  onTeardown?: () => void;
};

const FOV = 28;
const CAMERA_Y = 5;
const CAMERA_Z = 210;
const VISIBLE_HEIGHT = 2 * CAMERA_Z * Math.tan((FOV * Math.PI) / 360);
/** 8 columns and 4 rows inside a 16:9 frame; extra cells sit on the edges. */
const SPACING_X = (VISIBLE_HEIGHT * (16 / 9)) / 8;
const SPACING_Y = VISIBLE_HEIGHT / 4;

const HOVER_SCALE = 1.25;
const TAP_HOLD_MS = 300;
const SHADOW_DEPTH = -6;
const COARSE_DRAG_PX = 8;

type SceneProp = {
  root: THREE.Group;
  bob: THREE.Group;
  shadow: THREE.Mesh;
  shadowMaterial: THREE.MeshBasicMaterial;
  restX: number;
  restY: number;
  restZ: number;
  baseRX: number;
  baseRY: number;
  baseRZ: number;
  sizeScale: number;
  wave: WaveConfig;
  shadowBaseX: number;
  shadowBaseY: number;
  shadowBaseZ: number;
  shadowBaseW: number;
  shadowBaseH: number;
  springs: {
    scale: Spring;
  };
};

type DebugObject = {
  z: number;
  turnX: number;
  turnY: number;
  phase: number;
  period: number;
  scale: number;
  shadowScale: number;
  shadowOpacity: number;
};

type DebugWindow = Window & {
  __humanContactDebug?: {
    fieldRotation: () => { x: number; y: number; z: number };
    objects: () => DebugObject[];
  };
};

/** Stable per-index randomness; layout rebuilds keep the same arrangement. */
function hash(index: number, salt: number): number {
  const value = Math.sin(index * 127.1 + salt * 311.7) * 43758.5453;

  return value - Math.floor(value);
}

export function HumanContactScene({
  onFallback,
  onReady,
  onTeardown,
}: HumanContactSceneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const controlsRef = useRef<{
    setReduced: (next: boolean) => void;
  } | null>(null);
  const reduced = useReducedMotion();
  const reducedRef = useRef(reduced);
  const fallbackRef = useRef(onFallback);
  const readyRef = useRef(onReady);
  const teardownRef = useRef(onTeardown);

  useEffect(() => {
    fallbackRef.current = onFallback;
    readyRef.current = onReady;
    teardownRef.current = onTeardown;
  }, [onFallback, onReady, onTeardown]);

  useEffect(() => {
    reducedRef.current = reduced;
    controlsRef.current?.setReduced(reduced);
  }, [reduced]);

  useEffect(() => {
    const hostElement = containerRef.current;

    if (!hostElement) {
      return;
    }

    // Non-null alias: the functions below are hoisted, so the narrowing above
    // does not survive into them.
    const host: HTMLDivElement = hostElement;

    let renderer: THREE.WebGLRenderer;

    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        powerPreference: "high-performance",
      });
    } catch {
      // The wrapper's still stays visible; the overlay still reads.
      host.dataset.scene = "unavailable";
      fallbackRef.current?.();

      return;
    }

    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    renderer.setPixelRatio(dpr);
    renderer.setSize(1, 1, false);
    renderer.setClearColor(0x111111, 1);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.domElement.style.display = "block";
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();

    scene.background = new THREE.Color(0x111111);
    scene.fog = new THREE.Fog(0x111111, 20, 500);

    const camera = new THREE.PerspectiveCamera(FOV, 1, 1, 1000);

    camera.position.set(0, CAMERA_Y, CAMERA_Z);
    camera.lookAt(0, 0, 0);

    const lightRig = new THREE.Group();

    scene.add(lightRig);
    renderer.toneMappingExposure = FILM_LIGHTING.exposure;

    const shadowBaseOpacity = FILM_LIGHTING.shadowOpacity;
    const shadowScale = FILM_LIGHTING.shadowScale;

    function createLight(spec: LightSpec): THREE.Light {
      if (spec.type === "directional") {
        const light = new THREE.DirectionalLight(spec.color, spec.intensity);

        light.position.set(...spec.position);

        return light;
      }

      return new THREE.HemisphereLight(spec.sky, spec.ground, spec.intensity);
    }

    for (const spec of FILM_LIGHTING.lights) {
      lightRig.add(createLight(spec));
    }

    // The field is fixed. Only the props move inside it; the camera never
    // moves and the grid group is never rotated.
    const grid = new THREE.Group();

    scene.add(grid);

    const propSet = createPropSet();
    const shadowGeometry = new THREE.PlaneGeometry(1, 1);
    const proxyGeometry = new THREE.SphereGeometry(1, 12, 8);
    const proxyMaterial = new THREE.MeshBasicMaterial({ visible: false });

    const props: SceneProp[] = [];
    const proxies: THREE.Mesh[] = [];
    const raycaster = new THREE.Raycaster();
    const pointerNdc = new THREE.Vector2();
    const hoverQuery = window.matchMedia("(hover: hover) and (pointer: fine)");

    let reducedNow = reducedRef.current;
    let hovered: SceneProp | null = null;
    let tapCandidate: SceneProp | null = null;
    let tapStartX = 0;
    let tapStartY = 0;
    let tapTimer: number | null = null;
    let elapsed = 0;
    let running = false;
    let inView = true;
    let lastWidth = 0;
    let lastHeight = 0;
    let lastFrame = 0;
    let raf = 0;

    host.style.cursor = hoverQuery.matches ? "default" : "";

    function renderFrame(): void {
      renderer.render(scene, camera);

      if (host.dataset.scene !== "ready") {
        host.dataset.scene = "ready";
        readyRef.current?.();
      }
    }

    function applyProps(time: number): void {
      for (const prop of props) {
        const wave = sampleWave(prop.wave, time, reducedNow);
        const lift =
          prop.wave.amplitude === 0 ? 0 : wave.z / prop.wave.amplitude;
        const shadow = shadowForLift(lift, shadowBaseOpacity);

        prop.root.position.set(prop.restX, prop.restY, prop.restZ);
        prop.bob.position.set(0, 0, wave.z);
        prop.bob.rotation.set(
          prop.baseRX + wave.turnX,
          prop.baseRY + wave.turnY,
          prop.baseRZ,
        );
        prop.bob.scale.setScalar(prop.sizeScale * prop.springs.scale.value);

        prop.shadow.position.set(
          prop.shadowBaseX + shadow.offsetX,
          prop.shadowBaseY + shadow.offsetY,
          prop.shadowBaseZ,
        );
        prop.shadow.scale.set(
          prop.shadowBaseW * shadowScale * shadow.scale,
          prop.shadowBaseH * shadowScale * shadow.scale,
          1,
        );
        prop.shadowMaterial.opacity = shadow.opacity;
      }
    }

    function syncTargets(): void {
      for (const prop of props) {
        prop.springs.scale.target = prop === hovered ? HOVER_SCALE : 1;

        if (reducedNow) {
          prop.springs.scale.snap();
        }
      }

      if (reducedNow) {
        applyProps(elapsed);
        renderFrame();
      }
    }

    function clearTapTimer(): void {
      if (tapTimer !== null) {
        window.clearTimeout(tapTimer);
        tapTimer = null;
      }
    }

    function setHovered(next: SceneProp | null): void {
      if (next === hovered) {
        return;
      }

      hovered = next;
      host.toggleAttribute("data-active", next !== null);

      if (hoverQuery.matches) {
        host.style.cursor = next ? "pointer" : "default";
      }

      syncTargets();
    }

    function pickAt(clientX: number, clientY: number): SceneProp | null {
      const rect = host.getBoundingClientRect();

      pointerNdc.set(
        ((clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1,
        -((clientY - rect.top) / Math.max(1, rect.height)) * 2 + 1,
      );
      raycaster.setFromCamera(pointerNdc, camera);
      grid.updateMatrixWorld();

      const hit = raycaster.intersectObjects(proxies, false)[0];

      return hit
        ? (props[hit.object.userData.propIndex as number] ?? null)
        : null;
    }

    function simulate(dt: number): void {
      elapsed += dt;

      for (const prop of props) {
        prop.springs.scale.step(dt);
      }

      applyProps(elapsed);
    }

    function buildGrid(): void {
      hovered = null;
      clearTapTimer();
      host.removeAttribute("data-active");
      host.style.cursor = hoverQuery.matches ? "default" : "";

      for (const prop of props) {
        prop.shadowMaterial.dispose();
      }

      props.length = 0;
      proxies.length = 0;
      grid.clear();

      const aspect = camera.aspect;
      const visibleWidth = VISIBLE_HEIGHT * aspect;
      const cols = Math.max(
        5,
        Math.min(18, Math.round(visibleWidth / SPACING_X) + 1),
      );
      const rows = Math.max(
        4,
        Math.min(8, Math.round(VISIBLE_HEIGHT / SPACING_Y) + 1),
      );

      for (let row = 0; row < rows; row += 1) {
        for (let col = 0; col < cols; col += 1) {
          const index = row * cols + col;
          const prototype =
            propSet.prototypes[index % propSet.prototypes.length];
          const stagger = row % 2 === 0 ? 0 : SPACING_X * 0.5;
          const restX =
            (col - (cols - 1) / 2) * SPACING_X +
            stagger +
            (hash(index, 1) - 0.5) * 3;
          const restY =
            ((rows - 1) / 2 - row) * SPACING_Y + (hash(index, 2) - 0.5) * 2.4;
          const restZ = (hash(index, 3) - 0.5) * 2.4;
          const sizeScale = 0.91 + hash(index, 4) * 0.18;
          const baseRZ = (hash(index, 5) - 0.5) * 0.9;
          const baseRX = (hash(index, 6) - 0.5) * 0.22;
          const baseRY = (hash(index, 7) - 0.5) * 0.28;
          const wave = createWaveConfig(col, row, (salt) =>
            hash(index, salt + 16),
          );

          const root = new THREE.Group();

          root.position.set(restX, restY, restZ);

          const bob = new THREE.Group();

          bob.scale.setScalar(sizeScale);
          bob.add(prototype.object.clone(true));
          root.add(bob);

          const shadowBaseX = restX + prototype.width * 0.35;
          const shadowBaseY = restY - prototype.height * 0.44;
          const shadowBaseZ = restZ + SHADOW_DEPTH;
          const shadowBaseW = prototype.width * 1.25 * sizeScale;
          const shadowBaseH = prototype.height * 1.08 * sizeScale;
          const shadowMaterial = new THREE.MeshBasicMaterial({
            map: propSet.shadowTexture,
            color: 0x000000,
            transparent: true,
            opacity: shadowBaseOpacity,
            depthWrite: false,
            fog: false,
          });
          const shadow = new THREE.Mesh(shadowGeometry, shadowMaterial);

          shadow.position.set(shadowBaseX, shadowBaseY, shadowBaseZ);
          shadow.scale.set(shadowBaseW, shadowBaseH, 1);
          shadow.rotation.z = baseRZ;
          shadow.renderOrder = -1;

          const proxy = new THREE.Mesh(proxyGeometry, proxyMaterial);

          proxy.scale.setScalar(prototype.radius * sizeScale * 0.95);
          proxy.visible = false;
          proxy.userData.propIndex = props.length;
          root.add(proxy);

          grid.add(root, shadow);
          props.push({
            root,
            bob,
            shadow,
            shadowMaterial,
            restX,
            restY,
            restZ,
            baseRX,
            baseRY,
            baseRZ,
            sizeScale,
            wave,
            shadowBaseX,
            shadowBaseY,
            shadowBaseZ,
            shadowBaseW,
            shadowBaseH,
            springs: {
              scale: new Spring(1, 200, 25),
            },
          });
          proxies.push(proxy);
        }
      }

      applyProps(elapsed);
    }

    function resize(): void {
      // The layout box, not the transformed one: the reader panel scales during
      // the expand morph, and rebuilding the grid every frame of it would be
      // wasted work. The canvas is scaled with the panel anyway.
      const width = Math.max(1, host.offsetWidth);
      const height = Math.max(1, host.offsetHeight);

      if (
        Math.abs(width - lastWidth) < 1 &&
        Math.abs(height - lastHeight) < 1
      ) {
        return;
      }

      lastWidth = width;
      lastHeight = height;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      buildGrid();

      if (reducedNow) {
        renderFrame();
      }
    }

    function frame(now: number): void {
      if (!running) {
        return;
      }

      raf = requestAnimationFrame(frame);

      const dt = Math.min(0.05, Math.max(0.001, (now - lastFrame) / 1000));

      lastFrame = now;
      simulate(dt);
      renderFrame();
    }

    function start(): void {
      if (running || reducedNow) {
        return;
      }

      running = true;
      lastFrame = performance.now();
      raf = requestAnimationFrame(frame);
    }

    function stop(): void {
      running = false;
      cancelAnimationFrame(raf);
    }

    function updatePlayback(): void {
      if (document.hidden || !inView || reducedNow) {
        stop();

        if (!document.hidden && inView && reducedNow) {
          renderFrame();
        }

        return;
      }

      start();
    }

    function onPointerMove(event: PointerEvent): void {
      if (!event.isPrimary) {
        return;
      }

      if (!hoverQuery.matches) {
        if (
          tapCandidate &&
          Math.hypot(event.clientX - tapStartX, event.clientY - tapStartY) >
            COARSE_DRAG_PX
        ) {
          tapCandidate = null;
        }

        return;
      }

      setHovered(pickAt(event.clientX, event.clientY));
    }

    function onPointerDown(event: PointerEvent): void {
      if (!event.isPrimary || hoverQuery.matches) {
        return;
      }

      tapCandidate = pickAt(event.clientX, event.clientY);
      tapStartX = event.clientX;
      tapStartY = event.clientY;
    }

    function onPointerUp(event: PointerEvent): void {
      if (!event.isPrimary || hoverQuery.matches) {
        return;
      }

      const hit = tapCandidate;

      tapCandidate = null;

      if (!hit) {
        return;
      }

      clearTapTimer();
      setHovered(hit);
      tapTimer = window.setTimeout(() => {
        tapTimer = null;
        setHovered(null);
      }, TAP_HOLD_MS);
    }

    function onPointerLeave(): void {
      if (!hoverQuery.matches) {
        return;
      }

      setHovered(null);
    }

    function onPointerCancel(): void {
      tapCandidate = null;
    }

    function onVisibilityChange(): void {
      updatePlayback();
    }

    function onContextLost(event: Event): void {
      event.preventDefault();
      stop();
      fallbackRef.current?.();
    }

    const resizeObserver = new ResizeObserver(resize);
    const intersectionObserver = new IntersectionObserver(
      (entries) => {
        inView = Boolean(entries[0]?.isIntersecting);
        updatePlayback();
      },
      { threshold: 0.01 },
    );

    resizeObserver.observe(host);
    intersectionObserver.observe(host);
    document.addEventListener("visibilitychange", onVisibilityChange);
    renderer.domElement.addEventListener("webglcontextlost", onContextLost);
    host.addEventListener("pointermove", onPointerMove, { passive: true });
    host.addEventListener("pointerdown", onPointerDown, { passive: true });
    host.addEventListener("pointerup", onPointerUp, { passive: true });
    host.addEventListener("pointercancel", onPointerCancel, { passive: true });
    host.addEventListener("pointerleave", onPointerLeave);

    resize();

    const debugWindow = window as DebugWindow;

    if (process.env.NODE_ENV !== "production") {
      // Dev-only probe for the motion checks: the grid must stay at identity,
      // and the per-object samples prove the wave is running and staggered.
      debugWindow.__humanContactDebug = {
        fieldRotation: () => ({
          x: grid.rotation.x,
          y: grid.rotation.y,
          z: grid.rotation.z,
        }),
        objects: () =>
          props.map((prop) => ({
            z: prop.bob.position.z,
            turnX: prop.bob.rotation.x - prop.baseRX,
            turnY: prop.bob.rotation.y - prop.baseRY,
            phase: prop.wave.phase,
            period: prop.wave.period,
            scale: prop.springs.scale.value,
            shadowScale: prop.shadow.scale.x / prop.shadowBaseW,
            shadowOpacity: prop.shadowMaterial.opacity,
          })),
      };
    }

    if (reducedNow) {
      syncTargets();
    } else {
      start();
    }

    controlsRef.current = {
      setReduced: (next: boolean) => {
        reducedNow = next;

        if (next) {
          clearTapTimer();
          stop();
          syncTargets();
        } else {
          updatePlayback();
        }
      },
    };

    return () => {
      stop();
      clearTapTimer();
      controlsRef.current = null;
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      document.removeEventListener("visibilitychange", onVisibilityChange);
      renderer.domElement.removeEventListener(
        "webglcontextlost",
        onContextLost,
      );
      host.removeEventListener("pointermove", onPointerMove);
      host.removeEventListener("pointerdown", onPointerDown);
      host.removeEventListener("pointerup", onPointerUp);
      host.removeEventListener("pointercancel", onPointerCancel);
      host.removeEventListener("pointerleave", onPointerLeave);

      for (const prop of props) {
        prop.shadowMaterial.dispose();
      }

      props.length = 0;
      proxies.length = 0;
      grid.clear();
      lightRig.clear();
      propSet.dispose();
      shadowGeometry.dispose();
      proxyGeometry.dispose();
      proxyMaterial.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
      delete host.dataset.scene;
      delete host.dataset.active;
      teardownRef.current?.();

      if (process.env.NODE_ENV !== "production") {
        delete debugWindow.__humanContactDebug;
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="hc-canvas"
      data-human-contact-canvas=""
      aria-hidden="true"
    />
  );
}
