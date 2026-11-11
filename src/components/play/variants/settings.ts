import { FIBER_FAN_DEFAULTS } from "@/components/play/fiber-fan-settings";
import type { FiberFanSettings } from "@/components/play/fiber-fan-settings";

/**
 * Settings for every variant live here, away from the three.js modules, so the
 * lab can read defaults and slider ranges without pulling WebGL into its chunk.
 */

export type VariantId =
  "current" | "faithful" | "fibre-lamp" | "depth" | "silk-wave";

export type FaithfulSettings = {
  strandCount: number;
  spread: number;
  bloom: number;
  pushRadius: number;
  pushStrength: number;
  stiffness: number;
  damping: number;
};

export type FibreLampSettings = {
  strandCount: number;
  spread: number;
  droop: number;
  swaySpeed: number;
  attract: number;
  twinkle: number;
  damping: number;
};

export type DepthSettings = {
  strandCount: number;
  spread: number;
  parallax: number;
  tilt: number;
  bloom: number;
  easing: number;
};

export type SilkWaveSettings = {
  density: number;
  curve: number;
  flow: number;
  sheen: number;
  pointerStrength: number;
};

export type VariantSettings = {
  current: FiberFanSettings;
  faithful: FaithfulSettings;
  "fibre-lamp": FibreLampSettings;
  depth: DepthSettings;
  "silk-wave": SilkWaveSettings;
};

export type VariantMeta = {
  id: VariantId;
  label: string;
  shortcut: string;
  note: string;
};

export const VARIANTS: VariantMeta[] = [
  {
    id: "current",
    label: "Current",
    shortcut: "1",
    note: "The existing prototype, unchanged apart from the new tokens.",
  },
  {
    id: "faithful",
    label: "Faithful",
    shortcut: "2",
    note: "Dense straight fibres, bright tips, bloom at the origin.",
  },
  {
    id: "fibre-lamp",
    label: "Fibre lamp",
    shortcut: "3",
    note: "Fewer, longer strands drooping under gravity and swaying.",
  },
  {
    id: "depth",
    label: "Depth",
    shortcut: "4",
    note: "Three parallax layers; the pointer tilts the fan instead of parting it.",
  },
  {
    id: "silk-wave",
    label: "Silk wave",
    shortcut: "5",
    note: "One silk ribbon of fine fibres sweeping across the card.",
  },
];

export const FAITHFUL_DEFAULTS: FaithfulSettings = {
  strandCount: 620,
  spread: 170,
  bloom: 0.9,
  pushRadius: 160,
  pushStrength: 80,
  stiffness: 190,
  damping: 18,
};

export const FIBRE_LAMP_DEFAULTS: FibreLampSettings = {
  strandCount: 200,
  spread: 158,
  droop: 0.7,
  swaySpeed: 0.6,
  attract: 70,
  twinkle: 0.55,
  damping: 6.5,
};

export const DEPTH_DEFAULTS: DepthSettings = {
  strandCount: 420,
  spread: 170,
  parallax: 12,
  tilt: 3.5,
  bloom: 0.55,
  easing: 6,
};

export const SILK_WAVE_DEFAULTS: SilkWaveSettings = {
  density: 22,
  curve: 0.7,
  flow: 0.55,
  sheen: 0.9,
  pointerStrength: 30,
};

export function createVariantDefaults(): VariantSettings {
  return {
    current: { ...FIBER_FAN_DEFAULTS },
    faithful: { ...FAITHFUL_DEFAULTS },
    "fibre-lamp": { ...FIBRE_LAMP_DEFAULTS },
    depth: { ...DEPTH_DEFAULTS },
    "silk-wave": { ...SILK_WAVE_DEFAULTS },
  };
}

export type SliderDef = {
  key: string;
  label: string;
  min: number;
  max: number;
  step: number;
  unit: string;
  precision?: number;
};

