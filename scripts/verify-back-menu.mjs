/**
 * Evidence run for the four resting "← Work" designs.
 *
 * Usage: node scripts/verify-back-menu.mjs [baseUrl]
 *
 * Checks the resting DOM with no hover, the index's exact left/top edge, the
 * shared article row height, both destinations, Day/Night, the split card's
 * hover/keyboard/Escape path, touch, reduced motion and console errors.
 */

import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium, firefox, webkit } from "playwright";

const BASE = process.argv[2] ?? "http://localhost:3013";
const BROWSER = process.env.BM_BROWSER ?? "chromium";
const engine =
  BROWSER === "firefox" ? firefox : BROWSER === "webkit" ? webkit : chromium;
const VARIANTS = (
  process.env.BM_VARIANTS ?? "dropdown,inline,crumb,side"
).split(",");
const WIDTHS = (process.env.BM_WIDTHS ?? "1440,1024").split(",").map(Number);
const SLUG = "systems-in-motion";
const SHOTS = join(process.env.TEMP ?? ".", "back-menu-resting-shots");

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

async function moveAway(page) {
  await page.mouse.move(page.viewportSize().width - 40, 320);
  await page.waitForTimeout(260);
}

async function goIndex(page, variant = "dropdown") {
  await page.goto(`${BASE}/work?bm=${variant}`, {
    waitUntil: "domcontentloaded",
  });
  await page.waitForSelector(".wd-work-row");
  await page.waitForTimeout(1200);
}

async function openStudyFromIndex(page) {
  await page.locator(".wd-work-row").first().click();
  await page.waitForURL(/\/work\/[^/?]+/);
  await page.waitForSelector(".wd-reader-column");
  await page.waitForTimeout(850);
}

async function directStudy(page, variant) {
  await page.goto(`${BASE}/work/${SLUG}?bm=${variant}`, {
    waitUntil: "domcontentloaded",
  });
  await page.waitForSelector(".wd-reader-column");
  await page.waitForTimeout(850);
  await moveAway(page);
}

async function waitIndex(page) {
  await page.waitForURL((url) => url.pathname === "/work", { timeout: 5000 });
  await page.waitForSelector(".wd-index-scroll");
  await page.waitForTimeout(650);
}

async function waitHome(page) {
  await page.waitForURL((url) => url.pathname === "/", { timeout: 5000 });
  await page.waitForTimeout(600);
  await page.waitForFunction(() => {
    const layer = document.querySelector(".wd-expand-layer");
    return !layer || getComputedStyle(layer).visibility === "hidden";
  });
}

async function controlBox(page) {
  const box = await page.locator(".wd-back").boundingBox();
  if (!box) throw new Error("back control has no box");
  return box;
}

async function articleTop(page) {
  return page
    .locator(".wd-reader-column")
    .evaluate((node) => node.getBoundingClientRect().top);
}

async function restingState(page) {
  return page.evaluate(() => {
    const root = document.querySelector(".bm-root");
    if (!root) return null;

    const link = root.querySelector(".wd-back-link");
    const chevron = root.querySelector(".bm-chevron");
    const inlineButtons = [...root.querySelectorAll("[data-segment]")];
    const crumb = root.querySelector(".bm-crumb");
    const panel = root.querySelector(".bm-panel");

    return {
      variant: root.getAttribute("data-bm-variant"),
      inline: Boolean(root.querySelector(".bm-inline-track")),
      crumb: Boolean(crumb),
      split: Boolean(root.querySelector(".bm-split")),
      link: Boolean(link),
      chevron: chevron
        ? {
            label: chevron.getAttribute("aria-label"),
            expanded: chevron.getAttribute("aria-expanded"),
            path: chevron.querySelector("path")?.getAttribute("d"),
          }
        : null,
      inlineButtons: inlineButtons.map((button) => ({
        label: button.getAttribute("aria-label"),
        role: button.getAttribute("role"),
        tabIndex: button.getAttribute("tabindex"),
      })),
      crumbLinks: crumb
        ? [...crumb.querySelectorAll("a")].map((anchor) => ({
            text: anchor.textContent,
            href: anchor.getAttribute("href"),
          }))
        : [],
      title: crumb?.querySelector(".bm-crumb-current")?.textContent,
      panel: panel
        ? {
            className: panel.className,
            open: panel.getAttribute("data-open"),
            hidden: panel.getAttribute("aria-hidden"),
          }
        : null,
      menuRoles: root.querySelectorAll('[role="menu"]').length,
    };
  });
}

