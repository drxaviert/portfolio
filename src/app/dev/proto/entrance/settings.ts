import type { EntranceVariant } from "@/components/home/entrance-cell";

/**
 * Throwaway prototype (dev route only): the tunable numbers behind each
 * entrance variant, and the one place where they turn into CSS custom
 * properties.
 *
 * The panel writes these vars onto the stable `.entrance-scope` wrapper, so a
 * slider drag repaints the layout without re-rendering React; the values are
 * inherited into HomeLayout and read by home-entrance.css.
 *
 * The defaults are the shipped 76f8961 values (plus the prototype-only tuning
 * for "clear"), which is what "Reset" restores.
 */

export const BUDGET_MS = 700;

export type ScaleSettings = {
  from: number;
  blur: number;
  duration: number;
  stagger: number;
};

export type RiseSettings = {
  distance: number;
  duration: number;
  stagger: number;
};

export type RingSettings = {
  edgeDuration: number;
  edgeHold: number;
  fillDelay: number;
  fillDuration: number;
  stagger: number;
};

export type SkySettings = {
  glowDuration: number;
  delay: number;
  stagger: number;
  duration: number;
  from: number;
  blur: number;
};

export type ClearSettings = {
  blur: number;
  duration: number;
  /** Soft edge on the clearing mask, in vh so it tracks the viewport height. */
  feather: number;
  delay: number;
};

export type StepSettings = {
  /** Hard cuts per card; the total travel is count x distance. */
  count: number;
  distance: number;
  duration: number;
  stagger: number;
  markerSize: number;
  /** How long the corner markers stay at full opacity after the first cut. */
  markerHold: number;
  markerFade: number;
};

export type GrainSettings = {
  /** Peak grain opacity, in percent. */
  strength: number;
  jitter: number;
  /** One jitter step, in ms; a cycle is four of them. */
  rate: number;
  duration: number;
  delay: number;
  stagger: number;
  itemDuration: number;
};

export type Settings = {
  scale: ScaleSettings;
  rise: RiseSettings;
  ring: RingSettings;
  sky: SkySettings;
  clear: ClearSettings;
  step: StepSettings;
  grain: GrainSettings;
};

export const DEFAULT_SETTINGS: Settings = {
  scale: { from: 0.96, blur: 6, duration: 360, stagger: 50 },
  rise: { distance: 8, duration: 380, stagger: 60 },
  ring: {
    edgeDuration: 380,
    edgeHold: 175,
    fillDelay: 80,
    fillDuration: 240,
    stagger: 40,
  },
  sky: {
    glowDuration: 300,
    delay: 120,
    stagger: 36,
    duration: 360,
    from: 0.98,
    blur: 4,
  },
  // 20px of blur over the whole viewport, clearing from the horizon outwards.
  // 680ms keeps the whole reveal inside the 700ms budget; the feather is 25vh
  // — a quarter of the screen tall at the reference 1440x900.
  clear: { blur: 20, duration: 680, feather: 25, delay: 0 },
  // Base44 hero cuts: three 5px jumps per card, 40ms apart from the nav up.
  // 600ms is the marker fade on the last card, not the card itself.
  step: {
    count: 3,
    distance: 5,
    duration: 180,
    stagger: 40,
    markerSize: 6,
    markerHold: 100,
    markerFade: 200,
  },
  // Base44's boiling texture: a 120px noise tile stepped 3px four times a
  // cycle (400ms) while it decays over 460ms; the cards land last at 672ms.
  grain: {
    strength: 8,
    jitter: 3,
    rate: 100,
    duration: 460,
    delay: 160,
    stagger: 32,
    itemDuration: 320,
  },
};

/** Curves already in docs/design-system/motion.md; no new ones. */
export const EASINGS = [
  {
    id: "entrance",
    label: "Entrance (0.23, 1, 0.32, 1)",
    value: "cubic-bezier(0.23, 1, 0.32, 1)",
  },
  {
    id: "settle",
    label: "Icon settle (0.34, 1.3, 0.64, 1)",
    value: "cubic-bezier(0.34, 1.3, 0.64, 1)",
  },
  {
    id: "ring",
    label: "Ring grow (0.165, 0.84, 0.44, 1)",
    value: "cubic-bezier(0.165, 0.84, 0.44, 1)",
  },
  {
    id: "soft",
    label: "Frame glow (0.32, 0.72, 0, 1)",
    value: "cubic-bezier(0.32, 0.72, 0, 1)",
  },
] as const;

