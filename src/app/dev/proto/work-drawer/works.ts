/**
 * Throwaway placeholder data for the work-drawer prototype.
 *
 * Titles and meta are reused from src/app/dev/proto/work-carousel/works.ts;
 * the fields below are the ones the case-study reader needs. Copy is
 * deliberately generic — this prototype exists to compare drawer motion and
 * reading layout, not the words.
 */

export type Project = {
  slug: string;
  title: string;
  discipline: string;
  year: string;
  role: string;
  team: string;
  summary: string;
  /** 0–3: which CSS-drawn tint the hero and figure blocks use. */
  art: number;
  stats: { value: string; label: string }[];
};

export const PROJECTS: Project[] = [
  {
    slug: "field-notes-slow-interface",
    title: "Field notes from a slow interface",
    discipline: "Design system",
    year: "2026",
    role: "Design lead",
    team: "3 designers, 2 engineers",
    summary:
      "A component library rebuilt around waiting: slower defaults, calmer states, and controls that stop asking to be noticed.",
    art: 0,
    stats: [
      { value: "38%", label: "fewer support tickets" },
      { value: "12", label: "core components shipped" },
      { value: "6 wks", label: "from audit to release" },
    ],
  },
  {
    slug: "quiet-infrastructure-public-library",
    title: "The quiet infrastructure of a public library",
    discipline: "Research",
    year: "2025",
    role: "Design researcher",
    team: "2 researchers",
    summary:
      "Eight months inside a branch library, mapping the small rituals that keep a public service running without a queue.",
    art: 1,
    stats: [
      { value: "240h", label: "observed in branch" },
      { value: "34", label: "interviews" },
      { value: "9", label: "services mapped" },
    ],
  },
  {
    slug: "typeface-reading-bad-light",
    title: "A typeface for reading in bad light",
    discipline: "Type design",
    year: "2025",
    role: "Type designer",
    team: "Solo, with two readers",
    summary:
      "A workhorse text face for screens read at arm's length: on trains, at seven in the morning, with the brightness down.",
    art: 2,
    stats: [
      { value: "5", label: "weights" },
      { value: "812", label: "glyphs drawn" },
      { value: "3 yrs", label: "from sketch to shipping" },
    ],
  },
  {
    slug: "project-name",
    title: "Project name",
    discipline: "Brand",
    year: "2025",
    role: "Brand designer",
    team: "2 designers, 1 writer",
    summary:
      "A naming and identity system for a studio that had outgrown the name it started with in a shared kitchen.",
    art: 3,
    stats: [
      { value: "1", label: "wordmark" },
      { value: "14", label: "applications" },
      { value: "2 wks", label: "from brief to launch" },
    ],
  },
  {
    slug: "nine-ways-horizon-dusk",
    title: "Nine ways to draw a horizon at dusk",
    discipline: "Generative art",
    year: "2024",
    role: "Design engineer",
    team: "Solo",
    summary:
      "Nine procedural horizons, each built from a different rule about where the light goes when the sun is almost gone.",
    art: 1,
    stats: [
      { value: "9", label: "studies" },
      { value: "60fps", label: "on a five-year-old phone" },
      { value: "1", label: "canvas" },
    ],
  },
];

export function projectBySlug(slug: string | null): Project | null {
  if (!slug) return null;
  return PROJECTS.find((project) => project.slug === slug) ?? null;
}

export function projectIndex(slug: string): number {
  return PROJECTS.findIndex((project) => project.slug === slug);
}

/** Cycles back to the first project, so the reader always has a next step. */
export function nextProject(slug: string): Project {
  const index = projectIndex(slug);
  return PROJECTS[(index + 1) % PROJECTS.length] ?? PROJECTS[0];
}
