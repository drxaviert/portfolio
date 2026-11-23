/**
 * The vinyl's rotation, kept entirely out of React.
 *
 * One infinite WAAPI rotation runs for the card's whole life. Play and resume
 * tween its `playbackRate` from the current value up to 1, pause tweens it down
 * to 0, so the angle is never reset and the disc coasts to a stop instead of
 * snapping. 33⅓ rpm = 1.8s per revolution. The time readout may re-render once
 * a second; this never re-renders.
 */

const REVOLUTION_MS = 1800;
const PLAY_RAMP_MS = 600;
const RESUME_RAMP_MS = 400;
const PAUSE_RAMP_MS = 800;

const easeInQuad = (t: number) => t * t;
const easeOutQuad = (t: number) => 1 - (1 - t) * (1 - t);

export type VinylSpin = {
  start: (resume?: boolean) => void;
  pause: () => void;
  stop: () => void;
  reset: () => void;
  dispose: () => void;
};

export function createVinylSpin(element: HTMLElement): VinylSpin {
  const animation = element.animate(
    [{ transform: "rotate(0deg)" }, { transform: "rotate(360deg)" }],
    {
      duration: REVOLUTION_MS,
      iterations: Infinity,
      easing: "linear",
    },
  );

  animation.playbackRate = 0;

  let frame = 0;

  function cancelTween() {
    if (frame) {
      cancelAnimationFrame(frame);
      frame = 0;
    }
  }

  function tweenRate(
    to: number,
    duration: number,
    ease: (t: number) => number,
  ) {
    cancelTween();

    const from = animation.playbackRate;

    if (Math.abs(to - from) < 0.001) {
      animation.playbackRate = to;
      return;
    }

    const start = performance.now();

    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration);

      animation.playbackRate = from + (to - from) * ease(t);

      if (t < 1) {
        frame = requestAnimationFrame(step);
      } else {
        frame = 0;
      }
    };

    frame = requestAnimationFrame(step);
  }

  return {
    start(resume = false) {
      if (animation.playState !== "running") {
        animation.play();
      }

      tweenRate(1, resume ? RESUME_RAMP_MS : PLAY_RAMP_MS, easeInQuad);
    },
    pause() {
      tweenRate(0, PAUSE_RAMP_MS, easeOutQuad);
    },
    stop() {
      cancelTween();
      animation.playbackRate = 0;
    },
    reset() {
      cancelTween();
      animation.playbackRate = 0;
      animation.currentTime = 0;
    },
    dispose() {
      cancelTween();
      animation.cancel();
    },
  };
}
