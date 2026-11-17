import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");
const globals = read("src/app/globals.css");

/** The declaration block of the file's forced-colors media query. */
function forcedColorsBlock(css: string): string {
  return css.match(/@media \(forced-colors: active\) \{([\s\S]*?)\r?\n\}/)?.[1] ?? "";
}

describe("global interaction rules", () => {
  it("drops the double-tap-zoom wait on every control", () => {
    // iOS Safari holds the first tap ~300ms without this. :where() keeps the
    // rule at zero specificity, so no component loses its own touch behaviour.
    expect(globals).toMatch(
      /:where\(a, button, input, select, textarea, label, \[role="button"\]\) \{\s*touch-action: manipulation;/,
    );
  });

  it("gives shadow-only surfaces an edge in forced colours", () => {
    // Windows High Contrast drops box-shadow. Cards and menus are shadow-only
    // by rule (no stroke), so each owner restores a CanvasText edge inside an
    // @media (forced-colors: active) block: no effect in normal rendering.
    const shadowCard = forcedColorsBlock(globals);
    expect(shadowCard).toContain(".shadow-card");
    expect(shadowCard).toMatch(/border: 1px solid CanvasText/);

    const ring = forcedColorsBlock(read("src/components/home/ring-hover.css"));
    expect(ring).toContain(".ring-host");
    expect(ring).toMatch(/border: 1px solid CanvasText/);

    const reader = forcedColorsBlock(read("src/components/work/reader.css"));
    for (const selector of [
      ".wd-reader-panel",
      ".wd-reader-action",
      ".wd-step-tab",
      ".wd-step-replay",
    ]) {
      expect(reader).toContain(selector);
    }
    expect(reader).toMatch(/border: 1px solid CanvasText/);

    const ruler = forcedColorsBlock(read("src/components/work/scroll-ruler.css"));
    expect(ruler).toContain(".wd-ruler-card-inner");
    expect(ruler).toMatch(/border: 1px solid CanvasText/);
  });
});
