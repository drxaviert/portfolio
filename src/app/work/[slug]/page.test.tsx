import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { READER_TITLE_ID } from "@/components/work/reader";
import WorkPage, { generateStaticParams } from "./page";

const { notFound } = vi.hoisted(() => ({
  notFound: vi.fn((...args: unknown[]) => {
    void args;
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

vi.mock("next/navigation", () => ({
  notFound,
  usePathname: () => "/work/systems-in-motion",
  useRouter: () => ({
    push: () => undefined,
    replace: () => undefined,
    back: () => undefined,
  }),
}));

// Vitest has no MDX transform; the body is a placeholder here. The page test
// checks the article's wiring, not the compiled prose.
vi.mock("../../../../content/work/systems-in-motion.mdx", () => ({
  default: () => <p>Case-study body</p>,
}));

// The live canvas branch is mocked here: the reader's WebGL lifecycle is
// exercised in the browser, while this test only checks the layout switch.
vi.mock("@/components/work/canvas-reader", () => ({
  CanvasReader: ({ meta }: { meta: { title: string } }) => (
    <div data-canvas-reader>{meta.title}</div>
  ),
}));

async function renderStudy(slug = "systems-in-motion") {
  render(
    <ThemeProvider>
      {await WorkPage({ params: Promise.resolve({ slug }) })}
    </ThemeProvider>,
  );
}

beforeEach(() => {
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("work page", () => {
  it("renders the study's content", async () => {
    await renderStudy();

    // The homepage card has the same title; the article's is the one by id.
    const title = document.getElementById(READER_TITLE_ID);
    expect(title).toHaveTextContent("Systems in motion");
    expect(screen.getByText("Case-study body")).toBeInTheDocument();
  });

  it("is content only: the drawer's layout owns the panel and the homepage", async () => {
    await renderStudy();

    // Both belong to app/work/layout.tsx, so the page is just the article and a
    // study-to-study step swaps it inside the same open drawer.
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(document.querySelector("[data-work-card]")).not.toBeInTheDocument();
    expect(document.querySelector(".wd-expand-layer")).not.toBeInTheDocument();
    // The layout switch belongs to the index, not to a study.
    expect(
      screen.queryByRole("radiogroup", { name: "Layout" }),
    ).not.toBeInTheDocument();
  });

  it("ends with the next study in reading order", async () => {
    await renderStudy();

    expect(
      screen.getByRole("link", { name: "Next project: The title sequence" }),
    ).toHaveAttribute("href", "/work/title-sequence");
  });

  it("calls notFound for the hidden study", async () => {
    await expect(renderStudy("human-contact")).rejects.toThrow(
      "NEXT_NOT_FOUND",
    );

    expect(notFound).toHaveBeenCalled();
  });

  it("does not statically generate the hidden study", () => {
    const slugs = generateStaticParams().map(({ slug }) => slug);

    expect(slugs).toEqual([
      "systems-in-motion",
      "title-sequence",
      "type-in-motion",
      "motion-and-stills",
    ]);
    expect(slugs).not.toContain("human-contact");
  });

  it("calls notFound for an unknown slug", async () => {
    await expect(
      WorkPage({ params: Promise.resolve({ slug: "nope" }) }),
    ).rejects.toThrow("NEXT_NOT_FOUND");

    expect(notFound).toHaveBeenCalled();
  });

  it("renders the canvas layout through CanvasReader", async () => {
    await renderStudy("motion-and-stills");

    expect(document.querySelector("[data-canvas-reader]")).toHaveTextContent(
      "Motion & Stills",
    );
  });
});
