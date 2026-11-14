import { render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { getWork } from "@/lib/work";
import { READER_TITLE_ID, Reader } from "./reader";

// The only observable difference between push and replace is the prop Next's
// Link receives; a plain anchor keeps the assertion version-independent.
vi.mock("next/link", () => ({
  default: ({
    href,
    replace,
    children,
    ...rest
  }: {
    href: string;
    replace?: boolean;
    children: ReactNode;
  } & Record<string, unknown>) => (
    <a href={href} data-replace={replace ? "true" : "false"} {...rest}>
      {children}
    </a>
  ),
}));

function featured() {
  const meta = getWork("systems-in-motion");
  if (!meta) throw new Error("missing fixture");
  return meta;
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

function renderReader(
  children: ReactNode,
  mode: "overlay" | "page" = "overlay",
) {
  return render(
    <ThemeProvider>
      <Reader meta={featured()} mode={mode}>
        {children}
      </Reader>
    </ThemeProvider>,
  );
}

describe("reader overlay", () => {
  it("renders a labelled modal dialog", () => {
    renderReader(<p>Case-study body</p>);

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAttribute("aria-labelledby", READER_TITLE_ID);
  });

  it("anchors the ways-back rail to the whole column", () => {
    renderReader(<p>Case-study body</p>);

    const rail = document.querySelector<HTMLElement>(".wd-rail");
    const column = document.querySelector<HTMLElement>(".wd-reader-column");

    // The rail must start at the top of the scroll area, not below the cover,
    // or "← Work" cannot pin there on the first paint.
    expect(rail?.parentElement).toBe(column);
  });

  it("does not render a second nav inside the panel", () => {
    renderReader(<p>Case-study body</p>);

    const dialog = screen.getByRole("dialog");

    expect(
      within(dialog).queryByRole("navigation", { name: "Primary" }),
    ).not.toBeInTheDocument();
  });

  it("replaces history when the next study opens from the overlay", () => {
    renderReader(<p>Case-study body</p>);

    const next = screen.getByRole("link", {
      name: "Next project: The title sequence",
    });

    expect(next).toHaveAttribute("href", "/work/title-sequence");
    expect(next).toHaveAttribute("data-replace", "true");
  });

  it("pushes the next study on a direct load", () => {
    renderReader(<p>Case-study body</p>, "page");

    expect(
      screen.getByRole("link", { name: "Next project: The title sequence" }),
    ).toHaveAttribute("data-replace", "false");
  });
});
