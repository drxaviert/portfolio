/*
 * Measures the daily-painting frame boundary against the card surface.
 *
 * Reads the era × phase matrix on /dev/art-card, screenshots each stage at
 * device scale 2, and samples the outermost painted pixel of the frame at
 * eleven points along each edge. The surface colour is the stage's computed
 * background, which is the real card fill (--surface-container-low).
 *
 * Usage: node scripts/measure-frame-contrast.mjs [url]
 *   URL defaults to http://localhost:3013/dev/art-card.
 *   Stage screenshots land in .next/contrast/.
 */

import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { chromium } from "playwright";
import sharp from "sharp";

const URL = process.argv[2] ?? "http://localhost:3013/dev/art-card";
const OUT_DIR = ".next/contrast";
const DPR = 2;
const THRESHOLD = 3;

const PHASES = ["day", "dawn", "dusk", "night"];
const ERAS = ["gilt-ornate", "gilt-carved", "walnut", "modern", "scroll"];
const EDGE_STOPS = [0.06, 0.12, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.88, 0.94];

function srgbToLinear(channel) {
  const value = channel / 255;
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

function luminance([r, g, b]) {
  return (
    0.2126 * srgbToLinear(r) +
    0.7152 * srgbToLinear(g) +
    0.0722 * srgbToLinear(b)
  );
}

function contrast(a, b) {
  const first = luminance(a);
  const second = luminance(b);
  const lighter = Math.max(first, second);
  const darker = Math.min(first, second);
  return (lighter + 0.05) / (darker + 0.05);
}

function hex(rgb) {
  return `#${rgb.map((value) => value.toString(16).padStart(2, "0")).join("")}`;
}

function parseRgb(value) {
  const numbers = value.match(/[\d.]+/g)?.map(Number) ?? [];
  return numbers.slice(0, 3);
}

function pixel(image, x, y) {
  const index = (y * image.width + x) * image.channels;
  return [image.data[index], image.data[index + 1], image.data[index + 2]];
}

async function decode(buffer) {
  const { data, info } = await sharp(buffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return {
    data,
    width: info.width,
    height: info.height,
    channels: info.channels,
  };
}

function sampleEdges(image, left, top, width, height) {
  // The second device pixel in from the boundary: the first may be an
  // antialiased half-pixel when the layout box lands on a fraction, and a
  // 1 CSS px hairline at DPR 2 covers the first two pixels.
  const xLeft = Math.floor(left) + 1;
  const xRight = Math.ceil(left + width) - 1;
  const yTop = Math.floor(top) + 1;
  const yBottom = Math.ceil(top + height) - 1;
  const samples = [];

  for (const stop of EDGE_STOPS) {
    const x = Math.floor(left + stop * width);
    const y = Math.floor(top + stop * height);

    samples.push(
      { edge: "top", at: stop, rgb: pixel(image, x, yTop) },
      { edge: "bottom", at: stop, rgb: pixel(image, x, yBottom) },
      { edge: "left", at: stop, rgb: pixel(image, xLeft, y) },
      { edge: "right", at: stop, rgb: pixel(image, xRight, y) },
    );
  }

  return samples;
}

await mkdir(OUT_DIR, { recursive: true });

const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({
  viewport: { width: 1600, height: 1000 },
  deviceScaleFactor: DPR,
});

// The matrix uses a CSS canvas placeholder, not the remote IIIF images.
await page.route("**/*", (route) =>
  route.request().resourceType() === "image" ? route.abort() : route.continue(),
);

await page.goto(URL, { waitUntil: "domcontentloaded" });
await page.waitForSelector(".art-lab-frame-stage .painting-frame");
await page.evaluate(() => document.fonts.ready);

const results = [];

for (const era of ERAS) {
  for (const phase of PHASES) {
    const cell = page.locator(
      `.art-lab-frame-cell[data-phase-cell="${phase}"][data-era-cell="${era}"]`,
    );
    const stage = cell.locator(".art-lab-frame-stage");
    const frame = cell.locator(".painting-frame");

    const stageBox = await stage.boundingBox();
    const frameBox = await frame.boundingBox();
    if (!stageBox || !frameBox)
      throw new Error(`missing box for ${era}/${phase}`);

    const surface = parseRgb(
      await stage.evaluate(
        (element) => getComputedStyle(element).backgroundColor,
      ),
    );

    const shotPath = join(OUT_DIR, `${era}-${phase}.png`);
    const shot = await stage.screenshot({ animations: "disabled" });
    await writeFile(shotPath, shot);
    const image = await decode(shot);

    const samples = sampleEdges(
      image,
      (frameBox.x - stageBox.x) * DPR,
      (frameBox.y - stageBox.y) * DPR,
      frameBox.width * DPR,
      frameBox.height * DPR,
    );

    let worst = null;
    for (const sample of samples) {
      const ratio = contrast(sample.rgb, surface);
      if (!worst || ratio < worst.ratio) worst = { ...sample, ratio };
    }

    results.push({
      era,
      phase,
      surface,
      surfaceHex: hex(surface),
      worst: worst.ratio,
      worstEdge: worst.edge,
      worstAt: worst.at,
      worstHex: hex(worst.rgb),
      pass: worst.ratio >= THRESHOLD,
    });
  }
}

await browser.close();

console.log(`\nSource: ${URL}`);
console.log(`Stage screenshots: ${OUT_DIR}/\n`);

const header = `| Era | ${PHASES.join(" | ")} |`;
const divider = `| --- | ${PHASES.map(() => "---:").join(" | ")} |`;
console.log(header);
console.log(divider);

for (const era of ERAS) {
  const cells = PHASES.map((phase) => {
    const row = results.find(
      (item) => item.era === era && item.phase === phase,
    );
    return `${row.worst.toFixed(2)}:1${row.pass ? "" : " ❌"}`;
  });
  console.log(`| ${era} | ${cells.join(" | ")} |`);
}

console.log("\nWorst edge sample per cell:\n");
console.log(`| Era | ${PHASES.join(" | ")} |`);
console.log(`| --- | ${PHASES.map(() => "---").join(" | ")} |`);
for (const era of ERAS) {
  const cells = PHASES.map((phase) => {
    const row = results.find(
      (item) => item.era === era && item.phase === phase,
    );
    return `${row.worstHex} (${row.worstEdge} ${Math.round(row.worstAt * 100)}%)`;
  });
  console.log(`| ${era} | ${cells.join(" | ")} |`);
}

const failures = results.filter((row) => !row.pass);
console.log(
  `\n${results.length - failures.length}/${results.length} cells pass ≥ ${THRESHOLD}:1.`,
);
if (failures.length > 0) {
  console.log("Failures:");
  for (const row of failures) {
    console.log(
      `  ${row.era} / ${row.phase}: ${row.worst.toFixed(2)}:1 (${row.worstHex} vs ${row.surfaceHex})`,
    );
  }
  process.exitCode = 1;
}
