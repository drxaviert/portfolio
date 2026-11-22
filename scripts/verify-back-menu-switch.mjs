/**
 * Real-click proof for the dev switch on /work and in a study.
 *
 * Usage: node scripts/verify-back-menu-switch.mjs [baseUrl]
 *
 * Clicks each option with the pointer, then hovers "← Work" and checks the DOM.
 * It also switches on the index before a study mounts, and proves the switch
 * still works when localStorage and history.replaceState are both blocked.
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

async function moveAway(page, width) {
  await page.mouse.move(width - 40, 320);
  await page.waitForTimeout(280);
}

async function hoverBack(page) {
  const link = page.locator(".wd-back-link");
  const box = await link.boundingBox();
  if (!box) throw new Error("back link has no box");

  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForTimeout(500);
}

async function openStudyFromIndex(page) {
  await page.waitForSelector(".wd-work-row");
  await page.waitForTimeout(1200);
  await page.locator(".wd-work-row").first().click();
  await page.waitForURL(/\/work\/[^/?]+/);
  await page.waitForSelector(".wd-reader-column");
  await page.waitForTimeout(850);
}

async function menuState(page) {
  return page.evaluate(() => {
    const roots = [...document.querySelectorAll(".bm-root")].map((root) => ({
      variant: root.getAttribute("data-bm-variant"),
      visible: getComputedStyle(root).visibility !== "hidden",
      expanded: root
        .querySelector(".wd-back-link")
        ?.getAttribute("aria-expanded"),
      panels: [...root.querySelectorAll(".bm-panel")].map((panel) => ({
        className: panel.className,
        open: panel.getAttribute("data-open"),
      })),
    }));
    const visibleRoots = roots.filter(
      (root) => root.visible && root.expanded === "true",
    );

    return {
      path: window.location.pathname,
      search: window.location.search,
      storage: window.localStorage.getItem("portfolio.back-menu"),
      pressed: [...document.querySelectorAll(".bm-dev-option")].map(
        (button) => ({
          name: button.textContent,
          pressed: button.getAttribute("aria-pressed") === "true",
        }),
      ),
      visibleRoots,
    };
  });
}

async function clickPill(page, variant) {
  const button = page.getByRole("button", { name: variant, exact: true });
  await button.click();
  await page.waitForTimeout(350);
}

async function assertVariant(page, variant, label, { storage = true } = {}) {
  const state = await menuState(page);
  const onlyOne = state.pressed.filter((option) => option.pressed);

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

  const roots = state.visibleRoots;
  expect(
    `${label}: one visible reader opened`,
    roots.length === 1,
    JSON.stringify(roots),
  );

  const root = roots[0];

  if (!root) return;

  expect(
    `${label}: the visible reader is ${variant}`,
    root.variant === variant,
    root.variant,
  );
  expect(
    `${label}: its ${variant} panel is open`,
    root.panels.some(
      (panel) =>
        panel.open === "true" && panel.className.includes(`bm-${variant}`),
    ),
    JSON.stringify(root.panels),
  );
  expect(
    `${label}: no other variant panel is open`,
    root.panels.every(
      (panel) =>
        panel.open !== "true" ||
        VARIANTS.filter((name) => name !== variant).every(
          (name) => !panel.className.includes(`bm-${name}`),
        ),
    ),
    JSON.stringify(root.panels),
  );
}

async function switchInReader(page, variant) {
  await moveAway(page, page.viewportSize().width);
  await clickPill(page, variant);
  await hoverBack(page);
  await assertVariant(page, variant, `reader ${variant}`);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(260);
}

async function runReaderFlow(page) {
  console.log("\n[reader] load ?bm=dropdown, open a study, click every option");
  await page.goto(`${BASE}/work?bm=dropdown`, {
    waitUntil: "domcontentloaded",
  });
  await openStudyFromIndex(page);

  for (const variant of VARIANTS) {
    await switchInReader(page, variant);
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
    const state = await menuState(page);
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
  }

  // Leave the last option (side) selected, then prove the reader mounts into it.
  await openStudyFromIndex(page);
  await hoverBack(page);
  await assertVariant(page, "side", "reader after index switch");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(260);
}

async function runBlockedPersistenceFlow(page) {
  console.log("\n[blocked persistence] replaceState and localStorage throw");
  await page.goto(`${BASE}/work?bm=dropdown`, {
    waitUntil: "domcontentloaded",
  });
  await openStudyFromIndex(page);
  await moveAway(page, page.viewportSize().width);

  await page.evaluate(() => {
    window.history.replaceState = () => {
      throw new Error("replaceState blocked");
    };
    Storage.prototype.setItem = () => {
      throw new Error("localStorage blocked");
    };
  });

  await clickPill(page, "inline");
  await hoverBack(page);
  await assertVariant(page, "inline", "blocked persistence", {
    storage: false,
  });
  await page.keyboard.press("Escape");
  await page.waitForTimeout(260);
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
