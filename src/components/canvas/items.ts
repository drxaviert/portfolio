/**
 * The real media shown on the WebGL canvas, in the order the grid cycles it.
 *
 * Every file in the 11-27 `Optimized` folder except the per-project
 * `not-canvas` subfolders (pf-3xh.10), mapped to its source project. Each
 * project is one contiguous group, and the group order is the placement order
 * of the canvas clusters (`clusters.ts`): the first five are the featured
 * projects that open the first view (pf-9cv.23), the rest fill outward.
 * Shared by the live Motion & Stills study and the dev prototype.
 */

export type CanvasMediaEntry = {
  readonly id: string;
  readonly project: string;
};

export const CANVAS_MEDIA = [
  { id: "google-ai-agents-remake-2k-slowmo-314e33edea", project: "Google" },
  { id: "niod-cail-a01-dt-front-1-0064-c282a2d915", project: "NIOD" },
  { id: "niod-cell01-anim-v03-final-rev-6ecfbdec88", project: "NIOD" },
  { id: "niod-cell02-anim-v03-final-de3d5e5d08", project: "NIOD" },
  { id: "niod-cell03-anim-v02-745039b846", project: "NIOD" },
  { id: "niod-cell04-anim-v03-final-b6e7f401eb", project: "NIOD" },
  {
    id: "ord-sv-ripple-01h-hd-prob4-3554f8ab40",
    project: "Tribeca Film Festival",
  },
  {
    id: "11242024-ordinary-growthfactors-16x9-a41566383b",
    project: "Ordinary",
  },
  { id: "cash-flow-6562f7a566", project: "Cash App" },
  { id: "shapes-in-motion-v02-06-cbfe7000dd", project: "Shapes In Motion" },
  { id: "shapes-in-motion-v02-03-b8e056ffc3", project: "Shapes In Motion" },
  { id: "shapes-in-motion-v02-04-b48c336d9d", project: "Shapes In Motion" },
  { id: "shapes-in-motion-v02-05-9e6a544319", project: "Shapes In Motion" },
  { id: "isometric-22dc902537", project: "Shapes In Motion" },
  { id: "cellixir-01-v01a-7b1743d192", project: "Celixir" },
  { id: "cellixir-02-v01a-184ce4b886", project: "Celixir" },
  { id: "cellixir-03-v01a-e332bef5ef", project: "Celixir" },
  { id: "cellixir-04-v01b-00000-50982c176c", project: "Celixir" },
  { id: "cellixir-05-v01a-dc237ec38f", project: "Celixir" },
  { id: "klaris-main-3a8b6c894a", project: "Klaris" },
  { id: "klaris-side-shot-01-v01a-136d66d110", project: "Klaris" },
  { id: "klaris-side-shot-02-v01a-b58c17d2de", project: "Klaris" },
  { id: "klaris-side-shot-03-v01a-62da8fcfc3", project: "Klaris" },
  { id: "klaris-side-shot-04-v01a-f737312491", project: "Klaris" },
  { id: "linksys-phone-01-original-bec7ee254c", project: "Linksys" },
  { id: "linksys-phone-02-original-c73a8a8b95", project: "Linksys" },
  { id: "linksys-web-58e4afe00a", project: "Linksys" },
  { id: "linksys-cloud-9e9fa67d4e", project: "Linksys" },
  { id: "sunglasses-01-a01-retouched-b5d9e0dba8", project: "Personal" },
  { id: "sunglasses-a02-d4dcd50fb9", project: "Personal" },
  { id: "sunglasses-a03-adfa0b0a9b", project: "Personal" },
  { id: "sunglasses-01-a02-retouched-4820f51800", project: "Personal" },
  { id: "003-21-01-sh01-dt-a02-rs-camera-11048a1773", project: "Personal" },
  { id: "06-02-sh01-dt-a01-rs-camera-8de6bf3171", project: "Personal" },
  { id: "08-02-sh01-dt-a01-rs-camera-a67856d2c8", project: "Personal" },
  { id: "22-01-sh01-dt-a01-rs-camera-b0c9fd584b", project: "Personal" },
  { id: "23-01-sh01-dt-a01-rs-camera-54609386f4", project: "Personal" },
  { id: "24-01-sh01-dt-a01-rs-camera-86f4333ba5", project: "Personal" },
  { id: "25-01-sh01-dt-a01-rs-camera-a439d5ef1b", project: "Personal" },
  { id: "26-01-sh01-dt-a01-rs-camera-c930d8099f", project: "Personal" },
  { id: "28-01-sh01-dt-a01-rs-camera-13a3e7a221", project: "Personal" },
  { id: "30-01-sh01-dt-a03-rs-camera-7aebdf44a5", project: "Personal" },
  { id: "sun-retouched-scaled-4c943982f7", project: "Personal" },
  { id: "comestic-rnd-01c-scene-02-c89de39ff4", project: "Personal" },
  { id: "comestic-rnd-01a-scene-02-00000-eab1e778d9", project: "Personal" },
  { id: "comestic-rnd-01a-scene-03-00000-b5d265dbad", project: "Personal" },
  { id: "comestic-rnd-01a-scene-04-00000-7518673e45", project: "Personal" },
  { id: "comestic-rnd-01c-scene-01-e87380e521", project: "Personal" },
  { id: "spray-09-04-72c2d407b9", project: "Personal" },
  { id: "spray-01-fc09595632", project: "Personal" },
  { id: "spray-04-c08b5c7abc", project: "Personal" },
  { id: "spray-07-06-retouched-8ede0dc72e", project: "Personal" },
  { id: "spray-08-02-cb5e62da92", project: "Personal" },
  { id: "flower-nosound-7512432863", project: "Personal" },
  {
    id: "ud-lip-toy-hero-visual-2-alt-still-v07i-d222f7c08c",
    project: "Urban Decay",
  },
  { id: "ud-lip-toy-hero-visual-2-v07h-976f696ea2", project: "Urban Decay" },
  {
    id: "ud-tube-job-hero-visual-2-020-00000-653d8faeab",
    project: "Urban Decay",
  },
  { id: "ud-tube-job-hero-visual-2-v06a-893727ad71", project: "Urban Decay" },
  { id: "ud-bodytoy-v03g-00000-5c48ddf12c", project: "Urban Decay" },
  { id: "xylo-branding-good-form-5866566eb9", project: "Xylo" },
  {
    id: "lullavibes-instrumental-lullabies-rendit-a5e3dd48fa",
    project: "Lullavibes",
  },
  { id: "lpl-social-01-f3146c9f71", project: "London Public Library" },
  { id: "lpl-social-02-ba54416754", project: "London Public Library" },
  { id: "lpl-main-ccdd1a1d24", project: "London Public Library" },
  { id: "infiniti-horizon-4062a00416", project: "Infiniti" },
  {
    id: "attitude-oceanly-2-66x-1920x1080-ahq-11-d208aa1314",
    project: "Attitude",
  },
  { id: "good-form-reel-3ab73b7312", project: "Good Form Rebrand" },
] as const;

