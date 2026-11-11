"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { createStage } from "@/components/play/variants/stage";
import type { Stage } from "@/components/play/variants/stage";
import { SILK_WAVE_DEFAULTS } from "@/components/play/variants/settings";
import type { SilkWaveSettings } from "@/components/play/variants/settings";

export type SilkWaveVariantProps = {
  className?: string;
  settings?: Partial<SilkWaveSettings>;
};

const SILK_VERTEX = /* glsl */ `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const SILK_FRAGMENT = /* glsl */ `
  precision highp float;

  varying vec2 vUv;

  uniform vec3 uTop;
  uniform vec3 uMid;
  uniform vec3 uBase;
  uniform vec3 uSurface;
  uniform float uTime;
  uniform float uDensity;
  uniform float uCurve;
  uniform float uFlow;
  uniform float uSheen;
  uniform vec2 uPointer;
  uniform float uPointerStrength;
  uniform float uAspect;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  void main() {
    vec2 uv = vUv;

    // One ribbon sweeping diagonally, with a slow S-wobble along its length.
    float centre =
      0.42 +
      0.45 * (uv.x - 0.5) +
      uCurve * 0.16 * sin(uv.x * 3.4 - 0.7 + uTime * 0.10 * uFlow);

    // The cursor pushes the centreline away, eased over a wide radius.
    vec2 pointerDelta = vec2(
      (uv.x - uPointer.x) * uAspect,
      uv.y - uPointer.y
    );
    float influence = exp(-dot(pointerDelta, pointerDelta) * 3.2);
    centre +=
      clamp((uv.y - uPointer.y) * 7.0, -1.0, 1.0) *
      influence *
      uPointerStrength *
      0.0016;

    float halfWidth =
      0.15 + 0.062 * sin(uv.x * 3.14159265) +
      influence * uPointerStrength * 0.0009;

    float d = (uv.y - centre) / halfWidth;
    float inside = 1.0 - smoothstep(0.82, 1.0, abs(d));

    // Colour travels along the ribbon: base, mid, then top. Routing through
    // the mid colour keeps the blend from going grey in the middle.
    float gx = smoothstep(0.0, 1.0, uv.x * 0.92 + (1.0 - abs(d)) * 0.08);
    vec3 ribbon = mix(uBase, uMid, smoothstep(0.0, 0.55, gx));
    ribbon = mix(ribbon, uTop, smoothstep(0.45, 1.0, gx));

    // Rounded-cylinder shading across the band.
    ribbon *= 0.8 + 0.26 * (1.0 - abs(d));

    // Dense near-parallel fibres. The pattern fades where it would fall
    // below a pixel; that is what stops dense fibres turning into moire.
    float phase =
      d * uDensity +
      uv.x * 6.0 +
      uTime * uFlow * 1.8;
    float omega = 6.2831853;
    float aa = fwidth(phase) * omega;
    float stripes = 0.5 + 0.5 * sin(phase * omega);
    stripes = mix(stripes, 0.5, smoothstep(2.4, 4.2, aa));
    float micro = 0.5 + 0.5 * sin(phase * omega * 1.9 + 1.3);
    micro = mix(micro, 0.5, smoothstep(1.4, 2.2, aa * 1.9));
    float fibre = smoothstep(0.08, 0.92, mix(stripes, micro, 0.35));

    ribbon *= 0.82 + 0.26 * fibre;

    // A white specular fold that drifts along the ribbon.
    float foldPosition = 0.34 * sin(uv.x * 3.1 + uTime * (0.24 + uFlow * 0.5));
    float fold = exp(-pow((d - foldPosition) / 0.18, 2.0));
    float sheen = fold * uSheen * (0.4 + 0.6 * fibre);
    ribbon = mix(ribbon, vec3(1.0), clamp(sheen * 0.7, 0.0, 0.9));

    // A thin rim where the fold catches light.
    float rim = exp(-pow((abs(d) - 0.9) / 0.12, 2.0));
    ribbon += vec3(1.0) * rim * 0.05 * uSheen;

    // Keep the outside of the ribbon quiet, with only a faint halo.
    vec3 background = uSurface;
    float halo = exp(-pow((abs(d) - 1.0) / 0.35, 2.0));
    background = mix(background, ribbon, halo * 0.07);
    background *=
      1.0 -
      exp(-pow((d - 1.18) / 0.3, 2.0)) * 0.05 -
      exp(-pow((d + 1.18) / 0.3, 2.0)) * 0.04;

    vec3 color = mix(background, ribbon, inside);

    // Dither the vast flat areas to stop gradient banding.
    color += (hash(gl_FragCoord.xy) - 0.5) * 0.004;

    gl_FragColor = vec4(color, 1.0);
  }