async function checkResting(page, variant, indexBox) {
  await moveAway(page);
  const box = await controlBox(page);
  const top = await articleTop(page);
  const state = await restingState(page);

  expect(
    `${variant}: left edge matches index Home`,
    Math.abs(box.x - indexBox.x) < 0.5,
    `${indexBox.x} → ${box.x}`,
  );
  expect(
    `${variant}: y matches index Home`,
    Math.abs(box.y - indexBox.y) < 0.5,
    `${indexBox.y} → ${box.y}`,
  );
  expect(
    `${variant}: row is the same 32px`,
    Math.abs(box.height - indexBox.height) < 0.5,
    `${indexBox.height} → ${box.height}`,
  );

  if (!state) {
    fail(`${variant}: a resting control is rendered`, "missing .bm-root");
    return top;
  }

  expect(
    `${variant}: the variant root is correct`,
    state.variant === variant,
    state.variant,
  );

  if (variant === "inline") {
    expect(
      "inline: the Work | Home pair is on screen",
      state.inline &&
        !state.split &&
        !state.crumb &&
        state.inlineButtons.length === 2,
      JSON.stringify(state.inlineButtons),
    );
    expect(
      "inline: both items are plain buttons in the tab order",
      state.inlineButtons.every(
        (button) => button.role === "button" && button.tabIndex === "0",
      ),
      JSON.stringify(state.inlineButtons),
    );
    expect(
      "inline: no link or menu semantics",
      !state.link && state.menuRoles === 0,
    );
  } else if (variant === "crumb") {
    expect(
      "crumb: the breadcrumb is on screen",
      state.crumb &&
        !state.inline &&
        !state.split &&
        state.crumbLinks.length === 2,
      JSON.stringify(state.crumbLinks),
    );
    expect(
      "crumb: Home and Work are links, title is static",
      state.crumbLinks[0]?.href === "/" &&
        state.crumbLinks[1]?.href === "/work" &&
        state.title === "Systems in motion",
      JSON.stringify({ links: state.crumbLinks, title: state.title }),
    );
    expect("crumb: no menu semantics", state.menuRoles === 0);
  } else {
    expect(
      `${variant}: the split label and chevron are on screen`,
      state.split && state.link && Boolean(state.chevron),
      JSON.stringify(state),
    );
    expect(
      `${variant}: the chevron points ${variant === "side" ? "right" : "down"}`,
      state.chevron?.path ===
        (variant === "side"
          ? "M5.25 3 9.25 7 5.25 11"
          : "M3 5.25 7 9.25 11 5.25"),
      state.chevron?.path,
    );
    expect(
      `${variant}: the card starts closed`,
      state.panel?.open === "false" &&
        state.panel?.hidden === "true" &&
        state.chevron?.expanded === "false",
      JSON.stringify(state.panel),
    );
  }

  return top;
}

async function clickWork(page, variant) {
  if (variant === "inline") {
    await page.locator('[data-segment="Work"]').click();
    return;
  }

  if (variant === "crumb") {
    await page.locator('.bm-crumb-item[href="/work"]').click();
    return;
  }

  await page.locator(".wd-back-link").click();
}

async function clickHome(page, variant) {
  if (variant === "inline") {
    await page.locator('[data-segment="Home"]').click();
    return;
  }

  if (variant === "crumb") {
    await page.locator('.bm-crumb-item[href="/"]').click();
    return;
  }

  await page.locator(".bm-chevron").click();
  await page.waitForTimeout(220);
  await page.locator('[data-bm-item="home"]').click();
}

