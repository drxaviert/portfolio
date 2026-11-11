"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import {
  createGlowMesh,
  createStage,
  createStrandMaterial,
  createStrandMesh,
  createTipMaterial,
  createTipMesh,
  mulberry32,
} from "@/components/play/variants/stage";
import type {
  GlowMesh,
  Stage,
  StrandMesh,
  TipMesh,
} from "@/components/play/variants/stage";
import { DEPTH_DEFAULTS } from "@/components/play/variants/settings";
import type { DepthSettings } from "@/components/play/variants/settings";

export type DepthVariantProps = {
  className?: string;
  settings?: Partial<DepthSettings>;
};

type LayerConfig = {
  share: number;
  spreadDelta: number;
  parallax: number;
  tilt: number;
  lift: number;
  opacity: number;
  soft: boolean;
  tipSize: number;
  tipOpacity: number;
  brightness: [number, number];
};

const LAYERS: LayerConfig[] = [
  {
    share: 0.5,
    spreadDelta: 7,
    parallax: 0.35,
    tilt: 0.55,
    lift: 6,
    opacity: 0.13,
    soft: true,
    tipSize: 2,
    tipOpacity: 0.35,
    brightness: [0.35, 0.6],
  },
  {
    share: 0.32,
    spreadDelta: 1,
    parallax: 0.7,
    tilt: 0.8,
    lift: 3,
    opacity: 0.3,
    soft: false,
    tipSize: 2.6,
    tipOpacity: 0.65,
    brightness: [0.5, 0.82],
  },
  {
    share: 0.18,
    spreadDelta: -5,
    parallax: 1,
    tilt: 1,
    lift: 0,
    opacity: 0.75,
    soft: false,
    tipSize: 3.4,
    tipOpacity: 0.95,
    brightness: [0.7, 1],
  },
];

type Layer = LayerConfig & {
  group: THREE.Group;
  lines: StrandMesh;
  tips: TipMesh;
  offsetX: number;
  offsetY: number;
};

/**
 * Variant 3 · Depth. Three static layers of straight strands; the pointer
 * shifts them at different rates and tilts the fan from its base. Nothing
 * parts, so the fan reads as one solid object with space behind it.
 */
