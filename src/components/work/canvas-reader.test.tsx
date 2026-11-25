import { fireEvent, render, screen, within } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { ForwardedRef } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CanvasItem } from "@/components/canvas/infinite-canvas";
import type { ImageMedia } from "@/lib/media-types";
import type { WorkMeta } from "@/lib/work";
import { CanvasReader } from "./canvas-reader";
import { DrawerActionsProvider } from "./drawer-actions";

const releaseOpen = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  usePathname: () => "/work/motion-and-stills",
}));

vi.mock("@/components/canvas/infinite-canvas", async () => {
  const { forwardRef, useImperativeHandle } = await import("react");
  return {
    InfiniteCanvas: forwardRef(function MockCanvas(
      {
        onOpen,
      }: {
        onOpen?: (
          index: number,
          startAt?: number,
          openRect?: unknown,
          canvasOwned?: boolean,
        ) => void;
      },
      ref: ForwardedRef<unknown>,
    ) {
      useImperativeHandle(
        ref,
        () => ({
          releaseOpen,
          rectForIndex: () => null,
          reveal: () => {},
          handoff: () => {},
          closeTo: () => null,
          cancelClose: () => {},
          landClose: () => {},
        }),
        [],
      );

      return (
        <div data-canvas-stage>
          <button
            type="button"
            onClick={() => onOpen?.(0, undefined, undefined, true)}
          >
            Simulate tile open
          </button>
        </div>
      );
    }),
  };
});

vi.mock("@/components/canvas/focus-viewer", () => ({
  FocusViewer: ({
    onClosing,
    onClosed,
    onStep,
  }: {
    onClosing?: (index: number) => void;
    onClosed?: () => void;
    onStep?: () => void;
  }) => (
    <div data-focus-viewer>
      <button type="button" onClick={() => onStep?.()}>
        Simulate step
      </button>
      <button type="button" onClick={() => onClosing?.(0)}>
        Simulate closing
      </button>
      <button type="button" onClick={() => onClosed?.()}>
        Simulate close
      </button>
    </div>
  ),
}));

const meta = {
  slug: "motion-and-stills",
  title: "Motion & Stills",
  subtitle: "",
  year: "2026",
  role: "",
  summary: "",
  cover: "media:good-form-reel-4c969cc977",
  hidden: false,
} as WorkMeta;

const items: CanvasItem[] = [];

const imageMedia: ImageMedia = {
  id: "test-image-0000000000",
  kind: "image",
  width: 1000,
  height: 1000,
  alt: "Test image",
  caption: "Test",
  createdAt: "2026-11-24T00:00:00.000Z",
  original: "test.webp",
  sources: [
    {
      format: "webp",
      width: 640,
      url: "https://media.example.com/test/w640.webp",
    },
  ],
  lqip: "",
};

const viewerItem: CanvasItem = {
  key: "test-0",
  project: "Test",
  media: imageMedia,
};

function renderViewerReader() {
  render(
    <DrawerActionsProvider close={vi.fn()} stepBack={vi.fn()} exit={vi.fn()}>
      <CanvasReader meta={meta} items={[viewerItem]} />
    </DrawerActionsProvider>,
  );

  const reader = document.querySelector<HTMLElement>(".cv-reader");
  if (!reader) throw new Error("missing reader");

  return reader;
}

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

describe("CanvasReader viewer staging", () => {
  it("keeps a canvas-owned open uncovered and clears the state after close", () => {
    const reader = renderViewerReader();

    fireEvent.click(screen.getByRole("button", { name: "Simulate tile open" }));
    expect(reader).toHaveAttribute("data-viewing");
    expect(reader).toHaveAttribute("data-canvas-viewing");

    fireEvent.click(screen.getByRole("button", { name: "Simulate closing" }));
    expect(reader).toHaveAttribute("data-closing");
    expect(reader).toHaveAttribute("data-canvas-viewing");

    fireEvent.click(screen.getByRole("button", { name: "Simulate close" }));
    expect(reader).not.toHaveAttribute("data-viewing");
    expect(reader).not.toHaveAttribute("data-closing");
    expect(reader).not.toHaveAttribute("data-canvas-viewing");
  });

  it("dims and covers the canvas for a DOM-viewer close after a step", () => {
    const reader = renderViewerReader();

    fireEvent.click(screen.getByRole("button", { name: "Simulate tile open" }));
    fireEvent.click(screen.getByRole("button", { name: "Simulate step" }));

    expect(reader).toHaveAttribute("data-viewing");
    expect(reader).not.toHaveAttribute("data-canvas-viewing");

    fireEvent.click(screen.getByRole("button", { name: "Simulate closing" }));
    expect(reader).toHaveAttribute("data-closing");
    expect(reader).not.toHaveAttribute("data-canvas-viewing");

    fireEvent.click(screen.getByRole("button", { name: "Simulate close" }));
    expect(reader).not.toHaveAttribute("data-viewing");
    expect(reader).not.toHaveAttribute("data-closing");
    expect(reader).not.toHaveAttribute("data-canvas-viewing");
  });

  it("asks the canvas to drop the canvas-owned focus when the viewer steps", () => {
    releaseOpen.mockClear();
    renderViewerReader();

    fireEvent.click(screen.getByRole("button", { name: "Simulate tile open" }));
    expect(releaseOpen).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Simulate step" }));
    expect(releaseOpen).toHaveBeenCalledTimes(1);
  });
});

describe("CanvasReader bottom bar stacking", () => {
  it("keeps the breadcrumb bar above the fixed focus viewer", () => {
    const readerCss = readFileSync(
      join(process.cwd(), "src/components/work/canvas-reader.css"),
      "utf8",
    );
    const viewerCss = readFileSync(
      join(process.cwd(), "src/components/canvas/focus-viewer.css"),
      "utf8",
    );
    const barZ = Number(
      readerCss.match(/\.cv-reader__bottom-bar \{[\s\S]*?z-index: (\d+)/)?.[1],
    );
    const viewerZ = Number(
      viewerCss.match(/\.cv-viewer \{[\s\S]*?z-index: (\d+)/)?.[1],
    );

    expect(barZ).toBeGreaterThan(viewerZ);
  });
});
