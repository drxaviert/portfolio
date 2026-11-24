/**
 * The real media shown on the WebGL canvas, in the order the grid cycles it.
 * Round-robin by project, so consecutive cells are usually different clients.
 * Shared by the live Motion & Stills study and the dev prototype.
 */
export const CANVAS_MEDIA_IDS = [
  "attitude-oceanly-2-66x-1920x1080-ahq-11-00b9511a3c",
  "portfolio-in-2d-3d-f1a9c066a9",
  "cash-flow-4dfcb26e1d",
  "celixir-montage-5e348ee1c9",
  "good-form-reel-4c969cc977",
  "google-ai-agents-remake-2k-slowmo-992af5e059",
  "klaris-main-0c804c5e5d",
  "niod-deciem-good-form-9f058b81f5",
  "11242024-ordinary-growthfactors-16x9-53a4a9db88",
  "isometric-784845539a",
  "xylo-branding-good-form-6e2927470b",
  "cellixir-01-v01a-cf03dc7d17",
  "klaris-side-shot-01-v01a-5dba662a2e",
  "niod-cail-a01-dt-front-1-0064-d2839f4684",
  "ord-sv-ripple-01h-hd-prob4-082f053aed",
  "cellixir-02-v01a-32d7fcbdc3",
  "klaris-side-shot-02-v01a-4bfa134547",
  "niod-cell01-anim-v03-final-rev-8fa4277f23",
  "cellixir-03-v01a-6c85e817b3",
  "klaris-side-shot-03-v01a-0ce80af849",
  "niod-cell02-anim-v03-final-234f282dde",
  "cellixir-04-v01b-00000-8fab808305",
  "klaris-side-shot-04-v01a-4b8c4747ab",
  "niod-cell03-anim-v03-final-f3e1d32763",
  "cellixir-05-v01a-a403160841",
  "niod-cell04-anim-v03-final-ee749abb4e",
] as const;

export const CANVAS_MEDIA_COUNT = 26;
