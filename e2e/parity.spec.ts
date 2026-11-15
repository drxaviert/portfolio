import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { parseColor } from "../src/lib/system/color";
import type { Rgba } from "../src/lib/system/color";
import {
  DURATIONS,
  PALETTE,
  RADII,
  ROLES,
} from "../src/lib/system/source.generated";
import {
  normaliseColours,
  readTokens,
  readTokensAtPhase,
  waitForEngine,
  waitForFonts,
} from "./helpers";
import type { Phase } from "./helpers";

const PHASE_CASES: ReadonlyArray<{ tod: string; phase: Phase }> = [
  { tod: "0", phase: "dawn" },
  { tod: "0.333334", phase: "day" },
  { tod: "0.6666667", phase: "dusk" },
  { tod: "1", phase: "night" },
];

const TOKEN_NAMES = [
  ...new Set([
    ...Object.keys(PALETTE),
    ...Object.keys(ROLES.day),
    ...Object.keys(RADII),
    ...Object.keys(DURATIONS),
  ]),
];

/**
 * Tokens declared on an entrance/home element rather than :root. The engine
 * writes them on the design-system page because it derives every duration, but
 * the live site scopes them to the entrance subtree; comparing them at :root
 * would compare a value with nothing. Their own component still owns parity.
 */
const HOME_SCOPED_PREFIXES = [
  "--scale-",
  "--ring-",
  "--grow-",
  "--breath-",
  "--mist-",
  "--dawn-",
  "--soft-",
  "--entrance-",
  "--clear-",
  "--step-",
  "--grain-",
  "--sky-",
  "--rise-",
];

const COLOUR_LITERAL =
  /#[0-9a-f]{3,8}\b|(?:rgba?|srgb|oklch|lab|lch|hsl|color)\([^)]*\)/gi;

type Part =
  | { kind: "colour"; value: Rgba }
  | { kind: "text"; value: string };

function parseColour(value: string): Rgba | null {
  const srgb =
    /^srgb\((-?[\d.]+),(-?[\d.]+),(-?[\d.]+),(-?[\d.]+)\)$/.exec(value);

  if (srgb) {
    return {
      r: Number(srgb[1]) * 255,
      g: Number(srgb[2]) * 255,
      b: Number(srgb[3]) * 255,
      a: Number(srgb[4]),
    };
  }

  try {
    return parseColor(value.trim());
  } catch {
    return null;
  }
}

function normalizedText(value: string): string {
  return value
    .replace(/(^|[^\d.])\.(\d+)/g, (_, prefix, digits) => `${prefix}0.${digits}`)
    .replace(/\s+/g, " ")
    .replace(/\s*([(),])\s*/g, "$1")
    .trim();
}

function splitColours(value: string): Part[] {
  const parts: Part[] = [];
  const pattern = new RegExp(COLOUR_LITERAL.source, "gi");
  let last = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(value)) !== null) {
    const colour = parseColour(match[0]);

    if (!colour) continue;

    if (match.index > last) {
      parts.push({
        kind: "text",
        value: normalizedText(value.slice(last, match.index)),
      });
    }

    parts.push({ kind: "colour", value: colour });
    last = match.index + match[0].length;
  }

  if (last < value.length) {
    parts.push({ kind: "text", value: normalizedText(value.slice(last)) });
  }

  return parts;
}

function expectSameColour(name: string, expected: Rgba, actual: Rgba): void {
  expect
    .soft(Math.abs(expected.r - actual.r), `${name} red`)
    .toBeLessThanOrEqual(1);
  expect
    .soft(Math.abs(expected.g - actual.g), `${name} green`)
    .toBeLessThanOrEqual(1);
  expect
    .soft(Math.abs(expected.b - actual.b), `${name} blue`)
    .toBeLessThanOrEqual(1);
  expect
    .soft(Math.abs(expected.a - actual.a), `${name} alpha`)
    .toBeLessThanOrEqual(0.01);
}

function expectSameToken(name: string, live: string, docs: string): void {
  const liveColour = parseColour(live);
  const docsColour = parseColour(docs);

  if (liveColour && docsColour) {
    expectSameColour(name, liveColour, docsColour);

    return;
  }

  const rem = /^(-?\d*\.?\d+)rem$/.exec(live);

  if (rem) {
    expect(docs, `${name} rem`).toBe(`${Number(rem[1]) * 16}px`);

    return;
  }

  const liveDuration = /^(-?\d*\.?\d+)(ms|s)$/.exec(live);
  const docsDuration = /^(-?\d*\.?\d+)(ms|s)$/.exec(docs);

  if (liveDuration && docsDuration) {
    const toMs = (match: RegExpExecArray) =>
      Number(match[1]) * (match[2] === "s" ? 1000 : 1);

    expect(toMs(docsDuration), `${name} duration`).toBeCloseTo(
      toMs(liveDuration),
      3,
    );

    return;
  }

  const liveNumber = /^(-?\d*\.?\d+)(%|px)?$/.exec(live);
  const docsNumber = /^(-?\d*\.?\d+)(%|px)?$/.exec(docs);

  if (liveNumber && docsNumber && (liveNumber[2] ?? "") === (docsNumber[2] ?? "")) {
    expect(Number(docsNumber[1]), `${name} value`).toBeCloseTo(
      Number(liveNumber[1]),
      3,
    );

    return;
  }

  const liveParts = splitColours(live);
  const docsParts = splitColours(docs);

  expect(docsParts.length, `${name} colour parts`).toBe(liveParts.length);

  for (let index = 0; index < liveParts.length; index += 1) {
    const expected = liveParts[index];
    const actual = docsParts[index];

    if (expected.kind === "colour" && actual.kind === "colour") {
      expectSameColour(`${name}[${index}]`, expected.value, actual.value);
    } else {
      expect(actual, `${name}[${index}]`).toEqual(expected);
    }
  }
}

