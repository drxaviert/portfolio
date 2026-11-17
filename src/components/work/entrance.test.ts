import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(
  join(process.cwd(), "src", "components", "work", "entrance.css"),
  "utf8",
);

/** A block's own `--wd-enter-delay`, in ms. */
function blockDelay(selector: string): number {
  const rule = css.match(
    new RegExp(
      `${selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} \\{\\s*--wd-enter-delay: (\\d+)ms`,
    ),
  );

  expect(rule, selector).not.toBeNull();

  return Number(rule![1]);
}

/** The hero's animation-delay, in ms, off the reveal rule. */
function heroDelay(): number {
  const rule = css.match(
    /\.wd-expand-layer\[data-reveal="on"\] \.wd-hero \{[^}]*animation-delay: calc\((\d+)ms/,
  );

  expect(rule).not.toBeNull();

  return Number(rule![1]);
}

describe("entrance cascade", () => {
  it("starts with the cover, then title, meta and body on even 80ms beats", () => {
    const beat = [
      heroDelay(),
      blockDelay(".wd-intro-title"),
      blockDelay(".wd-intro-subtitle"),
      blockDelay(".wd-intro-meta"),
      blockDelay(".wd-prose > *:nth-child(1)"),
      blockDelay(".wd-prose > *:nth-child(2)"),
      blockDelay(".wd-prose > *:nth-child(n + 3)"),
    ];

    expect(beat).toEqual([0, 80, 160, 240, 320, 400, 480]);
  });

  it("never lets the text overtake the cover", () => {
    expect(heroDelay()).toBeLessThanOrEqual(blockDelay(".wd-intro-title"));
    expect(heroDelay()).toBeLessThan(blockDelay(".wd-intro-subtitle"));
  });
});

describe("blur timing", () => {
  /** The text rule's declaration block, off the reveal selector. */
  function textRule(): string {
    const rule = css.match(
      /\.wd-expand-layer\[data-reveal="on"\]\s+:is\(\.wd-intro-title[^{]*\{[^}]*\}/,
    );

    expect(rule).not.toBeNull();

    return rule![0];
  }

  it("gives the defocus its own slower curve, apart from the fade", () => {
    expect(css).toMatch(
      /--wd-enter-blur-ease: cubic-bezier\(0\.25, 0\.1, 0\.25, 1\);/,
    );

    // Opacity and the rise keep the pinned curve; only the blur moves.
    expect(textRule()).toMatch(
      /wd-enter-fade var\(--wd-enter-duration\) var\(--wd-enter-ease\)\s*backwards/,
    );
    expect(textRule()).toMatch(
      /wd-enter-defocus var\(--wd-enter-duration\) var\(--wd-enter-blur-ease\)\s*backwards/,
    );
  });

  it("starts the blur at 10px and resolves it to none", () => {
    expect(css).toMatch(
      /@keyframes wd-enter-defocus \{\s*from \{\s*filter: blur\(10px\);\s*\}\s*to \{\s*filter: none;/,
    );
  });

  it("holds the blur on the same beat as the fade", () => {
    expect(textRule()).toMatch(
      /animation-delay:\s*calc\(\s*var\(--wd-enter-delay, 0ms\) \+ var\(--wd-beat-lead, 0ms\)\s*\),\s*calc\(\s*var\(--wd-enter-delay, 0ms\) \+ var\(--wd-beat-lead, 0ms\)\s*\);/,
    );
  });
});

describe("LCP block", () => {
  /** The first two paragraphs' own rule. */
  function firstParagraphRule(): string {
    const rule = css.match(
      /\.wd-expand-layer\[data-reveal="on"\] \.wd-prose > \.wd-p:nth-of-type\(-n \+ 2\) \{[^}]*\}/,
    )?.[0];

    expect(rule).toBeTruthy();

    return rule!;
  }

  it("rises without the fade or the defocus", () => {
    // One of the first two paragraphs is the largest text above the fold on a
    // direct load, so one of them is the LCP element: it must be painted at
    // first paint, whichever the study's opening makes largest.
    expect(css).toMatch(
      /@keyframes wd-enter-rise \{\s*from \{\s*transform: translateY\(10px\);\s*\}\s*to \{\s*transform: none;/,
    );

    const rule = firstParagraphRule();
    expect(rule).toContain("wd-enter-rise");
    expect(rule).not.toContain("wd-enter-fade");
    expect(rule).not.toContain("wd-enter-defocus");
    // It keeps its own beat on the shared clock.
    expect(rule).toContain("var(--wd-enter-delay");
    expect(rule).toContain("var(--wd-beat-lead");
  });

  it("drops the rise under reduced motion", () => {
    const reduced =
      css.match(
        /@media \(prefers-reduced-motion: reduce\) \{([\s\S]*)$/,
      )?.[1] ?? "";

    expect(reduced).toMatch(
      /\.wd-expand-layer\[data-reveal="on"\] \.wd-prose > \.wd-p:nth-of-type\(-n \+ 2\) \{\s*animation: none;/,
    );
  });
});
