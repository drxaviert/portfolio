/**
 * Evidence run for the four "← Work" hover menu prototypes.
 *
 * Usage: node scripts/verify-back-menu.mjs [baseUrl]
 *
 * Not part of `pnpm test`: this drives a real Chromium against the dev server,
 * checks the shared behaviour per variant, and exits non-zero on any failure.
 */

import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";

const BASE = process.argv[2] ?? "http://localhost:3013";
const VARIANTS = (
  process.env.BM_VARIANTS ?? "dropdown,inline,crumb,side"
).split(",");
const WIDTHS = (process.env.BM_WIDTHS ?? "1440,1024").split(",").map(Number);
const SLUG = "systems-in-motion";
const SHOTS = join(process.env.TEMP ?? ".", "back-menu-shots");

mkdirSync(SHOTS, { recursive: true });

let failures = 0;
let checks = 0;

function ok(name, detail = "") {
  checks += 1;
  console.log(`  PASS  ${name}${detail ? ` — ${detail}` : ""}`);
}

function fail(name, detail) {
  checks += 1;
  failures += 1;
  console.log(`  FAIL  ${name} — ${detail}`);
}

function expect(name, condition, detail) {
  if (condition) ok(name, detail);
  else fail(name, detail);
}

const urlFor = (path, variant) =>
  `${BASE}${path}${path.includes("?") ? "&" : "?"}bm=${variant}`;

async function expanded(page) {
  return (
    (await page.locator(".wd-back-link").getAttribute("aria-expanded")) ===
    "true"
  );
}

async function moveAway(page, width) {
  await page.mouse.move(width - 40, 320);
  await page.waitForTimeout(260);
}

async function openStudyFromIndex(page, variant) {
  await page.goto(urlFor("/work", variant), { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".wd-work-row");
  await page.waitForTimeout(1200);

  await page.evaluate(() => {
    const scroll = document.querySelector(".wd-index-scroll");
    if (scroll) scroll.scrollTop = 240;
  });
  await page.waitForTimeout(150);

  const indexMenu = await page.locator(".wd-back-menu").count();

  const opened = await page.evaluate(() => {
    const scroll = document.querySelector(".wd-index-scroll");
    const links = [...document.querySelectorAll(".wd-work-row")];
    const visible =
      links.find((link) => {
        const rect = link.getBoundingClientRect();
        return rect.top > 150 && rect.bottom < window.innerHeight - 80;
      }) ?? links[0];

    const href = visible.getAttribute("href");
    visible.click();

    return { href, scroll: scroll?.scrollTop ?? 0 };
  });

  await page.waitForURL(`**${opened.href}*`);
  await page.waitForSelector(".wd-reader-column");
  await page.waitForTimeout(850);

  return { ...opened, indexMenu };
}

async function openStudyDirect(page, variant) {
  await page.goto(urlFor(`/work/${SLUG}`, variant), {
    waitUntil: "domcontentloaded",
  });
  await page.waitForSelector(".wd-reader-column");
  await page.waitForTimeout(850);
}

async function hoverOpen(page) {
  const box = await page.locator(".wd-back-link").boundingBox();
  if (!box) throw new Error("back link has no box");

  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);

  const immediate = await expanded(page);
  await page.waitForTimeout(100);
  const at100 = await expanded(page);

  await page.waitForFunction(
    () =>
      document.querySelector(".wd-back-link")?.getAttribute("aria-expanded") ===
      "true",
    undefined,
    { timeout: 1200 },
  );
  await page.waitForTimeout(220);

  return { immediate, at100 };
}

async function travelIntoMenu(page) {
  const panel = page.locator('.bm-panel[data-open="true"]');
  const box = await panel.boundingBox();
  if (!box) throw new Error("menu has no box");

  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, {
    steps: 18,
  });
  await page.waitForTimeout(340);
  return expanded(page);
}

function item(page, variant, id) {
  if (variant === "inline") {
    const label = id === "work" ? "Work" : "Home";
    return page.locator(`button[role="radio"][aria-label="${label}"]`);
  }

  return page.locator(`[data-bm-item="${id}"]`);
}

async function waitForIndex(page) {
  await page.waitForURL((url) => url.pathname === "/work", { timeout: 5000 });
  await page.waitForSelector(".wd-index-scroll");
  await page.waitForTimeout(700);
}

