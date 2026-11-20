import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BlurStack } from "@/components/work/blur-stack";
import { ViewportEdgeBlur } from "./viewport-edge-blur";

describe("ViewportEdgeBlur", () => {
  it("renders a decorative band at each viewport edge", () => {
    const { container } = render(<ViewportEdgeBlur />);
    const boxes = container.querySelectorAll(".wd-edge-blur");

    expect(boxes).toHaveLength(2);
    expect(boxes[0]).toHaveClass("wd-edge-blur--top");
    expect(boxes[1]).toHaveClass("wd-edge-blur--bottom");
    expect(container.querySelectorAll(".wd-blur-band")).toHaveLength(12);
    for (const box of boxes) {
      expect(box).toHaveAttribute("aria-hidden", "true");
    }
  });

  it("paints blur only, and mirrors the bottom edge", () => {
    const { container } = render(<ViewportEdgeBlur />);
    const stacks = Array.from(
      container.querySelectorAll<HTMLElement>(".wd-blur-stack"),
    );

    for (const stack of stacks) {
      expect(stack).toHaveAttribute("data-tint", "none");
      expect(stack.style.height).toBe("");
    }
    expect(stacks[0]).not.toHaveAttribute("data-edge");
    expect(stacks[1]).toHaveAttribute("data-edge", "bottom");
  });
});

describe("BlurStack defaults", () => {
  it("keeps the reader's markup unchanged", () => {
    const { container } = render(<BlurStack height="72px" />);
    const stack = container.firstElementChild as HTMLElement;

    // The reader passes only a height and gets the tinted top stack, with no
    // extra attributes in its output.
    expect(stack.className).toBe("wd-blur-stack");
    expect(stack.style.height).toBe("72px");
    expect(stack.attributes).toHaveLength(2); // class + style
  });
});
