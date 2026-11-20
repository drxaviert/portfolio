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

const shell = read("drawer-shell.css");
const reader = read("reader.css");
const entrance = read("entrance.css");

function reducedMotionBlock(css: string) {
  const at = css.indexOf("@media (prefers-reduced-motion: reduce)");

  return at === -1 ? "" : css.slice(at);
}

describe("drawer motion values", () => {
  it("pins the backdrop and content fades by name", () => {
    expect(shell).toMatch(/--wd-backdrop-in: 320ms ease-out;/);
    expect(shell).toMatch(/--wd-backdrop-out: 240ms ease-in;/);
    expect(shell).toMatch(
      /--wd-content-out: 300ms cubic-bezier\(0\.22, 1, 0\.36, 1\);/,
    );

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

  it("blur-fades the scroll ruler as the content cascade's next beat", () => {
    // The ruler is a sibling of the scroll column, so the column's entrance
    // fade never covered it: it floated at opacity 1 over the whole morph and
    // the whole close. It now joins the content cascade, blurred and on its
    // clock, and leaves on the reader chrome's phase law.
    expect(reader).toMatch(
      /\.wd-reader-actions,\s*\.wd-ruler \{\s*--wd-actions-in: 240ms cubic-bezier\(0\.23, 1, 0\.32, 1\);\s*--wd-actions-out: 140ms ease-in;\s*--wd-actions-reduced: 120ms ease-out;/,
    );
    // 8px of its own: the article's 10px is for paragraphs, and Dat chose a
    // strength that visibly smears the ticks at the start.
    expect(reader).toMatch(/--wd-ruler-blur: 8px;/);
    // The next 80ms step after the last content block's 480ms beat.
    expect(reader).toMatch(/--wd-ruler-enter-delay: calc\(480ms \+ 80ms\);/);
    // In: held invisible until the content is released, then the content's own
    // duration and curve for the move and the defocus alike.
    expect(reader).toMatch(
      /\[data-reveal="pending"\] \.wd-ruler,\s*\.wd-expand-layer\[data-phase="closing"\] \.wd-ruler \{\s*opacity: 0;\s*filter: blur\(var\(--wd-ruler-blur\)\);\s*pointer-events: none;/,
    );
    expect(reader).toMatch(
      /\[data-reveal="on"\]:not\(\[data-phase="closing"\]\) \.wd-ruler \{\s*opacity: 1;\s*filter: none;\s*transition:\s*opacity var\(--wd-enter-duration\) var\(--wd-enter-blur-ease\),\s*filter var\(--wd-enter-duration\) var\(--wd-enter-blur-ease\);\s*transition-delay: var\(--wd-ruler-enter-delay\);/,
    );
    // Out: its own 160ms ease-out, not the thumbs' 140ms ease-in.
    expect(reader).toMatch(/--wd-ruler-out: 160ms ease-out;/);
    expect(reader).toMatch(
      /\[data-phase="closing"\] \.wd-ruler \{\s*transition:\s*opacity var\(--wd-ruler-out\),\s*filter var\(--wd-ruler-out\);/,
    );
    // Reduced motion: no blur in either state, an opacity-only fade, no delay.
    const reduced = reducedMotionBlock(reader);
    expect(reduced).toMatch(
      /\[data-reveal="pending"\] \.wd-ruler,\s*\.wd-expand-layer\[data-phase="closing"\] \.wd-ruler \{\s*filter: none;/,
    );
    expect(reduced).toMatch(
      /\[data-reveal="on"\]:not\(\[data-phase="closing"\]\) \.wd-ruler,\s*\.wd-expand-layer\[data-phase="closing"\] \.wd-ruler \{\s*transition: opacity var\(--wd-actions-reduced\);\s*transition-delay: 0s;/,
    );
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
    // The move and the defocus share the drawer's curve and 900ms (carousel-
    // step.ts); the beat below is what orders the cascade.
    expect(entrance).toMatch(
      /--wd-enter-ease: cubic-bezier\(0\.25, 0\.8, 0\.25, 1\);/,
    );
    expect(entrance).toMatch(
      /--wd-enter-blur-ease: cubic-bezier\(0\.25, 0\.8, 0\.25, 1\);/,
    );
    expect(entrance).toMatch(/--wd-enter-duration: 900ms;/);
    expect(entrance).toMatch(
      /@keyframes wd-enter-fade \{\s*from \{\s*opacity: 0;\s*transform: translateY\(10px\);\s*\}\s*to \{\s*opacity: 1;\s*transform: none;/,
    );
    expect(entrance).toMatch(
      /animation:\s*wd-enter-fade var\(--wd-enter-duration\) var\(--wd-enter-ease\)\s*backwards,\s*wd-enter-defocus var\(--wd-enter-duration\) var\(--wd-enter-blur-ease\)\s*backwards;/,
    );

    // One 80ms beat: cover 0, title 80, subtitle 160, meta 240, p1 320, p2 400,
    // p3+ 480.
    expect(entrance).toMatch(/\.wd-intro-title \{\s*--wd-enter-delay: 80ms;/);
    expect(entrance).toMatch(
      /\.wd-intro-subtitle \{\s*--wd-enter-delay: 160ms;/,
    );
    expect(entrance).toMatch(/\.wd-intro-meta \{\s*--wd-enter-delay: 240ms;/);
    expect(entrance).toMatch(
      /\.wd-prose > \*:nth-child\(1\) \{\s*--wd-enter-delay: 320ms;/,
    );
    expect(entrance).toMatch(
      /\.wd-prose > \*:nth-child\(2\) \{\s*--wd-enter-delay: 400ms;/,
    );
    expect(entrance).toMatch(
      /\.wd-prose > \*:nth-child\(n \+ 3\) \{\s*--wd-enter-delay: 480ms;/,
    );
    // Cover: the first beat, the same timing, no filter.
    expect(entrance).toMatch(
      /\.wd-expand-layer\[data-reveal="on"\] \.wd-hero \{\s*animation: wd-enter-fade var\(--wd-enter-duration\) var\(--wd-enter-ease\)\s*backwards;/,
    );
  });

  it("has no entrance switch left", () => {
    const entrance = read("entrance.css");

    expect(entrance).not.toContain("data-entrance");
    expect(entrance).not.toContain("wd-blur-in");
  });

  it("plays the study-to-study entrance from its first frame", () => {
    const entrance = read("entrance.css");

    // No head start: the incoming article takes the open's own beat whole.
    expect(entrance).not.toContain("--wd-beat-lead");
    expect(entrance).toMatch(
      /animation-delay:\s*var\(--wd-enter-delay, 0ms\),\s*var\(--wd-enter-delay, 0ms\);/,
    );
  });

  it("keeps the content swap as an opacity fade at the shell's own layer", () => {
    const index = read("work-index.css");

    // The index is held invisible while the panel travels, then fades once on
    // the drawer's reveal — no cascade, and no movement.
    expect(index).toMatch(
      /\[data-reveal="pending"\] \.wd-index-scroll \{\s*opacity: 0;\s*transition: none;/,
    );
    expect(index).toMatch(
      /\[data-reveal="on"\]:not\(\[data-phase="closing"\]\)\s*\.wd-index-scroll \{\s*opacity: 1;\s*transition: opacity 300ms cubic-bezier\(0\.23, 1, 0\.32, 1\);/,
    );
    // Reduced motion keeps the fade, at the drawer's 120ms.
    const reduced = reducedMotionBlock(index);
    expect(reduced).toContain("transition: opacity var(--wd-fade-reduced);");
  });

  it("runs the content entrance on the carousel's step", () => {
    // The carousel's step: 900ms on "quick" (carousel-settings.ts), for the move
    // and the defocus alike. Nothing else about the entrance changes: same
    // keyframes, same beat.
    expect(entrance).toMatch(
      /\.wd-reader-panel \{\s*\/\*[^*]*\*\/\s*--wd-enter-ease: cubic-bezier\(0\.25, 0\.8, 0\.25, 1\);\s*--wd-enter-blur-ease: cubic-bezier\(0\.25, 0\.8, 0\.25, 1\);\s*--wd-enter-duration: 900ms;/,
    );
    // The move is still the rise + defocus pair, not a motion of its own.
    expect(entrance).toMatch(
      /@keyframes wd-enter-fade \{\s*from \{\s*opacity: 0;\s*transform: translateY\(10px\);/,
    );
    expect(entrance).toContain("@keyframes wd-enter-defocus");
    expect(entrance).not.toContain("wd-enter-slide");
    expect(entrance).not.toContain("translateX");
    // No variant plumbing is left anywhere in the motion code.
    expect(entrance).not.toContain("data-motion");
  });

  it("leaves the reduced-motion entrance untouched", () => {
    const reduced = reducedMotionBlock(entrance);

    // The drawer only sets custom properties, so the reduced rules
    // (animation: none) still drop every per-block animation.
    expect(reduced).toMatch(
      /\.wd-expand-layer\[data-reveal="on"\]\s+:is\(\.wd-intro-title, \.wd-intro-subtitle, \.wd-intro-meta, \.wd-prose > \*\),\s*\.wd-expand-layer\[data-reveal="on"\] \.wd-hero \{\s*animation: none;/,
    );
    expect(reduced).not.toContain("--wd-enter-duration");
  });

  it("opens the dock's last-mode tooltip inward instead of into the viewport edge", () => {
    const dock = read("../nav/nav-dock.css");

    expect(dock).toMatch(
      /\.wd-nav-dock\[data-nav-state="reader"\] \.nav-tooltip \{[^}]*top: calc\(100% \+ 8px\);/,
    );
    expect(dock).toMatch(
      /\.wd-nav-dock\s+\[data-mode-track\]\s*\.segment:last-child\s*\.segment-tooltip \{[^}]*right: 0;/,
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
