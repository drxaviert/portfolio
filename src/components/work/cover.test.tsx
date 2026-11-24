import { render } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { WorkMeta } from "@/lib/work";
import { Cover } from "./cover";

describe("Cover", () => {
  it('renders the Tiles scene for scene="tiles"', () => {
    const { container } = render(<Cover scene="tiles" />);

    const tiles = container.querySelector('[data-scene="tiles"] .fu-tiles');

    expect(tiles).toBeInTheDocument();
    expect(tiles).toHaveAttribute("data-mode", "loop");
  });

  it("draws the scene as DOM, so no image decode can delay the entrance", () => {
    const { container } = render(<Cover scene="tiles" />);

    // The cascade's first beat is the cover; there is no image request to wait
    // on, which is why the entrance needs no decode gate.
    expect(container.querySelector("img, canvas")).toBeNull();
    expect(
      container.querySelector('[data-scene="tiles"] .fu-tiles'),
    ).toBeInTheDocument();
  });

  it("scales the stage in CSS, so the first paint is already the right size", () => {
    const css = readFileSync(
      join(process.cwd(), "src", "components", "faux-ui", "faux-ui.css"),
      "utf8",
    );

    // The scene root is the stage's container...
    expect(css).toMatch(/\[data-scene\] \{\s*container-type: size;/);
    // ...and the scale is the box-to-canvas ratio, computed from that box.
    expect(css).toMatch(
      /\[data-scene\] \.fu-stage \{\s*--fu-scale: calc\(tan\(atan2\(100cqw, 753px\)\)\);/,
    );
    expect(css).toMatch(
      /\[data-scene\] \.fu-stage\[data-fit="cover"\] \{\s*--fu-scale: max\(\s*calc\(tan\(atan2\(100cqw, 753px\)\)\),\s*calc\(tan\(atan2\(100cqh, 416px\)\)\)\s*\);/,
    );

    // The rendered stage no longer carries a measurement of its own.
    const { container } = render(<Cover scene="tiles" fit="cover" />);

    expect(container.querySelector(".fu-stage")).not.toHaveAttribute("style");
    expect(container.querySelector(".fu-stage")).toHaveAttribute(
      "data-fit",
      "cover",
    );
  });

  it("draws a media cover from the picture the server resolved", () => {
    const { container } = render(
      <Cover
        scene="media:f874aa9e-71e7-4f6e-ac27-f084c7b7d08b-1-c-44e88e5097"
        coverImage={{
          avif: "https://x/w1280.avif",
          fallback: "https://x/w1280.webp",
          fallbackType: "image/webp",
          width: 1600,
          height: 900,
          lqip: "data:image/webp;base64,AAAA",
        }}
      />,
    );

    expect(container.querySelector('[data-cover="media"]')).toBeInTheDocument();
    expect(container.querySelector("source")).toHaveAttribute(
      "type",
      "image/avif",
    );
    expect(container.querySelector("img")).toHaveAttribute(
      "src",
      "https://x/w1280.webp",
    );
  });

  it("keeps the neutral surface when a media cover has no picture", () => {
    const { container } = render(<Cover scene="media:missing" />);

    expect(
      container.querySelector('[data-cover="neutral"]'),
    ).toBeInTheDocument();
  });

  it("renders the neutral surface for a scene it cannot resolve", () => {
    const { container } = render(
      <Cover scene={"poster" as WorkMeta["cover"]} />,
    );

    expect(
      container.querySelector('[data-cover="neutral"]'),
    ).toBeInTheDocument();
    expect(container.querySelector(".fu-tiles")).not.toBeInTheDocument();
    expect(container.querySelector(".fu-window")).not.toBeInTheDocument();
    expect(container.querySelector(".fu-phone")).not.toBeInTheDocument();
  });
});
