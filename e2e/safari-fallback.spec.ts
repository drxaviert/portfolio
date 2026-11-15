import { expect, test } from "@playwright/test";
import { waitForEngine, waitForFonts } from "./helpers";

test("WebKit keeps the CSS horizon and has no WebGL canvas", async ({
  page,
  browserName,
}) => {
  test.skip(browserName !== "webkit", "the CSS fallback is the WebKit path");

  await page.goto("/design-system?tod=0.5");
  await waitForEngine(page);
  await waitForFonts(page);

  await expect(page.locator(".horizon-canvas-layer")).toHaveCount(0, {
    timeout: 15_000,
  });
  await expect(page.locator("canvas.horizon-night-scope")).toHaveCount(0);

  const cssHorizon = page.locator(".horizon-night-scope").first();

  await expect(cssHorizon).toBeVisible();

  const backdrop = page.locator(".horizon-night-scope > div").first();
  const before = await backdrop.evaluate(
    (element) => getComputedStyle(element).backgroundImage,
  );

  await page
    .locator('aside[aria-label="Controls"]')
    .getByLabel("Time of day")
    .focus();
  await page.keyboard.press("End");

  await expect
    .poll(
      () =>
        page.evaluate(
          () => document.documentElement.getAttribute("data-phase"),
        ),
      { message: "tod should reach the night stop" },
    )
    .toBe("night");

  await expect
    .poll(
      () =>
        backdrop.evaluate(
          (element) => getComputedStyle(element).backgroundImage,
        ),
      { message: "the CSS horizon should follow tod" },
    )
    .not.toBe(before);
});
