import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { expect, test } from "@playwright/test";
import type { Locator, Page, TestInfo } from "@playwright/test";
import { waitForFonts } from "./helpers";
import type { Phase } from "./helpers";

type ThemeCase = { name: "day" | "night"; tod: string; phase: Phase };

// The Figma/desktop card box both pages are built from (1440 frame).
const CARD_SIZE = { width: 753, height: 416 };

const THEMES: ReadonlyArray<ThemeCase> = [
  { name: "day", tod: "0.3334", phase: "day" },
  { name: "night", tod: "1", phase: "night" },
];

async function docsCard(page: Page): Promise<Locator> {
  const doc = page
    .locator("div.space-y-6")
    .filter({ has: page.getByRole("heading", { name: "Card", exact: true }) })
    .first();

  return doc.locator('[data-doc-preview] article.ring-host');
}

async function homeCard(page: Page): Promise<Locator> {
  return page.locator("article.ring-host").first();
}

/**
 * Compare the documented card with the live home card. The docs screenshot is
 * written as the live expected image and toHaveScreenshot then checks the home
 * card against it at the configured 0.2% tolerance. Rest and real :hover are
 * separate cases, so force-state.css cannot drift from ring-hover.css.
 */
async function compareCards(
  page: Page,
  testInfo: TestInfo,
  theme: ThemeCase,
  state: "rest" | "hover",
): Promise<void> {
  // The live site re-applies its clock phase; persist the same choice the real
  // theme control writes so the card is captured under a stable phase.
  await page.addInitScript(
    ({ mode, dayPhase }) => {
      window.localStorage.setItem("theme", mode);
      if (dayPhase) window.localStorage.setItem("theme-day-phase", dayPhase);
    },
    { mode: theme.name, dayPhase: theme.name === "day" ? "day" : null },
  );

  await page.goto(`/design-system?tod=${theme.tod}`);
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.getAttribute("data-phase")),
    )
    .toBe(theme.phase);
  await waitForFonts(page);

  const docs = await docsCard(page);

  await docs.scrollIntoViewIfNeeded();
  await docs.evaluate((element, size) => {
    (element as HTMLElement).style.width = `${size.width}px`;
    (element as HTMLElement).style.height = `${size.height}px`;
  }, CARD_SIZE);

  if (state === "hover") {
    await page
      .getByRole("group", { name: "Card sample state" })
      .getByRole("button", { name: "Hover" })
      .evaluate((element) => (element as HTMLElement).click());
    await expect(docs).toHaveAttribute("data-state", "hover");
  }

  const name = `card-${theme.name}-${state}.png`;

  await pinCard(page, docs);

  const docsShot = await page.screenshot({
    clip: { x: 0, y: 0, ...CARD_SIZE },
    animations: "disabled",
    caret: "hide",
  });

  const snapshotPath = testInfo.snapshotPath(name);

  mkdirSync(dirname(snapshotPath), { recursive: true });
  writeFileSync(snapshotPath, docsShot);

  await page.goto("/");
  await waitForFonts(page);
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.getAttribute("data-phase")),
    )
    .toBe(theme.phase);

  const home = await homeCard(page);

  await pinCard(page, home);
  await page.mouse.move(0, 0);

  if (state === "hover") {
    await home.hover({
      position: {
        x: CARD_SIZE.width / 2,
        y: CARD_SIZE.height / 2,
      },
    });
  }

  await expect(page).toHaveScreenshot(name, {
    clip: { x: 0, y: 0, ...CARD_SIZE },
    animations: "disabled",
    caret: "hide",
  });
}

/**
 * Move the card to a fixed 753x416 host at the viewport origin. The docs page
 * and home page put the same card at different fractional offsets; pinning both
 * removes that subpixel shift (and the different page backgrounds) from the
 * comparison, so the screenshot is about the card, not its surroundings.
 */
async function pinCard(page: Page, card: Locator): Promise<void> {
  await card.evaluate((element, size) => {
    const host = document.createElement("div");

    host.style.cssText = [
      "position:fixed",
      "left:0",
      "top:0",
      `width:${size.width}px`,
      `height:${size.height}px`,
      "z-index:2147483647",
      "background:var(--surface)",
    ].join(";");

    (element as HTMLElement).style.width = `${size.width}px`;
    (element as HTMLElement).style.height = `${size.height}px`;
    host.append(element);
    document.body.append(host);
  }, CARD_SIZE);

  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      }),
  );
}

for (const theme of THEMES) {
  test(`Card matches the home card at rest (${theme.name})`, async ({
    page,
  }, testInfo) => {
    await compareCards(page, testInfo, theme, "rest");
  });

  test(`Card matches the home card on real hover (${theme.name})`, async ({
    page,
  }, testInfo) => {
    await compareCards(page, testInfo, theme, "hover");
  });
}
