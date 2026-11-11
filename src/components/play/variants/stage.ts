"use client";

import * as THREE from "three";

/**
 * Shared three.js stage for the Play card variants. It owns the renderer,
 * resizing, DPR cap, pointer sampling, the phase observer and the pause rules
 * (offscreen, hidden tab, reduced motion), so each variant only describes its
 * strands and its motion.
 */

export type Phase = "dawn" | "day" | "dusk" | "night";

export type PlayColors = {
  phase: Phase;
  top: THREE.Color;
  mid: THREE.Color;
  base: THREE.Color;
  strand: THREE.Color;
  glow: THREE.Color;
  surface: THREE.Color;
};

export type StagePointer = {
  /** Local pixels, origin at the bottom-left of the card. */
  x: number;
  y: number;
  /** -1..1 from the card centre, y up. */
  nx: number;
  ny: number;
  active: boolean;
};

export type GradientBackdrop = {
  mesh: THREE.Mesh;
  uniforms: {
    uTop: THREE.IUniform<THREE.Color>;
    uMid: THREE.IUniform<THREE.Color>;
    uBase: THREE.IUniform<THREE.Color>;
    uGlow: THREE.IUniform<THREE.Color>;
    uBloom: THREE.IUniform<number>;
    uDim: THREE.IUniform<number>;
    uAspect: THREE.IUniform<number>;
    uOrigin: THREE.IUniform<THREE.Vector2>;
  };
};

export type Stage = {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.OrthographicCamera;
  width: number;
  height: number;
  dpr: number;
  reduced: boolean;
  elapsed: number;
  dt: number;
  colors: PlayColors;
  pointer: StagePointer;
  backdrop: GradientBackdrop | null;
  /** Rebuild geometry after a settings change, then repaint. */
  rebuild: () => void;
  /** Repaint one frame without advancing time. */
  paint: () => void;
};

export type StageSpec = {
  /** Called on every resize and rebuild. Dispose old geometry here. */
  build: (stage: Stage) => void;
  /** Called when the phase (and therefore the tokens) changes. */
  colors?: (stage: Stage) => void;
  /** Called once per animation frame, and once for a still frame. */
  frame: (stage: Stage) => void;
};

export type StageOptions = {
  backdrop?: "gradient" | "plain";
  /** Clear colour when the backdrop is plain. Falls back to --surface. */
};

export type StageHandle = {
  stage: Stage;
  dispose: () => void;
};

const FALLBACK = {
  top: "#ffe97a",
  mid: "#a9d98b",
  base: "#8fb0f0",
  strand: "#fffdf4",
  glow: "#fff8d4",
  surface: "#ffffff",
};

const BACKDROP_VERTEX = /* glsl */ `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const BACKDROP_FRAGMENT = /* glsl */ `
  varying vec2 vUv;

  uniform vec3 uTop;
  uniform vec3 uMid;
  uniform vec3 uBase;
  uniform vec3 uGlow;
  uniform float uBloom;
  uniform float uDim;
  uniform float uAspect;
  uniform vec2 uOrigin;

  void main() {
    // Airy two-tone wash: top colour at the crown, mid by a third of the way.
    vec3 color = mix(uMid, uTop, smoothstep(0.30, 1.0, vUv.y));
    // A distinct horizon band below the fan's base.
    color = mix(uBase, color, smoothstep(0.03, 0.26, vUv.y));

    // Wide, soft white bloom where every strand meets.
    vec2 p = (vUv - uOrigin) * vec2(uAspect, 1.0);
    float bloom = exp(-dot(p, p) * 30.0);
    color += uGlow * bloom * uBloom;

    gl_FragColor = vec4(color * uDim, 1.0);
  }
