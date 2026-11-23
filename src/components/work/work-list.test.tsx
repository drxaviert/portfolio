import { fireEvent, render, waitFor } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Activity } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { listWork } from "@/lib/work";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { WorkList } from "./work-list";
import { INDEX_SCROLL_ID, INDEX_TITLE_ID } from "./work-index-ids";

const works = listWork();
const WIDE_QUERY = "(min-width: 1200px) and (hover: hover) and (pointer: fine)";

/** Whether the viewport is wide enough for the left modes in this test. */
let leftFits = true;
/** Whether the system asks for reduced motion in this test. */
let reduceMotion = false;

function renderList() {
  return render(
    <ThemeProvider>
      <WorkList works={works} />
    </ThemeProvider>,
  );
}

/**
 * jsdom has no layout, so the placement code's rects are stubbed: a 1440x900
 * viewport, a list column at x 132 spanning y 160-560, and three 100px rows.
 * Nav dock absent, so the visible top is scroll top 16 + 92 + 12 = 120.
 */
function mockListGeometry() {
  const rect = (left: number, top: number, width: number, height: number) =>
    ({
      left,
      top,
      width,
      height,
      right: left + width,
      bottom: top + height,
      x: left,
      y: top,
      toJSON: () => ({}),
    }) as DOMRect;

  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(
    function (this: Element) {
      const element = this as HTMLElement;

      if (element.classList.contains("wd-work-thumb-clip")) {
        return rect(0, 0, 1440, 900);
      }

      if (element.id === INDEX_SCROLL_ID) return rect(100, 16, 1140, 884);

      if (element.classList.contains("wd-work-list-column")) {
        return rect(132, 160, 976, 400);
      }

      if (element.classList.contains("wd-work-row-item")) {
        const index = Number(element.dataset.workIndex);

        return rect(132, 160 + index * 100, 976, 100);
      }

      return rect(0, 0, 0, 0);
    },
  );
}

/**
 * The panel's case at a wide viewport: the shipped list is a centred column, so
 * at 2560 the reading surface starts at 16, the list at 744, and the left
 * margin (744 - 32 - (16 + 16) = 680) is wider than the 600px cap.
 */
function mockPanelGeometry() {
  const rect = (left: number, top: number, width: number, height: number) =>
    ({
      left,
      top,
      width,
      height,
      right: left + width,
      bottom: top + height,
      x: left,
      y: top,
      toJSON: () => ({}),
    }) as DOMRect;

  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(
    function (this: Element) {
      const element = this as HTMLElement;

      if (element.classList.contains("wd-work-thumb-clip")) {
        return rect(0, 0, 2560, 1400);
      }

      if (element.id === INDEX_SCROLL_ID) return rect(16, 16, 2513, 1368);

      if (element.classList.contains("wd-work-list-column")) {
        return rect(744, 221, 1056, 318);
      }

      if (element.classList.contains("wd-work-row-item")) {
        const index = Number(element.dataset.workIndex);

        return rect(744, 221 + index * 106, 1056, 106);
      }

      return rect(0, 0, 0, 0);
    },
  );
}

/** The one thumb layer's last written position, or null before it is placed. */
function thumbXY(): { x: number; y: number } | null {
  const thumb = document.body.querySelector<HTMLElement>(".wd-work-thumb");
  const match = /translate3d\((-?[\d.]+)px, (-?[\d.]+)px, 0px\)/.exec(
    thumb?.style.transform ?? "",
  );

  return match ? { x: Number(match[1]), y: Number(match[2]) } : null;
}

function hoverRow(container: HTMLElement, index: number, clientY = 500) {
  const row =
    container.querySelectorAll<HTMLElement>(".wd-work-row-item")[index];

  fireEvent.pointerMove(row.querySelector<HTMLElement>(".wd-work-row")!, {
    clientX: 700,
    clientY,
  });
}

/**
 * A cached route, the way the router holds `/work`: Activity hides the segment
 * instead of unmounting it, so its DOM and state survive while its effects are
 * torn down and run again when it is shown.
 */
function CachedList({ visible }: { visible: boolean }) {
  return (
    <Activity mode={visible ? "visible" : "hidden"}>
      <ThemeProvider>
        <WorkList works={works} />
      </ThemeProvider>
    </Activity>
  );
}

