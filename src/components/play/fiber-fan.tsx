"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { FIBER_FAN_DEFAULTS } from "@/components/play/fiber-fan-settings";
import type { FiberFanSettings } from "@/components/play/fiber-fan-settings";

export type FiberFanProps = Partial<FiberFanSettings> & {
  className?: string;
};

type PhaseKey = "dawn" | "day" | "dusk" | "night";

type PhaseLook = {
  lineOpacity: number;
  tipOpacity: number;
  tipSize: number;
  glow: number;
};

/** Per-phase render tuning. Colours come from the CSS tokens; this is light. */
const PHASE_LOOK: Record<PhaseKey, PhaseLook> = {
  dawn: { lineOpacity: 0.42, tipOpacity: 0.8, tipSize: 3.4, glow: 1 },
  day: { lineOpacity: 0.45, tipOpacity: 0.85, tipSize: 3.2, glow: 1 },
  dusk: { lineOpacity: 0.42, tipOpacity: 0.8, tipSize: 3.4, glow: 1 },
  // Night keeps the strand colour dim and trades line alpha for a wider,
  // softer tip so the fan glows instead of drawing bright white fibres.
  night: { lineOpacity: 0.34, tipOpacity: 0.5, tipSize: 5.2, glow: 0.55 },
};

const SEGMENTS = 10;

const BACKGROUND_VERTEX = /* glsl */ `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const BACKGROUND_FRAGMENT = /* glsl */ `
  varying vec2 vUv;

  uniform vec3 uTop;
  uniform vec3 uMid;
  uniform vec3 uBottom;
  uniform vec3 uGlow;
  uniform float uGlowStrength;
  uniform float uAspect;

  void main() {
    float y = vUv.y;
    vec3 color = mix(uBottom, uMid, smoothstep(0.0, 0.24, y));
    color = mix(color, uTop, smoothstep(0.24, 0.92, y));

    // Soft glow at the base: wide, short, and gone by a third of the height.
    vec2 p = vec2((vUv.x - 0.5) * uAspect * 0.85, (vUv.y + 0.03) * 3.0);
    float glow = exp(-dot(p, p) * 7.0);
    color += uGlow * glow * uGlowStrength;

    gl_FragColor = vec4(color, 1.0);
  }
