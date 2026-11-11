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
import { FAITHFUL_DEFAULTS } from "@/components/play/variants/settings";
import type { FaithfulSettings } from "@/components/play/variants/settings";

export type FaithfulVariantProps = {
  className?: string;
  settings?: Partial<FaithfulSettings>;
};

/**
 * Variant 1 · Faithful. Straight one-pixel fibres from a single point at the
 * bottom centre, bright tip dots, and a white additive bloom where they meet.
 * The pointer parts nearby strands; the tips shimmer very slowly at rest.
 */
export function FaithfulVariant({ className, settings }: FaithfulVariantProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Stage | null>(null);
  const settingsRef = useRef<FaithfulSettings>({
    ...FAITHFUL_DEFAULTS,
    ...settings,
  });
  const builtRef = useRef({
    count: FAITHFUL_DEFAULTS.strandCount,
    spread: FAITHFUL_DEFAULTS.spread,
  });

  useEffect(() => {
    const next = { ...FAITHFUL_DEFAULTS, ...settings };
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

    const lineMaterial = createStrandMaterial();
    const tipMaterial = createTipMaterial();

    let lineMesh: StrandMesh | null = null;
    let tipMesh: TipMesh | null = null;
    let glow: GlowMesh | null = null;

    let count = 0;
    let originX = 0;
    let originY = 0;
    let baseX = new Float32Array(0);
    let baseY = new Float32Array(0);
    let tipX = new Float32Array(0);
    let tipY = new Float32Array(0);
    let midX = new Float32Array(0);
    let midY = new Float32Array(0);
    let offsetX = new Float32Array(0);
    let offsetY = new Float32Array(0);
    let velocityX = new Float32Array(0);
    let velocityY = new Float32Array(0);

    function build(stage: Stage): void {
      const current = settingsRef.current;
      const width = stage.width;
      const height = stage.height;

      if (lineMesh) {
        stage.scene.remove(lineMesh.mesh);
        lineMesh.mesh.geometry.dispose();
      }

      if (tipMesh) {
        stage.scene.remove(tipMesh.mesh);
        tipMesh.mesh.geometry.dispose();
      }

      count = Math.max(2, Math.round(current.strandCount));
      originX = width / 2;
      originY = -height * 0.07;

      baseX = new Float32Array(count);
      baseY = new Float32Array(count);
      tipX = new Float32Array(count);
      tipY = new Float32Array(count);
      midX = new Float32Array(count);
      midY = new Float32Array(count);
      offsetX = new Float32Array(count);
      offsetY = new Float32Array(count);
      velocityX = new Float32Array(count);
      velocityY = new Float32Array(count);

      const random = mulberry32(0x51ed270b);
      const halfAngle = (current.spread * Math.PI) / 360;
      const radiusX = width * 0.5;
      const radiusY = height * 0.95;

      for (let i = 0; i < count; i += 1) {
        const step = (2 * halfAngle) / count;
        const jitter = (random() - 0.5) * step * 0.9;
        const angle = -halfAngle + step * (i + 0.5) + jitter;
        const sin = Math.sin(angle);
        const cos = Math.cos(angle);

        // A tight cluster, not one exact pixel: a dense plug of white.
        baseX[i] = originX + (random() - 0.5) * 3;
        baseY[i] = originY + (random() - 0.5) * 3;

        let length = Math.hypot(radiusX * sin, radiusY * cos);
        length *= 0.9 + random() * 0.12;

        if (random() < 0.06) {
          length *= 0.84;
        }

        tipX[i] = originX + sin * length;
        tipY[i] = originY + cos * length;

        midX[i] = baseX[i] + (tipX[i] - baseX[i]) * 0.55;
        midY[i] = baseY[i] + (tipY[i] - baseY[i]) * 0.55;
      }

      lineMesh = createStrandMesh(count, 1, lineMaterial, random, [0.55, 0.9]);
      tipMesh = createTipMesh(count, tipMaterial, random, [0.75, 1]);

      lineMesh.mesh.position.z = -1;
      lineMesh.mesh.renderOrder = 1;
      tipMesh.mesh.position.z = -1;
      tipMesh.mesh.renderOrder = 2;

      stage.scene.add(lineMesh.mesh);
      stage.scene.add(tipMesh.mesh);

      if (!glow) {
        glow = createGlowMesh(stage.scene);
      }

      glow.mesh.scale.set(width * 0.24, height * 0.4, 1);
      glow.mesh.position.set(originX, originY + height * 0.06, 0);
      glow.uniforms.uColor.value.copy(stage.colors.glow);
    }

    function simulate(stage: Stage): void {
      const current = settingsRef.current;
      const pointer = stage.pointer;
      const radius = current.pushRadius;
      const radiusSq = radius * radius;
      const dt = stage.dt;

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
            const magnitude = current.pushStrength * falloff * falloff;
            targetX = (dx / distance) * magnitude;
            targetY = (dy / distance) * magnitude;
          }
        }

        const ax =
          (targetX - offsetX[i]) * current.stiffness -
          velocityX[i] * current.damping;
        const ay =
          (targetY - offsetY[i]) * current.stiffness -
          velocityY[i] * current.damping;

        velocityX[i] += ax * dt;
        velocityY[i] += ay * dt;
        offsetX[i] += velocityX[i] * dt;
        offsetY[i] += velocityY[i] * dt;
      }
    }

    function write(stage: Stage): void {
      if (!lineMesh || !tipMesh) {
        return;
      }

      const positions = lineMesh.positions;
      const tips = tipMesh.positions;
      let lineIndex = 0;
      let tipIndex = 0;

      for (let i = 0; i < count; i += 1) {
        const endX = tipX[i] + offsetX[i];
        const endY = tipY[i] + offsetY[i];

        positions[lineIndex] = baseX[i];
        positions[lineIndex + 1] = baseY[i];
        positions[lineIndex + 2] = 0;
        positions[lineIndex + 3] = endX;
        positions[lineIndex + 4] = endY;
        positions[lineIndex + 5] = 0;
        lineIndex += 6;

        tips[tipIndex] = endX;
        tips[tipIndex + 1] = endY;
        tips[tipIndex + 2] = 0;
        tipIndex += 3;
      }

      (
        lineMesh.mesh.geometry.getAttribute("position") as THREE.BufferAttribute
      ).needsUpdate = true;
      (
        tipMesh.mesh.geometry.getAttribute("position") as THREE.BufferAttribute
      ).needsUpdate = true;

      if (glow) {
        glow.uniforms.uColor.value.copy(stage.colors.glow);
        glow.uniforms.uStrength.value = settingsRef.current.bloom * 0.45;
      }

      if (stage.backdrop) {
        stage.backdrop.uniforms.uBloom.value = settingsRef.current.bloom * 0.9;
      }

      tipMaterial.uniforms.uTime.value = stage.elapsed;
      tipMaterial.uniforms.uShimmer.value = stage.reduced ? 0 : 0.32;
    }

    function colors(stage: Stage): void {
      lineMaterial.uniforms.uColor.value.copy(stage.colors.strand);
      lineMaterial.uniforms.uOpacity.value =
        stage.colors.phase === "night" ? 0.6 : 0.68;
      tipMaterial.uniforms.uColor.value.copy(stage.colors.strand);
      tipMaterial.uniforms.uOpacity.value =
        stage.colors.phase === "night" ? 0.72 : 0.92;
      tipMaterial.uniforms.uSize.value = 3.3 * stage.dpr;

      if (glow) {
        glow.uniforms.uColor.value.copy(stage.colors.glow);
      }
    }

    const handle = createStage(host, {
      build,
      colors,
      frame: (stage) => {
        if (!stage.reduced) {
          simulate(stage);
        }

        write(stage);
      },
    });

    if (!handle) {
      lineMaterial.dispose();
      tipMaterial.dispose();

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
      data-play-variant="faithful"
    />
  );
}
