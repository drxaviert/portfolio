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

describe("work index page", () => {
  it("renders the index, in the order the homepage leads with", () => {
    const { container } = render(
      <ThemeProvider>
        <WorkIndexPage />
      </ThemeProvider>,
    );

    const links = [
      ...container.querySelectorAll<HTMLAnchorElement>("a[href^='/work/']"),
    ];

    expect(links).toHaveLength(3);
    expect(links[0]).toHaveAttribute("href", "/work/systems-in-motion");
    // The drawer's panel is the layout's, so the page is only the content.
    expect(container.querySelector(".wd-expand-layer")).toBeNull();
    expect(container.querySelector("[data-work-card]")).toBeNull();
  });

  it("names the route Work", async () => {
    const { metadata } = await import("./page");

    expect(metadata.title).toBe("Work");
  });
});