async function waitForHome(page) {
  await page.waitForURL((url) => url.pathname === "/", { timeout: 5000 });
  await page.waitForTimeout(600);
  await page.waitForFunction(() => {
    const layer = document.querySelector(".wd-expand-layer");
    return !layer || getComputedStyle(layer).visibility === "hidden";
  });
}

async function checkMenuShape(page, variant) {
  const panel = page.locator('.bm-panel[data-open="true"]');

  if (variant === "inline") {
    const track = page.locator(".bm-inline-track");
    expect("inline uses the shared segment track", (await track.count()) === 1);
    const labels = await page
      .locator('.bm-inline [role="radio"]')
      .allTextContents();
    expect(
      "inline pair reads Work / Home",
      labels.join("|") === "Work|Home",
      labels.join(" / "),
    );
    return;
  }

  if (variant === "crumb") {
    const text = (await panel.textContent())?.replace(/\s+/g, "").trim();
    expect(
      "crumb reads Home / Work / title",
      text === "Home/Work/Systemsinmotion",
      text,
    );
    const current = page.locator(".bm-crumb-current");
    const style = await current.evaluate((node) => {
      const css = getComputedStyle(node);
      return {
        maxWidth: css.maxWidth,
        overflow: css.overflow,
        ellipsis: css.textOverflow,
      };
    });
    expect(
      "crumb title truncates at ~240px",
      style.maxWidth === "240px" && style.ellipsis === "ellipsis",
      JSON.stringify(style),
    );
    return;
  }

  const work = item(page, variant, "work");
  const home = item(page, variant, "home");
  expect("Work row is present", (await work.count()) === 1);
  expect("Home row is present", (await home.count()) === 1);
  expect(
    "dropdown row is 36px",
    variant !== "dropdown" ||
      (await work.evaluate((node) => getComputedStyle(node).height)) === "36px",
  );
  expect(
    "side row is 48px",
    variant !== "side" ||
      (await work.evaluate((node) => getComputedStyle(node).height)) === "48px",
  );
  expect(
    "card uses the popover surface",
    (await panel.evaluate((node) => getComputedStyle(node).backgroundColor)) !==
      "rgba(0, 0, 0, 0)",
  );
}

async function checkSideClearOfNav(page, variant) {
  if (variant !== "side") return;

  const navBottom = await page
    .locator("[data-nav-dock]")
    .evaluate((node) => node.getBoundingClientRect().bottom);
  const panelTop = await page
    .locator('.bm-panel[data-open="true"]')
    .evaluate((node) => node.getBoundingClientRect().top);

  expect(
    "side card sits below the nav",
    panelTop >= navBottom - 1,
    `panel ${panelTop.toFixed(1)} / nav ${navBottom.toFixed(1)}`,
  );
}

async function checkNoLayoutShift(page) {
  // Close the menu first, so "before" is genuinely the resting article.
  await page.keyboard.press("Escape");
  await page.waitForTimeout(150);
  await moveAway(page, page.viewportSize().width);

  const before = await page.evaluate(() => ({
    article: document
      .querySelector(".wd-reader-column")
      ?.getBoundingClientRect().top,
    scroll: document.querySelector(".wd-reader-scroll")?.scrollTop,
  }));

  await hoverOpen(page);
  await travelIntoMenu(page);
  await page.waitForTimeout(200);

  const after = await page.evaluate(() => ({
    article: document
      .querySelector(".wd-reader-column")
      ?.getBoundingClientRect().top,
    scroll: document.querySelector(".wd-reader-scroll")?.scrollTop,
  }));

  expect(
    "article top does not move on hover",
    Math.abs((before.article ?? 0) - (after.article ?? 0)) < 0.5,
    `${before.article} → ${after.article}`,
  );
  expect(
    "reader scroll does not move on hover",
    before.scroll === after.scroll,
    `${before.scroll} → ${after.scroll}`,
  );
}

async function setTheme(page, name) {
  await page
    .locator(`button[role="radio"][aria-label="${name}"]`)
    .click({ force: true });
  await page.waitForTimeout(750);
}

