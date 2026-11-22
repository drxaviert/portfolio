/**
 * Evidence run for the shared /work Breadcrumb.
 *
 * Usage: node scripts/verify-breadcrumb.mjs [baseUrl]
 *
 * Checks the index/reader rects at 1440, 1024 and 768, the nav item computed
 * styles, the Glide capsule, both destinations, scroll restore, Escape,
 * Tab + Enter, three drawer cycles, Day/Night and console errors.
 */

import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";

const BASE = process.argv[2] ?? "http://localhost:3013";
const WIDTHS = (process.env.BC_WIDTHS ?? "1440,1024,768")
  .split(",")
  .map(Number);
const SHOTS = join(process.env.TEMP ?? ".", "breadcrumb-evidence");

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

async function shot(page, name) {
  try {
    await page.screenshot({
      path: join(SHOTS, name),
      timeout: 8000,
      animations: "disabled",
    });
  } catch {
    // Evidence screenshots are best-effort; the checks above are the proof.
  }
}

async function waitIndex(page) {
  await page.waitForFunction(
    () => window.location.pathname === "/work",
    undefined,
    { timeout: 12000 },
  );
  await page.waitForSelector(".wd-index-scroll");
  await page.waitForTimeout(650);
}

async function waitHome(page) {
  await page.waitForFunction(
    () => window.location.pathname === "/",
    undefined,
    { timeout: 12000 },
  );
  await page.waitForTimeout(550);
  await page.waitForFunction(() => {
    const layer = document.querySelector(".wd-expand-layer");
    return !layer || getComputedStyle(layer).visibility === "hidden";
  });
}

async function indexRect(page) {
  await page.goto(`${BASE}/work`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".wd-breadcrumb");
  await page.waitForTimeout(850);

  return page.evaluate(() => {
    const crumb = document.querySelector(".wd-breadcrumb");
    const home = crumb.querySelector('a[href="/"]');
    const rect = (node) => {
      const box = node.getBoundingClientRect();
      return {
        left: box.left,
        top: box.top,
        width: box.width,
        height: box.height,
      };
    };

    return { crumb: rect(crumb), home: rect(home) };
  });
}

async function readerRect(page) {
  await page.goto(`${BASE}/work/systems-in-motion`, {
    waitUntil: "domcontentloaded",
  });
  await page.waitForSelector(".wd-breadcrumb");
  await page.waitForTimeout(850);

  return page.evaluate(() => {
    const crumb = document.querySelector(".wd-breadcrumb");
    const home = crumb.querySelector('a[href="/"]');
    const title = crumb.querySelector(".breadcrumb-current");
    const sep = crumb.querySelector(".breadcrumb-sep");
    const rect = (node) => {
      const box = node.getBoundingClientRect();
      return {
        left: box.left,
        top: box.top,
        width: box.width,
        height: box.height,
      };
    };

    return {
      crumb: rect(crumb),
      home: rect(home),
      title: rect(title),
      titleMax: getComputedStyle(title).maxWidth,
      sep: {
        color: getComputedStyle(sep).color,
        fontSize: getComputedStyle(sep).fontSize,
        fontWeight: getComputedStyle(sep).fontWeight,
      },
    };
  });
}

async function styleSnapshot(page) {
  return page.evaluate(() => {
    const home = document.querySelector('.wd-breadcrumb a[href="/"]');
    const nav = document.querySelector('[data-nav-dock] [aria-label="About"]');
    const divider = document.querySelector(
      "[data-nav-dock] .bg-outline-variant",
    );
    const style = (node) => {
      const css = getComputedStyle(node);
      return {
        fontSize: css.fontSize,
        fontWeight: css.fontWeight,
        height: css.height,
        borderRadius: css.borderRadius,
        paddingLeft: css.paddingLeft,
        paddingRight: css.paddingRight,
        color: css.color,
        lineHeight: css.lineHeight,
      };
    };

    return {
      crumb: style(home),
      nav: style(nav),
      navDivider: divider ? getComputedStyle(divider).backgroundColor : "",
    };
  });
}

async function hoverGlide(page, selector) {
  await page.locator(selector).hover();
  await page.waitForTimeout(380);

  return page.evaluate(() => {
    const glide = document.querySelector(".wd-breadcrumb .nav-glide");
    const css = getComputedStyle(glide);
    return {
      visible: glide.hasAttribute("data-visible"),
      clip: glide.style.clipPath,
      opacity: css.opacity,
      background: css.backgroundColor,
    };
  });
}

async function setTheme(page, name) {
  await page.locator(`button[role="radio"][aria-label="${name}"]`).click({
    force: true,
  });
  await page.waitForTimeout(750);
}

