import { render } from "@testing-library/react";
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HomeEntrancePlayed, SHIPPED_ENTRANCE_TOTAL_MS } from "./home-entrance";

const css = readFileSync(
  path.join(process.cwd(), "src/components/home/home-entrance.css"),
  "utf8",
);

describe("shipped home entrance", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    delete document.documentElement.dataset.entrancePlayed;
    delete document.documentElement.dataset.homeShown;
    document.body.innerHTML = "";
  });

  afterEach(() => {
    vi.useRealTimers();
    delete document.documentElement.dataset.entrancePlayed;
    delete document.documentElement.dataset.homeShown;
    document.body.innerHTML = "";
  });

  /** The server markup a first load hydrates (the page's own <main>). */
  function placeServerMarkup() {
    const main = document.createElement("main");
    main.dataset.entrance = "soft";
    main.dataset.entranceShipped = "";
    document.body.append(main);
  }

  it("settles at 1710ms", () => {
    expect(SHIPPED_ENTRANCE_TOTAL_MS).toBe(1710);
  });

  it("marks the document once the sequence has settled", () => {
    placeServerMarkup();
    render(<HomeEntrancePlayed />);

    // Nothing is gated at first: the CSS animation is already running.
    expect(document.documentElement.dataset.entrancePlayed).toBeUndefined();

    vi.advanceTimersByTime(SHIPPED_ENTRANCE_TOTAL_MS - 1);
    expect(document.documentElement.dataset.entrancePlayed).toBeUndefined();

    vi.advanceTimersByTime(1);
    expect(document.documentElement.dataset.entrancePlayed).toBe("true");
  });

  it("renders resting when home arrives by client navigation", () => {
    // A client-side arrival has no home markup in the document on the first
    // render: the page is created in the commit after it.
    render(<HomeEntrancePlayed />);

    // Gated before the first paint: the CSS animations never run.
    expect(document.documentElement.dataset.entrancePlayed).toBe("true");
    expect(document.documentElement.dataset.homeShown).toBe("");
  });

  it("still plays when home had already been shown in this document", () => {
    // Leaving `/` mid-sequence and coming back costs a replay.
    document.documentElement.dataset.homeShown = "";

    render(<HomeEntrancePlayed />);

    expect(document.documentElement.dataset.entrancePlayed).toBeUndefined();

    vi.advanceTimersByTime(SHIPPED_ENTRANCE_TOTAL_MS);
    expect(document.documentElement.dataset.entrancePlayed).toBe("true");
  });

  it("waits for a restarted entrance instead of cutting it on the clock", async () => {
    placeServerMarkup();

    // A hydration recovery replaces <main> and starts the entrance again after
    // the first mount. The clock reaches 1710ms while that run is still going;
    // the gate must wait for it instead of cancelling its delayed cards.
    let running = true;
    let finish = () => {};
    const finished = new Promise<void>((resolve) => {
      finish = resolve;
    });
    const animation = {
      animationName: "entrance-soft-card-split",
      playState: "running",
      finished,
    } as unknown as Animation;
    const doc = document as Document & { getAnimations?: () => Animation[] };
    doc.getAnimations = vi.fn(() => (running ? [animation] : []));

    try {
      render(<HomeEntrancePlayed />);

      vi.advanceTimersByTime(SHIPPED_ENTRANCE_TOTAL_MS);
      await vi.advanceTimersByTimeAsync(0);
      expect(document.documentElement.dataset.entrancePlayed).toBeUndefined();

      running = false;
      finish();
      await vi.advanceTimersByTimeAsync(0);
      expect(document.documentElement.dataset.entrancePlayed).toBe("true");
    } finally {
      delete (doc as { getAnimations?: () => Animation[] }).getAnimations;
    }
  });

  it("does not mark when it is torn down before the sequence settles", () => {
    placeServerMarkup();
    const view = render(<HomeEntrancePlayed />);

    view.unmount();

    expect(document.documentElement.dataset.entrancePlayed).toBeUndefined();

    // A remount (React's dev double-invoke, or a return) starts a fresh timer
    // and still waits for the settle.
    placeServerMarkup();
    render(<HomeEntrancePlayed />);
    vi.advanceTimersByTime(SHIPPED_ENTRANCE_TOTAL_MS);
    expect(document.documentElement.dataset.entrancePlayed).toBe("true");
  });

  it("stays resting when the document was marked before arrival", () => {
    // The reader marks the document before it pushes '/', so home must paint
    // resting even though its server markup is already here.
    placeServerMarkup();
    document.documentElement.dataset.entrancePlayed = "true";

    render(<HomeEntrancePlayed />);

    expect(document.documentElement.dataset.entrancePlayed).toBe("true");
    vi.advanceTimersByTime(SHIPPED_ENTRANCE_TOTAL_MS);
    expect(document.documentElement.dataset.entrancePlayed).toBe("true");
  });

  it("hints will-change for the blur only while the entrance is unplayed", () => {
    // The hint is worth it only for the layerise at the start of the blur.
    const hint = css.match(
      /@media \(prefers-reduced-motion: no-preference\) \{[\s\S]*?\r?\n\}\r?\n/,
    )?.[0];

    expect(hint).toBeTruthy();
    // Both animating surfaces (cards and the nav) are covered.
    expect(hint).toContain(".entrance-body");
    expect(hint).toContain(".wd-nav-dock");
    // And every selector in it is dropped by the same gate that ends the
    // animations, so no layer outlives the 1710ms sequence.
    expect(
      (hint!.match(/:root:not\(\[data-entrance-played\]\)/g) ?? []).length,
    ).toBe(2);
    // No unconditional will-change anywhere in the entrance stylesheet.
    expect((css.match(/will-change/g) ?? []).length).toBe(1);
  });

  it("ships a CSS-only start and a reduced-motion fade", () => {
    // The animation, not JS, carries the start pose: SSR markup + backwards fill.
    expect(css).toContain('[data-entrance="soft"] .entrance-body');
    expect(css).toContain("entrance-soft-card-split");
    expect(css).toContain("backwards");
    // The veil must not depend on backdrop-filter.
    expect(css).not.toMatch(/\.entrance-soft\s*{[^}]*backdrop-filter/);
    // Reduced motion: one 120ms fade (--entrance-reduced-duration, which points
    // at --duration-short-2), no filter, no softness animation.
    expect(css).toMatch(
      /@media \(prefers-reduced-motion: reduce\)[\s\S]*entrance-fade-in var\(--entrance-reduced-duration\)/,
    );
    expect(css).toMatch(
      /@media \(prefers-reduced-motion: reduce\)[\s\S]*filter: none !important/,
    );
    // One play per document.
    expect(css).toContain(":root[data-entrance-played]");
  });

  it("fades the featured card from 0.01, never 0, so its title counts for LCP", () => {
    // The featured card holds the largest text on a phone, so its title is the
    // LCP element. Chrome ignores a fully transparent element, so the original
    // rise, fade and blur start at 1% opacity: unseen, but painted on frame one.
    expect(css).toMatch(
      /\[data-entrance="soft"\] \[data-entrance-item="3"\] \.entrance-body \{\s*animation-name: entrance-soft-card-lcp;/,
    );

    const frames =
      css.match(/@keyframes entrance-soft-card-lcp \{([\s\S]*?)\n\}/)?.[1] ??
      "";
    expect(frames).toMatch(/opacity: 0\.01/);
    expect(frames).not.toMatch(/opacity: 0;/);
    expect(frames).toContain("filter: blur(var(--soft-blur");
  });
});