for (const { tod, phase } of PHASE_CASES) {
  test(`tokens at defaults equal globals.css (${phase})`, async ({ page }, testInfo) => {
    await page.goto("/");
    await waitForFonts(page);

    const live = await normaliseColours(
      page,
      await readTokensAtPhase(page, TOKEN_NAMES, phase),
    );

    await page.goto(`/design-system?tod=${tod}`);
    await waitForEngine(page, phase);
    await page.evaluate(
      () =>
        new Promise<void>((resolve) => {
          requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
        }),
    );

    const docs = await normaliseColours(
      page,
      await readTokens(page, TOKEN_NAMES),
    );
    let skipped = 0;

    for (const name of TOKEN_NAMES) {
      if (!live[name]) {
        // A root value that does not exist on the live site is a home-scoped
        // entrance token, not a globals.css default.
        expect(
          HOME_SCOPED_PREFIXES.some((prefix) => name.startsWith(prefix)),
          `${name} has no live :root value`,
        ).toBe(true);
        skipped += 1;
        continue;
      }

      expectSameToken(name, live[name], docs[name]);
    }

    testInfo.annotations.push({
      type: "root-scoped-tokens",
      description: `${TOKEN_NAMES.length - skipped} compared, ${skipped} home-scoped`,
    });
  });
}

const SNAPSHOT_PROPS = [
  "color",
  "backgroundColor",
  "borderTopColor",
  "boxShadow",
  "fontFamily",
  "fontSize",
  "fontWeight",
  "lineHeight",
  "letterSpacing",
  "borderRadius",
] as const;

type ElementSnapshot = {
  tag: string;
  className: string;
  width: number;
  height: number;
  styles: string[];
};

async function snapshotHome(page: Page): Promise<ElementSnapshot[]> {
  return page.evaluate((props) => {
    const elements = Array.from(document.querySelectorAll("main *")).filter(
      (element) => {
        const rect = element.getBoundingClientRect();

        return rect.width > 0 && rect.height > 0;
      },
    );

    return elements.slice(0, 20).map((element) => {
      const style = getComputedStyle(element);

      return {
        tag: element.tagName,
        className:
          typeof element.className === "string" ? element.className : "",
        width: (element as HTMLElement).offsetWidth,
        height: (element as HTMLElement).offsetHeight,
        styles: props.map((prop) => style.getPropertyValue(prop)),
      };
    });
  }, SNAPSHOT_PROPS);
}

test("home unaffected: client navigation clears engine vars and restores the site", async ({
  page,
}) => {
  await page.goto("/");
  await waitForFonts(page);
  await page.waitForFunction(
    () => document.documentElement.dataset.entrancePlayed === "true",
    undefined,
    { timeout: 5_000 },
  );

  const phase = (await page.evaluate(
    () => document.documentElement.getAttribute("data-phase") ?? "day",
  )) as Phase;
  const before = await snapshotHome(page);
  const styleBefore = await page.evaluate(
    () => document.documentElement.getAttribute("style"),
  );

  await page.goto("/design-system");
  await waitForEngine(page);

  // A client-side return must unmount the engine, not reload the document.
  await page.evaluate(() => {
    (window as unknown as { __clientNavMarker?: string }).__clientNavMarker =
      "kept";
  });
  await page.getByTestId("portfolio-home").click();
  await expect(page).toHaveURL("/");
  await expect
    .poll(
      () =>
        page.evaluate(
          () =>
            (window as unknown as { __clientNavMarker?: string })
              .__clientNavMarker,
        ),
      { message: "expected a client navigation, not a reload" },
    )
    .toBe("kept");
  await waitForFonts(page);
  await expect
    .poll(
      () =>
        page.evaluate(() =>
          document.documentElement.hasAttribute("data-system-engine"),
        ),
      { timeout: 5_000 },
    )
    .toBe(false);

  const after = await snapshotHome(page);
  const phaseAfter = await page.evaluate(
    () => document.documentElement.getAttribute("data-phase") ?? "day",
  );
  const styleAfter = await page.evaluate(
    () => document.documentElement.getAttribute("style"),
  );
  const leaked = await page.evaluate((roleNames) => {
    const inline = Array.from(document.documentElement.style);

    return inline.filter(
      (name) => name.startsWith("--palette-") || roleNames.includes(name),
    );
  }, Object.keys(ROLES.day));

  expect(phaseAfter).toBe(phase);
  expect(styleAfter).toBe(styleBefore);
  expect(leaked).toEqual([]);
  expect(after).toEqual(before);
});