async function runWidth(browser, width) {
  console.log(`\n[${width}px]`);
  const context = await browser.newContext({
    viewport: { width, height: 900 },
  });
  const page = await context.newPage();
  const errors = [];

  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(String(error)));

  const index = await indexRect(page);
  const reader = await readerRect(page);

  expect(
    `${width}: breadcrumb left matches`,
    Math.abs(index.crumb.left - reader.crumb.left) < 0.5,
    `${index.crumb.left} → ${reader.crumb.left}`,
  );
  expect(
    `${width}: breadcrumb y matches`,
    Math.abs(index.crumb.top - reader.crumb.top) < 0.5,
    `${index.crumb.top} → ${reader.crumb.top}`,
  );
  expect(
    `${width}: breadcrumb row height matches`,
    Math.abs(index.crumb.height - reader.crumb.height) < 0.5,
    `${index.crumb.height} → ${reader.crumb.height}`,
  );
  expect(
    `${width}: Home item rect is identical`,
    ["left", "top", "width", "height"].every(
      (key) => Math.abs(index.home[key] - reader.home[key]) < 0.5,
    ),
    JSON.stringify({ index: index.home, reader: reader.home }),
  );

  const styles = await styleSnapshot(page);
  for (const key of [
    "fontSize",
    "fontWeight",
    "height",
    "borderRadius",
    "paddingLeft",
    "paddingRight",
    "color",
    "lineHeight",
  ]) {
    expect(
      `${width}: ${key} matches the nav item`,
      styles.crumb[key] === styles.nav[key],
      `${styles.nav[key]} → ${styles.crumb[key]}`,
    );
  }

  expect(
    `${width}: separator is the nav's 16px outline-variant`,
    reader.sep.fontSize === "16px" && reader.sep.color === styles.navDivider,
    JSON.stringify({ sep: reader.sep, divider: styles.navDivider }),
  );
  expect(
    `${width}: title clips at 240px`,
    reader.titleMax === "240px" && reader.title.width <= 240.5,
    `${reader.title.width} / ${reader.titleMax}`,
  );

  const homeHover = await hoverGlide(page, '.wd-breadcrumb a[href="/"]');
  const workHover = await hoverGlide(page, '.wd-breadcrumb a[href="/work"]');

  expect(
    `${width}: the Glide capsule is visible on hover`,
    homeHover.visible && homeHover.opacity === "0.55",
    JSON.stringify(homeHover),
  );
  expect(
    `${width}: the Glide capsule moves between Home and Work`,
    homeHover.clip !== workHover.clip && workHover.visible,
    `${homeHover.clip} → ${workHover.clip}`,
  );

  const nav = page.locator('[data-nav-dock] [aria-label="About"]');
  await nav.hover();
  await page.waitForTimeout(380);
  const navGlide = await page.evaluate(() => {
    const glide = document.querySelector("[data-nav-dock] .nav-glide");
    const css = getComputedStyle(glide);
    return {
      background: css.backgroundColor,
      opacity: css.opacity,
      visible: glide.hasAttribute("data-visible"),
    };
  });

  expect(
    `${width}: breadcrumb fill is the nav's token`,
    navGlide.background === homeHover.background &&
      navGlide.opacity === homeHover.opacity,
    JSON.stringify({ navGlide, homeHover }),
  );

  await shot(page, `breadcrumb-${width}-day.png`);

  // Home lands on the homepage.
  await page.locator('.wd-breadcrumb a[href="/"]').click();
  await waitHome(page);
  const homeIntact = await page.evaluate(() => {
    const main = document.querySelector("main[data-entrance]");
    return Boolean(main && main.getBoundingClientRect().height > 200);
  });
  expect(`${width}: Home lands on / with the homepage intact`, homeIntact);

  // Tab + Enter on the reader: Home → Work → the index.
  await readerRect(page);
  const home = page.locator('.wd-breadcrumb a[href="/"]');
  await home.focus();
  await page.keyboard.press("Tab");
  const active = await page.evaluate(() =>
    document.activeElement?.getAttribute("href"),
  );
  expect(`${width}: Tab moves Home → Work`, active === "/work", active);
  await page.keyboard.press("Enter");
  await waitIndex(page);
  expect(`${width}: Enter on Work returns to the index`, true);

  // Esc on the reader steps back; Esc on the index closes.
  await readerRect(page);
  await page.keyboard.press("Escape");
  await waitIndex(page);
  expect(`${width}: Esc on the reader steps back`, true);

  await page.keyboard.press("Escape");
  await waitHome(page);
  expect(`${width}: Esc on the index closes`, true);

  // Day and Night.
  await readerRect(page);
  await setTheme(page, "Night");
  expect(
    `${width}: breadcrumb is present in Night`,
    await page.locator(".wd-breadcrumb").isVisible(),
  );
  await shot(page, `breadcrumb-${width}-night.png`);
  await setTheme(page, "Day");
  expect(
    `${width}: breadcrumb is present in Day`,
    await page.locator(".wd-breadcrumb").isVisible(),
  );

  expect(
    `${width}: no console errors`,
    errors.length === 0,
    errors.slice(0, 3).join(" | "),
  );

  await context.close();
}

