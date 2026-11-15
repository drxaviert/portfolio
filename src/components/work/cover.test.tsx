import { render } from "@testing-library/react";
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
