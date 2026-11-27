"use client";

import { useEffect } from "react";
import type { RefObject } from "react";

/** Spring stiffness and damping per strip; slightly under-damped so it wobbles. */
const STIFFNESS = 120;
const DAMPING = 10;
/** Degrees per second of impulse, per px/s of pointer speed. */
const GAIN = 0.18;
/** Neighbour falloff: the hit strip, then ±1, then ±2. */
const FALLOFF = [1, 0.6, 0.3];
const MAX_ANGLE = 12;
/** The tip's lower joints follow the strip with this share of its angle. */
const SEGMENT_SHARE = 0.35;
const LOWER_SEGMENTS = 3;
const REST_ANGLE = 0.02;
const REST_SPEED = 0.5;
const MAX_DT = 1 / 30;

/**
 * Lets the pointer brush the hanging ribbons: moving across the strips layer
 * kicks the strips under it sideways, and each strip is a damped spring that
 * settles back to straight. It writes only the `rotate` property (compositor
 * friendly) straight to the DOM, runs requestAnimationFrame only while any
 * strip still has energy, and keeps no React state per frame.
 *
 * Off under reduced motion and on touch (`hover: none`) devices.
 */
export function useRibbonSway(
  layerRef: RefObject<HTMLElement | null>,
  enabled: boolean,
) {
  useEffect(() => {
    const layer = layerRef.current;

    if (!enabled || !layer) return;
    if (window.matchMedia("(hover: none)").matches) return;

    const strips = Array.from(layer.children) as HTMLElement[];
    const lower = strips.map((strip) =>
      Array.from(
        strip.querySelectorAll<HTMLElement>(
          ".shred-strip-segment:not([data-root])",
        ),
      ).slice(-LOWER_SEGMENTS),
    );
    const angle = new Float32Array(strips.length);
    const velocity = new Float32Array(strips.length);
    let rect = layer.getBoundingClientRect();
    let lastX = 0;
    let lastT = 0;
    let frame = 0;
    let previous = 0;

    const refresh = () => {
      rect = layer.getBoundingClientRect();
    };

    const write = () => {
      for (let i = 0; i < strips.length; i += 1) {
        const value = `${angle[i].toFixed(3)}deg`;

        strips[i].style.rotate = value;
        lower[i].forEach((segment) => {
          segment.style.rotate = `${(angle[i] * SEGMENT_SHARE).toFixed(3)}deg`;
        });
      }
    };

    const clear = () => {
      strips.forEach((strip, i) => {
        strip.style.rotate = "";
        lower[i].forEach((segment) => {
          segment.style.rotate = "";
        });
      });
    };

    const tick = (now: number) => {
      const dt = Math.min((now - previous) / 1000, MAX_DT);
      let energy = false;

      previous = now;

      for (let i = 0; i < strips.length; i += 1) {
        velocity[i] += (-STIFFNESS * angle[i] - DAMPING * velocity[i]) * dt;
        angle[i] = Math.max(
          -MAX_ANGLE,
          Math.min(MAX_ANGLE, angle[i] + velocity[i] * dt),
        );

        if (
          Math.abs(angle[i]) > REST_ANGLE ||
          Math.abs(velocity[i]) > REST_SPEED
        )
          energy = true;
      }

      if (energy) {
        write();
        frame = requestAnimationFrame(tick);
        return;
      }

      angle.fill(0);
      velocity.fill(0);
      clear();
      frame = 0;
    };

    const onMove = (event: PointerEvent) => {
      const dtMs = event.timeStamp - lastT;
      const vx =
        lastT && dtMs > 0 && dtMs < 100
          ? ((event.clientX - lastX) / dtMs) * 1000
          : 0;

      lastX = event.clientX;
      lastT = event.timeStamp;

      if (vx === 0 || rect.width === 0) return;

      const hit = Math.floor(
        ((event.clientX - rect.left) / rect.width) * strips.length,
      );

      FALLOFF.forEach((weight, distance) => {
        [hit - distance, hit + distance].forEach((index, side) => {
          if ((distance === 0 && side === 1) || !strips[index]) return;

          velocity[index] += -GAIN * vx * weight;
        });
      });

      if (!frame) {
        previous = performance.now();
        frame = requestAnimationFrame(tick);
      }
    };

    const onEnter = (event: PointerEvent) => {
      refresh();
      lastX = event.clientX;
      lastT = event.timeStamp;
    };

    layer.addEventListener("pointerenter", onEnter);
    layer.addEventListener("pointermove", onMove);
    window.addEventListener("resize", refresh);

    return () => {
      layer.removeEventListener("pointerenter", onEnter);
      layer.removeEventListener("pointermove", onMove);
      window.removeEventListener("resize", refresh);
      if (frame) cancelAnimationFrame(frame);
      clear();
    };
  }, [layerRef, enabled]);
}