`;

const STRAND_VERTEX = /* glsl */ `
  attribute float aT;
  attribute float aBright;
  uniform float uTaper;
  varying float vAlpha;

  void main() {
    vAlpha = aBright * mix(1.0, 1.0 - uTaper, aT);
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
  attribute float aSeed;
  uniform float uSize;
  uniform float uTime;
  uniform float uShimmer;
  varying float vAlpha;

  void main() {
    float wave = sin(uTime * 0.85 + aSeed * 6.2831853);
    vAlpha = aAlpha * (1.0 + uShimmer * wave);
    gl_PointSize = uSize * (1.0 + uShimmer * 0.3 * wave);
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

export function readPhase(): Phase {
  const phase = document.documentElement.dataset.phase;

  return phase === "dawn" || phase === "dusk" || phase === "night"
    ? phase
    : "day";
}

export function readPlayColors(): PlayColors {
  const styles = window.getComputedStyle(document.documentElement);
  const phase = readPhase();

  return {
    phase,
    top: cssColor(styles, "--play-bg-top", FALLBACK.top),
    mid: cssColor(styles, "--play-bg-mid", FALLBACK.mid),
    base: cssColor(styles, "--play-base", FALLBACK.base),
    strand: cssColor(styles, "--play-strand", FALLBACK.strand),
    glow: cssColor(styles, "--play-glow", FALLBACK.glow),
    surface: cssColor(styles, "--surface-container-low", FALLBACK.surface),
  };
}

/** Small deterministic PRNG so rebuilds keep the same fan. */
export function mulberry32(seed: number): () => number {
  let state = seed;

  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createGradientBackdrop(scene: THREE.Scene): GradientBackdrop {
  const uniforms: GradientBackdrop["uniforms"] = {
    uTop: { value: new THREE.Color(FALLBACK.top) },
    uMid: { value: new THREE.Color(FALLBACK.mid) },
    uBase: { value: new THREE.Color(FALLBACK.base) },
    uGlow: { value: new THREE.Color(FALLBACK.glow) },
    uBloom: { value: 0.9 },
    uDim: { value: 1 },
    uAspect: { value: 3 },
    uOrigin: { value: new THREE.Vector2(0.5, 0.02) },
  };

  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.ShaderMaterial({
      uniforms,
      vertexShader: BACKDROP_VERTEX,
      fragmentShader: BACKDROP_FRAGMENT,
      depthTest: false,
      depthWrite: false,
    }),
  );
  mesh.position.z = -2;
  mesh.renderOrder = -1;
  mesh.frustumCulled = false;
  scene.add(mesh);

  return { mesh, uniforms };
}

export type StrandMesh = {
  mesh: THREE.LineSegments;
  positions: Float32Array;
  count: number;
  segments: number;
};

export function createStrandMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color("#fffdf4") },
      uOpacity: { value: 1 },
      uTaper: { value: 0.28 },
    },
    vertexShader: STRAND_VERTEX,
    fragmentShader: STRAND_FRAGMENT,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthTest: false,
    depthWrite: false,
  });
}

export function createStrandMesh(
  count: number,
  segments: number,
  material: THREE.Material,
  random: () => number,
  brightness: [number, number] = [0.55, 0.9],
): StrandMesh {
  const vertexCount = count * segments * 2;
  const positions = new Float32Array(vertexCount * 3);
  const aT = new Float32Array(vertexCount);
  const aBright = new Float32Array(vertexCount);

  let index = 0;

  for (let i = 0; i < count; i += 1) {
    const bright = brightness[0] + random() * (brightness[1] - brightness[0]);

    for (let segment = 0; segment < segments; segment += 1) {
      aT[index] = segment / segments;
      aT[index + 1] = (segment + 1) / segments;
      aBright[index] = bright;
      aBright[index + 1] = bright;
      index += 2;
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage),
  );
  geometry.setAttribute("aT", new THREE.BufferAttribute(aT, 1));
  geometry.setAttribute("aBright", new THREE.BufferAttribute(aBright, 1));

  const mesh = new THREE.LineSegments(geometry, material);
  mesh.frustumCulled = false;

  return { mesh, positions, count, segments };
}

export type TipMesh = {
  mesh: THREE.Points;
  positions: Float32Array;
  count: number;
};

export function createTipMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color("#fffdf4") },
      uOpacity: { value: 0.95 },
      uSize: { value: 3 },
      uTime: { value: 0 },
      uShimmer: { value: 0 },
    },
    vertexShader: TIP_VERTEX,
    fragmentShader: TIP_FRAGMENT,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthTest: false,
    depthWrite: false,
  });
}