export function DepthVariant({ className, settings }: DepthVariantProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Stage | null>(null);
  const settingsRef = useRef<DepthSettings>({
    ...DEPTH_DEFAULTS,
    ...settings,
  });
  const builtRef = useRef({
    count: DEPTH_DEFAULTS.strandCount,
    spread: DEPTH_DEFAULTS.spread,
  });

  useEffect(() => {
    const next = { ...DEPTH_DEFAULTS, ...settings };
    settingsRef.current = next;

    const previous = builtRef.current;
    const geometryChanged =
      previous.count !== next.strandCount || previous.spread !== next.spread;

    if (geometryChanged) {
      builtRef.current = {
        count: next.strandCount,
        spread: next.spread,
      };
      stageRef.current?.rebuild();
    } else {
      stageRef.current?.paint();
    }
  }, [settings]);

  useEffect(() => {
    const host = hostRef.current;

    if (!host) {
      return;
    }

    const materials = LAYERS.map(() => ({
      line: createStrandMaterial(),
      tip: createTipMaterial(),
    }));

    let layers: Layer[] = [];
    let glow: GlowMesh | null = null;
    let originX = 0;
    let originY = 0;

    function disposeLayers(stage: Stage): void {
      for (const layer of layers) {
        stage.scene.remove(layer.group);
        layer.lines.mesh.geometry.dispose();
        layer.tips.mesh.geometry.dispose();
      }

      layers = [];
    }

    function build(stage: Stage): void {
      const current = settingsRef.current;
      const width = stage.width;
      const height = stage.height;

      disposeLayers(stage);

      originX = width / 2;
      originY = -height * 0.07;

      const random = mulberry32(0x6a09e667);
      const radiusX = width * 0.5;
      const radiusY = height * 0.95;
      const halfBase = (current.spread * Math.PI) / 360;

      LAYERS.forEach((config, layerIndex) => {
        const count = Math.max(
          2,
          Math.round(current.strandCount * config.share),
        );
        const rendered = config.soft ? count * 2 : count;
        const lineMaterial = materials[layerIndex].line;
        const tipMaterial = materials[layerIndex].tip;

        const lines = createStrandMesh(
          rendered,
          1,
          lineMaterial,
          random,
          config.brightness,
        );
        const tips = createTipMesh(count, tipMaterial, random, [0.55, 1]);

        const halfAngle = halfBase + (config.spreadDelta * Math.PI) / 360;
        const group = new THREE.Group();
        const positions = lines.positions;
        const tipPositions = tips.positions;

        let lineIndex = 0;
        let tipIndex = 0;

        for (let i = 0; i < count; i += 1) {
          const step = (2 * halfAngle) / count;
          const jitter = (random() - 0.5) * step * 0.9;
          const angle = -halfAngle + step * (i + 0.5) + jitter;
          const sin = Math.sin(angle);
          const cos = Math.cos(angle);

          let length = Math.hypot(radiusX * sin, radiusY * cos);
          length *= 0.9 + random() * 0.13;

          if (random() < 0.07) {
            length *= 0.86;
          }

          const baseLocalX = (random() - 0.5) * 3;
          const baseLocalY = (random() - 0.5) * 3;
          const tipLocalX = sin * length;
          const tipLocalY = cos * length;

          if (config.soft) {
            // Two offset copies at low alpha read as a soft, out-of-focus line.
            const perpX = cos * 1.3;
            const perpY = -sin * 1.3;

            for (let copy = 0; copy < 2; copy += 1) {
              const sign = copy === 0 ? -1 : 1;

              positions[lineIndex] = baseLocalX + perpX * sign;
              positions[lineIndex + 1] = baseLocalY + perpY * sign;
              positions[lineIndex + 2] = 0;
              positions[lineIndex + 3] = tipLocalX + perpX * sign * 1.25;
              positions[lineIndex + 4] = tipLocalY + perpY * sign * 1.25;
              positions[lineIndex + 5] = 0;
              lineIndex += 6;
            }
          } else {
            positions[lineIndex] = baseLocalX;
            positions[lineIndex + 1] = baseLocalY;
            positions[lineIndex + 2] = 0;
            positions[lineIndex + 3] = tipLocalX;
            positions[lineIndex + 4] = tipLocalY;
            positions[lineIndex + 5] = 0;
            lineIndex += 6;
          }

          tipPositions[tipIndex] = tipLocalX;
          tipPositions[tipIndex + 1] = tipLocalY;
          tipPositions[tipIndex + 2] = 0;
          tipIndex += 3;
        }

        lines.mesh.position.z = -1;
        lines.mesh.renderOrder = 1;
        tips.mesh.position.z = -1;
        tips.mesh.renderOrder = 2;
        group.add(lines.mesh);
        group.add(tips.mesh);
        group.position.set(originX, originY + config.lift, 0);
        stage.scene.add(group);

        layers.push({
          ...config,
          group,
          lines,
          tips,
          offsetX: 0,
          offsetY: 0,
        });
      });

      if (!glow) {
        glow = createGlowMesh(stage.scene);
      }

      glow.mesh.scale.set(width * 0.24, height * 0.4, 1);
      glow.mesh.position.set(originX, originY + height * 0.06, 0);
      glow.uniforms.uColor.value.copy(stage.colors.glow);

      // The layers were created after the stage's colour pass, so apply the
      // per-layer opacities and tip sizes to the new meshes now.
      colors(stage);
    }

    function write(stage: Stage): void {
      const current = settingsRef.current;
      const pointer = stage.pointer;
      const parallax = current.parallax;
      const tilt = (current.tilt * Math.PI) / 180;
      const lerp = stage.reduced ? 0 : Math.min(1, stage.dt * current.easing);

      layers.forEach((layer, index) => {
        const drift = stage.reduced
          ? 0
          : Math.sin(stage.elapsed * 0.23 + index * 1.9) * 0.7;
        const targetX =
          (pointer.active ? -pointer.nx * parallax : 0) * layer.parallax +
          drift;
        const targetY =
          (pointer.active ? -pointer.ny * parallax * 0.22 : 0) * layer.parallax;

        layer.offsetX += (targetX - layer.offsetX) * lerp;
        layer.offsetY += (targetY - layer.offsetY) * lerp;
        layer.group.position.set(
          originX + layer.offsetX,
          originY + layer.lift + layer.offsetY,
          0,
        );
        layer.group.rotation.z =
          (pointer.active ? -pointer.nx * tilt : 0) * layer.tilt;
      });

      if (glow) {
        glow.uniforms.uColor.value.copy(stage.colors.glow);
        glow.uniforms.uStrength.value = current.bloom * 0.4;
      }

      if (stage.backdrop) {
        stage.backdrop.uniforms.uBloom.value = current.bloom;
      }

      layers.forEach((_, index) => {
        const tipMaterial = materials[index].tip;
        tipMaterial.uniforms.uTime.value = stage.reduced ? 0 : stage.elapsed;
        tipMaterial.uniforms.uShimmer.value = stage.reduced ? 0 : 0.14;
      });
    }

    function colors(stage: Stage): void {
      layers.forEach((layer, index) => {
        const lineMaterial = materials[index].line;
        const tipMaterial = materials[index].tip;
        const night = stage.colors.phase === "night";

        lineMaterial.uniforms.uColor.value.copy(stage.colors.strand);
        lineMaterial.uniforms.uOpacity.value =
          layer.opacity * (night ? 0.9 : 1);
        tipMaterial.uniforms.uColor.value.copy(stage.colors.strand);
        tipMaterial.uniforms.uOpacity.value =
          layer.tipOpacity * (night ? 0.9 : 1);
        tipMaterial.uniforms.uSize.value = layer.tipSize * stage.dpr;
      });

      if (glow) {
        glow.uniforms.uColor.value.copy(stage.colors.glow);
      }
    }

    const handle = createStage(host, {
      build,
      colors,
      frame: write,
    });

    if (!handle) {
      materials.forEach((material) => {
        material.line.dispose();
        material.tip.dispose();
      });

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
      data-play-variant="depth"
    />
  );
}
