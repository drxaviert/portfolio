import { render } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { Figure, Row } from "./media-parts";

describe("media row", () => {
  it("renders a three-up row with one placeholder per figure", () => {
    const { container } = render(
      <Row cols={3}>
        <Figure aspect="1 / 1" />
        <Figure aspect="1 / 1" />
        <Figure aspect="1 / 1" />
      </Row>,
    );

    const row = container.querySelector(".wd-fig-row");

    expect(row).toHaveAttribute("data-cols", "3");
    expect(row?.querySelectorAll("figure")).toHaveLength(3);
    expect(
      row?.querySelector<HTMLElement>(".wd-media")?.style.aspectRatio,
    ).toBe("1 / 1");
  });

  it("defaults to two columns", () => {
    const { container } = render(
      <Row>
        <Figure aspect="16 / 9" />
        <Figure aspect="16 / 9" />
      </Row>,
    );

    expect(container.querySelector(".wd-fig-row")).toHaveAttribute(
      "data-cols",
      "2",
    );
  });

  it("stacks both row widths below 768px", () => {
    const css = readFileSync(
      join(process.cwd(), "src", "components", "work", "reader.css"),
      "utf8",
    );

    expect(css).toMatch(
      /@media \(max-width: 767\.98px\)[\s\S]*?\.wd-fig-row\[data-cols="3"\][\s\S]*?grid-template-columns: minmax\(0, 1fr\)/,
    );
  });
});