async function checkSplitCard(page, variant) {
  const link = await page.locator(".wd-back-link").boundingBox();
  if (!link) throw new Error("split label has no box");

  await page.mouse.move(link.x + link.width / 2, link.y + link.height / 2);
  await page.waitForTimeout(450);

  const openState = await page.evaluate(() => ({
    expanded: document
      .querySelector(".bm-chevron")
      ?.getAttribute("aria-expanded"),
    open: document.querySelector(".bm-panel")?.getAttribute("data-open"),
  }));
  expect(
    `${variant}: hover opens the card`,
    openState.expanded === "true" && openState.open === "true",
    JSON.stringify(openState),
  );

  const panel = await page.locator('.bm-panel[data-open="true"]').boundingBox();
  await page.mouse.move(panel.x + panel.width / 2, panel.y + panel.height / 2, {
    steps: 14,
  });
  await page.waitForTimeout(350);
  expect(
    `${variant}: pointer can travel into the card`,
    (await page.locator(".bm-panel").getAttribute("data-open")) === "true",
  );

  if (variant === "side") {
    const navBottom = await page
      .locator("[data-nav-dock]")
      .evaluate((node) => node.getBoundingClientRect().bottom);
    expect(
      "side: the card stays below the nav",
      panel.y >= navBottom - 1,
      `${panel.y} / ${navBottom}`,
    );
  }

  await page.screenshot({
    path: join(SHOTS, `${variant}-${page.viewportSize().width}-open.png`),
  });

  await page.keyboard.press("Escape");
  await page.waitForTimeout(180);
  expect(
    `${variant}: one Esc closes the card only`,
    new URL(page.url()).pathname === `/work/${SLUG}` &&
      (await page.locator(".bm-chevron").getAttribute("aria-expanded")) ===
        "false",
  );

  await page.keyboard.press("Escape");
  await waitIndex(page);
  expect(`${variant}: the next Esc steps the reader back`, true);

  await directStudy(page, variant);
  await page.locator(".bm-chevron").click();
  await page.waitForTimeout(220);
  const focused = await page.evaluate(() =>
    document.activeElement?.getAttribute("data-bm-item"),
  );
  expect(
    `${variant}: the chevron opens and focuses Work`,
    focused === "work",
    focused,
  );

  await page.keyboard.press("ArrowDown");
  const moved = await page.evaluate(() =>
    document.activeElement?.getAttribute("data-bm-item"),
  );
  expect(`${variant}: ArrowDown moves to Home`, moved === "home", moved);

  await page.keyboard.press("Enter");
  await waitHome(page);
  expect(`${variant}: keyboard Home lands on /`, true);
}

async function checkInlineFocus(page) {
  await page.locator('[data-segment="Work"]').focus();
  await page.waitForTimeout(220);
  const workState = await page.evaluate(() => ({
    visible: document
      .querySelector(".shape-layer--hover")
      ?.classList.contains("is-visible"),
    path: document.querySelector(".shape-layer--hover path")?.getAttribute("d"),
  }));
  expect(
    "inline: focus shows the glide capsule",
    workState.visible,
    workState.path,
  );

  await page.locator('[data-segment="Home"]').focus();
  await page.waitForTimeout(260);
  const homeState = await page.evaluate(() => {
    const path = document
      .querySelector(".shape-layer--hover path")
      ?.getAttribute("d");

    return {
      visible: document
        .querySelector(".shape-layer--hover")
        ?.classList.contains("is-visible"),
      path,
      startX: Number(path?.match(/^M([\d.]+),2/)?.[1]),
    };
  });
  expect(
    "inline: focus glides the capsule to Home",
    homeState.visible && homeState.startX >= 56,
    JSON.stringify(homeState),
  );
}

async function checkThemes(page, variant) {
  await page.locator('button[role="radio"][aria-label="Night"]').click({
    force: true,
  });
  await page.waitForTimeout(850);
  await moveAway(page);
  const night = await page.evaluate(() => ({
    phase: document.documentElement.dataset.phase,
    control: Boolean(document.querySelector(".bm-root")),
    rect: document.querySelector(".bm-root")?.getBoundingClientRect().height,
  }));
  expect(
    `${variant}: the control is present in Night`,
    night.phase === "night" && night.control && night.rect === 32,
    JSON.stringify(night),
  );
  await page.screenshot({
    path: join(SHOTS, `${variant}-${page.viewportSize().width}-night.png`),
  });

  await page.locator('button[role="radio"][aria-label="Day"]').click({
    force: true,
  });
  await page.waitForTimeout(850);
  expect(
    `${variant}: the control is present in Day`,
    (await page
      .locator('[role="radio"][aria-label="Day"]')
      .getAttribute("aria-checked")) === "true",
  );
}

