"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { createPropSet } from "./props";
import { Spring } from "./springs";
import type { HoverVariant } from "./variant";

type HumanContactSceneProps = {
  variant: HoverVariant;
};

const FOV = 28;
const CAMERA_Y = 5;
const CAMERA_Z = 210;
const VISIBLE_HEIGHT = 2 * CAMERA_Z * Math.tan((FOV * Math.PI) / 360);
/** 8 columns and 4 rows inside a 16:9 frame; extra cells sit on the edges. */
const SPACING_X = (VISIBLE_HEIGHT * (16 / 9)) / 8;
const SPACING_Y = VISIBLE_HEIGHT / 4;

const HOVER_SCALE = 1.25;
const LIFT_Z = 16;
const NUDGE_NEAR = 3.2;
const NUDGE_FAR = 1.1;
const SHADOW_DEPTH = -6;

type SceneProp = {
  root: THREE.Group;
  bob: THREE.Group;
  shadow: THREE.Mesh;
  shadowMaterial: THREE.MeshBasicMaterial;
  row: number;
  col: number;
  restX: number;
  restY: number;
  restZ: number;
  baseRX: number;
  baseRY: number;
  baseRZ: number;
  sizeScale: number;
  shadowX: number;
  shadowY: number;
  shadowW: number;
  shadowH: number;
  shadowOpacity: number;
  idleSpeed: number;
  idlePhase: number;
  idlePhase2: number;
  idlePhase3: number;
  idleAmp: number;
  hoverTiltX: number;
  hoverTiltZ: number;
  springs: {
    scale: Spring;
    lift: Spring;
    nudgeX: Spring;
    nudgeY: Spring;
    rotX: Spring;
    rotZ: Spring;
  };
};

/** Stable per-index randomness; layout rebuilds keep the same arrangement. */
function hash(index: number, salt: number): number {
  const value = Math.sin(index * 127.1 + salt * 311.7) * 43758.5453;

  return value - Math.floor(value);
}

