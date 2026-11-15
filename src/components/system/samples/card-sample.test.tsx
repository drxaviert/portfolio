import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CardSample } from "@/components/system/samples/card-sample";

describe("CardSample", () => {
  it("forces the requested state and keeps the live ring markup", () => {
    const { container } = render(<CardSample forceState="hover" />);
    const card = container.querySelector("article");

    expect(card).toHaveAttribute("data-state", "hover");
    expect(card).toHaveClass("ring-host");
    expect(container.querySelector(".ring-frame")).not.toBeNull();
    expect(container.querySelector(".ring-glow")).not.toBeNull();
    expect(container.querySelector(".ring-surface")).not.toBeNull();
    expect(container.querySelector(".ring-title")).not.toBeNull();
  });

  it("renders unforced by default with custom children", () => {
    const { container } = render(<CardSample>Work title</CardSample>);

    expect(container.querySelector("article")).not.toHaveAttribute("data-state");
    expect(screen.getByText("Work title")).toBeInTheDocument();
  });

  it("does not add a click affordance", () => {
    const { container } = render(<CardSample forceState="focus-visible" />);

    expect(container.querySelector("button")).toBeNull();
    expect(container.querySelector("a")).toBeNull();
  });
});
