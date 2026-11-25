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
  "ai-agents-google": () => import("../../content/work/ai-agents-google.mdx"),
  klaris: () => import("../../content/work/klaris.mdx"),
  "shapes-in-motion": () => import("../../content/work/shapes-in-motion.mdx"),
  "growth-factors-deciem": () =>
    import("../../content/work/growth-factors-deciem.mdx"),
  cellixir: () => import("../../content/work/cellixir.mdx"),
  "tribeca-film-festival-deciem": () =>
    import("../../content/work/tribeca-film-festival-deciem.mdx"),
  "urban-decay": () => import("../../content/work/urban-decay.mdx"),
  "niod-deciem": () => import("../../content/work/niod-deciem.mdx"),
  eroxon: () => import("../../content/work/eroxon.mdx"),
  "good-form-rebrand": () => import("../../content/work/good-form-rebrand.mdx"),
  "xylo-audio": () => import("../../content/work/xylo-audio.mdx"),
  lullavibes: () => import("../../content/work/lullavibes.mdx"),
  "docebo-ai-capabilities": () =>
    import("../../content/work/docebo-ai-capabilities.mdx"),
  "cash-app-cash-flow": () =>
    import("../../content/work/cash-app-cash-flow.mdx"),
  metaview: () => import("../../content/work/metaview.mdx"),
  "2d-motion-design-introduction": () =>
    import("../../content/work/2d-motion-design-introduction.mdx"),
  linksys: () => import("../../content/work/linksys.mdx"),
  "london-public-library": () =>
    import("../../content/work/london-public-library.mdx"),
  personal: () => import("../../content/work/personal.mdx"),
  "about-dat": () => import("../../content/work/about-dat.mdx"),
};