async function checkScrollRestore(browser) {
  console.log("\n[scroll restore] 768x520");
  const context = await browser.newContext({
    viewport: { width: 768, height: 520 },
  });
  const page = await context.newPage();

  await page.goto(`${BASE}/work`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".wd-work-row");
  await page.waitForTimeout(1200);

  const opened = await page.evaluate(() => {
    const scroll = document.querySelector(".wd-index-scroll");
    scroll.scrollTop = 160;
    const links = [...document.querySelectorAll(".wd-work-row")];
    const visible =
      links.find((link) => {
        const rect = link.getBoundingClientRect();
        return rect.top > 150 && rect.bottom < window.innerHeight - 60;
      }) ?? links[0];
    visible.click();
    return { scroll: scroll.scrollTop, href: visible.getAttribute("href") };
  });

  await page.waitForURL(`**${opened.href}*`);
  await page.waitForSelector(".wd-breadcrumb");
  await page.waitForTimeout(700);
  await page.locator('.wd-breadcrumb a[href="/work"]').click();
  await waitIndex(page);
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

async function checkDrawerCycles(browser) {
  console.log("\n[drawer cycles] 1440");
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();

  await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(700);

  for (let cycle = 1; cycle <= 3; cycle += 1) {
    await page.locator('[data-nav-dock] a[aria-label="Work"]').click();
    await page.waitForURL((url) => url.pathname === "/work", { timeout: 12000 });
    await page.waitForTimeout(650);
    expect(
      `cycle ${cycle}: drawer opens`,
      await page.locator(".wd-breadcrumb").isVisible(),
    );

    await page.locator('[data-nav-dock] a[aria-label="Home"]').click();
    await waitHome(page);
    expect(
      `cycle ${cycle}: drawer closes`,
      await page
        .locator(".wd-expand-layer")
        .evaluate((layer) => getComputedStyle(layer).visibility === "hidden"),
    );
  }

  await context.close();
}

async function checkReducedMotion(browser) {
  console.log("\n[reduced motion] 1440");
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    reducedMotion: "reduce",
  });
  const page = await context.newPage();

  await page.goto(`${BASE}/work/systems-in-motion`, {
    waitUntil: "domcontentloaded",
  });
  await page.waitForSelector(".wd-breadcrumb");
  await page.waitForTimeout(850);
  await page.locator('.wd-breadcrumb a[href="/"]').hover();
  await page.waitForTimeout(300);

  const reduced = await page.evaluate(() => {
    const glide = document.querySelector(".wd-breadcrumb .nav-glide");
    const home = document.querySelector('.wd-breadcrumb a[href="/"]');
    return {
      glide: getComputedStyle(glide).display,
      fill: getComputedStyle(home).backgroundColor,
    };
  });

  expect(
    "reduced motion: capsule travel is hidden",
    reduced.glide === "none",
    reduced.glide,
  );
  expect(
    "reduced motion: the item carries the fill instead",
    reduced.fill !== "rgba(0, 0, 0, 0)",
    reduced.fill,
  );

  await context.close();
}

async function checkTouch(browser) {
  console.log("\n[touch] 1024");
  const context = await browser.newContext({
    viewport: { width: 1024, height: 900 },
    hasTouch: true,
  });
  const page = await context.newPage();

  await page.goto(`${BASE}/work/systems-in-motion`, {
    waitUntil: "domcontentloaded",
  });
  await page.waitForSelector(".wd-breadcrumb");
  await page.waitForTimeout(850);
  expect(
    "touch: hover is none",
    await page.evaluate(() => matchMedia("(hover: none)").matches),
  );

  await page.locator('.wd-breadcrumb a[href="/work"]').tap();
  await waitIndex(page);
  expect("touch: Work is a plain link to the index", true);

  await context.close();
}

const browser = await chromium.launch();

try {
  for (const width of WIDTHS) {
    await runWidth(browser, width);
  }

  await checkScrollRestore(browser);
  await checkDrawerCycles(browser);
  await checkReducedMotion(browser);
  await checkTouch(browser);
} finally {
  await browser.close();
}

console.log(`\n${checks - failures}/${checks} checks passed`);
console.log(`screenshots: ${SHOTS}`);

if (failures > 0) process.exitCode = 1;
