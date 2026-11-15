import { expect } from "@playwright/test";
import type { Page } from "@playwright/test";

export type Phase = "dawn" | "day" | "dusk" | "night";

/** Wait until the engine has written its first frame (and the phase, if given). */
export async function waitForEngine(page: Page, phase?: Phase): Promise<void> {
  await expect
    .poll(
      () =>
        page.evaluate(() => ({
          owned: document.documentElement.getAttribute("data-system-engine"),
          phase: document.documentElement.getAttribute("data-phase"),
        })),
      { timeout: 15_000 },
    )
    .toMatchObject({ owned: "true", ...(phase ? { phase } : {}) });
}

/** Force a phase on a page with no engine (the live site) and settle layout. */
export async function forcePhase(page: Page, phase: Phase): Promise<void> {
  await page.evaluate((next) => {
    const html = document.documentElement;

    html.setAttribute("data-phase", next);
    html.classList.toggle("dark", next === "night");
  }, phase);

  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      }),
  );
}

export async function waitForFonts(page: Page): Promise<void> {
  await page.evaluate(() => document.fonts.ready);
}

/**
 * Rewrite every colour literal in the token map to one sRGB form, using the
 * browser's own colour maths. This compares oklch/lab/hex/rgb sources without
 * reimplementing colour conversion in the test, and leaves non-colour text
 * (durations, percentages, shadows' lengths) untouched.
 */
export async function normaliseColours(
  page: Page,
  values: Record<string, string>,
): Promise<Record<string, string>> {
  return page.evaluate((entries) => {
    const probe = document.createElement("div");
    const supportsMix = CSS.supports(
      "color",
      "color-mix(in srgb, red 50%, blue)",
    );

    document.body.append(probe);

    const convert = (literal: string): string => {
      if (!supportsMix || !CSS.supports("color", literal)) return literal;

      probe.style.color = `color-mix(in srgb, ${literal} 100%, rgb(0 0 0))`;

      const computed = getComputedStyle(probe).color.trim();

      probe.style.color = "";

      const srgb = /^color\(srgb\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)(?:\s*\/\s*([\d.]+))?\)$/.exec(
        computed,
      );

      if (srgb) {
        return `srgb(${srgb[1]},${srgb[2]},${srgb[3]},${srgb[4] ?? 1})`;
      }

      const rgba = /^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:\s*[,/]\s*([\d.]+))?\s*\)$/.exec(
        computed,
      );

      if (rgba) {
        return `srgb(${Number(rgba[1]) / 255},${Number(rgba[2]) / 255},${Number(rgba[3]) / 255},${rgba[4] ?? 1})`;
      }

      return literal;
    };

    const colourLiteral =
      /#[0-9a-f]{3,8}\b|(?:rgba?|oklch|lab|lch|hsl|color)\([^)]*\)/gi;
    const out: Record<string, string> = {};

    for (const [name, value] of Object.entries(entries)) {
      out[name] = value.replace(colourLiteral, convert);
    }

    probe.remove();

    return out;
  }, values);
}

/** The visible desktop Hue slider. */
export function desktopHue(page: Page) {
  return page.locator('aside[aria-label="Controls"]').getByLabel("Hue");
}

/** Read the token values off :root, resolving var() chains (live site only). */
export async function readTokens(
  page: Page,
  names: string[],
): Promise<Record<string, string>> {
  return page.evaluate((list) => {
    const style = getComputedStyle(document.documentElement);
    const raw: Record<string, string> = {};

    for (const name of list) raw[name] = style.getPropertyValue(name).trim();

    const resolve = (value: string, depth = 0): string => {
      if (depth > 20) return value;

      return value.replace(
        /var\(\s*(--[\w-]+)\s*\)/g,
        (match, name: string) =>
          raw[name] ? resolve(raw[name], depth + 1) : match,
      );
    };

    const out: Record<string, string> = {};

    for (const name of list) out[name] = resolve(raw[name]);

    return out;
  }, names);
}

/**
 * The live site keeps re-applying its clock phase, so forcing data-phase and
 * reading in separate tasks races the theme. Set, flush and read in one task.
 */
export async function readTokensAtPhase(
  page: Page,
  names: string[],
  phase: Phase,
): Promise<Record<string, string>> {
  return page.evaluate(
    ({ list, next }) => {
      const html = document.documentElement;
      const previous = html.getAttribute("data-phase");
      const wasDark = html.classList.contains("dark");

      html.setAttribute("data-phase", next);
      html.classList.toggle("dark", next === "night");

      const style = getComputedStyle(html);
      const raw: Record<string, string> = {};

      for (const name of list) raw[name] = style.getPropertyValue(name).trim();

      const resolve = (value: string, depth = 0): string => {
        if (depth > 20) return value;

        return value.replace(
          /var\(\s*(--[\w-]+)\s*\)/g,
          (match, name: string) =>
            raw[name] ? resolve(raw[name], depth + 1) : match,
        );
      };

      const out: Record<string, string> = {};

      for (const name of list) out[name] = resolve(raw[name]);

      if (previous === null) html.removeAttribute("data-phase");
      else html.setAttribute("data-phase", previous);

      html.classList.toggle("dark", wasDark);

      return out;
    },
    { list: names, next: phase },
  );
}

export type DragResult = {
  frames: number;
  fps: number;
  longFrames: number;
  medianFrameMs: number;
  maxFrameMs: number;
};

/** Drive Hue to -180..180 over three seconds, one input event per rAF. */
export async function dragHue(page: Page): Promise<DragResult> {
  return page.evaluate(async () => {
    const slider = Array.from(
      document.querySelectorAll<HTMLInputElement>(
        'aside[aria-label="Controls"] input[type="range"]',
      ),
    ).find(
      (input) =>
        input.labels?.[0]?.textContent?.trim() === "Hue" &&
        input.offsetParent !== null,
    );

    if (!slider) throw new Error("Hue slider not found");

    const setter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )?.set;

    if (!setter) throw new Error("No value setter");

    const times: number[] = [];
    const start = performance.now();

    await new Promise<void>((resolve) => {
      const step = () => {
        const now = performance.now();
        const elapsed = now - start;

        if (elapsed >= 3000) {
          resolve();
          return;
        }

        setter.call(slider, String(Math.round(-180 + (360 * elapsed) / 3000)));
        slider.dispatchEvent(new Event("input", { bubbles: true }));
        times.push(now);
        requestAnimationFrame(step);
      };

      requestAnimationFrame(step);
    });

    const gaps: number[] = [];

    for (let index = 1; index < times.length; index += 1) {
      gaps.push(times[index] - times[index - 1]);
    }

    const sorted = [...gaps].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)] ?? 0;

    return {
      frames: times.length,
      fps: Number(((times.length - 1) / 3).toFixed(1)),
      longFrames: gaps.filter((gap) => gap > 25).length,
      medianFrameMs: Number(median.toFixed(2)),
      maxFrameMs: Number((sorted[sorted.length - 1] ?? 0).toFixed(2)),
    };
  });
}
