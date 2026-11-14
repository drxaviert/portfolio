import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BlurStack } from "./blur-stack";

describe("BlurStack", () => {
  it("renders six decorative bands", () => {
    const { container } = render(<BlurStack height="72px" />);
    const bands = container.querySelectorAll(".wd-blur-band");

    expect(bands).toHaveLength(6);
    for (const band of bands) {
      expect(band).toHaveAttribute("aria-hidden", "true");
    }
  });

  it("takes its height from the nav's bottom edge", () => {
    const { container } = render(
      <BlurStack height="calc(var(--wd-nav-inset) + 64px)" />,
    );
    const stack = container.firstElementChild as HTMLElement;

    expect(stack.style.height).toBe("calc(var(--wd-nav-inset) + 64px)");
  });
});