export function HumanContactScene({ variant }: HumanContactSceneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const controlsRef = useRef<{
    setVariant: (next: HoverVariant) => void;
  } | null>(null);
  const variantRef = useRef(variant);

  useEffect(() => {
    variantRef.current = variant;
    controlsRef.current?.setVariant(variant);
  }, [variant]);

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
      // No WebGL: the page keeps its #111 backdrop and the overlay still reads.
      host.dataset.scene = "unavailable";

      return;
    }

    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    renderer.setPixelRatio(dpr);
    renderer.setSize(1, 1, false);
    renderer.setClearColor(0x111111, 1);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
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

    // Key from upper-left: highlights land top-left, blobs sit lower-right.
    const key = new THREE.DirectionalLight(0xffffff, 2.4);

    key.position.set(-140, 170, 230);
    scene.add(key);

    const fill = new THREE.DirectionalLight(0xd8e0ea, 0.55);

    fill.position.set(160, -70, 140);
    scene.add(fill);

    const rim = new THREE.DirectionalLight(0xffffff, 0.7);

    rim.position.set(70, 180, -200);
    scene.add(rim);

    scene.add(new THREE.HemisphereLight(0xffffff, 0x111111, 0.6));

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

    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const reducedMotion = () => media.matches;

    let activeVariant: HoverVariant = variantRef.current;
    let hovered: SceneProp | null = null;
    let pointerTiltX = 0;
    let pointerTiltZ = 0;
    let elapsed = 0;
    let running = false;
    let inView = true;
    let lastWidth = 0;
    let lastHeight = 0;
    let lastFrame = 0;
    let raf = 0;

    function renderFrame(): void {
      renderer.render(scene, camera);

      if (host.dataset.scene !== "ready") {
        host.dataset.scene = "ready";
      }
    }

    function applyProps(time: number): void {
      const reduced = reducedMotion();

      for (const prop of props) {
        const drift = reduced
          ? 0
          : Math.sin(time * prop.idleSpeed + prop.idlePhase) * prop.idleAmp;
        const driftRz = reduced
          ? 0
          : Math.sin(time * prop.idleSpeed * 0.73 + prop.idlePhase2) * 0.02;
        const driftRx = reduced
          ? 0
          : Math.sin(time * prop.idleSpeed * 0.61 + prop.idlePhase3) * 0.012;

        prop.root.position.set(
          prop.restX + prop.springs.nudgeX.value,
          prop.restY + prop.springs.nudgeY.value,
          prop.restZ,
        );
        prop.bob.position.set(0, drift, prop.springs.lift.value);
        prop.bob.rotation.set(
          prop.baseRX + driftRx + prop.springs.rotX.value,
          prop.baseRY,
          prop.baseRZ + driftRz + prop.springs.rotZ.value,
        );
        prop.bob.scale.setScalar(prop.sizeScale * prop.springs.scale.value);

        const liftMix = prop.springs.lift.value / LIFT_Z;
        const spread = 1 + 0.24 * liftMix;

        prop.shadow.position.set(
          prop.restX + prop.springs.nudgeX.value + prop.shadowX,
          prop.restY + prop.springs.nudgeY.value + prop.shadowY,
          prop.restZ + SHADOW_DEPTH,
        );
        prop.shadow.rotation.z = prop.baseRZ;
        prop.shadow.scale.set(prop.shadowW * spread, prop.shadowH * spread, 1);
        prop.shadowMaterial.opacity = prop.shadowOpacity * (1 - 0.35 * liftMix);
      }
    }

    function syncTargets(): void {
      const reduced = reducedMotion();
      const variantNow = activeVariant;

      for (const prop of props) {
        const isHovered = prop === hovered;

        prop.springs.scale.target = isHovered ? HOVER_SCALE : 1;
        prop.springs.lift.target =
          !reduced && isHovered && variantNow === "b" ? LIFT_Z : 0;
        prop.springs.rotX.target =
          !reduced && isHovered && variantNow === "b" ? prop.hoverTiltX : 0;
        prop.springs.rotZ.target =
          !reduced && isHovered && variantNow === "b" ? prop.hoverTiltZ : 0;

        let nudgeX = 0;
        let nudgeY = 0;

        if (!reduced && variantNow === "c" && hovered && !isHovered) {
          const dx = prop.restX - hovered.restX;
          const dy = prop.restY - hovered.restY;
          const distance = Math.max(0.0001, Math.hypot(dx, dy));
          const ring = Math.max(
            Math.abs(prop.col - hovered.col),
            Math.abs(prop.row - hovered.row),
          );
          const push = ring <= 1 ? NUDGE_NEAR : ring === 2 ? NUDGE_FAR : 0;

          nudgeX = (dx / distance) * push;
          nudgeY = (dy / distance) * push;
        }

        prop.springs.nudgeX.target = nudgeX;
        prop.springs.nudgeY.target = nudgeY;
      }

      if (reduced) {
        for (const prop of props) {
          prop.springs.scale.snap();
          prop.springs.lift.snap();
          prop.springs.nudgeX.snap();
          prop.springs.nudgeY.snap();
          prop.springs.rotX.snap();
          prop.springs.rotZ.snap();
        }

        applyProps(elapsed);
        renderFrame();
      }
    }

    function setHovered(next: SceneProp | null): void {
      if (next === hovered) {
        return;
      }

      hovered = next;
      host.style.cursor = next ? "pointer" : "default";
      syncTargets();
    }

    function simulate(dt: number): void {
      elapsed += dt;

      for (const prop of props) {
        prop.springs.scale.step(dt);
        prop.springs.lift.step(dt);
        prop.springs.nudgeX.step(dt);
        prop.springs.nudgeY.step(dt);
        prop.springs.rotX.step(dt);
        prop.springs.rotZ.step(dt);
      }

      if (!reducedMotion()) {
        const ease = 1 - Math.pow(5 / 6, dt * 60);

        grid.rotation.x += (pointerTiltX - grid.rotation.x) * ease;
        grid.rotation.z += (pointerTiltZ - grid.rotation.z) * ease;
      }

      applyProps(elapsed);
    }

    function buildGrid(): void {
      hovered = null;
      host.style.cursor = "default";

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

          const root = new THREE.Group();

          root.position.set(restX, restY, restZ);

          const bob = new THREE.Group();

          bob.scale.setScalar(sizeScale);
          bob.add(prototype.object.clone(true));
          root.add(bob);

          const shadowMaterial = new THREE.MeshBasicMaterial({
            map: propSet.shadowTexture,
            color: 0x000000,
            transparent: true,
            opacity: 0.5,
            depthWrite: false,
            fog: false,
          });
          const shadow = new THREE.Mesh(shadowGeometry, shadowMaterial);

          shadow.renderOrder = -1;
          shadow.scale.set(prototype.width * 1.25, prototype.height * 1.08, 1);
          shadow.rotation.z = baseRZ;

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
            row,
            col,
            restX,
            restY,
            restZ,
            baseRX,
            baseRY,
            baseRZ,
            sizeScale,
            shadowX: prototype.width * 0.35,
            shadowY: -prototype.height * 0.44,
            shadowW: prototype.width * 1.25 * sizeScale,
            shadowH: prototype.height * 1.08 * sizeScale,
            shadowOpacity: 0.5,
            idleSpeed: 0.34 + hash(index, 8) * 0.34,
            idlePhase: hash(index, 9) * Math.PI * 2,
            idlePhase2: hash(index, 10) * Math.PI * 2,
            idlePhase3: hash(index, 11) * Math.PI * 2,
            idleAmp: 0.16 + hash(index, 12) * 0.22,
            hoverTiltX: (hash(index, 13) - 0.5) * 0.16,
            hoverTiltZ: (hash(index, 14) - 0.5) * 0.1,
            springs: {
              scale: new Spring(1, 200, 25),
              lift: new Spring(0, 150, 20),
              nudgeX: new Spring(0, 130, 17),
              nudgeY: new Spring(0, 130, 17),
              rotX: new Spring(0, 120, 16),
              rotZ: new Spring(0, 120, 16),
            },
          });
          proxies.push(proxy);
        }
      }

      applyProps(elapsed);
    }

    function resize(): void {
      const rect = host.getBoundingClientRect();
      const width = Math.max(1, rect.width);
      const height = Math.max(1, rect.height);

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

      if (reducedMotion()) {
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
      if (running || reducedMotion()) {
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
      if (document.hidden || !inView || reducedMotion()) {
        stop();

        if (!document.hidden && inView && reducedMotion()) {
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

      const rect = host.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;

      pointerNdc.set(
        (x / Math.max(1, rect.width)) * 2 - 1,
        -(y / Math.max(1, rect.height)) * 2 + 1,
      );
      pointerTiltX = 0.0002 * (event.clientY - window.innerHeight / 2);
      pointerTiltZ = 0.0001 * (event.clientX - window.innerWidth / 2);

      raycaster.setFromCamera(pointerNdc, camera);
      grid.updateMatrixWorld();

      const hit = raycaster.intersectObjects(proxies, false)[0];

      setHovered(
        hit ? (props[hit.object.userData.propIndex as number] ?? null) : null,
      );
    }

    function onPointerLeave(): void {
      pointerTiltX = 0;
      pointerTiltZ = 0;
      setHovered(null);
    }

    function onVisibilityChange(): void {
      updatePlayback();
    }

    function onReducedChange(): void {
      if (reducedMotion()) {
        stop();
        grid.rotation.set(0, 0, 0);
        syncTargets();
      } else {
        updatePlayback();
      }
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
    media.addEventListener("change", onReducedChange);
    host.addEventListener("pointermove", onPointerMove, { passive: true });
    host.addEventListener("pointerleave", onPointerLeave);

    resize();

    if (reducedMotion()) {
      syncTargets();
    } else {
      start();
    }

    controlsRef.current = {
      setVariant: (next: HoverVariant) => {
        activeVariant = next;
        syncTargets();
      },
    };

    return () => {
      stop();
      controlsRef.current = null;
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      document.removeEventListener("visibilitychange", onVisibilityChange);
      media.removeEventListener("change", onReducedChange);
      host.removeEventListener("pointermove", onPointerMove);
      host.removeEventListener("pointerleave", onPointerLeave);

      for (const prop of props) {
        prop.shadowMaterial.dispose();
      }

      props.length = 0;
      proxies.length = 0;
      grid.clear();
      propSet.dispose();
      shadowGeometry.dispose();
      proxyGeometry.dispose();
      proxyMaterial.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
      delete host.dataset.scene;
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
