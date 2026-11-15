import { parseColor, toOklch } from "@/lib/system/color";
import {
  DURATIONS,
  PALETTE,
  RADII,
  ROLES,
} from "@/lib/system/source.generated";
import type { Phase } from "@/lib/theme";

export type NodeKind =
  | "param"
  | "primitive"
  | "role"
  | "radius"
  | "duration"
  | "component";

export type SystemNode = {
  id: string;
  kind: NodeKind;
  label: string;
  from: string[];
  consumers?: string[];
};

const PHASES: readonly Phase[] = ["dawn", "day", "dusk", "night"];

const PARAMS: ReadonlyArray<{ id: string; label: string }> = [
  { id: "hue", label: "Hue" },
  { id: "round", label: "Roundness" },
  { id: "tod", label: "Time of day" },
  { id: "contrast", label: "Contrast" },
  { id: "speed", label: "Motion speed" },
];

/** Component → the tokens it consumes (the only hand-written links). */
const COMPONENTS: readonly SystemNode[] = [
  {
    id: "card",
    kind: "component",
    label: "Card",
    from: [
      "--shadow-card",
      "--radius-lg",
      "--surface-container-low",
      "--frame-line",
      "--horizon-ring-glow",
    ],
  },
  {
    id: "nav-item-glide",
    kind: "component",
    label: "Nav item + Glide",
    from: [
      "--primary",
      "--on-surface",
      "--surface-container",
      "--radius-md",
      "--duration-short-2",
      "--duration-short-3",
      "--duration-medium-5",
    ],
  },
  {
    id: "theme-toggle",
    kind: "component",
    label: "Theme toggle",
    from: ["--toggle-track", "--toggle-selected", "--primary"],
  },
  {
    id: "tracker",
    kind: "component",
    label: "Tracker",
    from: [
      "--tracker-0",
      "--tracker-1",
      "--tracker-2",
      "--tracker-3",
      "--tracker-4",
      "--on-surface-variant",
    ],
  },
];

const NODES = new Map<string, SystemNode>();

function labelForToken(token: string): string {
  return token
    .replace(/^--/, "")
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function varReferences(value: string): string[] {
  return [...value.matchAll(/var\(\s*(--[\w-]+)\s*\)/g)].map(
    (match) => match[1],
  );
}

function buildNodes(): void {
  for (const param of PARAMS) {
    NODES.set(param.id, {
      id: param.id,
      kind: "param",
      label: param.label,
      from: [],
    });
  }

  // Primitives rotate with hue exactly when they have meaningful chroma; the
  // engine's rotation weight runs from 0.01 to 0.03 in OKLCH chroma.
  for (const [token, value] of Object.entries(PALETTE)) {
    const chroma = toOklch(parseColor(value)).c;

    NODES.set(token, {
      id: token,
      kind: "primitive",
      label: labelForToken(token),
      from: chroma > 0.01 ? ["hue"] : [],
    });
  }

  const references = new Map<string, string[]>();

  for (const phase of PHASES) {
    for (const [token, value] of Object.entries(ROLES[phase])) {
      const list = references.get(token) ?? [];

      for (const reference of varReferences(value)) {
        if (!list.includes(reference)) list.push(reference);
      }

      references.set(token, list);
    }
  }

  for (const [token, parents] of references) {
    const from = [...parents];

    // Surfaces and their on-* partners are the pairs contrast scales.
    if (/^--(surface|on-)/.test(token)) from.push("contrast");

    // Every role moves with the time-of-day slider.
    from.push("tod");

    NODES.set(token, {
      id: token,
      kind: "role",
      label: labelForToken(token),
      from,
    });
  }

  for (const token of Object.keys(RADII)) {
    NODES.set(token, {
      id: token,
      kind: "radius",
      label: labelForToken(token),
      from: ["round"],
    });
  }

  for (const token of Object.keys(DURATIONS)) {
    NODES.set(token, {
      id: token,
      kind: "duration",
      label: labelForToken(token),
      from: ["speed"],
    });
  }

  for (const component of COMPONENTS) NODES.set(component.id, component);
}

buildNodes();

/** Parameter → … → token, root first. Empty for an unknown token. */
export function chainFor(token: string): SystemNode[] {
  const target = NODES.get(token);

  if (!target) return [];

  const ordered: SystemNode[] = [];
  const seen = new Set<string>();

  const visit = (node: SystemNode): void => {
    if (seen.has(node.id)) return;

    seen.add(node.id);

    for (const parentId of node.from) {
      const parent = NODES.get(parentId);

      if (parent) visit(parent);
    }

    ordered.push(node);
  };

  visit(target);

  return ordered;
}

/** Component labels that consume `token`. */
export function consumersOf(token: string): string[] {
  return COMPONENTS.filter((component) => component.from.includes(token)).map(
    (component) => component.label,
  );
}
