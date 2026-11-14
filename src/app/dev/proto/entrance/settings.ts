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
 * The defaults are the shipped 76f8961 values, which is what "Reset" restores.
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

export type Settings = {
  scale: ScaleSettings;
  rise: RiseSettings;
  ring: RingSettings;
  sky: SkySettings;
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
  unit: "ms" | "px" | "×";
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

  return [
    `/* home entrance · ${variant} · easing ${easingName} */`,
    `--entrance-ease: ${easing};`,
    ...vars.map(([name, value]) => `${name}: ${value};`),
    `/* settles by ${total}ms */`,
  ].join("\n");
}