export const CANVAS_MEDIA_IDS = CANVAS_MEDIA.map((item) => item.id);

export const CANVAS_MEDIA_COUNT = 67;

const PROJECT_LABELS: Record<string, string> = {
  Attitdue: "Attitude",
};

/** Display name for the opened-view chip; the key stays the folder name. */
export function projectLabel(project: string): string {
  return PROJECT_LABELS[project] ?? project;
}

/** The projects that open the first view, in placement order. */
export const FEATURED_PROJECTS = [
  "Google",
  "NIOD",
  "Tribeca Film Festival",
  "Ordinary",
  "Cash App",
] as const;

/**
 * The case study (`content/work/<slug>.mdx`) behind each project folder.
 * Infiniti and Attitude have no study, so their chip stays a plain label.
 */
const PROJECT_SLUGS: Record<string, string> = {
  Google: "ai-agents-google",
  NIOD: "niod-deciem",
  "Tribeca Film Festival": "tribeca-film-festival-deciem",
  Ordinary: "growth-factors-deciem",
  "Cash App": "cash-app-cash-flow",
  "Shapes In Motion": "shapes-in-motion",
  Celixir: "cellixir",
  Klaris: "klaris",
  Linksys: "linksys",
  Personal: "personal",
  "Urban Decay": "urban-decay",
  Xylo: "xylo-audio",
  Lullavibes: "lullavibes",
  "London Public Library": "london-public-library",
  "Good Form Rebrand": "good-form-rebrand",
};

/** The chip's link, or null when the project has no case study. */
export function projectHref(project: string): string | null {
  const slug = PROJECT_SLUGS[project];

  return slug ? `/work/${slug}` : null;
}