async function checkThemes(page, variant) {
  await setTheme(page, "Night");
  expect(
    "night theme applied",
    (await page.evaluate(() => document.documentElement.dataset.phase)) ===
      "night",
  );

  await moveAway(page, page.viewportSize().width);
  const night = await hoverOpen(page);
  expect(
    "menu opens in Night",
    night.immediate === false && (await expanded(page)),
  );
  await checkMenuShape(page, variant);
  await checkSideClearOfNav(page, variant);
  await page.screenshot({
    path: join(SHOTS, `${variant}-${page.viewportSize().width}-night.png`),
  });

  await page.keyboard.press("Escape");
  await page.waitForTimeout(120);
  await page.waitForTimeout(200);

  await setTheme(page, "Day");
  expect(
    "day theme applied",
    (await page.evaluate(() => document.documentElement.dataset.phase)) !==
      "night",
  );

  await moveAway(page, page.viewportSize().width);
  await hoverOpen(page);
  await page.screenshot({
    path: join(SHOTS, `${variant}-${page.viewportSize().width}-day.png`),
  });
  await page.keyboard.press("Escape");
  await page.waitForTimeout(250);
}

async function checkDrawerCycles(page, variant) {
  await page.goto(BASE + "/", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(700);

  for (let cycle = 1; cycle <= 3; cycle += 1) {
    await page.locator('[data-nav-dock] a[aria-label="Work"]').click();
    await page.waitForURL((url) => url.pathname === "/work", { timeout: 5000 });
    await page.waitForTimeout(650);

    const open = await page.evaluate(() => {
      const layer = document.querySelector(".wd-expand-layer");
      return Boolean(layer && getComputedStyle(layer).visibility !== "hidden");
    });
    expect(`drawer cycle ${cycle} opens (${variant})`, open);

    await page.locator('[data-nav-dock] a[aria-label="Home"]').click();
    await waitForHome(page);

    const closed = await page.evaluate(() => {
      const layer = document.querySelector(".wd-expand-layer");
      return !layer || getComputedStyle(layer).visibility === "hidden";
    });
    expect(`drawer cycle ${cycle} closes (${variant})`, closed);
  }
}

async function runVariant(browser, variant, width) {
  console.log(`\n[${variant}] ${width}px`);

  const context = await browser.newContext({
    viewport: { width, height: 900 },
    colorScheme: "light",
  });
  const page = await context.newPage();
  const consoleErrors = [];

  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => consoleErrors.push(String(error)));

  await page.goto(BASE + "/", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(300);

  const opened = await openStudyFromIndex(page, variant);
  expect("the index BackLink stays a plain link", opened.indexMenu === 0);
  await moveAway(page, width);

  const hover = await hoverOpen(page);
  expect(
    "hover does not open before the intent delay",
    hover.immediate === false,
  );
  expect(
    "hover still closed at 100ms",
    hover.at100 === false,
    `expanded=${hover.at100}`,
  );
  expect("hover opens after ~150ms", await expanded(page));

  expect("pointer can travel into the menu", await travelIntoMenu(page));

  await checkMenuShape(page, variant);
  await checkSideClearOfNav(page, variant);
  await page.screenshot({
    path: join(SHOTS, `${variant}-${width}-open.png`),
  });

  await checkNoLayoutShift(page);

  // Work: the reader's existing step-back, and the index's scroll restored.
  await travelIntoMenu(page);
  await item(page, variant, "work").click();
  await waitForIndex(page);
  const restored = await page.evaluate(
    () => document.querySelector(".wd-index-scroll")?.scrollTop ?? -1,
  );
  expect(
    "Work returns to the index with its scroll",
    Math.abs(restored - opened.scroll) <= 2,
    `${opened.scroll} → ${restored}`,
  );

  // Button itself.
  await openStudyFromIndex(page, variant);
  await page.locator(".wd-back-link").click();
  await waitForIndex(page);
  expect("clicking the button goes to Work", true);

  // Home: the whole drawer closes to the homepage.
  await openStudyDirect(page, variant);
  await moveAway(page, width);
  await hoverOpen(page);
  await item(page, variant, "home").click();
  await waitForHome(page);
  const homeIntact = await page.evaluate(() => {
    const main = document.querySelector("main[data-entrance]");
    return Boolean(main && main.getBoundingClientRect().height > 200);
  });
  expect("Home lands on / with the homepage intact", homeIntact);

  // Esc layering: one press closes the menu, the next steps back.
  await openStudyDirect(page, variant);
  await moveAway(page, width);
  await hoverOpen(page);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(160);
  expect(
    "first Esc closes the menu only",
    !(await expanded(page)) && new URL(page.url()).pathname === `/work/${SLUG}`,
  );
  await page.keyboard.press("Escape");
  await waitForIndex(page);
  expect("second Esc steps the reader back", true);

  // Keyboard: ArrowDown opens and focuses the first item, arrows move, Enter
  // activates the focused one.
  await openStudyDirect(page, variant);
  await moveAway(page, width);
  await page.locator(".wd-back-link").focus();
  await page.keyboard.press("ArrowDown");
  await page.waitForTimeout(120);
  expect("ArrowDown opens the menu", await expanded(page));

  const first = await page.evaluate(() => {
    const active = document.activeElement;
    return {
      id: active?.getAttribute("data-bm-item"),
      role: active?.getAttribute("role"),
      label: active?.getAttribute("aria-label"),
    };
  });
  expect(
    "the first item takes focus",
    variant === "inline" ? first.label === "Work" : Boolean(first.id),
    JSON.stringify(first),
  );

  await page.keyboard.press("ArrowDown");
  const second = await page.evaluate(() => {
    const active = document.activeElement;
    return {
      id: active?.getAttribute("data-bm-item"),
      label: active?.getAttribute("aria-label"),
    };
  });
  expect(
    "ArrowDown moves to the next item",
    Boolean(second.id || second.label),
  );

  await page.keyboard.press("Enter");
  if (variant === "crumb") {
    await waitForIndex(page);
    expect("Enter activates the focused Work crumb", true);
  } else {
    await waitForHome(page);
    expect("Enter activates the focused Home item", true);
  }

  // Day and Night.
  await openStudyDirect(page, variant);
  await checkThemes(page, variant);

  // Three full drawer open/close cycles, untouched nav and Esc lifecycle.
  await checkDrawerCycles(page, variant);

  expect(
    "no console errors",
    consoleErrors.length === 0,
    consoleErrors.slice(0, 3).join(" | "),
  );

  await context.close();
}

async function checkReducedMotion(browser) {
  console.log("\n[reduced motion] dropdown");
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    reducedMotion: "reduce",
  });
  const page = await context.newPage();

  await openStudyDirect(page, "dropdown");
  await moveAway(page, 1440);
  await hoverOpen(page);

  const style = await page
    .locator('.bm-panel[data-open="true"]')
    .evaluate((node) => {
      const css = getComputedStyle(node);
      return {
        transform: css.transform,
        durations: css.transitionDuration,
      };
    });

  expect(
    "reduced motion has no scale",
    style.transform === "none" ||
      style.transform === "matrix(1, 0, 0, 1, 0, 0)",
    style.transform,
  );
  const durations = style.durations
    .split(",")
    .map((value) => Number.parseFloat(value));
  expect(
    "reduced motion stays at or under 120ms",
    durations.every((value) => (Number.isFinite(value) ? value <= 0.12 : true)),
    style.durations,
  );

  await context.close();
}

