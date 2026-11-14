import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { getWork } from "@/lib/work";
import { READER_TITLE_ID, Reader } from "./reader";

describe("reader overlay", () => {
  it("renders a labelled modal dialog", () => {
    const meta = getWork("systems-in-motion");
    if (!meta) throw new Error("missing fixture");

    render(
      <Reader meta={meta} mode="overlay">
        <p>Case-study body</p>
      </Reader>,
    );

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAttribute("aria-labelledby", READER_TITLE_ID);
  });
});
