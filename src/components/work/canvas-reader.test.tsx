import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CanvasItem } from "@/components/canvas/infinite-canvas";
import type { WorkMeta } from "@/lib/work";
import { CanvasReader } from "./canvas-reader";
import { DrawerActionsProvider } from "./drawer-actions";

vi.mock("next/navigation", () => ({
  usePathname: () => "/work/motion-and-stills",
}));

vi.mock("@/components/canvas/infinite-canvas", () => ({
  InfiniteCanvas: () => <div data-canvas-stage />,
}));

vi.mock("@/components/canvas/focus-viewer", () => ({
  FocusViewer: () => <div data-focus-viewer />,
}));

const meta = {
  slug: "motion-and-stills",
  title: "Motion & Stills",
  subtitle: "",
  year: "2026",
  role: "",
  summary: "",
  cover: "media:good-form-reel-4c969cc977",
} as WorkMeta;

const items: CanvasItem[] = [];

function renderReader() {
  const close = vi.fn();
  const stepBack = vi.fn();

  render(
    <DrawerActionsProvider close={close} stepBack={stepBack} exit={vi.fn()}>
      <CanvasReader meta={meta} items={items} />
    </DrawerActionsProvider>,
  );

  return { close, stepBack };
}

function bottomBar() {
  const bar = document.querySelector<HTMLElement>(".cv-reader__bottom-bar");
  expect(bar).not.toBeNull();
  if (!bar) throw new Error("missing bottom bar");

  return bar;
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

describe("CanvasReader breadcrumb bar", () => {
  it("puts the shared breadcrumb and the hint in one bottom chip", () => {
    renderReader();

    const bar = bottomBar();
    expect(bar).toHaveClass("cv-reader__pill");
    expect(bar).toHaveTextContent("Drag or scroll · Click to open");

    const nav = within(bar).getByRole("navigation", { name: "Breadcrumb" });
    expect(nav.closest(".cv-reader__pill")).toBe(bar);
    expect(within(nav).getByRole("link", { name: "Home" })).toHaveAttribute(
      "href",
      "/",
    );
    expect(within(nav).getByRole("link", { name: "Work" })).toHaveAttribute(
      "href",
      "/work",
    );
    expect(
      within(nav).getByText("Motion & Stills", {
        selector: ".breadcrumb-current",
      }),
    ).toHaveAttribute("aria-current", "page");
    expect(nav.querySelectorAll(".breadcrumb-sep").length).toBe(2);

    expect(bar).not.toHaveTextContent("←");
    expect(document.querySelector(".cv-reader__back")).toBeNull();
    expect(document.querySelector(".cv-reader__hint")).toBeNull();
    expect(document.querySelector(".cv-reader")).not.toHaveAttribute(
      "data-crumbs",
    );
  });

  it("keeps the breadcrumb's drawer actions", () => {
    const { close, stepBack } = renderReader();

    fireEvent.click(screen.getByRole("link", { name: "Work" }));
    expect(stepBack).toHaveBeenCalledTimes(1);
    expect(close).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("link", { name: "Home" }));
    expect(close).toHaveBeenCalledTimes(1);
  });

  it("keeps the breadcrumb's glide animation inside the chip", () => {
    renderReader();

    const bar = bottomBar();
    const home = within(bar).getByRole("link", { name: "Home" });
    const work = within(bar).getByRole("link", { name: "Work" });

    Object.defineProperty(home, "offsetWidth", { value: 40 });
    Object.defineProperty(home, "offsetLeft", { value: 0 });
    Object.defineProperty(work, "offsetWidth", { value: 40 });
    Object.defineProperty(work, "offsetLeft", { value: 56 });

    fireEvent.pointerEnter(home, { pointerType: "mouse" });
    expect(bar.querySelector(".nav-glide")).toHaveAttribute("data-visible");

    fireEvent.pointerEnter(work, { pointerType: "mouse" });
    expect(bar.querySelector(".nav-glide")).toHaveAttribute("data-visible");
  });

  it("drops the Cathy Dolle credit", () => {
    renderReader();

    expect(screen.queryByText(/Cathy Dolle/)).toBeNull();
    expect(document.querySelector(".cv-reader__credit")).toBeNull();
  });
});
