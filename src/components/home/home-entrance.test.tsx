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
  });

  afterEach(() => {
    vi.useRealTimers();
    delete document.documentElement.dataset.entrancePlayed;
  });

  it("settles at 1710ms", () => {
    expect(SHIPPED_ENTRANCE_TOTAL_MS).toBe(1710);
  });

  it("marks the document once the sequence has settled", () => {
    render(<HomeEntrancePlayed />);

    // Nothing is gated at first: the CSS animation is already running.
    expect(document.documentElement.dataset.entrancePlayed).toBeUndefined();

    vi.advanceTimersByTime(SHIPPED_ENTRANCE_TOTAL_MS - 1);
    expect(document.documentElement.dataset.entrancePlayed).toBeUndefined();

    vi.advanceTimersByTime(1);
    expect(document.documentElement.dataset.entrancePlayed).toBe("true");
  });

  it("does not mark when it is torn down before the sequence settles", () => {
    const view = render(<HomeEntrancePlayed />);

    view.unmount();

    expect(document.documentElement.dataset.entrancePlayed).toBeUndefined();

    // A remount (React's dev double-invoke, or a return) starts a fresh timer
    // and still waits for the settle.
    render(<HomeEntrancePlayed />);
    vi.advanceTimersByTime(SHIPPED_ENTRANCE_TOTAL_MS);
    expect(document.documentElement.dataset.entrancePlayed).toBe("true");
  });

  it("ships a CSS-only start and a reduced-motion fade", () => {
    // The animation, not JS, carries the start pose: SSR markup + backwards fill.
    expect(css).toContain('[data-entrance="soft"] .entrance-body');
    expect(css).toContain("entrance-soft-card-split");
    expect(css).toContain("backwards");
    // The veil must not depend on backdrop-filter.
    expect(css).not.toMatch(/\.entrance-soft\s*{[^}]*backdrop-filter/);
    // Reduced motion: one 120ms fade, no filter, no softness animation.
    expect(css).toMatch(
      /@media \(prefers-reduced-motion: reduce\)[\s\S]*entrance-fade-in 120ms/,
    );
    expect(css).toMatch(
      /@media \(prefers-reduced-motion: reduce\)[\s\S]*filter: none !important/,
    );
    // One play per document.
    expect(css).toContain(":root[data-entrance-played]");
  });
});
