import { render, screen } from "@testing-library/react";
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
  document.documentElement.removeAttribute("data-work-layout");
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
  it("renders the index, in the order the homepage leads with", () => {
    const { container } = renderPage();

    const links = [
      ...container.querySelectorAll<HTMLAnchorElement>(
        '[data-layout="grid"] a[href^="/work/"]',
      ),
    ];

    expect(links).toHaveLength(3);
    expect(links[0]).toHaveAttribute("href", "/work/systems-in-motion");
    // The drawer's panel is the layout's, so the page is only the content.
    expect(container.querySelector(".wd-expand-layer")).toBeNull();
    expect(container.querySelector("[data-work-card]")).toBeNull();
  });

  it("renders both layouts, with the grid chosen by default", () => {
    // Both are in the markup so the stored choice can be applied before paint
    // by the inline script; the stylesheet picks one from <html>.
    const { container } = renderPage();

    expect(container.querySelector('[data-layout="grid"] .wd-grid')).not.toBeNull();
    expect(
      container.querySelector('[data-layout="list"] .wd-index-list'),
    ).not.toBeNull();

    expect(screen.getByRole("radiogroup", { name: "Layout" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Grid view" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(document.documentElement).toHaveAttribute(
      "data-work-layout",
      "grid",
    );
  });

  it("names the route Work", async () => {
    const { metadata } = await import("./page");

    expect(metadata.title).toBe("Work");
  });
});