export const VARIANT_SLIDERS: Record<VariantId, SliderDef[]> = {
  current: [
    {
      key: "strandCount",
      label: "Strand count",
      min: 100,
      max: 1200,
      step: 20,
      unit: "",
    },
    {
      key: "fanAngle",
      label: "Fan angle",
      min: 120,
      max: 180,
      step: 1,
      unit: "°",
    },
    {
      key: "glowStrength",
      label: "Base glow",
      min: 0,
      max: 2,
      step: 0.05,
      unit: "",
      precision: 2,
    },
    {
      key: "pushRadius",
      label: "Push radius",
      min: 20,
      max: 320,
      step: 5,
      unit: "px",
    },
    {
      key: "pushStrength",
      label: "Push strength",
      min: 0,
      max: 260,
      step: 5,
      unit: "px",
    },
    {
      key: "stiffness",
      label: "Spring stiffness",
      min: 20,
      max: 500,
      step: 5,
      unit: "",
    },
    {
      key: "damping",
      label: "Damping",
      min: 1,
      max: 40,
      step: 0.5,
      unit: "",
      precision: 2,
    },
  ],
  faithful: [
    {
      key: "strandCount",
      label: "Strand count",
      min: 400,
      max: 700,
      step: 10,
      unit: "",
    },
    { key: "spread", label: "Spread", min: 150, max: 178, step: 1, unit: "°" },
    {
      key: "bloom",
      label: "Origin bloom",
      min: 0,
      max: 2,
      step: 0.05,
      unit: "",
      precision: 2,
    },
    {
      key: "pushRadius",
      label: "Part radius",
      min: 40,
      max: 320,
      step: 5,
      unit: "px",
    },
    {
      key: "pushStrength",
      label: "Part strength",
      min: 0,
      max: 200,
      step: 5,
      unit: "px",
    },
    {
      key: "stiffness",
      label: "Spring stiffness",
      min: 60,
      max: 400,
      step: 5,
      unit: "",
    },
    {
      key: "damping",
      label: "Damping",
      min: 4,
      max: 40,
      step: 0.5,
      unit: "",
      precision: 2,
    },
  ],
  "fibre-lamp": [
    {
      key: "strandCount",
      label: "Strand count",
      min: 150,
      max: 250,
      step: 5,
      unit: "",
    },
    { key: "spread", label: "Spread", min: 120, max: 180, step: 1, unit: "°" },
    {
      key: "droop",
      label: "Gravity droop",
      min: 0,
      max: 1.4,
      step: 0.05,
      unit: "",
      precision: 2,
    },
    {
      key: "swaySpeed",
      label: "Sway speed",
      min: 0,
      max: 1.5,
      step: 0.05,
      unit: "",
      precision: 2,
    },
    {
      key: "attract",
      label: "Pointer pull",
      min: 0,
      max: 160,
      step: 5,
      unit: "px",
    },
    {
      key: "twinkle",
      label: "Tip twinkle",
      min: 0,
      max: 1,
      step: 0.05,
      unit: "",
      precision: 2,
    },
    {
      key: "damping",
      label: "Wobble damping",
      min: 2,
      max: 20,
      step: 0.5,
      unit: "",
      precision: 2,
    },
  ],
  depth: [
    {
      key: "strandCount",
      label: "Strand count",
      min: 240,
      max: 640,
      step: 10,
      unit: "",
    },
    { key: "spread", label: "Spread", min: 150, max: 178, step: 1, unit: "°" },
    {
      key: "parallax",
      label: "Parallax",
      min: 0,
      max: 24,
      step: 1,
      unit: "px",
    },
    {
      key: "tilt",
      label: "Fan tilt",
      min: 0,
      max: 8,
      step: 0.5,
      unit: "°",
      precision: 1,
    },
    {
      key: "easing",
      label: "Parallax easing",
      min: 2,
      max: 14,
      step: 0.5,
      unit: "",
      precision: 1,
    },
    {
      key: "bloom",
      label: "Origin bloom",
      min: 0,
      max: 1.5,
      step: 0.05,
      unit: "",
      precision: 2,
    },
  ],
  "silk-wave": [
    {
      key: "density",
      label: "Fibre density",
      min: 8,
      max: 48,
      step: 2,
      unit: "",
    },
    {
      key: "curve",
      label: "Curve amount",
      min: 0.2,
      max: 1.2,
      step: 0.05,
      unit: "",
      precision: 2,
    },
    {
      key: "flow",
      label: "Flow speed",
      min: 0,
      max: 1.5,
      step: 0.05,
      unit: "",
      precision: 2,
    },
    {
      key: "sheen",
      label: "Sheen strength",
      min: 0,
      max: 1.5,
      step: 0.05,
      unit: "",
      precision: 2,
    },
    {
      key: "pointerStrength",
      label: "Pointer bend",
      min: 0,
      max: 80,
      step: 5,
      unit: "px",
    },
  ],
};