`;

const STRAND_VERTEX = /* glsl */ `
  attribute float aAlpha;
  varying float vAlpha;

  void main() {
    vAlpha = aAlpha;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const STRAND_FRAGMENT = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  varying float vAlpha;

  void main() {
    gl_FragColor = vec4(uColor, vAlpha * uOpacity);
  }
`;

const TIP_VERTEX = /* glsl */ `
  attribute float aAlpha;
  uniform float uSize;
  varying float vAlpha;

  void main() {
    vAlpha = aAlpha;
    gl_PointSize = uSize;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const TIP_FRAGMENT = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  varying float vAlpha;

  void main() {
    float d = length(gl_PointCoord - vec2(0.5));
    float a = smoothstep(0.5, 0.05, d);
    gl_FragColor = vec4(uColor, a * vAlpha * uOpacity);
  }
`;

function cssColor(
  styles: CSSStyleDeclaration,
  property: string,
  fallback: string,
): THREE.Color {
  const value = styles.getPropertyValue(property).trim();

  return new THREE.Color(value || fallback);
}

function readPhase(): PhaseKey {
  const phase = document.documentElement.dataset.phase;

  return phase === "dawn" || phase === "dusk" || phase === "night"
    ? phase
    : "day";
}

/** Small deterministic PRNG so a rebuild keeps the same fan shape. */
function mulberry32(seed: number): () => number {
  let state = seed;

  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function FiberFan({ className, ...overrides }: FiberFanProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const strandCount = overrides.strandCount ?? FIBER_FAN_DEFAULTS.strandCount;
  const fanAngle = overrides.fanAngle ?? FIBER_FAN_DEFAULTS.fanAngle;
  const glowStrength =
    overrides.glowStrength ?? FIBER_FAN_DEFAULTS.glowStrength;
  const pushRadius = overrides.pushRadius ?? FIBER_FAN_DEFAULTS.pushRadius;
  const pushStrength =
    overrides.pushStrength ?? FIBER_FAN_DEFAULTS.pushStrength;
  const stiffness = overrides.stiffness ?? FIBER_FAN_DEFAULTS.stiffness;
  const damping = overrides.damping ?? FIBER_FAN_DEFAULTS.damping;

  const settingsRef = useRef<FiberFanSettings>({
    strandCount,
    fanAngle,
    glowStrength,
    pushRadius,
    pushStrength,
    stiffness,
    damping,
  });

  const rebuildRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    settingsRef.current = {
      strandCount,
      fanAngle,
      glowStrength,
      pushRadius,
      pushStrength,
      stiffness,
      damping,
    };
  }, [
    strandCount,
    fanAngle,
    glowStrength,
    pushRadius,
    pushStrength,
    stiffness,
    damping,
  ]);

  useEffect(() => {
    rebuildRef.current?.();
  }, [strandCount, fanAngle]);

  useEffect(() => {
    const hostElement = containerRef.current;

    if (!hostElement) {
      return;
    }

    // Non-null alias: the callbacks below are hoisted function declarations,
    // so the narrowing above does not survive into them.
    const host: HTMLDivElement = hostElement;

    let renderer: THREE.WebGLRenderer;

    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        powerPreference: "high-performance",
      });
    } catch {
      // No WebGL: the card keeps its CSS gradient and simply stays still.
      return;
    }

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    renderer.setPixelRatio(dpr);
    renderer.setClearColor(0x000000, 1);
    renderer.domElement.style.display = "block";
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    host.style.touchAction = "pan-y";
    host.appendChild(renderer.domElement);

    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(0, 1, 1, 0, 0.1, 10);

    const size = { width: 0, height: 0 };

    const bgUniforms = {
      uTop: { value: new THREE.Color("#ffe873") },
      uMid: { value: new THREE.Color("#a6d96a") },
      uBottom: { value: new THREE.Color("#8fa8ff") },
      uGlow: { value: new THREE.Color("#fff6c9") },
      uGlowStrength: { value: 0.9 },
      uAspect: { value: 3 },
    };

    const background = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.ShaderMaterial({
        uniforms: bgUniforms,
        vertexShader: BACKGROUND_VERTEX,
        fragmentShader: BACKGROUND_FRAGMENT,
        depthTest: false,
        depthWrite: false,
      }),
    );
    background.position.z = -2;
    background.renderOrder = -1;
    background.frustumCulled = false;
    scene.add(background);

    const strandUniforms = {
      uColor: { value: new THREE.Color("#fffdf2") },
      uOpacity: { value: 0.55 },
    };

    const strandMaterial = new THREE.ShaderMaterial({
      uniforms: strandUniforms,
      vertexShader: STRAND_VERTEX,
      fragmentShader: STRAND_FRAGMENT,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthTest: false,
      depthWrite: false,
    });

    const tipUniforms = {
      uColor: { value: new THREE.Color("#fffdf2") },
      uOpacity: { value: 0.9 },
      uSize: { value: 3.2 * dpr },
    };

    const tipMaterial = new THREE.ShaderMaterial({
      uniforms: tipUniforms,
      vertexShader: TIP_VERTEX,
      fragmentShader: TIP_FRAGMENT,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthTest: false,
      depthWrite: false,
    });

    const strands = new THREE.LineSegments(
      new THREE.BufferGeometry(),
      strandMaterial,
    );
    strands.position.z = -1;
    strands.renderOrder = 1;
    strands.frustumCulled = false;
    scene.add(strands);

    const tips = new THREE.Points(new THREE.BufferGeometry(), tipMaterial);
    tips.position.z = -1;
    tips.renderOrder = 2;
    tips.frustumCulled = false;
    scene.add(tips);

    // Per-strand rest shape and spring state, allocated on build.
    let count = 0;
    let originX = 0;
    let originY = 0;
    let baseX = new Float32Array(0);
    let baseY = new Float32Array(0);
    let tipX = new Float32Array(0);
    let tipY = new Float32Array(0);
    let ctrlX = new Float32Array(0);
    let ctrlY = new Float32Array(0);
    let midX = new Float32Array(0);
    let midY = new Float32Array(0);
    let swayPhase = new Float32Array(0);
    let offsetX = new Float32Array(0);
    let offsetY = new Float32Array(0);
    let velocityX = new Float32Array(0);
    let velocityY = new Float32Array(0);
    let linePositions: Float32Array | null = null;
    let tipPositions: Float32Array | null = null;

    const scratchX = new Float32Array(SEGMENTS + 1);
    const scratchY = new Float32Array(SEGMENTS + 1);
    const built = { count: 0, angle: 0, width: 0, height: 0 };

    let look = PHASE_LOOK.day;

    const pointer = { x: 0, y: 0, active: false };

    let raf = 0;
    let running = false;
    let lastFrame = 0;
    let elapsed = 0;
    let inView = true;
    let started = false;

    function build(): void {
      const settings = settingsRef.current;
      const width = size.width;
      const height = size.height;

      if (
        width < 2 ||
        height < 2 ||
        (built.count === settings.strandCount &&
          built.angle === settings.fanAngle &&
          built.width === width &&
          built.height === height)
      ) {
        return;
      }

      built.count = settings.strandCount;
      built.angle = settings.fanAngle;
      built.width = width;
      built.height = height;

      count = Math.max(2, Math.round(settings.strandCount));
      originX = width / 2;
      originY = -Math.max(18, height * 0.1);

      baseX = new Float32Array(count);
      baseY = new Float32Array(count);
      tipX = new Float32Array(count);
      tipY = new Float32Array(count);
      ctrlX = new Float32Array(count);
      ctrlY = new Float32Array(count);
      midX = new Float32Array(count);
      midY = new Float32Array(count);
      swayPhase = new Float32Array(count);
      offsetX = new Float32Array(count);
      offsetY = new Float32Array(count);
      velocityX = new Float32Array(count);
      velocityY = new Float32Array(count);

      const random = mulberry32(0x9e3779b9);
      const halfAngle = (settings.fanAngle * Math.PI) / 360;
      const radiusX = width * 0.46;
      const radiusY = height * 0.95;

      for (let i = 0; i < count; i += 1) {
        // Even angular spread with a little jitter, so the arc stays ragged.
        const jitter = (random() - 0.5) * ((2 * halfAngle) / count) * 1.4;
        const angle = -halfAngle + 2 * halfAngle * ((i + 0.5) / count) + jitter;
        const sin = Math.sin(angle);
        const cos = Math.cos(angle);

        // A small cluster at the base instead of one exact point: 560 strands
        // converging on a pixel would read as a solid white plug.
        baseX[i] = originX + (random() - 0.5) * 16;
        baseY[i] = originY + (random() - 0.5) * 10;

        // Elliptical tips fill a wide card: the arc sweeps from the bottom
        // corners over the top and back down.
        let length = Math.hypot(radiusX * sin, radiusY * cos);
        length *= 0.94 + random() * 0.09;

        if (random() < 0.1) {
          length *= 0.84;
        }

        tipX[i] = originX + sin * length;
        tipY[i] = originY + cos * length;

        const curl = (random() - 0.5) * length * 0.09;
        ctrlX[i] = originX + sin * length * 0.55 + cos * curl;
        ctrlY[i] = originY + cos * length * 0.55 - sin * curl;

        // Sampling point for the pointer force, just past the middle.
        const midT = 0.62;
        const inv = 1 - midT;
        midX[i] =
          inv * inv * originX +
          2 * inv * midT * ctrlX[i] +
          midT * midT * tipX[i];
        midY[i] =
          inv * inv * originY +
          2 * inv * midT * ctrlY[i] +
          midT * midT * tipY[i];

        swayPhase[i] = random() * Math.PI * 2;
      }

      // Lines: 10 segments per strand, duplicated vertices for LineSegments.
      const vertexCount = count * SEGMENTS * 2;
      linePositions = new Float32Array(vertexCount * 3);
      const lineAlphas = new Float32Array(vertexCount);

      let alphaIndex = 0;

      for (let i = 0; i < count; i += 1) {
        const strandAlpha = 0.38 + random() * 0.36;

        for (let segment = 0; segment < SEGMENTS; segment += 1) {
          const startAlpha = (1 - 0.72 * (segment / SEGMENTS)) * strandAlpha;
          const endAlpha =
            (1 - 0.72 * ((segment + 1) / SEGMENTS)) * strandAlpha;
          lineAlphas[alphaIndex] = startAlpha;
          lineAlphas[alphaIndex + 1] = endAlpha;
          alphaIndex += 2;
        }
      }

      if (strands.geometry) {
        strands.geometry.dispose();
      }

      const lineGeometry = new THREE.BufferGeometry();
      lineGeometry.setAttribute(
        "position",
        new THREE.BufferAttribute(linePositions, 3).setUsage(
          THREE.DynamicDrawUsage,
        ),
      );
      lineGeometry.setAttribute(
        "aAlpha",
        new THREE.BufferAttribute(lineAlphas, 1),
      );
      strands.geometry = lineGeometry;

      tipPositions = new Float32Array(count * 3);
      const tipAlphas = new Float32Array(count);

      for (let i = 0; i < count; i += 1) {
        tipAlphas[i] = 0.7 + random() * 0.3;
      }

      if (tips.geometry) {
        tips.geometry.dispose();
      }

      const tipGeometry = new THREE.BufferGeometry();
      tipGeometry.setAttribute(
        "position",
        new THREE.BufferAttribute(tipPositions, 3).setUsage(
          THREE.DynamicDrawUsage,
        ),
      );
      tipGeometry.setAttribute(
        "aAlpha",
        new THREE.BufferAttribute(tipAlphas, 1),
      );
      tips.geometry = tipGeometry;

      background.scale.set(width, height, 1);
      background.position.set(width / 2, height / 2, -2);
      bgUniforms.uAspect.value = width / Math.max(1, height);

      writeFrame(0);
    }

    function simulate(dt: number): void {
      const settings = settingsRef.current;
      const stiffnessNow = settings.stiffness;
      const dampingNow = settings.damping;
      const radius = settings.pushRadius;
      const radiusSq = radius * radius;
      const strength = settings.pushStrength;

      for (let i = 0; i < count; i += 1) {
        let targetX = 0;
        let targetY = 0;

        if (pointer.active) {
          const dx = midX[i] - pointer.x;
          const dy = midY[i] - pointer.y;
          const distanceSq = dx * dx + dy * dy;

          if (distanceSq < radiusSq && distanceSq > 0.0001) {
            const distance = Math.sqrt(distanceSq);
            const falloff = 1 - distance / radius;
            const magnitude = strength * falloff * falloff;
            targetX = (dx / distance) * magnitude;
            targetY = (dy / distance) * magnitude;
          }
        }

        const accelX =
          (targetX - offsetX[i]) * stiffnessNow - velocityX[i] * dampingNow;
        const accelY =
          (targetY - offsetY[i]) * stiffnessNow - velocityY[i] * dampingNow;

        velocityX[i] += accelX * dt;
        velocityY[i] += accelY * dt;
        offsetX[i] += velocityX[i] * dt;
        offsetY[i] += velocityY[i] * dt;
      }
    }

    function writeFrame(time: number): void {
      if (!linePositions || !tipPositions) {
        return;
      }

      let lineIndex = 0;
      let tipIndex = 0;
      const motion = reduced ? 0 : 1;

      for (let i = 0; i < count; i += 1) {
        const sway =
          Math.sin(time * 0.7 + swayPhase[i]) * 1.8 * motion +
          Math.sin(time * 0.31 + swayPhase[i] * 1.7) * 1.1 * motion;

        const controlX = ctrlX[i] + offsetX[i] * 0.45 + sway * 0.45;
        const controlY = ctrlY[i] + offsetY[i] * 0.45;
        const endX = tipX[i] + offsetX[i] + sway;
        const endY = tipY[i] + offsetY[i];

        for (let point = 0; point <= SEGMENTS; point += 1) {
          const t = point / SEGMENTS;
          const inv = 1 - t;
          scratchX[point] =
            inv * inv * baseX[i] + 2 * inv * t * controlX + t * t * endX;
          scratchY[point] =
            inv * inv * baseY[i] + 2 * inv * t * controlY + t * t * endY;
        }

        for (let segment = 0; segment < SEGMENTS; segment += 1) {
          const a = segment;
          const b = segment + 1;
          linePositions[lineIndex] = scratchX[a];
          linePositions[lineIndex + 1] = scratchY[a];
          linePositions[lineIndex + 2] = 0;
          linePositions[lineIndex + 3] = scratchX[b];
          linePositions[lineIndex + 4] = scratchY[b];
          linePositions[lineIndex + 5] = 0;
          lineIndex += 6;
        }

        tipPositions[tipIndex] = endX;
        tipPositions[tipIndex + 1] = endY;
        tipPositions[tipIndex + 2] = 0;
        tipIndex += 3;
      }

      const linePosition = strands.geometry.getAttribute("position") as
        THREE.BufferAttribute | undefined;
      const tipPosition = tips.geometry.getAttribute("position") as
        THREE.BufferAttribute | undefined;

      if (linePosition) {
        linePosition.needsUpdate = true;
      }

      if (tipPosition) {
        tipPosition.needsUpdate = true;
      }

      bgUniforms.uGlowStrength.value =
        settingsRef.current.glowStrength * look.glow;
    }

    function render(): void {
      renderer.render(scene, camera);
    }

    function syncColors(): void {
      const phase = readPhase();
      look = PHASE_LOOK[phase];
      const styles = window.getComputedStyle(document.documentElement);

      strandUniforms.uColor.value.copy(
        cssColor(styles, "--play-strand", "#fffdf2"),
      );
      strandUniforms.uOpacity.value = look.lineOpacity;
      tipUniforms.uColor.value.copy(
        cssColor(styles, "--play-strand", "#fffdf2"),
      );
      tipUniforms.uOpacity.value = look.tipOpacity;
      tipUniforms.uSize.value = look.tipSize * renderer.getPixelRatio();

      bgUniforms.uTop.value.copy(cssColor(styles, "--play-bg-top", "#ffe873"));
      bgUniforms.uMid.value.copy(cssColor(styles, "--play-bg-mid", "#a6d96a"));
      bgUniforms.uBottom.value.copy(
        cssColor(styles, "--play-bg-bottom", "#8fa8ff"),
      );
      bgUniforms.uGlow.value.copy(cssColor(styles, "--play-glow", "#fff6c9"));
    }

    function frame(now: number): void {
      if (!running) {
        return;
      }

      raf = requestAnimationFrame(frame);

      const dt = Math.min(0.033, Math.max(0.001, (now - lastFrame) / 1000));
      lastFrame = now;
      elapsed += dt;

      simulate(dt);
      writeFrame(elapsed);
      render();
    }

    function start(): void {
      if (reduced || running) {
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

    function renderStatic(): void {
      writeFrame(0);
      render();
    }

    function resize(): void {
      const rect = host.getBoundingClientRect();
      const width = Math.max(1, rect.width);
      const height = Math.max(1, rect.height);

      if (width === size.width && height === size.height && built.count > 0) {
        return;
      }

      size.width = width;
      size.height = height;
      renderer.setSize(width, height, false);
      camera.right = width;
      camera.top = height;
      camera.updateProjectionMatrix();

      build();
      syncColors();

      if (reduced) {
        renderStatic();
      } else if (inView && !document.hidden) {
        start();
      }

      started = true;
    }

    function setPointer(event: PointerEvent): void {
      const rect = host.getBoundingClientRect();

      pointer.x = event.clientX - rect.left;
      pointer.y = rect.height - (event.clientY - rect.top);
      pointer.active = true;
    }

    function onPointerMove(event: PointerEvent): void {
      if (event.isPrimary) {
        setPointer(event);
      }
    }

    function onPointerDown(event: PointerEvent): void {
      if (!event.isPrimary) {
        return;
      }

      setPointer(event);

      try {
        host.setPointerCapture(event.pointerId);
      } catch {
        // Capture is best-effort; the drag still works inside the card.
      }
    }

    function onPointerUp(event: PointerEvent): void {
      pointer.active = false;

      try {
        if (host.hasPointerCapture(event.pointerId)) {
          host.releasePointerCapture(event.pointerId);
        }
      } catch {
        // Nothing to release.
      }
    }

    function onPointerLeave(): void {
      pointer.active = false;
    }

    function onVisibilityChange(): void {
      if (!inView || document.hidden) {
        stop();
      } else {
        start();
      }
    }

    function applyPhase(): void {
      syncColors();

      if (reduced) {
        renderStatic();
      }
    }

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(host);

    const intersectionObserver = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        inView = Boolean(entry?.isIntersecting);

        if (!inView) {
          stop();
        } else if (started) {
          start();
        }
      },
      { threshold: 0.01 },
    );
    intersectionObserver.observe(host);

    const phaseObserver = new MutationObserver((records) => {
      if (records.some((record) => record.attributeName === "data-phase")) {
        applyPhase();
      }
    });
    phaseObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-phase"],
    });

    document.addEventListener("visibilitychange", onVisibilityChange);

    if (!reduced) {
      host.addEventListener("pointermove", onPointerMove, {
        passive: true,
      });
      host.addEventListener("pointerdown", onPointerDown);
      host.addEventListener("pointerup", onPointerUp);
      host.addEventListener("pointerleave", onPointerLeave);
      host.addEventListener("pointercancel", onPointerLeave);
    }

    resize();

    rebuildRef.current = () => {
      build();
      syncColors();

      if (reduced) {
        renderStatic();
      }
    };

    return () => {
      stop();
      rebuildRef.current = null;
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      phaseObserver.disconnect();
      document.removeEventListener("visibilitychange", onVisibilityChange);

      host.removeEventListener("pointermove", onPointerMove);
      host.removeEventListener("pointerdown", onPointerDown);
      host.removeEventListener("pointerup", onPointerUp);
      host.removeEventListener("pointerleave", onPointerLeave);
      host.removeEventListener("pointercancel", onPointerLeave);

      strands.geometry?.dispose();
      tips.geometry?.dispose();
      background.geometry.dispose();
      strandMaterial.dispose();
      tipMaterial.dispose();
      (background.material as THREE.Material).dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      className={className}
      data-fiber-fan=""
    />
  );
}
