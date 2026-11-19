import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ThemeProvider } from "@/components/theme/theme-provider";
import WorkIndexPage from "./page";

vi.mock("next/navigation", () => ({
  usePathname: () => "/work",
  useRouter: () => ({
    back: vi.fn(),
    replace: vi.fn(),
    push: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

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
  window.sessionStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

async function renderPage(layout?: string) {
  const tree = await WorkIndexPage({
    searchParams: Promise.resolve(layout === undefined ? {} : { layout }),
  });

  return render(<ThemeProvider>{tree}</ThemeProvider>);
}

describe("work index page", () => {
  it("renders the index, in the order the homepage leads with", async () => {
    const { container } = await renderPage();

    const links = [
      ...container.querySelectorAll<HTMLAnchorElement>("a[href^='/work/']"),
    ];

    expect(links).toHaveLength(3);
    expect(links[0]).toHaveAttribute("href", "/work/systems-in-motion");
    // The drawer's panel is the layout's, so the page is only the content.
    expect(container.querySelector(".wd-expand-layer")).toBeNull();
    expect(container.querySelector("[data-work-card]")).toBeNull();
  });

  it("renders the layout the URL asked for, before hydration", async () => {
    // `?layout=list` has to be in the server's markup, or the grid paints first
    // and flips. The page hands the value straight to the index.
    const list = await renderPage("list");
    expect(list.container.querySelector(".wd-index-list")).toBeInTheDocument();
    expect(list.container.querySelector(".wd-grid")).toBeNull();
    list.unmount();

    const grid = await renderPage("grid");
    expect(grid.container.querySelector(".wd-grid")).toBeInTheDocument();
    expect(grid.container.querySelector(".wd-index-list")).toBeNull();
  });

  it("names the route Work", async () => {
    const { metadata } = await import("./page");

    expect(metadata.title).toBe("Work");
  });
});
