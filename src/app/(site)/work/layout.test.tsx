import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ThemeProvider } from "@/components/theme/theme-provider";
import SiteLayout from "../layout";
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
    const layout = await SiteLayout({
      children: <WorkLayout><p>study</p></WorkLayout>,
    });
    const { container } = render(<ThemeProvider>{layout}</ThemeProvider>);

    // The bands live on `/` alone: a direct load of a study shares the
    // homepage underneath but not its edge blur.
    expect(screen.getByText("study")).toBeInTheDocument();
    expect(container.querySelector(".wd-edge-blur")).toBeNull();
  });
});

describe("work layout ownership", () => {
  it("leaves the homepage to the site layout so it never remounts", () => {
    const { container } = render(
      <ThemeProvider>
        <WorkLayout>
          <p>study</p>
        </WorkLayout>
      </ThemeProvider>,
    );

    // The card, carousel and player belong to the (site) layout's one
    // HomeScreen; a second copy here would remount them on every navigation.
    expect(screen.getByText("study")).toBeInTheDocument();
    expect(container.querySelector(".art-card")).toBeNull();
  });
});
