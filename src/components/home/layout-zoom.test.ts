import { describe, expect, it } from "vitest";
import { layoutZoom, rectZoom } from "./layout-zoom";

function fakeElement(offsetWidth: number) {
  const element = document.createElement("div");

  Object.defineProperty(element, "offsetWidth", {
    configurable: true,
    value: offsetWidth,
  });

  return element;
}

function rect(width: number) {
  return { width } as DOMRect;
}

describe("layout-zoom", () => {
  it("reads the effective zoom from the visual and layout widths", () => {
    const element = fakeElement(36);

    expect(rectZoom(element, rect(34.25))).toBeCloseTo(0.9514, 4);
  });

  it("is 1 when the layout width is unknown", () => {
    expect(rectZoom(fakeElement(0), rect(0))).toBe(1);
    expect(rectZoom(fakeElement(0), rect(34.25))).toBe(1);
  });

  it("measures an element's own zoom", () => {
    const element = fakeElement(1136);

    element.getBoundingClientRect = () => rect(1080.9375);

    expect(layoutZoom(element)).toBeCloseTo(0.9515, 4);
  });
});