async function checkTouch(browser) {
  console.log("\n[touch] dropdown");
  const context = await browser.newContext({
    viewport: { width: 1024, height: 900 },
    hasTouch: true,
  });
  const page = await context.newPage();

  await openStudyDirect(page, "dropdown");
  const hoverNone = await page.evaluate(
    () => window.matchMedia("(hover: none)").matches,
  );
  expect("the touch context reports hover: none", hoverNone);

  await page.locator(".wd-back-link").tap();
  await waitForIndex(page);
  expect("a touch tap goes to Work", true);

  await context.close();
}

/** A short viewport gives the index a real scroll, so the restore is visible. */
async function checkScrollRestore(browser) {
  console.log("\n[scroll] dropdown, 1024x520");
  const context = await browser.newContext({
    viewport: { width: 1024, height: 520 },
  });
  const page = await context.newPage();

  const opened = await openStudyFromIndex(page, "dropdown");
  expect(
    "the index scrolls in this viewport",
    opened.scroll > 0,
    `${opened.scroll}px`,
  );

  await moveAway(page, 1024);
  await hoverOpen(page);
  await item(page, "dropdown", "work").click();
  await waitForIndex(page);

  const restored = await page.evaluate(
    () => document.querySelector(".wd-index-scroll")?.scrollTop ?? -1,
  );
  expect(
    "Work restores the index scroll",
    Math.abs(restored - opened.scroll) <= 2,
    `${opened.scroll} → ${restored}`,
  );

  await context.close();
}

const browser = await chromium.launch();

try {
  for (const width of WIDTHS) {
    for (const variant of VARIANTS) {
      await runVariant(browser, variant, width);
    }
  }

  await checkReducedMotion(browser);
  await checkTouch(browser);
  await checkScrollRestore(browser);
} finally {
  await browser.close();
}

console.log(`\n${checks - failures}/${checks} checks passed`);
console.log(`screenshots: ${SHOTS}`);

if (failures > 0) {
  process.exitCode = 1;
}
