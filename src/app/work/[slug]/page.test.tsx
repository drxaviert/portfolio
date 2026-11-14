import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { READER_TITLE_ID } from "@/components/work/reader";
import WorkPage from "./page";

const { notFound } = vi.hoisted(() => ({
  notFound: vi.fn((...args: unknown[]) => {
    void args;
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

vi.mock("next/navigation", () => ({ notFound }));

// Vitest has no MDX transform; the body is a placeholder here. The page test
// checks the reader shell and the route, not the compiled prose.
vi.mock("../../../../content/work/systems-in-motion.mdx", () => ({
  default: () => <p>Case-study body</p>,
}));

async function renderStudy(slug = "systems-in-motion") {
  render(await WorkPage({ params: Promise.resolve({ slug }) }));
}

describe("work page", () => {
  it("renders the study title as the reader heading", async () => {
    await renderStudy();

    const title = screen.getByRole("heading", { name: "Systems in motion" });
    expect(title).toHaveAttribute("id", READER_TITLE_ID);
    expect(screen.getByText("Case-study body")).toBeInTheDocument();
  });

  it("renders a page, not a dialog", async () => {
    await renderStudy();

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("ends with the next study in reading order", async () => {
    await renderStudy();

    expect(
      screen.getByRole("link", { name: "Next project: The title sequence" }),
    ).toHaveAttribute("href", "/work/title-sequence");
  });

  it("calls notFound for an unknown slug", async () => {
    await expect(
      WorkPage({ params: Promise.resolve({ slug: "nope" }) }),
    ).rejects.toThrow("NEXT_NOT_FOUND");

    expect(notFound).toHaveBeenCalled();
  });
});
