import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { getWork } from "@/lib/work";
import { READER_TITLE_ID, Reader } from "./reader";

// The only observable difference between push and replace is the prop Next's
// Link receives; a plain anchor keeps the assertion version-independent.
vi.mock("next/link", () => ({
  default: ({
    href,
    replace,
    children,
    ...rest
  }: {
    href: string;
    replace?: boolean;
    children: ReactNode;
  } & Record<string, unknown>) => (
    <a href={href} data-replace={replace ? "true" : "false"} {...rest}>
      {children}
    </a>
  ),
}));

function featured() {
  const meta = getWork("systems-in-motion");
  if (!meta) throw new Error("missing fixture");
  return meta;
}

describe("reader overlay", () => {
  it("renders a labelled modal dialog", () => {
    render(
      <Reader meta={featured()} mode="overlay">
        <p>Case-study body</p>
      </Reader>,
    );

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAttribute("aria-labelledby", READER_TITLE_ID);
  });

  it("replaces history when the next study opens from the overlay", () => {
    render(
      <Reader meta={featured()} mode="overlay">
        <p>Case-study body</p>
      </Reader>,
    );

    const next = screen.getByRole("link", {
      name: "Next project: The title sequence",
    });

    expect(next).toHaveAttribute("href", "/work/title-sequence");
    expect(next).toHaveAttribute("data-replace", "true");
  });

  it("pushes the next study on a direct load", () => {
    render(
      <Reader meta={featured()} mode="page">
        <p>Case-study body</p>
      </Reader>,
    );

    expect(
      screen.getByRole("link", { name: "Next project: The title sequence" }),
    ).toHaveAttribute("data-replace", "false");
  });
});
