import { fireEvent, render } from "@testing-library/react";
import { Activity } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { listWork } from "@/lib/work";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { WorkList } from "./work-list";
import { INDEX_SCROLL_ID, INDEX_TITLE_ID } from "./work-index-ids";

const works = listWork();
const DOCK_QUERY = "(min-width: 1200px) and (hover: hover) and (pointer: fine)";

/** Whether the viewport is wide enough for the docked variant in this test. */
let dockFits = true;

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

beforeEach(() => {
  dockFits = true;
  window.history.replaceState({}, "", "/work");
  document.documentElement.removeAttribute("data-work-thumb");
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      // The list only reacts to a fine pointer; reduced motion stays off.
      matches:
        query === "(hover: hover) and (pointer: fine)" ||
        (dockFits && query === DOCK_QUERY),
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

    expect(container.querySelector(".wd-work-column")).toHaveAttribute(
      "data-thumb",
      "cursor",
    );
    expect(container.querySelector(".wd-work-dock")).toBeNull();
    expect(document.body.querySelector(".wd-work-thumb-clip")).not.toBeNull();
    expect(document.documentElement).not.toHaveAttribute("data-work-thumb");
  });

  it("docks the thumbnail on the left for ?thumb=left, cursor visible", () => {
    window.history.replaceState({}, "", "/work?thumb=left");

    const { container } = renderList();
    const group = container.querySelector<HTMLElement>(".wd-work-group")!;
    const list = container.querySelector<HTMLElement>(".wd-work-list-column")!;
    const dock = container.querySelector<HTMLElement>(".wd-work-dock")!;
    const first = container.querySelector<HTMLElement>(".wd-work-row-item")!;

    expect(container.querySelector(".wd-work-column")).toHaveAttribute(
      "data-thumb",
      "left",
    );
    expect(dock).not.toBeNull();
    // The document marker drives the docked layout CSS (set pre-paint by a
    // hard load); the docked panel replaces the cursor-follow layer, and the
    // cursor stays visible.
    expect(document.documentElement).toHaveAttribute("data-work-thumb", "left");
    expect(document.body.querySelector(".wd-work-thumb-clip")).toBeNull();
    expect(dock).not.toHaveAttribute("data-work-active");

    fireEvent.pointerMove(first.querySelector<HTMLElement>(".wd-work-row")!, {
      clientX: 100,
      clientY: 100,
    });

    expect(first).toHaveAttribute("data-work-current");
    expect(group).toHaveAttribute("data-work-dim");
    expect(group).not.toHaveAttribute("data-work-pointer");
    expect(dock).toHaveAttribute("data-work-active");

    // One front slot, holding the hovered row's cover.
    const fronts = dock.querySelectorAll(".wd-work-thumb-img[data-front]");
    expect(fronts).toHaveLength(1);
    expect(fronts[0]?.firstElementChild).not.toBeNull();

    // Moving to the second row swaps the front slot through the other layer.
    const second =
      container.querySelectorAll<HTMLElement>(".wd-work-row-item")[1];
    const frontBefore = [
      ...dock.querySelectorAll(".wd-work-thumb-img"),
    ].indexOf(fronts[0]);

    fireEvent.pointerMove(second.querySelector<HTMLElement>(".wd-work-row")!, {
      clientX: 120,
      clientY: 180,
    });

    const frontAfter = [
      ...dock.querySelectorAll(".wd-work-thumb-img[data-front]"),
    ][0];
    expect(
      [...dock.querySelectorAll(".wd-work-thumb-img")].indexOf(frontAfter),
    ).not.toBe(frontBefore);
    expect(second).toHaveAttribute("data-work-current");

    fireEvent.pointerLeave(list);

    expect(dock).not.toHaveAttribute("data-work-active");
    expect(group).not.toHaveAttribute("data-work-dim");
  });

  it("drops a stale hover when a cached view is revealed again", () => {
    window.history.replaceState({}, "", "/work?thumb=left");

    const view = render(<CachedList visible />);
    const group = view.container.querySelector<HTMLElement>(".wd-work-group")!;
    const dock = view.container.querySelector<HTMLElement>(".wd-work-dock")!;
    const first =
      view.container.querySelector<HTMLElement>(".wd-work-row-item")!;

    fireEvent.pointerMove(first.querySelector<HTMLElement>(".wd-work-row")!, {
      clientX: 100,
      clientY: 100,
    });

    expect(dock).toHaveAttribute("data-work-active");
    expect(group).toHaveAttribute("data-work-dim");

    // The route is hidden while a study shows, then revealed: no pointer event
    // happens between the two, so only the reveal itself can clear the hover.
    view.rerender(<CachedList visible={false} />);
    view.rerender(<CachedList visible />);

    expect(dock).not.toHaveAttribute("data-work-active");
    expect(group).not.toHaveAttribute("data-work-dim");
    expect(first).not.toHaveAttribute("data-work-current");
  });

  it("falls back to the shipped cursor thumb where the dock does not fit", () => {
    dockFits = false;
    window.history.replaceState({}, "", "/work?thumb=left");

    const { container } = renderList();

    expect(container.querySelector(".wd-work-column")).toHaveAttribute(
      "data-thumb",
      "cursor",
    );
    expect(container.querySelector(".wd-work-dock")).toBeNull();
    expect(document.body.querySelector(".wd-work-thumb-clip")).not.toBeNull();
    expect(document.documentElement).not.toHaveAttribute("data-work-thumb");
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
