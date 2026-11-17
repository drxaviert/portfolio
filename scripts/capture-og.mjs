/**
 * Captures the homepage as the site-wide Open Graph image.
 *
 * The card is a real screenshot of `/`, not a rendered text card, so the image
 * shows whatever the site actually ships: the tracker card, the Play shell, the
 * featured work card and the nav dock over the Day horizon. It runs against a
 * production server (`pnpm start`, i.e. `next start`) built from the current
 * checkout, or against `OG_CAPTURE_URL` when one is supplied.
 *
 * Determinism: the browser context emulates `prefers-reduced-motion: reduce`.
 * That is a capture-only switch — visitors are unaffected — and it parks every
 * ambient clock the page owns: the horizon shader stops after one frame at
 * clock 0, its CSS drift/breathe layers are `animation: none`, and the Play
 * card's fibre fan renders one static frame instead of a rAF loop. The entrance
 * still runs (its reduced branch is a 120ms fade), so waiting for
 * `data-entrance-played` still lands on the settled page. Two captures of the
 * same build therefore produce the same PNG.
 *
 * The two persisted theme keys are seeded before any page script runs (the
 * same localStorage keys `src/lib/theme.ts` documents), so the pre-paint theme
 * script resolves Day + the Midday pin instead of the visitor's clock.
 *
 * Framing: `--viewport 1600x840` (or 1920x1008) renders the same 1.905:1 frame
 * at a larger CSS viewport and lets the device scale factor do the downscale
 * (`deviceScaleFactor = 1200 / width`), so the output stays 1200x630.
 */
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const OUTPUT_SIZE = { width: 1200, height: 630 };
const ASPECT = OUTPUT_SIZE.width / OUTPUT_SIZE.height;
const DEFAULT_PORT = 3100;
const SERVER_READY_TIMEOUT_MS = 60_000;

/** `home-entrance.tsx` SHIPPED_ENTRANCE_TOTAL_MS: the sequence settles here. */
const ENTRANCE_TOTAL_MS = 1710;
/** `.horizon-canvas-layer` fades over `--duration-medium-5` (300ms). */
const HORIZON_FADE_MS = 300;
/** A little slack so a transition timer can never beat the screenshot. */
const SETTLE_MS = 250;

const projectRoot = path.resolve(import.meta.dirname, "..");

function argValue(name) {
  const index = process.argv.indexOf(name);

  return index > -1 ? process.argv[index + 1] : undefined;
}

function parseViewport(value) {
  const match = /^(\d+)x(\d+)$/.exec(value ?? "");

  if (!match) {
    throw new Error(`Expected a viewport like 1600x840, got "${value}".`);
  }

  const width = Number(match[1]);
  const height = Number(match[2]);

  if (Math.abs(width / height - ASPECT) > 0.002) {
    throw new Error(
      `${width}x${height} is not the ${OUTPUT_SIZE.width}:${OUTPUT_SIZE.height} aspect.`,
    );
  }

  return { width, height };
}

const explicitUrl = (argValue("--url") ?? process.env.OG_CAPTURE_URL)?.trim();
const port = Number(process.env.OG_PORT ?? DEFAULT_PORT);
const url = explicitUrl || `http://localhost:${port}/`;
const viewport = parseViewport(
  argValue("--viewport") ?? process.env.OG_VIEWPORT ?? "1200x630",
);
const deviceScaleFactor = OUTPUT_SIZE.width / viewport.width;
const outputPath = path.resolve(
  projectRoot,
  argValue("--out") ?? "src/app/opengraph-image.png",
);

function log(message) {
  process.stdout.write(`[og] ${message}\n`);
}

function startServer(port) {
  // Windows resolves `pnpm` to a .cmd shim, which Node can only run through
  // cmd.exe; everywhere else the pnpm binary is executable directly.
  const [command, args] =
    process.platform === "win32"
      ? [
          process.env.ComSpec ?? "cmd.exe",
          ["/d", "/s", "/c", `pnpm start -p ${port}`],
        ]
      : ["pnpm", ["start", "-p", String(port)]];
  const child = spawn(command, args, {
    cwd: projectRoot,
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"],
  });

  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk) => process.stdout.write(chunk));
  child.stderr.on("data", (chunk) => process.stderr.write(chunk));

  return child;
}

async function waitForServer(url, child) {
  const deadline = Date.now() + SERVER_READY_TIMEOUT_MS;

  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(
        `The production server exited with code ${child.exitCode}.`,
      );
    }

    try {
      const response = await fetch(url);

      if (response.ok) return;
    } catch {
      // Not listening yet.
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(`The production server did not answer ${url} in time.`);
}

async function stopServer(child) {
  if (!child || child.exitCode !== null) return;

  if (process.platform === "win32") {
    spawn("taskkill", ["/PID", String(child.pid), "/T", "/F"], {
      stdio: "ignore",
    });
  } else {
    child.kill("SIGTERM");
  }

  await new Promise((resolve) => setTimeout(resolve, 500));
}

