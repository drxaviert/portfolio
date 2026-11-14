import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The drawer's motion law, asserted where CSS is the only implementation:
 * entrances use the entrance curve, exits use ease-in, and reduced motion is
 * opacity only, 120ms ease-out. A reduced override must restate the whole
 * transition, or a base shorthand keeps its own easing (T8 F1).
 */
function read(name: string) {
  return readFileSync(
    join(process.cwd(), "src", "components", "work", name),
    "utf8",
  );
}

const shell = read("expand-shell.css");
const reader = read("reader.css");

function reducedMotionBlock(css: string) {
  const at = css.indexOf("@media (prefers-reduced-motion: reduce)");

  return at === -1 ? "" : css.slice(at);
}

describe("drawer motion values", () => {
  it("pins the backdrop and content fades by name", () => {
    expect(shell).toMatch(/--wd-backdrop-in: 320ms ease-out;/);
    expect(shell).toMatch(/--wd-backdrop-out: 240ms ease-in;/);
    expect(shell).toMatch(
      /--wd-content-in: 240ms cubic-bezier\(0\.23, 1, 0\.32, 1\);/,
    );
    expect(shell).toMatch(/--wd-content-out: 140ms ease-in;/);

    expect(shell).toContain(
      "animation: wd-backdrop-in var(--wd-backdrop-in) both;",
    );
    expect(shell).toContain(
      "animation: wd-backdrop-out var(--wd-backdrop-out) both;",
    );
    expect(shell).toContain("transition: opacity var(--wd-content-out);");
  });

  it("gives the thumb pair the same 140ms ease-in exit", () => {
    expect(reader).toMatch(/--wd-actions-out: 140ms ease-in;/);
    expect(reader).toContain("transition: opacity var(--wd-actions-out);");
  });

  it("restates the whole transition under reduced motion", () => {
    const reduced = reducedMotionBlock(shell);

    expect(shell).toMatch(/--wd-fade-reduced: 120ms ease-out;/);
    expect(reduced).toContain("transition: opacity var(--wd-fade-reduced);");
    expect(reduced).not.toContain("transition-duration");
    expect(reduced).toContain(
      "animation: wd-backdrop-out var(--wd-fade-reduced) both;",
    );
  });

  it("keeps the reduced thumb-pair close at 120ms ease-out", () => {
    const reduced = reducedMotionBlock(reader);

    expect(reader).toMatch(/--wd-actions-reduced: 120ms ease-out;/);
    expect(reduced).toContain("transition: opacity var(--wd-actions-reduced);");
    expect(reduced).not.toContain("transition-duration");
  });

  it("opens the reader's nav tooltips inward instead of into the viewport edge", () => {
    const dock = read("../nav/nav-dock.css");

    expect(dock).toMatch(
      /\.wd-nav-dock\[data-nav-state="reader"\] \.nav-tooltip \{[^}]*top: calc\(100% \+ 8px\);/,
    );
    expect(dock).toMatch(
      /\[data-nav-state="reader"\]\s*\[data-mode-track\]\s*\.segment:last-child\s*\.segment-tooltip \{[^}]*right: 0;/,
    );
  });

  it("keeps the UA focus ring off the programmatically focused title only", () => {
    expect(reader).toMatch(
      /\.wd-expand-layer \.wd-intro-title:focus \{\s*outline: none;/,
    );
    // Nothing else loses a ring: the interactive controls keep theirs.
    expect(reader).toContain(".wd-reader-action:focus-visible {");
    expect(reader).toContain(".wd-rail-top:focus-visible");
  });
});
