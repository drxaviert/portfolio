/**
 * The real media shown on the WebGL canvas, in the order the grid cycles it.
 *
 * Every current manifest is here. The sequence is built from the source
 * subfolder under `Optimized`, split into clusters of at most three items
 * per project and interleaved so same-project tiles are loose neighbours:
 * adjacent within a cluster, never a solid project block, and the first and
 * last projects differ so the infinite repeat does not butt against itself.
 * Shared by the live Motion & Stills study and the dev prototype.
 */

export type CanvasMediaEntry = {
  readonly id: string;
  readonly project: string;
};

export const CANVAS_MEDIA = [
  { id: "003-21-01-sh01-dt-a02-rs-camera-1bd9c62f31", project: "Personal" },
  { id: "01-k-h-phone-camera-01-81314bd062", project: "Personal" },
  { id: "01-k-h-phone-camera-02-7245d77d24", project: "Personal" },
  { id: "celixir-montage-5e348ee1c9", project: "Celixir" },
  { id: "cellixir-01-v01a-cf03dc7d17", project: "Celixir" },
  { id: "cellixir-02-v01a-32d7fcbdc3", project: "Celixir" },
  { id: "01-k-h-phone-camera-05-5808a55785", project: "Personal" },
  { id: "01-k-h-phone-camera-06-d23355174c", project: "Personal" },
  { id: "05-02-sh01-dt-a01-rs-camera-e3942f379d", project: "Personal" },
  { id: "klaris-main-0c804c5e5d", project: "Klaris" },
  { id: "klaris-side-shot-01-v01a-5dba662a2e", project: "Klaris" },
  { id: "klaris-side-shot-02-v01a-4bfa134547", project: "Klaris" },
  { id: "06-02-sh01-dt-a01-rs-camera-d402024381", project: "Personal" },
  { id: "08-02-sh01-dt-a01-rs-camera-c283e3dce5", project: "Personal" },
  { id: "09-02-sh01-dt-a01-rs-camera-efd0a300ee", project: "Personal" },
  { id: "linksys-cloud-b130afa924", project: "Linksys" },
  { id: "linksys-logo-animation-23402b2dc4", project: "Linksys" },
  { id: "linksys-loop-5fe8e6aa00", project: "Linksys" },
  { id: "22-01-sh01-dt-a01-rs-camera-c3df709738", project: "Personal" },
  { id: "23-01-sh01-dt-a01-rs-camera-66240e988a", project: "Personal" },
  { id: "24-01-sh01-dt-a01-rs-camera-b4e3c42c5d", project: "Personal" },
  { id: "niod-deciem-good-form-9f058b81f5", project: "NIOD" },
  { id: "niod-cail-a01-dt-front-1-0064-d2839f4684", project: "NIOD" },
  { id: "niod-cell01-anim-v03-final-rev-8fa4277f23", project: "NIOD" },
  { id: "25-01-sh01-dt-a01-rs-camera-86c00aa463", project: "Personal" },
  { id: "26-01-sh01-dt-a01-rs-camera-2c55da8317", project: "Personal" },
  { id: "28-01-sh01-dt-a01-rs-camera-fed59b9446", project: "Personal" },
  { id: "ud-bodytoy-v03g-00000-b0cfa65dd0", project: "Urban Decay" },
  {
    id: "ud-lip-toy-hero-visual-2-alt-still-v07i-182932f88d",
    project: "Urban Decay",
  },
  {
    id: "ud-tube-job-hero-visual-2-020-00000-140236b405",
    project: "Urban Decay",
  },
  { id: "30-01-sh01-dt-a03-rs-camera-44a8baf8fb", project: "Personal" },
  { id: "all-02-700d412162", project: "Personal" },
  { id: "all-03-354aafd63b", project: "Personal" },
  { id: "xylo-branding-good-form-6e2927470b", project: "Xylo" },
  { id: "xylo-concept-05-01-01-9fd0cf192c", project: "Xylo" },
  { id: "xylo-concept-08-01-01-df21204648", project: "Xylo" },
  { id: "all-04-f7ef9b67f3", project: "Personal" },
  { id: "all-05-5eb87ffaae", project: "Personal" },
  { id: "comestic-rnd-01a-scene-01-00000-ce53bb5176", project: "Personal" },
  {
    id: "attitude-oceanly-2-66x-1920x1080-ahq-11-00b9511a3c",
    project: "Attitdue",
  },
  { id: "comestic-rnd-01a-scene-02-00000-b0e52c9586", project: "Personal" },
  { id: "comestic-rnd-01a-scene-03-00000-b53726405e", project: "Personal" },
  { id: "comestic-rnd-01a-scene-04-00000-6643676ad2", project: "Personal" },
  { id: "portfolio-in-2d-3d-f1a9c066a9", project: "Base" },
  { id: "comestic-rnd-01a-scene-05-00000-1531dcbc28", project: "Personal" },
  { id: "comestic-rnd-01c-scene-01-aea4c352ab", project: "Personal" },
  { id: "comestic-rnd-01c-scene-02-525b5439da", project: "Personal" },
  { id: "cash-flow-4dfcb26e1d", project: "Cash App" },
  { id: "comestic-rnd-01c-scene-05-d05d2caa00", project: "Personal" },
  {
    id: "notch-pantene-bubbles-softbody-rnd-dt-v0-5905ef909e",
    project: "Personal",
  },
  { id: "orbs-landscape-4e9d9141b7", project: "Personal" },
  { id: "cellixir-03-v01a-6c85e817b3", project: "Celixir" },
  { id: "cellixir-04-v01b-00000-8fab808305", project: "Celixir" },
  { id: "cellixir-05-v01a-a403160841", project: "Celixir" },
  { id: "spray-01-b41dcefd00", project: "Personal" },
  { id: "spray-04-0eb6a9fdba", project: "Personal" },
  { id: "spray-07-06-retouched-e30a3c29ae", project: "Personal" },
  { id: "good-form-reel-4c969cc977", project: "Good Form Rebrand" },
  { id: "spray-08-02-fce2bc8513", project: "Personal" },
  { id: "spray-09-04-73a59c6551", project: "Personal" },
  { id: "sun-retouched-scaled-cf8c7e9a61", project: "Personal" },
  { id: "google-ai-agents-remake-2k-slowmo-992af5e059", project: "Google" },
  { id: "sunglasses-01-a01-retouched-31b5132fe2", project: "Personal" },
  { id: "sunglasses-01-a02-retouched-9ff54cd896", project: "Personal" },
  { id: "sunglasses-a02-ef7ce65f84", project: "Personal" },
  { id: "infiniti-logo-1508ebc33b", project: "Infiniti" },
  { id: "infiniti-horizon-ea360a3014", project: "Infiniti" },
  { id: "klaris-side-shot-03-v01a-0ce80af849", project: "Klaris" },
  { id: "klaris-side-shot-04-v01a-4b8c4747ab", project: "Klaris" },
  { id: "linksys-phone-01-96e0be3590", project: "Linksys" },
  { id: "linksys-phone-02-ad980985aa", project: "Linksys" },
  { id: "linksys-web-7c95588ff6", project: "Linksys" },
  { id: "lpl-main-3bd28f7369", project: "London Public Library" },
  { id: "lpl-social-01-7f7d35df0b", project: "London Public Library" },
  { id: "lpl-social-02-acb1814653", project: "London Public Library" },
  {
    id: "lullavibes-instrumental-lullabies-rendit-90eb7aeb4d",
    project: "Lullavibes",
  },
  {
    id: "lullavibes-instrumental-lullabies-rendit-68e14ee9ff",
    project: "Lullavibes",
  },
  {
    id: "lullavibes-instrumental-lullabies-rendit-7493801771",
    project: "Lullavibes",
  },
  { id: "niod-cell02-anim-v03-final-234f282dde", project: "NIOD" },
  { id: "niod-cell03-anim-v03-final-f3e1d32763", project: "NIOD" },
  { id: "niod-cell04-anim-v03-final-ee749abb4e", project: "NIOD" },
  {
    id: "11242024-ordinary-growthfactors-16x9-53a4a9db88",
    project: "Ordinary",
  },
  { id: "ord-sv-ripple-01h-hd-prob4-082f053aed", project: "Ordinary" },
  { id: "sunglasses-a03-1f4d12b875", project: "Personal" },
  { id: "flower-redshift-rop1-2-ad29f0dc78", project: "Personal" },
  { id: "isometric-784845539a", project: "Shapes In Motion" },
  { id: "ud-tube-job-hero-visual-2-v06a-390aec79de", project: "Urban Decay" },
  { id: "xylo-concept-09-01-01-1828ecce45", project: "Xylo" },
] as const;

export const CANVAS_MEDIA_IDS = CANVAS_MEDIA.map((item) => item.id);

export const CANVAS_MEDIA_COUNT = 88;
