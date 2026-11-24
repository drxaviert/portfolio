import type { MDXProps } from "mdx/types";
import type { ComponentType } from "react";
import type { WorkSlug } from "./work";

export type WorkBody = { default: ComponentType<MDXProps> };

/**
 * One importer per study. Server-only: the MDX files never enter a client
 * bundle, and both the direct page and the intercepted overlay load the same
 * body through this map.
 */
export const WORK_BODIES: Record<WorkSlug, () => Promise<WorkBody>> = {
  "systems-in-motion": () => import("../../content/work/systems-in-motion.mdx"),
  "title-sequence": () => import("../../content/work/title-sequence.mdx"),
  "type-in-motion": () => import("../../content/work/type-in-motion.mdx"),
  "motion-and-stills": () =>
    import("../../content/work/motion-and-stills.mdx"),
  "human-contact": () => import("../../content/work/human-contact.mdx"),
};
