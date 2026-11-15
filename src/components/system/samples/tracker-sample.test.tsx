import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TrackerSample } from "@/components/system/samples/tracker-sample";

function renderSample(forceState?: "rest" | "hover") {
  return render(<TrackerSample forceState={forceState} />);
}

describe("TrackerSample", () => {
  it("renders the live 32-week grid as two 16-column bands and three pager dots", () => {
    const { container } = renderSample();
    const bands = container.querySelectorAll("[data-tracker-band]");

    expect(bands).toHaveLength(2);
    bands.forEach((band) => {
      expect(band.className).toContain("grid-cols-16");
      expect(band.children).toHaveLength(112);
    });
    expect(container.querySelectorAll("[data-tracker-dot]")).toHaveLength(3);
  });

  it("maps every cell onto the tracker ramp", () => {
    const { container } = renderSample();
    const cells = container.querySelectorAll(".tracker-cell");

    expect(cells).toHaveLength(49 + 224);
    cells.forEach((cell) =>
      expect(cell.className).toMatch(/bg-tracker-[0-4]/),
    );
  });

  it("shows the caption on real hover and when forced", () => {
    const hover = renderSample("hover");
    expect(hover.getByTestId("tracker-caption")).toBeInTheDocument();
    hover.unmount();

    const rest = renderSample("rest");
    expect(rest.container.querySelector("[data-tracker-caption]")).toBeNull();

    const sample = rest.container.querySelector("[data-tracker-sample]");
    expect(sample).not.toBeNull();

    fireEvent.pointerEnter(sample as Element);
    expect(
      rest.container.querySelector("[data-tracker-caption]"),
    ).not.toBeNull();

    fireEvent.pointerLeave(sample as Element);
    expect(rest.container.querySelector("[data-tracker-caption]")).toBeNull();
  });

  it("uses deterministic placeholder data between renders", () => {
    const first = renderSample();
    const firstLevels = Array.from(
      first.container.querySelectorAll(".tracker-cell"),
    ).map((cell) => cell.className);

    first.unmount();

    const second = renderSample();
    const secondLevels = Array.from(
      second.container.querySelectorAll(".tracker-cell"),
    ).map((cell) => cell.className);

    expect(secondLevels).toEqual(firstLevels);
  });

  it("is not an interactive control: the live tracker has no focusable cells", () => {
    const { container } = renderSample();

    expect(container.querySelector("button")).toBeNull();
    expect(container.querySelector("a")).toBeNull();
    expect(container.querySelector("[tabindex]")).toBeNull();
    expect(container.querySelector("[role='img']")).toHaveAttribute(
      "aria-label",
      "Contribution tracker, placeholder data",
    );
  });
});
