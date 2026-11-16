import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { getWork } from "@/lib/work";
import { announceProgressionEntry, clearProgressionLead } from "./progression";
import { READER_TITLE_ID, Reader } from "./reader";

const { push, replace } = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace }),
}));

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
  clearProgressionLead();
  push.mockReset();
  replace.mockReset();
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

function renderReader(children: ReactNode) {
  return render(
    <ThemeProvider>
      <Reader meta={featured()}>{children}</Reader>
    </ThemeProvider>,
  );
}

describe("reader overlay", () => {
  it("renders a labelled dialog without claiming to be aria-modal", () => {
    renderReader(<p>Case-study body</p>);

    const dialog = screen.getByRole("dialog");
    // The nav is the dialog's sibling in the root layout: aria-modal would
    // remove it from the accessibility tree.
    expect(dialog).not.toHaveAttribute("aria-modal");
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

  it("hands the next study off on the close fade, not a hard cut", async () => {
    const fade = vi.spyOn(Element.prototype, "animate");
    renderReader(<p>Case-study body</p>);

    fireEvent.click(
      screen.getByRole("link", { name: "Next project: The title sequence" }),
    );

    expect(fade).toHaveBeenCalledWith(
      [{ opacity: 1 }, { opacity: 0 }],
      expect.objectContaining({
        duration: 140,
        easing: "ease-in",
        fill: "forwards",
      }),
    );

    // The route moves while the fade is still running.
    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith("/work/title-sequence"),
    );
    expect(push).not.toHaveBeenCalled();
  });

  it("lands the next study's entrance part-way in", () => {
    announceProgressionEntry();
    renderReader(<p>Case-study body</p>);

    const panel = document.querySelector<HTMLElement>(".wd-reader-panel");

    expect(panel?.style.getPropertyValue("--wd-beat-lead")).toBe("-120ms");
    expect(panel).toHaveAttribute("data-progression", "lead");
  });

  it("caps the body measure without narrowing the rest of the column", () => {
    const css = readFileSync(
      join(process.cwd(), "src", "components", "work", "reader.css"),
      "utf8",
    );
    const paragraph = css.match(/\.wd-p \{[^}]*\}/)?.[0];

    expect(paragraph).toMatch(/max-width: 68ch;/);

    // Headings, the intro block and the column keep the full 550px measure.
    expect(css).not.toMatch(/\.wd-h2 \{[^}]*max-width: 68ch/);
    expect(css).not.toMatch(/\.wd-intro-title \{[^}]*max-width: 68ch/);
  });
});
