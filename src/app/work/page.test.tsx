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
  window.localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function renderPage() {
  return render(
    <ThemeProvider>
      <WorkIndexPage />
    </ThemeProvider>,
  );
}

describe("work index page", () => {
  it("renders one list row per study, in the order the homepage leads with", () => {
    const { container } = renderPage();

    const links = [
      ...container.querySelectorAll<HTMLAnchorElement>(
        ".wd-work-row[href^='/work/']",
      ),
    ];

    expect(links).toHaveLength(4);
    expect(links[0]).toHaveAttribute("href", "/work/systems-in-motion");
    expect(links[3]).toHaveAttribute("href", "/work/motion-and-stills");
    // The drawer's panel is the layout's, so the page is only the content.
    expect(container.querySelector(".wd-expand-layer")).toBeNull();
    expect(container.querySelector("[data-work-card]")).toBeNull();
  });

  it("is a single list, with no grid, switch or preview", () => {
    const { container } = renderPage();

    expect(container.querySelector(".wd-work-list")).not.toBeNull();
    expect(container.querySelector("[data-layout]")).toBeNull();
    expect(container.querySelector(".wd-grid")).toBeNull();
    expect(container.querySelector(".wd-index-preview")).toBeNull();
    expect(container.querySelector('[role="radiogroup"]')).toBeNull();
    expect(document.documentElement).not.toHaveAttribute("data-work-layout");
  });

  it("names the route Work", async () => {
    const { metadata } = await import("./page");

    expect(metadata.title).toBe("Work");
  });
});