export function createTipMesh(
  count: number,
  material: THREE.Material,
  random: () => number,
  alpha: [number, number] = [0.7, 1],
): TipMesh {
  const positions = new Float32Array(count * 3);
  const alphas = new Float32Array(count);
  const seeds = new Float32Array(count);

  for (let i = 0; i < count; i += 1) {
    alphas[i] = alpha[0] + random() * (alpha[1] - alpha[0]);
    seeds[i] = random();
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage),
  );
  geometry.setAttribute("aAlpha", new THREE.BufferAttribute(alphas, 1));
  geometry.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 1));

  const mesh = new THREE.Points(geometry, material);
  mesh.frustumCulled = false;

  return { mesh, positions, count };
}

export type GlowMesh = {
  mesh: THREE.Mesh;
  uniforms: {
    uColor: THREE.IUniform<THREE.Color>;
    uStrength: THREE.IUniform<number>;
  };
};

/** Additive radial glow; place and scale it at the fan's origin. */
export function createGlowMesh(scene: THREE.Scene): GlowMesh {
  const uniforms = {
    uColor: { value: new THREE.Color("#ffffff") },
    uStrength: { value: 1 },
  };

  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.ShaderMaterial({
      uniforms,
      vertexShader: BACKDROP_VERTEX,
      fragmentShader: /* glsl */ `
        varying vec2 vUv;
        uniform vec3 uColor;
        uniform float uStrength;

        void main() {
          vec2 p = (vUv - 0.5) * 2.0;
          float d = length(p);
          float a = exp(-d * d * 5.0) * uStrength;
          gl_FragColor = vec4(uColor, a);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthTest: false,
      depthWrite: false,
    }),
  );
  mesh.renderOrder = 3;
  mesh.frustumCulled = false;
  scene.add(mesh);

  return { mesh, uniforms };
}

function applyBackdropColors(
  backdrop: GradientBackdrop | null,
  colors: PlayColors,
): void {
  if (!backdrop) {
    return;
  }

  backdrop.uniforms.uTop.value.copy(colors.top);
  backdrop.uniforms.uMid.value.copy(colors.mid);
  backdrop.uniforms.uBase.value.copy(colors.base);
  backdrop.uniforms.uGlow.value.copy(colors.glow);
  // Night is the same palette, rendered a quarter deeper.
  backdrop.uniforms.uDim.value = colors.phase === "night" ? 0.75 : 1;
}

export function createStage(
  host: HTMLElement,
  spec: StageSpec,
  options: StageOptions = {},
): StageHandle | null {
  let renderer: THREE.WebGLRenderer;

  try {
    renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: "high-performance",
    });
  } catch {
    // No WebGL: the card keeps its CSS gradient and stays still.
    return null;
  }

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  renderer.setPixelRatio(dpr);
  renderer.domElement.style.display = "block";
  renderer.domElement.style.width = "100%";
  renderer.domElement.style.height = "100%";
  renderer.domElement.style.pointerEvents = "none";
  host.style.touchAction = "pan-y";
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(0, 1, 1, 0, 0.1, 10);
  const backdrop =
    options.backdrop === "plain" ? null : createGradientBackdrop(scene);

  const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

  const stage: Stage = {
    renderer,
    scene,
    camera,
    width: 0,
    height: 0,
    dpr: renderer.getPixelRatio(),
    reduced: motionQuery.matches,
    elapsed: 0,
    dt: 0,
    colors: readPlayColors(),
    pointer: { x: 0, y: 0, nx: 0, ny: 0, active: false },
    backdrop,
    rebuild: () => {},
    paint: () => {},
  };

  let ready = false;
  let inView = true;
  let running = false;
  let raf = 0;
  let lastFrame = 0;

  function paint(): void {
    stage.dt = 0;
    spec.frame(stage);
    renderer.render(scene, camera);
  }

  function applyColors(): void {
    stage.colors = readPlayColors();
    applyBackdropColors(backdrop, stage.colors);
    renderer.setClearColor(stage.colors.surface, 1);
    spec.colors?.(stage);
  }

  function stop(): void {
    running = false;
    cancelAnimationFrame(raf);
  }

  function tick(now: number): void {
    if (!running) {
      return;
    }

    raf = requestAnimationFrame(tick);

    const dt = Math.min(0.033, Math.max(0.001, (now - lastFrame) / 1000));
    lastFrame = now;
    stage.dt = dt;
    stage.elapsed += dt;

    spec.frame(stage);
    renderer.render(scene, camera);
  }

  function start(): void {
    if (stage.reduced || running || !ready || !inView || document.hidden) {
      return;
    }

    running = true;
    lastFrame = performance.now();
    raf = requestAnimationFrame(tick);
  }

  function resize(): void {
    const rect = host.getBoundingClientRect();
    const width = Math.max(1, Math.round(rect.width));
    const height = Math.max(1, Math.round(rect.height));

    if (ready && width === stage.width && height === stage.height) {
      return;
    }

    stage.width = width;
    stage.height = height;
    renderer.setSize(width, height, false);
    camera.right = width;
    camera.top = height;
    camera.updateProjectionMatrix();
    stage.dpr = renderer.getPixelRatio();

    if (backdrop) {
      backdrop.mesh.scale.set(width, height, 1);
      backdrop.mesh.position.set(width / 2, height / 2, -2);
      backdrop.uniforms.uAspect.value = width / Math.max(1, height);
    }

    applyColors();
    spec.build(stage);
    ready = true;

    if (stage.reduced) {
      stage.elapsed = 0;
    }

    paint();
    start();
  }

  stage.paint = paint;
  stage.rebuild = () => {
    applyColors();
    spec.build(stage);
    paint();
  };

  function setPointer(event: PointerEvent): void {
    if (stage.reduced) {
      return;
    }

    const rect = host.getBoundingClientRect();

    if (rect.width < 1 || rect.height < 1) {
      return;
    }

    const x = event.clientX - rect.left;
    const y = rect.height - (event.clientY - rect.top);

    stage.pointer.x = x;
    stage.pointer.y = y;
    stage.pointer.nx = (x / rect.width) * 2 - 1;
    stage.pointer.ny = (y / rect.height) * 2 - 1;
    stage.pointer.active = true;
  }

  function onPointerMove(event: PointerEvent): void {
    if (event.isPrimary) {
      setPointer(event);
    }
  }

  function onPointerLeave(): void {
    stage.pointer.active = false;
  }

  function onVisibilityChange(): void {
    if (document.hidden || !inView) {
      stop();
    } else {
      start();
    }
  }

  function onMotionChange(event: MediaQueryListEvent): void {
    stage.reduced = event.matches;

    if (stage.reduced) {
      stop();
      stage.elapsed = 0;
      paint();
    } else {
      start();
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
      } else {
        start();
      }
    },
    { threshold: 0.01 },
  );
  intersectionObserver.observe(host);

  const phaseObserver = new MutationObserver((records) => {
    if (records.some((record) => record.attributeName === "data-phase")) {
      applyColors();

      if (stage.reduced) {
        paint();
      }
    }
  });
  phaseObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-phase"],
  });

  document.addEventListener("visibilitychange", onVisibilityChange);
  motionQuery.addEventListener("change", onMotionChange);
  host.addEventListener("pointermove", onPointerMove, { passive: true });
  host.addEventListener("pointerdown", onPointerMove);
  host.addEventListener("pointerleave", onPointerLeave);
  host.addEventListener("pointercancel", onPointerLeave);

  resize();

  const dispose = () => {
    stop();
    resizeObserver.disconnect();
    intersectionObserver.disconnect();
    phaseObserver.disconnect();
    document.removeEventListener("visibilitychange", onVisibilityChange);
    motionQuery.removeEventListener("change", onMotionChange);
    host.removeEventListener("pointermove", onPointerMove);
    host.removeEventListener("pointerdown", onPointerMove);
    host.removeEventListener("pointerleave", onPointerLeave);
    host.removeEventListener("pointercancel", onPointerLeave);

    scene.traverse((object) => {
      const renderable = object as THREE.Mesh;
      renderable.geometry?.dispose();
      const material = renderable.material as
        THREE.Material | THREE.Material[] | undefined;

      if (Array.isArray(material)) {
        material.forEach((item) => item.dispose());
      } else {
        material?.dispose();
      }
    });

    renderer.dispose();
    renderer.forceContextLoss();
    renderer.domElement.remove();
  };

  return { stage, dispose };
}