export const DEFAULT_EASING = EASINGS[0].value;

export type Control = {
  key: string;
  label: string;
  min: number;
  max: number;
  step: number;
  unit: "ms" | "px" | "vh" | "%" | "×";
  digits?: number;
};

export const CONTROLS: Record<EntranceVariant, Control[]> = {
  scale: [
    {
      key: "from",
      label: "Start scale",
      min: 0.8,
      max: 1,
      step: 0.01,
      unit: "×",
      digits: 2,
    },
    {
      key: "blur",
      label: "Blur",
      min: 0,
      max: 12,
      step: 0.5,
      unit: "px",
      digits: 1,
    },
    {
      key: "duration",
      label: "Item duration",
      min: 120,
      max: 800,
      step: 10,
      unit: "ms",
    },
    { key: "stagger", label: "Stagger", min: 0, max: 120, step: 5, unit: "ms" },
  ],
  rise: [
    {
      key: "distance",
      label: "Distance",
      min: 0,
      max: 32,
      step: 1,
      unit: "px",
    },
    {
      key: "duration",
      label: "Row duration",
      min: 120,
      max: 800,
      step: 10,
      unit: "ms",
    },
    {
      key: "stagger",
      label: "Row stagger",
      min: 0,
      max: 160,
      step: 5,
      unit: "ms",
    },
  ],
  ring: [
    {
      key: "edgeDuration",
      label: "Edge duration",
      min: 120,
      max: 800,
      step: 10,
      unit: "ms",
    },
    {
      key: "edgeHold",
      label: "Edge hold",
      min: 0,
      max: 400,
      step: 10,
      unit: "ms",
    },
    {
      key: "fillDelay",
      label: "Fill delay",
      min: 0,
      max: 300,
      step: 10,
      unit: "ms",
    },
    {
      key: "fillDuration",
      label: "Fill duration",
      min: 80,
      max: 600,
      step: 10,
      unit: "ms",
    },
    { key: "stagger", label: "Stagger", min: 0, max: 100, step: 5, unit: "ms" },
  ],
  sky: [
    {
      key: "glowDuration",
      label: "Glow duration",
      min: 0,
      max: 600,
      step: 10,
      unit: "ms",
    },
    {
      key: "delay",
      label: "Card start delay",
      min: 0,
      max: 400,
      step: 10,
      unit: "ms",
    },
    {
      key: "stagger",
      label: "Per-item stagger",
      min: 0,
      max: 100,
      step: 4,
      unit: "ms",
    },
    {
      key: "duration",
      label: "Item duration",
      min: 120,
      max: 800,
      step: 10,
      unit: "ms",
    },
    {
      key: "from",
      label: "Start scale",
      min: 0.8,
      max: 1,
      step: 0.01,
      unit: "×",
      digits: 2,
    },
    {
      key: "blur",
      label: "Blur",
      min: 0,
      max: 12,
      step: 0.5,
      unit: "px",
      digits: 1,
    },
  ],
  clear: [
    {
      key: "blur",
      label: "Start blur",
      min: 0,
      max: 40,
      step: 1,
      unit: "px",
    },
    {
      key: "duration",
      label: "Clear duration",
      min: 120,
      max: 1600,
      step: 20,
      unit: "ms",
    },
    {
      key: "feather",
      label: "Feather width",
      min: 0,
      max: 60,
      step: 1,
      unit: "vh",
    },
    {
      key: "delay",
      label: "Delay",
      min: 0,
      max: 500,
      step: 10,
      unit: "ms",
    },
  ],
  step: [
    { key: "count", label: "Step count", min: 2, max: 6, step: 1, unit: "×" },
    {
      key: "distance",
      label: "Step distance",
      min: 1,
      max: 10,
      step: 1,
      unit: "px",
    },
    {
      key: "duration",
      label: "Card duration",
      min: 80,
      max: 400,
      step: 10,
      unit: "ms",
    },
    {
      key: "stagger",
      label: "Card stagger",
      min: 0,
      max: 120,
      step: 5,
      unit: "ms",
    },
    {
      key: "markerSize",
      label: "Marker size",
      min: 2,
      max: 12,
      step: 1,
      unit: "px",
    },
    {
      key: "markerHold",
      label: "Marker hold",
      min: 0,
      max: 300,
      step: 10,
      unit: "ms",
    },
    {
      key: "markerFade",
      label: "Marker fade",
      min: 60,
      max: 400,
      step: 10,
      unit: "ms",
    },
  ],
  grain: [
    {
      key: "strength",
      label: "Grain strength",
      min: 0,
      max: 25,
      step: 1,
      unit: "%",
    },
    {
      key: "jitter",
      label: "Jitter distance",
      min: 1,
      max: 6,
      step: 1,
      unit: "px",
    },
    {
      key: "rate",
      label: "Jitter step rate",
      min: 40,
      max: 200,
      step: 10,
      unit: "ms",
    },
    {
      key: "duration",
      label: "Grain duration",
      min: 120,
      max: 900,
      step: 10,
      unit: "ms",
    },
    {
      key: "delay",
      label: "Card start delay",
      min: 0,
      max: 500,
      step: 10,
      unit: "ms",
    },
    {
      key: "stagger",
      label: "Per-item stagger",
      min: 0,
      max: 100,
      step: 4,
      unit: "ms",
    },
    {
      key: "itemDuration",
      label: "Item duration",
      min: 120,
      max: 800,
      step: 10,
      unit: "ms",
    },
  ],
};

