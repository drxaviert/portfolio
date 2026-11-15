import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const globals = readFileSync(
  join(process.cwd(), "src", "app", "globals.css"),
  "utf8",
);

describe("global interaction rules", () => {
  it("drops the double-tap-zoom wait on every control", () => {
    // iOS Safari holds the first tap ~300ms without this. :where() keeps the
    // rule at zero specificity, so no component loses its own touch behaviour.
    expect(globals).toMatch(
      /:where\(a, button, input, select, textarea, label, \[role="button"\]\) \{\s*touch-action: manipulation;/,
    );
  });
});