beforeEach(() => {
  leftFits = true;
  reduceMotion = false;
  window.history.replaceState({}, "", "/work");
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches:
        query === "(hover: hover) and (pointer: fine)" ||
        (leftFits && query === WIDE_QUERY) ||
        (reduceMotion && query === "(prefers-reduced-motion: reduce)"),
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
  vi.restoreAllMocks();
});

describe("work list", () => {
  it("renders one linked row per study with year, title, summary and role", () => {
    const { container } = renderList();
    const rows = [...container.querySelectorAll(".wd-work-row-item")];

    expect(rows).toHaveLength(works.length);

    rows.forEach((row, index) => {
      const work = works[index];
      const link = row.querySelector<HTMLAnchorElement>(".wd-work-row");

      expect(row).toHaveAttribute("data-work-index", String(index));
      expect(link).toHaveAttribute("href", `/work/${work.slug}`);
      expect(link).toHaveAccessibleName(
        `${work.title}, ${work.year}, ${work.role}`,
      );
      expect(row.querySelector(".wd-work-year")).toHaveTextContent(work.year);
      expect(row.querySelector(".wd-work-title")).toHaveTextContent(work.title);
      expect(row.querySelector(".wd-work-summary")).toHaveTextContent(
        work.summary,
      );
      expect(row.querySelector(".wd-work-role")).toHaveTextContent(work.role);
    });
  });

  it("keeps the drawer's scroll and title ids on the new list", () => {
    const { container } = renderList();
    const scroll = container.querySelector<HTMLElement>(`#${INDEX_SCROLL_ID}`);
    const title = container.querySelector<HTMLElement>(`#${INDEX_TITLE_ID}`);

    expect(scroll).toHaveClass("wd-index-scroll");
    expect(scroll?.querySelector(".wd-work-list")).not.toBeNull();
    expect(title).toHaveTextContent("Work");
    expect(title).toHaveAttribute("tabindex", "-1");
  });

  it("portals the thumbnail above the nav and keeps it hidden until hover", () => {
    const { container } = renderList();
    const clip = document.body.querySelector<HTMLElement>(
      ".wd-work-thumb-clip",
    );

    expect(clip).not.toBeNull();
    expect(clip?.parentElement).toBe(document.body);
    expect(container.querySelector(".wd-work-thumb-clip")).toBeNull();
    expect(clip).not.toHaveAttribute("data-work-active");
    expect(container.querySelector(".wd-work-group")).not.toHaveAttribute(
      "data-work-pointer",
    );
  });

  it("keeps the shipped cursor thumbnail with no ?thumb param", () => {
    const { container } = renderList();
    const clip = document.body.querySelector<HTMLElement>(
      ".wd-work-thumb-clip",
    );

    expect(container.querySelector(".wd-work-column")).toHaveAttribute(
      "data-thumb",
      "cursor",
    );
    expect(clip).not.toBeNull();
    expect(clip).toHaveAttribute("data-work-variant", "cursor");
  });

  it("overlays every left mode on the unchanged list, cursor visible", async () => {
    for (const mode of ["left-follow", "left-snap", "left-fixed"] as const) {
      window.history.replaceState({}, "", `/work?thumb=${mode}`);

      const { container, unmount } = renderList();
      const group = container.querySelector<HTMLElement>(".wd-work-group")!;
      const clip = document.body.querySelector<HTMLElement>(
        ".wd-work-thumb-clip",
      )!;

      mockListGeometry();

      // No dock, no extra column: the group is still just the list.
      expect(container.querySelector(".wd-work-dock")).toBeNull();
      expect(group.children).toHaveLength(1);
      expect(container.querySelector(".wd-work-column")).toHaveAttribute(
        "data-thumb",
        mode,
      );
      expect(clip).toHaveAttribute("data-work-variant", mode);

      hoverRow(container, 1);

      // X is the list's left edge, so the cursor stays visible.
      await waitFor(() => expect(thumbXY()?.x).toBe(132));
      expect(group).not.toHaveAttribute("data-work-pointer");
      expect(group).toHaveAttribute("data-work-dim");
      expect(clip).toHaveAttribute("data-work-active");

      unmount();
    }
  });

  it("left-follow centres Y on the cursor, X on the list edge", async () => {
    window.history.replaceState({}, "", "/work?thumb=left-follow");

    const { container } = renderList();

    mockListGeometry();
    hoverRow(container, 0, 500);

    await waitFor(() => expect(thumbXY()).toEqual({ x: 132, y: 320 }));

    // Moving inside the row moves Y with the cursor, not to the row's centre.
    hoverRow(container, 0, 300);
    await waitFor(() => expect(thumbXY()?.y).toBe(120));
  });

  it("left-snap centres Y on the row and glides to the next one", async () => {
    window.history.replaceState({}, "", "/work?thumb=left-snap");

    const { container } = renderList();

    mockListGeometry();
    hoverRow(container, 0);

    // First row: centre 210 minus half the 360 box, clamped to the visible top.
    await waitFor(() => expect(thumbXY()).toEqual({ x: 132, y: 120 }));

    hoverRow(container, 2);

    // The glide starts from the old Y and is still in flight a frame later.
    await waitFor(() => {
      const y = thumbXY()?.y ?? 0;

      expect(y).toBeGreaterThan(120);
      expect(y).toBeLessThan(230);
    });
    await waitFor(() => expect(thumbXY()).toEqual({ x: 132, y: 230 }));
  });

  it("left-fixed holds one Y, centred on the list block, for every row", async () => {
    window.history.replaceState({}, "", "/work?thumb=left-fixed");

    const { container } = renderList();

    mockListGeometry();
    hoverRow(container, 0, 200);

    // List block 160-560, centred: 160 + 200 - 180 = 180.
    await waitFor(() => expect(thumbXY()).toEqual({ x: 132, y: 180 }));

    hoverRow(container, 2, 800);
    await waitFor(() => expect(thumbXY()).toEqual({ x: 132, y: 180 }));
  });

  it("parks the panel in the left margin without moving the list", async () => {
    window.history.replaceState({}, "", "/work?thumb=panel");
    mockPanelGeometry();

    const { container } = renderList();
    const group = container.querySelector<HTMLElement>(".wd-work-group")!;
    const clip = document.body.querySelector<HTMLElement>(
      ".wd-work-thumb-clip",
    )!;
    const panel = clip.querySelector<HTMLElement>(".wd-work-panel")!;
    const front = () =>
      panel.querySelector<HTMLElement>(".wd-work-thumb-img[data-front]");

    // The group is still just the list: no dock, no shift, no markup change.
    expect(group.children).toHaveLength(1);
    expect(container.querySelector(".wd-work-panel")).toBeNull();
    expect(container.querySelector(".wd-work-column")).toHaveAttribute(
      "data-thumb",
      "panel",
    );
    expect(panel).not.toHaveAttribute("data-work-active");

    hoverRow(container, 1);

    expect(panel).toHaveAttribute("data-work-active");
    expect(group).toHaveAttribute("data-work-dim");
    expect(group).not.toHaveAttribute("data-work-pointer");
    expect(front()?.firstElementChild).not.toBeNull();

    // Margin 16+16 to list-32 is 680px, so the box caps at 600 and hugs the
    // list (right edge list left - 32) at the shipped thumb's 4:3.
    await waitFor(() => expect(panel.style.width).toBe("600px"));
    expect(panel.style.height).toBe("450px");
    expect(panel.style.transform).toBe("translate3d(112px, 221px, 0px)");

    const firstFront = front();

    hoverRow(container, 2);

    // Same two-layer crossfade; the front slot moved to the other layer.
    expect(front()).not.toBe(firstFront);
    expect(container.querySelectorAll(".wd-work-row-item")[2]).toHaveAttribute(
      "data-work-current",
    );
  });

  it("yields the panel to the shipped thumb when the margin is too small", () => {
    window.history.replaceState({}, "", "/work?thumb=panel");
    mockListGeometry();

    const { container } = renderList();
    const clip = document.body.querySelector<HTMLElement>(
      ".wd-work-thumb-clip",
    )!;

    // List at 132, surface at 100: 132 - 32 - (100 + 16) = -16.
    expect(container.querySelector(".wd-work-column")).toHaveAttribute(
      "data-thumb",
      "cursor",
    );
    expect(clip.querySelector(".wd-work-panel")).toBeNull();
    expect(clip.querySelector(".wd-work-thumb")).not.toBeNull();
  });

  it("swaps the panel media on the reference's 1s expo-out fade", () => {
    renderList();

    const css = readFileSync(
      join(process.cwd(), "src", "components", "work", "work-list.css"),
      "utf8",
    );

    expect(css).toMatch(
      /\.wd-work-panel \.wd-work-thumb-img \{[^}]*transition-duration: 1000ms;[^}]*transition-timing-function: cubic-bezier\(0\.19, 1, 0\.22, 1\);/,
    );
    // Reduced motion swaps on the same frame.
    expect(css).toMatch(
      /prefers-reduced-motion: reduce[\s\S]*?\.wd-work-panel \.wd-work-thumb-img \{\s*transition: none;/,
    );
  });

  it("left-snap jumps with no glide under reduced motion", async () => {
    reduceMotion = true;
    window.history.replaceState({}, "", "/work?thumb=left-snap");

    const { container } = renderList();

    mockListGeometry();
    hoverRow(container, 0);
    await waitFor(() => expect(thumbXY()).toEqual({ x: 132, y: 120 }));

    hoverRow(container, 2);

    // One frame later it is already on the new row, not part-way there.
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => resolve());
    });
    expect(thumbXY()).toEqual({ x: 132, y: 230 });
  });

  it("drops a stale hover when a cached view is revealed again", () => {
    window.history.replaceState({}, "", "/work?thumb=left-snap");

    const view = render(<CachedList visible />);
    const group = view.container.querySelector<HTMLElement>(".wd-work-group")!;
    const clip = document.body.querySelector<HTMLElement>(
      ".wd-work-thumb-clip",
    )!;
    const first =
      view.container.querySelector<HTMLElement>(".wd-work-row-item")!;

    fireEvent.pointerMove(first.querySelector<HTMLElement>(".wd-work-row")!, {
      clientX: 700,
      clientY: 500,
    });

    expect(clip).toHaveAttribute("data-work-active");
    expect(group).toHaveAttribute("data-work-dim");

    // The route is hidden while a study shows, then revealed: no pointer event
    // happens between the two, so only the reveal itself can clear the hover.
    view.rerender(<CachedList visible={false} />);
    view.rerender(<CachedList visible />);

    expect(clip).not.toHaveAttribute("data-work-active");
    expect(group).not.toHaveAttribute("data-work-dim");
    expect(first).not.toHaveAttribute("data-work-current");
  });

  it("falls back to the shipped cursor thumb where the modes do not fit", () => {
    leftFits = false;

    for (const mode of ["left-snap", "panel"] as const) {
      window.history.replaceState({}, "", `/work?thumb=${mode}`);

      const { container, unmount } = renderList();
      const clip = document.body.querySelector<HTMLElement>(
        ".wd-work-thumb-clip",
      )!;

      expect(container.querySelector(".wd-work-column")).toHaveAttribute(
        "data-thumb",
        "cursor",
      );
      expect(clip).toHaveAttribute("data-work-variant", "cursor");
      expect(container.querySelector(".wd-work-panel")).toBeNull();

      fireEvent.pointerMove(
        container.querySelector<HTMLElement>(".wd-work-row")!,
        { clientX: 100, clientY: 100 },
      );

      // The shipped variant still hides the cursor and follows the pointer.
      expect(container.querySelector(".wd-work-group")).toHaveAttribute(
        "data-work-pointer",
      );

      unmount();
    }
  });

  it("hides the cursor and dims the other rows only while a row is hovered", () => {
    const { container } = renderList();
    const group = container.querySelector<HTMLElement>(".wd-work-group")!;
    const list = container.querySelector<HTMLElement>(".wd-work-list-column")!;
    const first = container.querySelector<HTMLElement>(".wd-work-row-item")!;
    const link = first.querySelector<HTMLElement>(".wd-work-row")!;

    fireEvent.pointerMove(link, { clientX: 100, clientY: 100 });

    expect(first).toHaveAttribute("data-work-current");
    expect(group).toHaveAttribute("data-work-pointer");
    expect(group).toHaveAttribute("data-work-dim");
    expect(
      document.body
        .querySelector(".wd-work-thumb-clip")
        ?.hasAttribute("data-work-active"),
    ).toBe(true);

    fireEvent.pointerLeave(list);

    expect(first).not.toHaveAttribute("data-work-current");
    expect(group).not.toHaveAttribute("data-work-pointer");
    expect(group).not.toHaveAttribute("data-work-dim");
    expect(
      document.body
        .querySelector(".wd-work-thumb-clip")
        ?.hasAttribute("data-work-active"),
    ).toBe(false);
  });
});
