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
    /\.wd-expand-layer\[data-reveal="on"\] \.wd-hero \{[^}]*animation-delay: (?:calc\()?(\d+)ms/,
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

  it("runs the defocus on the drawer's curve, through its own token", () => {
    // One curve for the whole entrance now (carousel-step.ts, 900ms quick); the
    // blur keeps its own token so a retune could still split it.
    expect(css).toMatch(
      /--wd-enter-blur-ease: cubic-bezier\(0\.25, 0\.8, 0\.25, 1\);/,
    );

    expect(textRule()).toMatch(
      /wd-enter-fade var\(--wd-enter-duration\) var\(--wd-enter-ease\)\s*backwards/,
    );
    expect(textRule()).toMatch(
      /wd-enter-defocus var\(--wd-enter-duration\) var\(--wd-enter-blur-ease\)\s*backwards/,
    );
  });

  it("starts the blur at the panel's defocus strength and resolves it to none", () => {
    // One value for the content and the scroll ruler (reader.css scales it).
    expect(css).toMatch(/--wd-defocus-blur: 10px;/);
    expect(css).toMatch(
      /@keyframes wd-enter-defocus \{\s*from \{\s*filter: blur\(var\(--wd-defocus-blur, 10px\)\);\s*\}\s*to \{\s*filter: none;/,
    );
  });

  it("holds the blur on the same beat as the fade", () => {
    expect(textRule()).toMatch(
      /animation-delay:\s*var\(--wd-enter-delay, 0ms\),\s*var\(--wd-enter-delay, 0ms\);/,
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

  it("keeps the full fade and defocus, fading from 0.01 so it counts for LCP", () => {
    // One of the first two paragraphs is the largest text above the fold on a
    // direct load. Chrome ignores opacity 0, so the fade starts at 1%: unseen,
    // but painted at first paint. The blur must still play (it was dropped).
    expect(css).toMatch(
      /@keyframes wd-enter-fade-lcp \{\s*from \{\s*opacity: 0\.01;\s*transform: translateY\(10px\);/,
    );

    const rule = firstParagraphRule();
    expect(rule).toContain("wd-enter-fade-lcp");
    expect(rule).toContain("wd-enter-defocus");
    // Beat and curves come from the shared rule; only the name changes.
    expect(rule).not.toMatch(/animation:/);
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
