/**
 * Real-click proof for the dev switch on /work and in a study.
 *
 * Usage: node scripts/verify-back-menu-switch.mjs [baseUrl]
 *
 * Clicks each option with the pointer and checks the resting control in the
 * reader: inline and crumb are always extended, dropdown and side show the
 * split chevron. It also switches on the index before a study mounts, and
 * proves the switch still works when localStorage and history.replaceState are
 * both blocked.
 */

import { chromium, firefox, webkit } from "playwright";

const BASE = process.argv[2] ?? "http://localhost:3013";
const BROWSER = process.env.BM_BROWSER ?? "chromium";
const engine =
  BROWSER === "firefox" ? firefox : BROWSER === "webkit" ? webkit : chromium;
const VARIANTS = ["dropdown", "inline", "crumb", "side"];

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

async function openStudyFromIndex(page) {
  await page.waitForSelector(".wd-work-row");
  await page.waitForTimeout(1200);
  await page.locator(".wd-work-row").first().click();
  await page.waitForURL(/\/work\/[^/?]+/);
  await page.waitForSelector(".wd-reader-column");
  await page.waitForTimeout(850);
}

async function restingState(page) {
  return page.evaluate(() => {
    const roots = [...document.querySelectorAll(".bm-root")].map((root) => ({
      variant: root.getAttribute("data-bm-variant"),
      visible: getComputedStyle(root).visibility !== "hidden",
      inline: Boolean(root.querySelector(".bm-inline-track")),
      crumb: Boolean(root.querySelector(".bm-crumb")),
      split: Boolean(root.querySelector(".bm-split")),
      chevron: Boolean(root.querySelector(".bm-chevron")),
      menuOpen: [...root.querySelectorAll(".bm-panel")].some(
        (panel) => panel.getAttribute("data-open") === "true",
      ),
    }));

    return {
      path: window.location.pathname,
      storage: window.localStorage.getItem("portfolio.back-menu"),
      pressed: [...document.querySelectorAll(".bm-dev-option")].map(
        (button) => ({
          name: button.textContent,
          pressed: button.getAttribute("aria-pressed") === "true",
        }),
      ),
      roots,
    };
  });
}

async function clickPill(page, variant) {
  await page.getByRole("button", { name: variant, exact: true }).click();
  await page.waitForTimeout(350);
}

async function assertVariant(page, variant, label, { storage = true } = {}) {
  const state = await restingState(page);
  const onlyOne = state.pressed.filter((option) => option.pressed);
  const visibleRoots = state.roots.filter((root) => root.visible);

  expect(
    `${label}: the pill marks ${variant} active`,
    onlyOne.length === 1 && onlyOne[0].name === variant,
    JSON.stringify(state.pressed),
  );

  if (storage) {
    expect(
      `${label}: localStorage follows the pill`,
      state.storage === variant,
      state.storage,
    );
  }

  expect(
    `${label}: one resting reader is visible`,
    visibleRoots.length === 1,
    JSON.stringify(state.roots),
  );

  const root = visibleRoots[0];

  if (!root) return;

  expect(
    `${label}: the resting reader is ${variant}`,
    root.variant === variant,
    root.variant,
  );

  if (variant === "inline") {
    expect(
      `${label}: the inline pair is on screen`,
      root.inline && !root.split && !root.crumb,
      JSON.stringify(root),
    );
  } else if (variant === "crumb") {
    expect(
      `${label}: the breadcrumb is on screen`,
      root.crumb && !root.inline && !root.split,
      JSON.stringify(root),
    );
  } else {
    expect(
      `${label}: the split label and chevron are on screen`,
      root.split && root.chevron && !root.inline && !root.crumb,
      JSON.stringify(root),
    );
    expect(`${label}: the card starts closed`, !root.menuOpen);
  }
}

async function runReaderFlow(page) {
  console.log("\n[reader] load ?bm=dropdown, open a study, click every option");
  await page.goto(`${BASE}/work?bm=dropdown`, {
    waitUntil: "domcontentloaded",
  });
  await openStudyFromIndex(page);

  for (const variant of VARIANTS) {
    await page.mouse.move(1200, 320);
    await page.waitForTimeout(220);
    await clickPill(page, variant);
    await assertVariant(page, variant, `reader ${variant}`);
  }
}

async function runIndexFlow(page) {
  console.log("\n[index] switch every option, then open a study");
  await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(800);
  await page.locator('[data-nav-dock] a[aria-label="Work"]').click();
  await page.waitForURL((url) => url.pathname === "/work");
  await page.waitForTimeout(700);

  for (const variant of VARIANTS) {
    await clickPill(page, variant);
    const state = await restingState(page);
    const pressed = state.pressed.filter((option) => option.pressed);

    expect(
      `index ${variant}: the pill marks it active`,
      pressed.length === 1 && pressed[0].name === variant,
      JSON.stringify(state.pressed),
    );
    expect(
      `index ${variant}: localStorage follows`,
      state.storage === variant,
      state.storage,
    );
    expect(
      `index ${variant}: the Home BackLink stays plain`,
      state.roots.length === 0,
    );
  }

  // Leave the last option (side) selected, then prove the reader mounts into it.
  await openStudyFromIndex(page);
  await assertVariant(page, "side", "reader after index switch");
}

async function runBlockedPersistenceFlow(page) {
  console.log("\n[blocked persistence] replaceState and localStorage throw");
  await page.goto(`${BASE}/work?bm=dropdown`, {
    waitUntil: "domcontentloaded",
  });
  await openStudyFromIndex(page);

  await page.evaluate(() => {
    window.history.replaceState = () => {
      throw new Error("replaceState blocked");
    };
    Storage.prototype.setItem = () => {
      throw new Error("localStorage blocked");
    };
  });

  await clickPill(page, "inline");
  await assertVariant(page, "inline", "blocked persistence", {
    storage: false,
  });
}

const browser = await engine.launch();

try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();
  const errors = [];

  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(String(error)));

  await runReaderFlow(page);
  await runIndexFlow(page);
  await runBlockedPersistenceFlow(page);

  expect(
    "no console errors",
    errors.length === 0,
    errors.slice(0, 3).join(" | "),
  );

  await context.close();
} finally {
  await browser.close();
}

console.log(`\n${checks - failures}/${checks} checks passed`);

if (failures > 0) process.exitCode = 1;
