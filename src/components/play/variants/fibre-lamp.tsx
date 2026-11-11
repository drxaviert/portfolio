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
import { FIBRE_LAMP_DEFAULTS } from "@/components/play/variants/settings";
import type { FibreLampSettings } from "@/components/play/variants/settings";

export type FibreLampVariantProps = {
  className?: string;
  settings?: Partial<FibreLampSettings>;
};

const SEGMENTS = 16;

/**
 * Variant 2 · Fibre lamp. Fewer, longer fibres that hang under gravity, sway
 * as one body, and lean towards the pointer. The spring is deliberately soft,
 * so letting go leaves a wobble behind.
 */
export function FibreLampVariant({
  className,
  settings,
}: FibreLampVariantProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Stage | null>(null);
  const settingsRef = useRef<FibreLampSettings>({
    ...FIBRE_LAMP_DEFAULTS,
    ...settings,
  });
  const builtRef = useRef({
    count: FIBRE_LAMP_DEFAULTS.strandCount,
    spread: FIBRE_LAMP_DEFAULTS.spread,
  });

  useEffect(() => {
    const next = { ...FIBRE_LAMP_DEFAULTS, ...settings };
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

    lineMaterial.uniforms.uTaper.value = 0.35;

    let lineMesh: StrandMesh | null = null;
    let tipMesh: TipMesh | null = null;
    let glow: GlowMesh | null = null;

    let count = 0;
    let originX = 0;
    let originY = 0;
    let angles = new Float32Array(0);
    let lengths = new Float32Array(0);
    let baseX = new Float32Array(0);
    let baseY = new Float32Array(0);
    let seeds = new Float32Array(0);
    let offsetX = new Float32Array(0);
    let offsetY = new Float32Array(0);
    let velocityX = new Float32Array(0);
    let velocityY = new Float32Array(0);

    const scratchX = new Float32Array(SEGMENTS + 1);
    const scratchY = new Float32Array(SEGMENTS + 1);

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
      originY = -height * 0.08;

      angles = new Float32Array(count);
      lengths = new Float32Array(count);
      baseX = new Float32Array(count);
      baseY = new Float32Array(count);
      seeds = new Float32Array(count);
      offsetX = new Float32Array(count);
      offsetY = new Float32Array(count);
      velocityX = new Float32Array(count);
      velocityY = new Float32Array(count);

      const random = mulberry32(0x2f6e4a11);
      const halfAngle = (current.spread * Math.PI) / 360;
      const radiusX = width * 0.47;
      const radiusY = height * 1.02;

      for (let i = 0; i < count; i += 1) {
        const step = (2 * halfAngle) / count;
        const jitter = (random() - 0.5) * step * 0.8;
        const angle = -halfAngle + step * (i + 0.5) + jitter;

        angles[i] = angle;
        baseX[i] = originX + (random() - 0.5) * 5;
        baseY[i] = originY + (random() - 0.5) * 3;
        seeds[i] = random();

        let length = Math.hypot(
          radiusX * Math.sin(angle),
          radiusY * Math.cos(angle),
        );
        length *= 0.9 + random() * 0.18;
        lengths[i] = length;
      }

      lineMesh = createStrandMesh(
        count,
        SEGMENTS,
        lineMaterial,
        random,
        [0.5, 0.85],
      );
      tipMesh = createTipMesh(count, tipMaterial, random, [0.7, 1]);

      lineMesh.mesh.position.z = -1;
      lineMesh.mesh.renderOrder = 1;
      tipMesh.mesh.position.z = -1;
      tipMesh.mesh.renderOrder = 2;

      stage.scene.add(lineMesh.mesh);
      stage.scene.add(tipMesh.mesh);

      if (!glow) {
        glow = createGlowMesh(stage.scene);
      }

      glow.mesh.scale.set(width * 0.42, height * 0.55, 1);
      glow.mesh.position.set(originX, originY + height * 0.08, 0);
      glow.uniforms.uColor.value.copy(stage.colors.glow);
    }

    function simulate(stage: Stage): void {
      const current = settingsRef.current;
      const pointer = stage.pointer;
      const dt = stage.dt;
      const radius = Math.max(120, Math.min(stage.width, stage.height) * 0.9);
      const radiusSq = radius * radius;

      for (let i = 0; i < count; i += 1) {
        // The pointer samples the rest curve, not the bent one.
        const angle = angles[i];
        const sin = Math.sin(angle);
        const cos = Math.cos(angle);
        const length = lengths[i];
        const droop = current.droop;
        const down = length * droop * 0.22;
        const outward = sin * length * droop * 0.1;
        const restX = baseX[i] + sin * length * 0.62 + outward * 0.45;
        const restY = baseY[i] + cos * length * 0.62 - down * 0.45;

        let targetX = 0;
        let targetY = 0;

        if (pointer.active) {
          const dx = pointer.x - restX;
          const dy = pointer.y - restY;
          const distanceSq = dx * dx + dy * dy;

          if (distanceSq < radiusSq && distanceSq > 0.0001) {
            const distance = Math.sqrt(distanceSq);
            const falloff = 1 - distance / radius;
            const magnitude = current.attract * falloff * falloff;
            targetX = (dx / distance) * magnitude;
            targetY = (dy / distance) * magnitude;
          }
        }

        const stiffness = 110;
        const ax =
          (targetX - offsetX[i]) * stiffness - velocityX[i] * current.damping;
        const ay =
          (targetY - offsetY[i]) * stiffness - velocityY[i] * current.damping;

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

      const current = settingsRef.current;
      const time = stage.reduced ? 0 : stage.elapsed;
      const speed = stage.reduced ? 0 : current.swaySpeed;
      const droop = current.droop;
      const positions = lineMesh.positions;
      const tips = tipMesh.positions;
      let lineIndex = 0;
      let tipIndex = 0;

      for (let i = 0; i < count; i += 1) {
        const sway =
          (Math.sin(time * 0.24 * speed + seeds[i] * 3.1) * 0.05 +
            Math.sin(time * 0.61 * speed + seeds[i] * 7.7) * 0.014) *
          speed;
        const angle = angles[i] + sway;
        const sin = Math.sin(angle);
        const cos = Math.cos(angle);
        const length = lengths[i];
        const down = length * droop * 0.22;
        const outward = sin * length * droop * 0.1;
        const lag =
          Math.sin(time * 0.33 * speed + seeds[i] * 5.3) *
          length *
          0.01 *
          speed;

        const p1x = baseX[i] + sin * length * 0.3;
        const p1y = baseY[i] + cos * length * 0.3;
        const p2x = baseX[i] + sin * length * 0.66 + outward * 0.45 + lag * 0.5;
        const p2y = baseY[i] + cos * length * 0.66 - down * 0.4;
        const p3x = baseX[i] + sin * length + outward + lag;
        const p3y = baseY[i] + cos * length - down;

        const ox = offsetX[i];
        const oy = offsetY[i];

        const c1x = p1x + ox * 0.18;
        const c1y = p1y + oy * 0.18;
        const c2x = p2x + ox * 0.62;
        const c2y = p2y + oy * 0.62;
        const endX = p3x + ox;
        const endY = p3y + oy;

        for (let point = 0; point <= SEGMENTS; point += 1) {
          const t = point / SEGMENTS;
          const inv = 1 - t;
          const a = inv * inv * inv;
          const b = 3 * inv * inv * t;
          const c = 3 * inv * t * t;
          const d = t * t * t;

          scratchX[point] = a * baseX[i] + b * c1x + c * c2x + d * endX;
          scratchY[point] = a * baseY[i] + b * c1y + c * c2y + d * endY;
        }

        for (let segment = 0; segment < SEGMENTS; segment += 1) {
          const from = segment;
          const to = segment + 1;

          positions[lineIndex] = scratchX[from];
          positions[lineIndex + 1] = scratchY[from];
          positions[lineIndex + 2] = 0;
          positions[lineIndex + 3] = scratchX[to];
          positions[lineIndex + 4] = scratchY[to];
          positions[lineIndex + 5] = 0;
          lineIndex += 6;
        }

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
        glow.uniforms.uStrength.value = stage.reduced ? 0.42 : 0.5;
      }

      if (stage.backdrop) {
        stage.backdrop.uniforms.uBloom.value = 0.4;
      }

      tipMaterial.uniforms.uTime.value = time;
      tipMaterial.uniforms.uShimmer.value = stage.reduced
        ? 0
        : current.twinkle * 0.7;
    }

    function colors(stage: Stage): void {
      lineMaterial.uniforms.uColor.value.copy(stage.colors.strand);
      lineMaterial.uniforms.uOpacity.value =
        stage.colors.phase === "night" ? 0.62 : 0.72;
      tipMaterial.uniforms.uColor.value.copy(stage.colors.strand);
      tipMaterial.uniforms.uOpacity.value =
        stage.colors.phase === "night" ? 0.75 : 0.95;
      tipMaterial.uniforms.uSize.value = 3 * stage.dpr;

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
      data-play-variant="fibre-lamp"
    />
  );
}
