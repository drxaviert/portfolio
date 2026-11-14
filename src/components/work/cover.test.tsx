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
