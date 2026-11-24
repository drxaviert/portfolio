/**
 * A mass-spring oscillator for the hover interaction.
 *
 * The hover target can change at any time (pointer to another prop, variant
 * switch, resize); the spring keeps its value and velocity, so a retarget
 * mid-flight bends the existing motion instead of restarting it. No duration
 * is stored anywhere, which is what makes it interruptible.
 *
 * Steps are split so a long frame cannot explode the integration: dt is
 * clamped by the caller and every step is at most 1/120 s, so 30 fps and
 * 144 fps trace the same curve.
 */
const MAX_STEP = 1 / 120;

export class Spring {
  value: number;
  velocity = 0;
  target: number;
  readonly stiffness: number;
  readonly damping: number;

  constructor(value: number, stiffness = 190, damping = 26, target = value) {
    this.value = value;
    this.target = target;
    this.stiffness = stiffness;
    this.damping = damping;
  }

  step(dt: number): void {
    let remaining = dt;

    while (remaining > 0) {
      const h = Math.min(MAX_STEP, remaining);
      const acceleration =
        this.stiffness * (this.target - this.value) -
        this.damping * this.velocity;

      this.velocity += acceleration * h;
      this.value += this.velocity * h;
      remaining -= h;
    }
  }

  /** Jump to the target and kill momentum, for reduced motion. */
  snap(): void {
    this.value = this.target;
    this.velocity = 0;
  }
}