/** 7 reading-order items: the last one starts at 6 x stagger. */
const LAST_ITEM = 6;
/** 3 rows: the last one starts at 2 x stagger. */
const LAST_ROW = 2;

/** Milliseconds between the edge's own in/out fades. Symmetric by design. */
export function edgeFades(ring: RingSettings): { inMs: number; outMs: number } {
  const fade = (ring.edgeDuration - ring.edgeHold) / 2;
  const inMs = Math.max(20, fade);

  return {
    inMs,
    outMs: Math.max(20, ring.edgeDuration - ring.edgeHold - inMs),
  };
}

/** One hard cut of a step-cut card: the whole duration over the cut count. */
export function stepFirstMs(step: StepSettings): number {
  return step.duration / step.count;
}

/** The card timing the panel and Copy values show for a non-eased variant. */
export function stepsTiming(
  variant: EntranceVariant,
  settings: Settings,
): string | null {
  return variant === "step" ? `steps(${settings.step.count}, end)` : null;
}

export function totalMs(variant: EntranceVariant, settings: Settings): number {
  switch (variant) {
    case "scale":
      return LAST_ITEM * settings.scale.stagger + settings.scale.duration;
    case "rise":
      return LAST_ROW * settings.rise.stagger + settings.rise.duration;
    case "ring": {
      const { inMs, outMs } = edgeFades(settings.ring);
      const edge = inMs + settings.ring.edgeHold + outMs;
      const fill = settings.ring.fillDelay + settings.ring.fillDuration;

      return LAST_ITEM * settings.ring.stagger + Math.max(edge, fill);
    }
    case "sky":
      return Math.max(
        settings.sky.glowDuration,
        settings.sky.delay +
          LAST_ITEM * settings.sky.stagger +
          settings.sky.duration,
      );
    case "clear":
      // One layer, one reveal: the mask radius is the whole animation.
      return settings.clear.delay + settings.clear.duration;
    case "step": {
      const s = settings.step;
      const card = s.duration;
      // The markers outlive the card: they arrive on its first cut and fade
      // after the hold, so the sequence ends when the last card's markers go.
      const markers = stepFirstMs(s) + s.markerHold + s.markerFade;

      return LAST_ITEM * s.stagger + Math.max(card, markers);
    }
    case "grain":
      // The grain and the last card both finish the sequence; whichever is
      // later is the settle.
      return Math.max(
        settings.grain.duration,
        settings.grain.delay +
          LAST_ITEM * settings.grain.stagger +
          settings.grain.itemDuration,
      );
  }
}