async function runVariant(browser, variant, width) {
  console.log(`\n[${variant}] ${width}px`);
  const context = await browser.newContext({
    viewport: { width, height: 900 },
  });
  const page = await context.newPage();
  const errors = [];

  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(String(error)));

  await goIndex(page, variant);
  const indexBox = await controlBox(page);
  await openStudyFromIndex(page);
  const top = await checkResting(page, variant, indexBox);
  await checkThemes(page, variant);
  await moveAway(page);

  if (variant === "dropdown" || variant === "side") {
    await checkSplitCard(page, variant);
  } else if (variant === "inline") {
    await checkInlineFocus(page);

    await page.locator('[data-segment="Work"]').focus();
    await page.keyboard.press("Tab");
    const next = await page.evaluate(() =>
      document.activeElement?.getAttribute("aria-label"),
    );
    expect("inline: Tab moves Work → Home", next === "Home", next);

    await directStudy(page, variant);
    await clickWork(page, variant);
    await waitIndex(page);
    expect("inline: Work goes to the index", true);

    await directStudy(page, variant);
    await clickHome(page, variant);
    await waitHome(page);
    expect("inline: Home goes to /", true);

    await directStudy(page, variant);
    await page.keyboard.press("Escape");
    await waitIndex(page);
    expect("inline: Esc steps back with no menu open", true);
  } else {
    await page.locator('.bm-crumb-item[href="/"]').focus();
    await page.keyboard.press("Tab");
    const next = await page.evaluate(() => document.activeElement?.textContent);
    expect("crumb: Tab moves Home → Work", next === "Work", next);

    await clickWork(page, variant);
    await waitIndex(page);
    expect("crumb: Work goes to the index", true);

    await directStudy(page, variant);
    await clickHome(page, variant);
    await waitHome(page);
    expect("crumb: Home goes to /", true);

    await directStudy(page, variant);
    await page.keyboard.press("Escape");
    await waitIndex(page);
    expect("crumb: Esc steps back with no menu open", true);
  }

  if (variant === "dropdown" || variant === "side") {
    await directStudy(page, variant);
    await clickWork(page, variant);
    await waitIndex(page);
    expect(`${variant}: the label goes to Work`, true);

    await directStudy(page, variant);
    await clickHome(page, variant);
    await waitHome(page);
    expect(`${variant}: Home goes to /`, true);
  }

  expect(
    `${variant}: article top is 184`,
    Math.abs(top - 184) < 0.5,
    String(top),
  );
  expect(
    `${variant}: no console errors`,
    errors.length === 0,
    errors.slice(0, 3).join(" | "),
  );

  await context.close();
}

async function checkTouch(browser) {
  console.log("\n[touch] inline + split");
  const context = await browser.newContext({
    viewport: { width: 1024, height: 900 },
    hasTouch: true,
  });
  const page = await context.newPage();

  await directStudy(page, "inline");
  expect(
    "touch: hover is none",
    await page.evaluate(() => matchMedia("(hover: none)").matches),
  );
  await page.locator('[data-segment="Work"]').tap();
  await waitIndex(page);
  expect("touch: the inline Work tap goes to Work", true);

  await directStudy(page, "side");
  await page.locator(".bm-chevron").tap();
  await page.waitForTimeout(300);
  expect(
    "touch: the chevron opens the side card",
    (await page.locator(".bm-chevron").getAttribute("aria-expanded")) ===
      "true",
  );
  await page.locator('[data-bm-item="home"]').tap();
  await waitHome(page);
  expect("touch: a card item goes home", true);

  await context.close();
}

async function checkReducedMotion(browser) {
  console.log("\n[reduced motion] inline + dropdown");
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    reducedMotion: "reduce",
  });
  const page = await context.newPage();

  await directStudy(page, "inline");
  const inline = await page.evaluate(() => {
    const work = document.querySelector('[data-segment="Work"]');
    const layer = document.querySelector(".shape-layer");
    return {
      background: getComputedStyle(work).backgroundColor,
      layer: getComputedStyle(layer).display,
    };
  });
  expect(
    "reduced motion: the inline Work capsule is still visible",
    inline.background !== "rgba(0, 0, 0, 0)" && inline.layer === "none",
    JSON.stringify(inline),
  );

  await directStudy(page, "dropdown");
  const box = await page.locator(".wd-back-link").boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForTimeout(400);
  const panel = await page.evaluate(() => {
    const node = document.querySelector('.bm-panel[data-open="true"]');
    return getComputedStyle(node).transform;
  });
  expect(
    "reduced motion: the card has no scale",
    panel === "none" || panel === "matrix(1, 0, 0, 1, 0, 0)",
    panel,
  );

  await context.close();
}

const browser = await engine.launch();

try {
  for (const width of WIDTHS) {
    for (const variant of VARIANTS) {
      await runVariant(browser, variant, width);
    }
  }

  await checkTouch(browser);
  await checkReducedMotion(browser);
} finally {
  await browser.close();
}

console.log(`\n${checks - failures}/${checks} checks passed`);
console.log(`screenshots: ${SHOTS}`);

if (failures > 0) process.exitCode = 1;
