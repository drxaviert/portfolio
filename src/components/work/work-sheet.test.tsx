import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { listWork } from "@/lib/work";
import { setProtoLayout } from "./proto-layout-toggle";
import { WorkSheet } from "./work-sheet";

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
  setProtoLayout("grid");
});

afterEach(() => {
  setProtoLayout("grid");
  vi.unstubAllGlobals();
});

function renderSheet() {
  return render(<WorkSheet works={listWork()} />);
}

describe("work sheet", () => {
  it("is a dialog named by its heading, with a labelled close handle", () => {
    renderSheet();

    const dialog = screen.getByRole("dialog", { name: "Work" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(
      screen.getByRole("button", { name: "Close work" }),
    ).toBeInTheDocument();
  });

  it("lists every study as a morph source into its reader", () => {
    renderSheet();

    const links = screen.getAllByRole("link", {
      name: /Systems in motion|The title sequence|Type in motion/,
    });

    expect(links).toHaveLength(3);
    expect(links[0]).toHaveAttribute("href", "/work/systems-in-motion");
    expect(links[0]).toHaveAttribute("data-work-card", "systems-in-motion");
    expect(links[0]).toHaveAttribute("data-work-slug", "systems-in-motion");
  });

  it("switches to the index layout on L, and back on G", () => {
    const { container } = renderSheet();

    expect(container.querySelector(".wd-grid")).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "l" });
    expect(container.querySelector(".wd-index")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "List" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    fireEvent.keyDown(window, { key: "g" });
    expect(container.querySelector(".wd-grid")).toBeInTheDocument();
  });

  it("marks the featured study first, as the rest of the site does", () => {
    renderSheet();

    const first = document.querySelector("[data-work-sheet] [data-work-card]");

    expect(first).toHaveAttribute("data-work-card", "systems-in-motion");
  });
});