/** PNG width/height live in the IHDR chunk at bytes 16-23. */
function readPngSize(buffer) {
  const signature = buffer.subarray(0, 8).toString("hex");

  if (signature !== "89504e470d0a1a0a") {
    throw new Error("The capture is not a PNG.");
  }

  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

/**
 * Seeds the theme before the document's own scripts run. Values match
 * `src/lib/theme.ts`: "theme" is the mode (legacy "light"/"dark" accepted) and
 * "theme-day-phase" pins Day's phase; "day" is Midday in the toggle.
 */
function seedTheme() {
  try {
    window.localStorage.setItem("theme", "day");
    window.localStorage.setItem("theme-day-phase", "day");
  } catch {
    // Storage can be blocked; the assertion after load reports it.
  }
}

async function capture(url) {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor,
    colorScheme: "light",
    locale: "en-US",
    // Capture-only freeze: no visitor sees this. See the file header.
    reducedMotion: "reduce",
  });

  await context.addInitScript(seedTheme);

  const page = await context.newPage();
  const problems = [];

  page.on("console", (message) => {
    if (message.type() === "error") problems.push(message.text());
  });
  page.on("pageerror", (error) => problems.push(error.message));

  try {
    await page.goto(url, { waitUntil: "networkidle" });
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.evaluate(() => document.fonts.ready);

    const theme = await page.evaluate(() => ({
      mode: document.documentElement.dataset.mode,
      phase: document.documentElement.dataset.phase,
      dayPhase: document.documentElement.dataset.dayPhase,
    }));

    if (theme.mode !== "day" || theme.phase !== "day") {
      throw new Error(
        `Expected Day/Midday, got mode=${theme.mode} phase=${theme.phase} dayPhase=${theme.dayPhase}.`,
      );
    }

    log(`theme ${theme.mode}, phase ${theme.phase}, pin ${theme.dayPhase}`);

    // The entrance is CSS started at first paint; the component marks the
    // document once its JS timer lands, so this waits for the real run rather
    // than guessing. A document that arrived client-side never plays it.
    const entered = await page
      .waitForFunction(
        () => document.documentElement.dataset.entrancePlayed === "true",
        null,
        { timeout: ENTRANCE_TOTAL_MS + 3_000 },
      )
      .then(() => true)
      .catch(() => false);

    log(
      entered
        ? "entrance finished"
        : "no entrance run in this document; continuing after a fixed wait",
    );

    if (!entered) {
      await page.waitForTimeout(ENTRANCE_TOTAL_MS);
    }

    // WebGL boots after the CSS horizon; wait for its first frame to be shown.
    // A context without WebGL keeps the CSS layer, so a missing canvas is not a
    // failure.
    const horizonReady = await page
      .waitForFunction(
        () =>
          document.querySelector('.horizon-canvas-layer[data-ready="true"]') !==
          null,
        null,
        { timeout: 10_000 },
      )
      .then(() => true)
      .catch(() => false);

    log(
      horizonReady
        ? "WebGL horizon ready (frozen at its rest frame)"
        : "WebGL horizon unavailable; captured the CSS horizon",
    );

    if (horizonReady) {
      await page.waitForTimeout(HORIZON_FADE_MS);
    }

    await page.waitForTimeout(SETTLE_MS);

    const buffer = await page.screenshot({
      type: "png",
      // Finite animations jump to their end state; infinite ones are cancelled.
      animations: "disabled",
    });
    const size = readPngSize(buffer);

    if (
      size.width !== OUTPUT_SIZE.width ||
      size.height !== OUTPUT_SIZE.height
    ) {
      throw new Error(
        `Expected ${OUTPUT_SIZE.width}x${OUTPUT_SIZE.height}, got ${size.width}x${size.height}.`,
      );
    }

    await mkdir(path.dirname(outputPath), { recursive: true });
    await writeFile(outputPath, buffer);

    log(
      `wrote ${path.relative(projectRoot, outputPath)} (${size.width}x${size.height} from ${viewport.width}x${viewport.height} CSS @${deviceScaleFactor})`,
    );

    if (problems.length > 0) {
      log(`page reported ${problems.length} console error(s):`);
      for (const problem of problems) log(`  ${problem}`);
    }
  } finally {
    await context.close();
    await browser.close();
  }
}

let server = null;

try {
  if (!explicitUrl) {
    log(`starting pnpm start on port ${port}`);
    server = startServer(port);
    await waitForServer(url, server);
  }

  log(
    `capturing ${url} at ${viewport.width}x${viewport.height} CSS -> ${OUTPUT_SIZE.width}x${OUTPUT_SIZE.height}`,
  );
  await capture(url);
} catch (error) {
  process.stderr.write(
    `[og] ${error instanceof Error ? error.message : error}\n`,
  );
  process.exitCode = 1;
} finally {
  await stopServer(server);
}
