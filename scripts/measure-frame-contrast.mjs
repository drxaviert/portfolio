/*
 * Measures the daily-painting frame face against the card surface.
 *
 * Reads the sample × phase matrix on /dev/art-card, screenshots each stage at
 * device scale 2, and samples just inside the outermost painted pixel along
 * each edge, every device pixel, skipping the rounded corners. The layout box
 * can land on a fraction, so the first fully painted pixel is ceil(edge); the
 * sampler derives that from the box instead of adding a fixed offset, then
 * stays two device pixels inside it because an element screenshot can include
 * a device pixel outside a fractional box. The surface colour is the stage's
 * computed background, which is the real card fill
 * (--surface-container-low).
 *
 * Usage: node scripts/measure-frame-contrast.mjs [url]
 *   URL defaults to http://localhost:3013/dev/art-card.
 *   Stage screenshots land in .next/contrast/.
 */

import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { chromium } from "playwright";
import sharp from "sharp";

const args = process.argv.slice(2);
const URL =
  args.find((argument) => !argument.startsWith("--")) ??
  "http://localhost:3013/dev/art-card";
const OUT_DIR = ".next/contrast";
const DPR = 2;
const THRESHOLD = 3;

const PHASES = ["day", "dawn", "dusk", "night"];
const SAMPLES = [
  "portrait-ornate",
  "landscape-carved",
  "square-walnut",
  "scroll",
  "fallback",
];

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
  // Device-space box. The outermost fully painted pixel is ceil(edge) on the
  // left/top and floor(edge) - 1 on the right/bottom; that holds whether the
  // layout edge lands on a whole pixel or a fraction. Inset two device pixels
  // so a screenshot cropped at a fractional box cannot land on the surface
  // outside the frame.
  const inset = 2;
  const xLeft = Math.ceil(left) + inset;
  const xRight = Math.floor(left + width) - 1 - inset;
  const yTop = Math.ceil(top) + inset;
  const yBottom = Math.floor(top + height) - 1 - inset;
  // The corner radius is 2px; stay 4 CSS px in so no sample is surface.
  const margin = Math.round(4 * DPR);
  const xSpan = Math.max(1, xRight - xLeft);
  const ySpan = Math.max(1, yBottom - yTop);
  const samples = [];

  for (let x = xLeft + margin; x <= xRight - margin; x++) {
    const at = (x - xLeft) / xSpan;
    samples.push(
      { edge: "top", at, rgb: pixel(image, x, yTop) },
      { edge: "bottom", at, rgb: pixel(image, x, yBottom) },
    );
  }

  for (let y = yTop + margin; y <= yBottom - margin; y++) {
    const at = (y - yTop) / ySpan;
    samples.push(
      { edge: "left", at, rgb: pixel(image, xLeft, y) },
      { edge: "right", at, rgb: pixel(image, xRight, y) },
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

// The sampler only needs the frame face; abort images for speed.
await page.route("**/*", (route) =>
  route.request().resourceType() === "image" ? route.abort() : route.continue(),
);

await page.goto(URL, { waitUntil: "domcontentloaded" });
await page.waitForSelector(".art-lab-frame-stage .painting-frame");
await page.evaluate(() => document.fonts.ready);

const results = [];

for (const sampleKey of SAMPLES) {
  for (const phase of PHASES) {
    const cell = page.locator(
      `.art-lab-frame-cell[data-phase-cell="${phase}"][data-sample-cell="${sampleKey}"]`,
    );
    const stage = cell.locator(".art-lab-frame-stage");
    const frame = cell.locator(".painting-frame");

    const stageBox = await stage.boundingBox();
    const frameBox = await frame.boundingBox();
    if (!stageBox || !frameBox)
      throw new Error(`missing box for ${sampleKey}/${phase}`);

    const surface = parseRgb(
      await stage.evaluate(
        (element) => getComputedStyle(element).backgroundColor,
      ),
    );

    const shotPath = join(OUT_DIR, `${sampleKey}-${phase}.png`);
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
      sample: sampleKey,
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

const header = `| Sample | ${PHASES.join(" | ")} |`;
const divider = `| --- | ${PHASES.map(() => "---:").join(" | ")} |`;
console.log(header);
console.log(divider);

for (const sampleKey of SAMPLES) {
  const cells = PHASES.map((phase) => {
    const row = results.find(
      (item) => item.sample === sampleKey && item.phase === phase,
    );
    return `${row.worst.toFixed(2)}:1${row.pass ? "" : " ❌"}`;
  });
  console.log(`| ${sampleKey} | ${cells.join(" | ")} |`);
}

console.log("\nWorst face sample per cell:\n");
console.log(`| Sample | ${PHASES.join(" | ")} |`);
console.log(`| --- | ${PHASES.map(() => "---").join(" | ")} |`);
for (const sampleKey of SAMPLES) {
  const cells = PHASES.map((phase) => {
    const row = results.find(
      (item) => item.sample === sampleKey && item.phase === phase,
    );
    return `${row.worstHex} (${row.worstEdge} ${Math.round(row.worstAt * 100)}%)`;
  });
  console.log(`| ${sampleKey} | ${cells.join(" | ")} |`);
}

const failures = results.filter((row) => !row.pass);
console.log(
  `\n${results.length - failures.length}/${results.length} cells pass ≥ ${THRESHOLD}:1.`,
);
if (failures.length > 0) {
  console.log("Failures:");
  for (const row of failures) {
    console.log(
      `  ${row.sample} / ${row.phase}: ${row.worst.toFixed(2)}:1 (${row.worstHex} vs ${row.surfaceHex})`,
    );
  }
  process.exitCode = 1;
}
