import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(join(__dirname, "art-card.css"), "utf8");
const promotedRules = [
  ...css.matchAll(/([^{}]+)\{([^{}]*will-change:\s*transform[^{}]*)\}/g),
].map(([, selector]) => selector);

describe("shred layer promotion", () => {
  it.each([".art-card-canvas", ".shred-strip-track", ".shred-strip-segment"])(
    "keeps %s promoted in every non-idle phase, so the jam settles without a re-raster pop",
    (target) => {
      expect(
        promotedRules.some(
          (selector) =>
            selector.includes(target) &&
            selector.includes(':not([data-shred-phase="idle"])'),
        ),
      ).toBe(true);
    },
  );
});
