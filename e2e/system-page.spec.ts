import { expect, test } from "@playwright/test";
import {
  desktopHue,
  dragHue,
  waitForEngine,
  waitForFonts,
} from "./helpers";

function parseDuration(value: string): number {
  const match = /^(-?[\d.]+)(ms|s)$/.exec(value.trim());

  if (!match) throw new Error(`Not a duration: ${value}`);

  return Number(match[1]) * (match[2] === "s" ? 1000 : 1);
}

async function durationToken(page: import("@playwright/test").Page) {
  return page.evaluate(() =>
    getComputedStyle(document.documentElement)
      .getPropertyValue("--duration-medium-5")
      .trim(),
  );
}

test("keyboard hue steps change --primary", async ({ page }) => {
  await page.goto("/design-system");
  await waitForEngine(page);

  const slider = desktopHue(page);

  await slider.focus();

  const before = await page.evaluate(() =>
    getComputedStyle(document.documentElement)
      .getPropertyValue("--primary")
      .trim(),
  );

  await page.keyboard.press("ArrowRight");

  await expect
    .poll(
      () =>
        page.evaluate(() =>
          getComputedStyle(document.documentElement)
            .getPropertyValue("--primary")
            .trim(),
        ),
      { message: "hue should move --primary" },
    )
    .not.toBe(before);
});

test("invalid URL parameters load without console errors", async ({ page }) => {
  const errors: string[] = [];

  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });

  await page.goto("/design-system?hue=abc&round=NaN");
  await waitForEngine(page);
  await waitForFonts(page);

  expect(errors).toEqual([]);
});

test("speed=2 halves a duration token", async ({ page }) => {
  await page.goto("/design-system");
  await waitForEngine(page);
  const normal = parseDuration(await durationToken(page));

  await page.goto("/design-system?speed=2");
  await waitForEngine(page);
  const fast = parseDuration(await durationToken(page));

  expect(normal / fast).toBeCloseTo(2, 3);
});

test("phone viewport shows the controls sheet handle and section dropdown", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/design-system");
  await waitForEngine(page);

  await expect(page.getByRole("button", { name: "Controls" })).toBeVisible();
  await expect(page.locator('select[aria-label="Sections"]')).toBeVisible();
});

test("reduced motion keeps durations at speed 1", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/design-system");
  await waitForEngine(page);
  const normal = parseDuration(await durationToken(page));

  await page.goto("/design-system?speed=2");
  await waitForEngine(page);
  const reduced = parseDuration(await durationToken(page));

  expect(reduced).toBe(normal);
});

test("theme toggle sample leaves storage and site phase attributes untouched", async ({
  page,
}) => {
  await page.goto("/design-system");
  await waitForEngine(page);

  const sample = page.locator('[data-doc-preview] [data-theme-toggle]');

  await sample.scrollIntoViewIfNeeded();

  const before = await page.evaluate(() => ({
    theme: window.localStorage.getItem("theme"),
    mode: document.documentElement.dataset.mode ?? null,
    dayPhase: document.documentElement.dataset.dayPhase ?? null,
  }));

  const theme = sample.getByRole("radiogroup", { name: "Theme" });

  const click = async (locator: import("@playwright/test").Locator) => {
    await locator.evaluate((element) => (element as HTMLElement).click());
  };

  await click(theme.getByRole("radio", { name: "Night", exact: true }));
  await click(theme.getByRole("radio", { name: "Day", exact: true }));
  await click(
    sample
      .getByRole("radiogroup", { name: "Day phase" })
      .getByRole("radio", { name: "Dusk", exact: true }),
  );
  await click(theme.getByRole("radio", { name: "Auto", exact: true }));

  const after = await page.evaluate(() => ({
    theme: window.localStorage.getItem("theme"),
    mode: document.documentElement.dataset.mode ?? null,
    dayPhase: document.documentElement.dataset.dayPhase ?? null,
  }));

  expect(after).toEqual(before);
});

test("hue drag stays inside the frame budget at the top and colour", async ({
  page,
  browserName,
}) => {
  test.skip(browserName !== "chromium", "perf budget is measured in Chromium");
  test.slow();

  await page.goto("/design-system?tod=0.5");
  await waitForEngine(page);
  await waitForFonts(page);

  const renderer = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl");
    const info = gl?.getExtension("WEBGL_debug_renderer_info");

    return info && gl
      ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL)
      : "webgl unavailable";
  });

  console.log("webgl renderer", renderer);

  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(500);

  const top = await dragHue(page);

  await page.evaluate(() => {
    document.getElementById("colour")?.scrollIntoView();
  });
  await page.waitForTimeout(800);

  const colour = await dragHue(page);

  console.log("hue drag perf", JSON.stringify({ top, colour }));

  expect(top.fps, `top FPS ${JSON.stringify(top)}`).toBeGreaterThanOrEqual(55);
  expect(top.longFrames, `top long frames ${JSON.stringify(top)}`).toBeLessThan(
    5,
  );
  expect(colour.fps, `colour FPS ${JSON.stringify(colour)}`).toBeGreaterThanOrEqual(
    55,
  );
  expect(
    colour.longFrames,
    `colour long frames ${JSON.stringify(colour)}`,
  ).toBeLessThan(5);
});
