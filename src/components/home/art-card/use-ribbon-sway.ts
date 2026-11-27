"use client";

import { useEffect } from "react";
import type { RefObject } from "react";

/** Root spring: lazy swing (~0.9 Hz), damping ratio ~0.42, settles in ~2s. */
const STIFFNESS = 32;
const DAMPING_RATIO = 0.42;
/** Each strip's stiffness varies by up to this share (seeded), so none move in lockstep. */
const STIFFNESS_VARIATION = 0.15;
/** Fixed integration step and the largest frame time we will catch up on. */
const STEP = 1 / 120;
const MAX_DT = 1 / 30;
/** Pointer speed (px/s): EMA time constant and the tanh knee of its influence. */
const POINTER_TAU = 0.06;
const POINTER_KNEE = 1500;
/** Pointer counts as moving until this long after its last event; then it fades. */
const POINTER_IDLE = 0.06;
const POINTER_FADE_TAU = 0.08;
/** Force (deg/s²) at the knee speed; a sweep of the ribbons swings them ~5-10deg. */
const FORCE = 1200;
/** Gaussian reach of the push, in strips. */
const SIGMA = 1.75;
/** Soft ceiling for any written angle (deg). */
const MAX_ANGLE = 14;
/** Lower joints chase their parent's angle: stiffer, lighter, slightly larger. */
const LOWER_SEGMENTS = 3;
const FOLLOW_STIFFNESS = [60, 78, 96];
const FOLLOW_RATIO = 0.5;
const FOLLOW_GAIN = 1.12;
const REST_ANGLE = 0.01;
const REST_SPEED = 0.1;

const seeded = (index: number) => {
  const value = Math.sin((index + 1) * 12.9898) * 43758.5453;

  return value - Math.floor(value);
};

const soft = (value: number, limit: number) => limit * Math.tanh(value / limit);

/**
 * Lets the pointer brush the hanging ribbons like a breeze. Pointer speed is
 * low-passed and applied as a gaussian-weighted force over time (never a
 * per-event kick). Each strip is a lazy spring; its lower joints are springs
 * that follow the joint above with a lag, so a wave travels to the tip.
 * Integrates on a fixed timestep (frame-rate independent), writes only the
 * `rotate` property, runs requestAnimationFrame only while there is energy,
 * and keeps no React state per frame.
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
    const count = strips.length;
    const lower = strips.map((strip) =>
      Array.from(
        strip.querySelectorAll<HTMLElement>(
          ".shred-strip-segment:not([data-root])",
        ),
      ).slice(-LOWER_SEGMENTS),
    );
    const joints = LOWER_SEGMENTS + 1;
    /** Absolute angle and velocity per strip joint (0 = strip root). */
    const angle = new Float32Array(count * joints);
    const velocity = new Float32Array(count * joints);
    const rootK = Float32Array.from(
      { length: count },
      (_, i) => STIFFNESS * (1 + (seeded(i) * 2 - 1) * STIFFNESS_VARIATION),
    );
    let rect = layer.getBoundingClientRect();
    let lastX = 0;
    let lastT = 0;
    let lastMoveAt = 0;
    let pointerSpeed = 0;
    let pointerPos = 0;
    let frame = 0;
    let previous = 0;
    let carry = 0;

    const refresh = () => {
      rect = layer.getBoundingClientRect();
    };

    const write = () => {
      for (let i = 0; i < count; i += 1) {
        const base = i * joints;

        strips[i].style.rotate =
          `${soft(angle[base], MAX_ANGLE).toFixed(3)}deg`;
        lower[i].forEach((segment, j) => {
          const relative = angle[base + j + 1] - angle[base + j];

          segment.style.rotate = `${relative.toFixed(3)}deg`;
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

    const step = (seconds: number, now: number) => {
      const moving = now - lastMoveAt < POINTER_IDLE * 1000;

      if (!moving) pointerSpeed *= Math.exp(-seconds / POINTER_FADE_TAU);

      const push = soft(pointerSpeed, POINTER_KNEE) / POINTER_KNEE;

      for (let i = 0; i < count; i += 1) {
        const base = i * joints;
        const reach = (i - pointerPos) / SIGMA;
        const force = -FORCE * push * Math.exp(-0.5 * reach * reach);
        const k = rootK[i];

        velocity[base] +=
          (force -
            k * angle[base] -
            2 * DAMPING_RATIO * Math.sqrt(k) * velocity[base]) *
          seconds;
        angle[base] += velocity[base] * seconds;

        for (let j = 1; j < joints; j += 1) {
          const own = FOLLOW_STIFFNESS[j - 1] * (rootK[i] / STIFFNESS);
          const target = angle[base + j - 1] * FOLLOW_GAIN;
          const at = base + j;

          velocity[at] +=
            (own * (target - angle[at]) -
              2 * FOLLOW_RATIO * Math.sqrt(own) * velocity[at]) *
            seconds;
          angle[at] += velocity[at] * seconds;
        }
      }
    };

    const hasEnergy = () => {
      if (Math.abs(pointerSpeed) > POINTER_KNEE * 0.01) return true;

      for (let i = 0; i < angle.length; i += 1) {
        if (
          Math.abs(angle[i]) > REST_ANGLE ||
          Math.abs(velocity[i]) > REST_SPEED
        )
          return true;
      }

      return false;
    };

    const tick = (now: number) => {
      carry += Math.min((now - previous) / 1000, MAX_DT);
      previous = now;

      while (carry >= STEP) {
        step(STEP, now);
        carry -= STEP;
      }

      if (hasEnergy()) {
        write();
        frame = requestAnimationFrame(tick);
        return;
      }

      angle.fill(0);
      velocity.fill(0);
      pointerSpeed = 0;
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

      if (rect.width === 0) return;

      pointerPos = ((event.clientX - rect.left) / rect.width) * count - 0.5;

      if (vx === 0) return;

      pointerSpeed +=
        (vx - pointerSpeed) * (1 - Math.exp(-dtMs / 1000 / POINTER_TAU));
      lastMoveAt = performance.now();

      if (!frame) {
        previous = performance.now();
        carry = 0;
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
