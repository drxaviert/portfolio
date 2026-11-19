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
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("work index page", () => {
  it("renders the sheet over the homepage", () => {
    render(
      <ThemeProvider>
        <WorkIndexPage />
      </ThemeProvider>,
    );

    const sheet = document.querySelector("[data-work-sheet]");
    expect(sheet).toBeInTheDocument();
    // The homepage is underneath, so the sheet closes onto it.
    expect(document.querySelector("main[data-entrance]")).toBeInTheDocument();

    // One sheet, never two: this page is the only renderer on `/work`.
    expect(document.querySelectorAll("[data-work-sheet]")).toHaveLength(1);
  });

  it("lists every study in the sheet, with a link into it", () => {
    render(
      <ThemeProvider>
        <WorkIndexPage />
      </ThemeProvider>,
    );

    const sheet = document.querySelector<HTMLElement>("[data-work-sheet]")!;
    const links = [
      ...sheet.querySelectorAll<HTMLAnchorElement>("a[href^='/work/']"),
    ];

    expect(links).toHaveLength(3);
    expect(links[0]).toHaveAttribute("href", "/work/systems-in-motion");
    expect(links[0]).toHaveAttribute("data-work-card", "systems-in-motion");
  });

  it("names the route Work", async () => {
    const { metadata } = await import("./page");

    expect(metadata.title).toBe("Work");
  });
});