`;

/**
 * Variant 5 · Silk wave. One saturated ribbon made of thousands of fine
 * fibres, sweeping diagonally over a plain card. The sheen travels; the
 * pointer eases a bend into the ribbon without snapping.
 */
export function SilkWaveVariant({ className, settings }: SilkWaveVariantProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Stage | null>(null);
  const settingsRef = useRef<SilkWaveSettings>({
    ...SILK_WAVE_DEFAULTS,
    ...settings,
  });

  useEffect(() => {
    settingsRef.current = { ...SILK_WAVE_DEFAULTS, ...settings };
    stageRef.current?.paint();
  }, [settings]);

  useEffect(() => {
    const host = hostRef.current;

    if (!host) {
      return;
    }

    const uniforms = {
      uTop: { value: new THREE.Color("#f2a0c8") },
      uMid: { value: new THREE.Color("#e9786f") },
      uBase: { value: new THREE.Color("#f3c46b") },
      uSurface: { value: new THREE.Color("#ffffff") },
      uTime: { value: 0 },
      uDensity: { value: SILK_WAVE_DEFAULTS.density },
      uCurve: { value: SILK_WAVE_DEFAULTS.curve },
      uFlow: { value: SILK_WAVE_DEFAULTS.flow },
      uSheen: { value: SILK_WAVE_DEFAULTS.sheen },
      uPointer: { value: new THREE.Vector2(0.5, 0.5) },
      uPointerStrength: { value: 0 },
      uAspect: { value: 3 },
    };

    const material = new THREE.ShaderMaterial({
      uniforms,
      vertexShader: SILK_VERTEX,
      fragmentShader: SILK_FRAGMENT,
      depthTest: false,
      depthWrite: false,
    });

    let plane: THREE.Mesh | null = null;

    function build(stage: Stage): void {
      if (!plane) {
        plane = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), material);
        plane.frustumCulled = false;
        plane.position.z = -1;
        stage.scene.add(plane);
      }

      plane.scale.set(stage.width, stage.height, 1);
      plane.position.set(stage.width / 2, stage.height / 2, -1);
      uniforms.uAspect.value = stage.width / Math.max(1, stage.height);
    }

    function colors(stage: Stage): void {
      uniforms.uTop.value.copy(stage.colors.top);
      uniforms.uMid.value.copy(stage.colors.mid);
      uniforms.uBase.value.copy(stage.colors.base);
      uniforms.uSurface.value.copy(stage.colors.surface);
    }

    const handle = createStage(
      host,
      {
        build,
        colors,
        frame: (stage) => {
          const current = settingsRef.current;
          const pointer = stage.pointer;

          uniforms.uTime.value = stage.reduced ? 0 : stage.elapsed;
          uniforms.uDensity.value = current.density;
          uniforms.uCurve.value = current.curve;
          uniforms.uFlow.value = stage.reduced ? 0 : current.flow;
          uniforms.uSheen.value = current.sheen;
          uniforms.uPointerStrength.value =
            stage.reduced || !pointer.active ? 0 : current.pointerStrength;
          uniforms.uPointer.value.set(
            pointer.x / Math.max(1, stage.width),
            pointer.y / Math.max(1, stage.height),
          );
        },
      },
      { backdrop: "plain" },
    );

    if (!handle) {
      material.dispose();

      return;
    }

    stageRef.current = handle.stage;

    return () => {
      stageRef.current = null;
      handle.dispose();
    };
  }, []);

  return (
    <div
      ref={hostRef}
      aria-hidden="true"
      className={className}
      data-play-variant="silk-wave"
    />
  );
}