/** The custom properties home-entrance.css reads, for one variant. */
export function cssVars(
  variant: EntranceVariant,
  settings: Settings,
  easing: string,
): Record<string, string> {
  const shared = { "--entrance-ease": easing };

  switch (variant) {
    case "scale": {
      const s = settings.scale;

      return {
        ...shared,
        "--scale-from": String(s.from),
        "--scale-blur": `${s.blur}px`,
        "--scale-duration": `${s.duration}ms`,
        "--scale-stagger": `${s.stagger}ms`,
      };
    }
    case "rise": {
      const s = settings.rise;

      return {
        ...shared,
        "--rise-distance": `${s.distance}px`,
        "--rise-duration": `${s.duration}ms`,
        "--rise-stagger": `${s.stagger}ms`,
      };
    }
    case "ring": {
      const s = settings.ring;
      const { inMs, outMs } = edgeFades(s);

      return {
        ...shared,
        "--ring-edge-in": `${inMs}ms`,
        "--ring-edge-out": `${outMs}ms`,
        "--ring-edge-hold": `${s.edgeHold}ms`,
        "--ring-fill-delay": `${s.fillDelay}ms`,
        "--ring-fill-duration": `${s.fillDuration}ms`,
        "--ring-stagger": `${s.stagger}ms`,
      };
    }
    case "sky": {
      const s = settings.sky;

      return {
        ...shared,
        "--sky-glow-duration": `${s.glowDuration}ms`,
        "--sky-delay": `${s.delay}ms`,
        "--sky-stagger": `${s.stagger}ms`,
        "--sky-duration": `${s.duration}ms`,
        "--sky-from": String(s.from),
        "--sky-blur": `${s.blur}px`,
      };
    }
    case "clear": {
      const s = settings.clear;

      return {
        ...shared,
        "--clear-blur": `${s.blur}px`,
        "--clear-duration": `${s.duration}ms`,
        "--clear-feather": `${s.feather}vh`,
        "--clear-delay": `${s.delay}ms`,
      };
    }
    case "step": {
      const s = settings.step;

      return {
        ...shared,
        "--step-count": String(s.count),
        "--step-distance": `${s.distance}px`,
        "--step-duration": `${s.duration}ms`,
        "--step-stagger": `${s.stagger}ms`,
        "--step-marker-size": `${s.markerSize}px`,
        "--step-marker-hold": `${s.markerHold}ms`,
        "--step-marker-fade": `${s.markerFade}ms`,
      };
    }
    case "grain": {
      const s = settings.grain;

      return {
        ...shared,
        "--grain-strength": String(s.strength / 100),
        "--grain-jitter": `${s.jitter}px`,
        "--grain-rate": `${s.rate}ms`,
        "--grain-duration": `${s.duration}ms`,
        "--grain-delay": `${s.delay}ms`,
        "--grain-stagger": `${s.stagger}ms`,
        "--grain-item-duration": `${s.itemDuration}ms`,
      };
    }
  }
}

export function formatValue(control: Control, value: number): string {
  return `${value.toFixed(control.digits ?? 0)}${control.unit}`;
}

function values(
  settings: Settings,
  variant: EntranceVariant,
): Record<string, number> {
  return settings[variant] as unknown as Record<string, number>;
}

export function valueOf(
  settings: Settings,
  variant: EntranceVariant,
  key: string,
): number {
  return values(settings, variant)[key];
}

/** One field replaced; the variant object is never mutated in place. */
export function patch(
  settings: Settings,
  variant: EntranceVariant,
  key: string,
  value: number,
): Settings {
  return {
    ...settings,
    [variant]: { ...values(settings, variant), [key]: value },
  } as Settings;
}

export function resetVariant(
  settings: Settings,
  variant: EntranceVariant,
): Settings {
  return { ...settings, [variant]: { ...DEFAULT_SETTINGS[variant] } };
}

/** Paste-ready block: the chosen variant, its curve, every var and the total. */
export function copyBlock(
  variant: EntranceVariant,
  settings: Settings,
  easing: string,
  total: number,
): string {
  const easingName =
    EASINGS.find((entry) => entry.value === easing)?.id ?? "custom";
  const vars = Object.entries(cssVars(variant, settings, easing)).filter(
    ([name]) => name !== "--entrance-ease",
  );
  const steps = stepsTiming(variant, settings);
  const curve = steps
    ? `cards ${steps} · markers on ${easingName}`
    : `easing ${easingName}`;

  return [
    `/* home entrance · ${variant} · ${curve} */`,
    steps
      ? `/* --entrance-ease is the marker fade only; cards do not tween */`
      : null,
    `--entrance-ease: ${easing};`,
    ...vars.map(([name, value]) => `${name}: ${value};`),
    `/* settles by ${total}ms */`,
  ]
    .filter((line): line is string => line !== null)
    .join("\n");
}
