import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { READER_TITLE_ID } from "@/components/work/reader";
import WorkPage from "./page";

const { notFound } = vi.hoisted(() => ({
  notFound: vi.fn((...args: unknown[]) => {
    void args;
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

const nav = vi.hoisted(() => ({ pathname: "/work/systems-in-motion" }));

vi.mock("next/navigation", () => ({
  notFound,
  usePathname: () => nav.pathname,
  useRouter: () => ({
    push: () => undefined,
    replace: () => undefined,
    back: () => undefined,
  }),
}));

// Vitest has no MDX transform; the body is a placeholder here. The page test
// checks the reader shell and the route, not the compiled prose.
vi.mock("../../../../content/work/systems-in-motion.mdx", () => ({
  default: () => <p>Case-study body</p>,
}));

async function renderStudy(slug = "systems-in-motion") {
  render(
    <ThemeProvider>
      {await WorkPage({ params: Promise.resolve({ slug }) })}
    </ThemeProvider>,
  );
}

beforeEach(() => {
  nav.pathname = "/work/systems-in-motion";
  delete document.documentElement.dataset.entrancePlayed;
  delete document.documentElement.dataset.homeShown;
  delete document.documentElement.dataset.readerEntry;

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
  it("renders the study title in the reader", async () => {
    await renderStudy();

    // The homepage card has the same title; the reader's is the one by id.
    const title = document.getElementById(READER_TITLE_ID);
    expect(title).toHaveTextContent("Systems in motion");
    expect(screen.getByText("Case-study body")).toBeInTheDocument();
  });

  it("renders the reader as a dialog over the homepage", async () => {
    await renderStudy();

    expect(screen.getByRole("dialog")).toHaveAttribute(
      "aria-labelledby",
      READER_TITLE_ID,
    );
    // The homepage is underneath, so close has a card to fly into.
    expect(document.querySelector("[data-work-card]")).toBeInTheDocument();
    expect(document.querySelector("main[data-entrance]")).toBeInTheDocument();
  });

  it("opens resting, with the homepage marked as already shown", async () => {
    await renderStudy();

    const layer = document.querySelector(".wd-expand-layer");
    expect(layer).toHaveAttribute("data-phase", "open");
    expect(document.documentElement.dataset.entrancePlayed).toBe("true");
  });

  it("steps its reader aside on another study's URL", async () => {
    // A study-to-study navigation leaves this page behind in children while the
    // modal slot shows the new reader; two readers must not stack.
    nav.pathname = "/work/title-sequence";

    const tree = await WorkPage({
      params: Promise.resolve({ slug: "systems-in-motion" }),
    });
    render(<ThemeProvider>{tree}</ThemeProvider>);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    // The homepage underneath stays: close still has a card to fly into.
    expect(document.querySelector("[data-work-card]")).toBeInTheDocument();
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
