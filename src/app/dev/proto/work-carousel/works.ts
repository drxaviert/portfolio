/**
 * Throwaway data for the featured-work carousel prototype.
 *
 * "Project name" is the one real middle-row card from
 * /dev/prototype — Figma has no work content, only that placeholder title. The
 * rest are realistic long titles so the crop and the cross-fade get tested
 * against text that actually wraps.
 */
export type Work = {
  id: string;
  title: string;
  slug: string;
  meta: string;
  year: string;
  /** 0–5: which CSS-drawn poster sits behind the card. */
  art: number;
};

export const WORKS: Work[] = [
  {
    id: "slow-interface",
    title: "Field notes from a slow interface",
    slug: "field-notes-slow-interface",
    meta: "Design system",
    year: "2026",
    art: 0,
  },
  {
    id: "public-library",
    title: "The quiet infrastructure of a public library",
    slug: "quiet-infrastructure-public-library",
    meta: "Research",
    year: "2025",
    art: 1,
  },
  {
    id: "bad-light",
    title: "A typeface for reading in bad light",
    slug: "typeface-reading-bad-light",
    meta: "Type design",
    year: "2025",
    art: 3,
  },
  {
    id: "project-name",
    title: "Project name",
    slug: "project-name",
    meta: "Brand",
    year: "2025",
    art: 4,
  },
  {
    id: "four-day-week",
    title: "How a two-person studio runs a four-day week",
    slug: "two-person-studio-four-day-week",
    meta: "Editorial",
    year: "2024",
    art: 5,
  },
  {
    id: "horizon-at-dusk",
    title: "Nine ways to draw a horizon at dusk",
    slug: "nine-ways-horizon-dusk",
    meta: "Generative art",
    year: "2024",
    art: 2,
  },
];
