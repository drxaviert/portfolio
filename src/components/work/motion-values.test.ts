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

  it("runs the blur reveal on one even beat, in reading order", () => {
    const entrance = read("entrance.css");

    // The move and its curve.
    expect(entrance).toMatch(
      /--wd-enter-ease: cubic-bezier\(0\.22, 1, 0\.36, 1\);/,
    );
    expect(entrance).toMatch(/--wd-enter-duration: 800ms;/);
    expect(entrance).toMatch(
      /@keyframes wd-enter-blur \{\s*from \{\s*opacity: 0;\s*filter: blur\(8px\);\s*transform: translateY\(10px\);/,
    );
    expect(entrance).toMatch(
      /animation: wd-enter-blur var\(--wd-enter-duration\) var\(--wd-enter-ease\)\s*backwards;/,
    );

    // One 80ms beat: title 0, subtitle 80, meta 160, cover 240, p1 320, p2 400,
    // p3+ 480.
    expect(entrance).toMatch(/\.wd-intro-title \{\s*--wd-enter-delay: 0ms;/);
    expect(entrance).toMatch(
      /\.wd-intro-subtitle \{\s*--wd-enter-delay: 80ms;/,
    );
    expect(entrance).toMatch(/\.wd-intro-meta \{\s*--wd-enter-delay: 160ms;/);
    expect(entrance).toMatch(
      /\.wd-prose > \*:nth-child\(1\) \{\s*--wd-enter-delay: 320ms;/,
    );
    expect(entrance).toMatch(
      /\.wd-prose > \*:nth-child\(2\) \{\s*--wd-enter-delay: 400ms;/,
    );
    expect(entrance).toMatch(
      /\.wd-prose > \*:nth-child\(n \+ 3\) \{\s*--wd-enter-delay: 480ms;/,
    );
    // Cover: the same timing, no filter.
    expect(entrance).toMatch(
      /\.wd-expand-layer\[data-reveal="on"\] \.wd-hero \{\s*animation: wd-enter-rise var\(--wd-enter-duration\) var\(--wd-enter-ease\)\s*backwards;\s*animation-delay: calc\(240ms \+ var\(--wd-beat-lead, 0ms\)\);/,
    );
  });

  it("has no entrance switch left", () => {
    const entrance = read("entrance.css");

    expect(entrance).not.toContain("data-entrance");
    expect(entrance).not.toContain("wd-blur-in");
  });

  it("starts a study-to-study entrance part-way in, on the same beat", () => {
    const entrance = read("entrance.css");

    // The lead rides on top of the beat; the beat itself is untouched.
    expect(entrance).toMatch(
      /animation-delay: calc\(\s*var\(--wd-enter-delay, 0ms\) \+ var\(--wd-beat-lead, 0ms\)\s*\);/,
    );
    expect(entrance).toContain(
      "animation-delay: calc(240ms + var(--wd-beat-lead, 0ms));",
    );
  });

  it("does not fade the incoming column in again after a hand-off", () => {
    const reduced = reducedMotionBlock(read("entrance.css"));

    expect(reduced).toMatch(
      /\.wd-reader-panel\[data-progression="lead"\] \.wd-reader-scroll \{\s*opacity: 1;\s*transition: none;/,
    );
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
