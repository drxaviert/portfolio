import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ThemeProvider } from "@/components/theme/theme-provider";
import WorkLayout from "./layout";

vi.mock("next/navigation", () => ({
  usePathname: () => "/work/systems-in-motion",
  useRouter: () => ({
    back: vi.fn(),
    replace: vi.fn(),
    push: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

vi.mock("@/lib/daily-art", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/daily-art")>();

  return {
    ...actual,
    getTodaysArt: vi.fn(async () => actual.fallbackArt("2026-11-25")),
  };
});

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

describe("work layout", () => {
  it("does not mount the homepage's edge blur over the drawer", async () => {
    const layout = await WorkLayout({ children: <p>study</p> });
    const { container } = render(<ThemeProvider>{layout}</ThemeProvider>);

    // The bands live on `/` alone: a direct load of a study shares the
    // homepage underneath but not its edge blur.
    expect(screen.getByText("study")).toBeInTheDocument();
    expect(container.querySelector(".wd-edge-blur")).toBeNull();
  });
});
