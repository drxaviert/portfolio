import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { WorkDrawer } from "./work-drawer";

vi.mock("next/navigation", () => ({
  usePathname: () => "/work",
  useRouter: () => ({
    back: vi.fn(),
    replace: vi.fn(),
    push: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

function layer() {
  return document.querySelector<HTMLElement>(
    ".wd-expand-layer:not([data-stale])",
  )!;
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

function renderDrawer() {
  return render(
    <ThemeProvider>
      <WorkDrawer>
        <p>index</p>
      </WorkDrawer>
    </ThemeProvider>,
  );
}

describe("WorkDrawer", () => {
  it("is the navigation's own drawer when no drawer markup exists yet", () => {
    renderDrawer();

    // The resting path is the one that marks the document as already shown;
    // this copy did not take it, so it is a fresh open that morphs.
    expect(screen.getByText("index")).toBeInTheDocument();
    expect(document.documentElement.dataset.entrancePlayed).toBeUndefined();
  });

  it("starts open at rest when the drawer was already in the document", () => {
    // A direct load: the server rendered the drawer, so this copy is the
    // destination and has no morph to play.
    const stale = document.createElement("div");
    stale.className = "wd-expand-layer";
    stale.dataset.stale = "";
    document.body.append(stale);

    renderDrawer();

    expect(layer()).toHaveAttribute("data-phase", "open");
    expect(document.documentElement.dataset.entrancePlayed).toBe("true");
  });
});
