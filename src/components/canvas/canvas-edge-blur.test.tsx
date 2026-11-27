import { render } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CanvasEdgeBlur } from "./canvas-edge-blur";

function edgeBlurCss(): string {
  return readFileSync(
    join(process.cwd(), "src/components/canvas/canvas-edge-blur.css"),
    "utf8",
  );
}

describe("CanvasEdgeBlur", () => {
  it("renders six decorative bands in one layer", () => {
    const { container } = render(<CanvasEdgeBlur />);
    const overlay = container.querySelector(".cv-edge-blur");

    expect(overlay).toHaveAttribute("aria-hidden", "true");
    expect(overlay).not.toHaveAttribute("tabindex");

    const bands = container.querySelectorAll(".cv-edge-blur__band");
    expect(bands).toHaveLength(6);
    for (const band of bands) {
      expect(band).toHaveAttribute("aria-hidden", "true");
    }
  });

  it("keeps the tunable depth, strength, tint and dip as tokens", () => {
    const css = edgeBlurCss();

    expect(css).toMatch(/--cv-edge-depth: clamp\(56px, 9vw, 160px\);/);
    expect(css).toMatch(/--cv-edge-blur-max: 16px;/);
    expect(css).toMatch(/--cv-edge-tint: 8%;/);
    expect(css).toMatch(/--cv-edge-dip: 200ms;/);
  });

  it("masks both axes with a union, so all four edges ramp to their own boundary", () => {
    const css = edgeBlurCss();

    // One vertical and one horizontal gradient per band, composited add.
    expect(css).toMatch(/mask-composite: add;/);
    expect(css).toMatch(/linear-gradient\(\s*to bottom,\s*#000 0,/);
    expect(css).toMatch(/linear-gradient\(\s*to right,\s*#000 0,/);
    // The centre is transparent all the way through both axes.
    expect(css).toMatch(/transparent var\(--cv-band-fade\)/);
  });

  it("dips out while a tile is open and through the whole close", () => {
    const css = edgeBlurCss();
    const hideRule = /\.cv-reader\[data-viewing\] \.cv-edge-blur,\s*\.cv-reader\[data-closing\] \.cv-edge-blur \{([\s\S]*?)\}/;
    const body = hideRule.exec(css)?.[1] ?? "";

    expect(body).toContain("opacity: 0;");
    expect(body).toContain("visibility: hidden;");
    expect(body).toContain("transition-delay: 0s, var(--cv-edge-dip);");
    expect(css).toMatch(
      /@media \(prefers-reduced-motion: reduce\)[\s\S]*?transition: none;/,
    );
  });
});
