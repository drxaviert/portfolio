import { fireEvent, render } from "@testing-library/react";
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

beforeEach(() => {
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      // The list only reacts to a fine pointer; reduced motion stays off.
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
