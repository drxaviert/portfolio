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

function renderList() {
  return render(
    <ThemeProvider>
      <WorkList works={works} />
    </ThemeProvider>,
  );
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

/**
 * jsdom has no layout, so the placement code's rects are stubbed. This is the
 * narrow case: the list leaves 16px of margin once the panel's gutters are
 * taken, so the cursor thumbnail is the treatment.
 */
function mockNarrowGeometry() {
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
 * The wide case: surface at 16, list at 744, so the margin is 680px after the
 * 16px gutter and 32px gap. The panel caps at 600 and right-aligns to the
 * list. The first row's top is 221 and the nav's visible top is 120.
 */
function mockWideGeometry() {
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

function hoverRow(container: HTMLElement, index: number, clientY = 500) {
  const row =
    container.querySelectorAll<HTMLElement>(".wd-work-row-item")[index];

  fireEvent.pointerMove(row.querySelector<HTMLElement>(".wd-work-row")!, {
    clientX: 700,
    clientY,
  });
}

beforeEach(() => {
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      // The list only shows a thumbnail on a fine pointer; reduced motion off.
      matches: query === "(hover: hover) and (pointer: fine)",
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
  it("renders one linked row per study with optional year, title, summary and role", () => {
    const { container } = renderList();
    const rows = [...container.querySelectorAll(".wd-work-row-item")];

    expect(rows).toHaveLength(works.length);

    rows.forEach((row, index) => {
      const work = works[index];
      const link = row.querySelector<HTMLAnchorElement>(".wd-work-row");

      expect(row).toHaveAttribute("data-work-index", String(index));
      expect(link).toHaveAttribute("href", `/work/${work.slug}`);
      expect(link).toHaveAccessibleName(
        work.year
          ? `${work.title}, ${work.year}, ${work.role}`
          : `${work.title}, ${work.role}`,
      );
      if (work.year) {
        expect(row.querySelector(".wd-work-year")).toHaveTextContent(work.year);
        expect(link).not.toHaveAttribute("data-work-no-year");
      } else {
        expect(row.querySelector(".wd-work-year")).toBeNull();
        expect(link).toHaveAttribute("data-work-no-year", "");
      }
      expect(row.querySelector(".wd-work-title")).toHaveTextContent(work.title);
      expect(row.querySelector(".wd-work-summary")).toHaveTextContent(
        work.summary,
      );
      expect(row.querySelector(".wd-work-role")).toHaveTextContent(work.role);
    });
  });

  it("shows Current in the year cell for an ongoing study", () => {
    const { container } = renderList();
    const personal = works.find((work) => work.slug === "personal");

    expect(personal).toBeDefined();
    const link = container.querySelector<HTMLAnchorElement>(
      'a.wd-work-row[href="/work/personal"]',
    );

    expect(link).not.toBeNull();
    expect(link).not.toHaveAttribute("data-work-no-year");
    expect(link).toHaveAccessibleName(
      `${personal!.title}, Current, ${personal!.role}`,
    );
    expect(link?.querySelector(".wd-work-year")).toHaveTextContent("Current");
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

  it("shows the margin panel in the empty left margin without moving the list", async () => {
    mockWideGeometry();

    const { container } = renderList();
    const group = container.querySelector<HTMLElement>(".wd-work-group")!;
    const clip = document.body.querySelector<HTMLElement>(
      ".wd-work-thumb-clip",
    )!;
    const panel = clip.querySelector<HTMLElement>(".wd-work-panel")!;
    const rows = container.querySelectorAll<HTMLElement>(".wd-work-row-item");
    const front = () =>
      panel.querySelector<HTMLElement>(".wd-work-thumb-img[data-front]");

    // The list is still just the list: the panel is a fixed box in the clip.
    expect(group.children).toHaveLength(1);
    expect(container.querySelector(".wd-work-panel")).toBeNull();
    expect(clip.querySelector(".wd-work-thumb")).toBeNull();
    expect(panel).not.toHaveAttribute("data-work-active");

    hoverRow(container, 1);

    expect(panel).toHaveAttribute("data-work-active");
    expect(group).toHaveAttribute("data-work-dim");
    expect(group).not.toHaveAttribute("data-work-pointer");
    expect(rows[1]).toHaveAttribute("data-work-current");
    expect(front()?.firstElementChild).not.toBeNull();

    // 680px of margin -> capped at 600, right-aligned to the list (744 - 32).
    await waitFor(() => expect(panel.style.width).toBe("600px"));
    // Row 1's media is 16:9, so the box takes that ratio rather than 4:3.
    expect(panel.style.height).toBe("337.5px");
    expect(panel.style.transform).toBe("translate3d(112px, 221px, 0px)");

    const firstFront = front();

    hoverRow(container, 2);

    // The same two-layer crossfade: the front slot moved to the other layer.
    expect(front()).not.toBe(firstFront);
    expect(container.querySelectorAll(".wd-work-row-item")[2]).toHaveAttribute(
      "data-work-current",
    );
  });

  it("falls back to the cursor thumbnail below the panel's gate", async () => {
    mockNarrowGeometry();

    const { container } = renderList();
    const clip = document.body.querySelector<HTMLElement>(
      ".wd-work-thumb-clip",
    )!;
    const thumb = clip.querySelector<HTMLElement>(".wd-work-thumb")!;
    const group = container.querySelector<HTMLElement>(".wd-work-group")!;

    expect(clip.querySelector(".wd-work-panel")).toBeNull();
    expect(thumb).not.toBeNull();

    hoverRow(container, 1, 500);

    await waitFor(() =>
      expect(thumb.style.transform).toBe("translate3d(460px, 365px, 0px)"),
    );
    expect(group).toHaveAttribute("data-work-dim");
    expect(group).toHaveAttribute("data-work-pointer");
  });

  it("gives the fallback a fresh thumb when the margin gate closes", async () => {
    mockWideGeometry();

    const { container } = renderList();
    const panel = () =>
      document.body.querySelector<HTMLElement>(".wd-work-panel");

    hoverRow(container, 1);
    await waitFor(() => expect(panel()?.style.width).toBe("600px"));

    // A resize moves the list until the margin is too small: the panel yields
    // to the shipped thumb, which must not inherit the panel's inline size.
    mockNarrowGeometry();
    fireEvent(window, new Event("resize"));

    await waitFor(() =>
      expect(document.body.querySelector(".wd-work-thumb")).not.toBeNull(),
    );

    const thumb = document.body.querySelector<HTMLElement>(".wd-work-thumb")!;

    expect(document.body.querySelector(".wd-work-panel")).toBeNull();
    expect(thumb.style.width).toBe("");
    expect(thumb.style.height).toBe("");
  });

  it("swaps the panel media on the 1s expo-out fade", () => {
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

  it("drops a stale hover when a cached view is revealed again", () => {
    mockWideGeometry();

    const view = render(<CachedList visible />);
    const group = view.container.querySelector<HTMLElement>(".wd-work-group")!;
    const panel = document.body.querySelector<HTMLElement>(".wd-work-panel")!;
    const first =
      view.container.querySelector<HTMLElement>(".wd-work-row-item")!;

    hoverRow(view.container, 0);

    expect(panel).toHaveAttribute("data-work-active");
    expect(group).toHaveAttribute("data-work-dim");

    // The route is hidden while a study shows, then revealed: no pointer event
    // happens between the two, so only the reveal itself can clear the hover.
    view.rerender(<CachedList visible={false} />);
    view.rerender(<CachedList visible />);

    expect(panel).not.toHaveAttribute("data-work-active");
    expect(group).not.toHaveAttribute("data-work-dim");
    expect(first).not.toHaveAttribute("data-work-current");
  });

  it("hides the cursor and dims the other rows only while a row is hovered", () => {
    mockNarrowGeometry();

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
