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
  it("does not mount the homepage's edge blur over the drawer", () => {
    const { container } = render(
      <ThemeProvider>
        <WorkLayout>
          <p>study</p>
        </WorkLayout>
      </ThemeProvider>,
    );

    // The bands live on `/` alone: a direct load of a study shares the
    // homepage underneath but not its edge blur.
    expect(screen.getByText("study")).toBeInTheDocument();
    expect(container.querySelector(".wd-edge-blur")).toBeNull();
  });
});
