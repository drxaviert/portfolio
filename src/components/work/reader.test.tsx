import {
  createEvent,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { getWork } from "@/lib/work";
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

describe("reader content", () => {
  it("is content only: the drawer's panel owns the dialog", () => {
    renderReader(<p>Case-study body</p>);

    // The panel, its role and its label belong to DrawerShell now; a study just
    // fills it.
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(document.getElementById(READER_TITLE_ID)).toBeInTheDocument();
  });

  it("anchors the ways-back rail to the whole column", () => {
    renderReader(<p>Case-study body</p>);

    const rail = document.querySelector<HTMLElement>(".wd-rail");
    const column = document.querySelector<HTMLElement>(".wd-reader-column");

    // The rail must start at the top of the scroll area, not below the cover,
    // or "← Work" cannot pin there on the first paint.
    expect(rail?.parentElement).toBe(column);
  });

  it("does not render a second nav inside the study", () => {
    renderReader(<p>Case-study body</p>);

    expect(
      screen.queryByRole("navigation", { name: "Primary" }),
    ).not.toBeInTheDocument();
  });

  it("links the next study, so Back returns to this one", () => {
    renderReader(<p>Case-study body</p>);

    const next = screen.getByRole("link", {
      name: "Next project: The title sequence",
    });

    expect(next).toHaveAttribute("href", "/work/title-sequence");
    expect(next).toHaveAttribute("data-replace", "false");
  });

  it("does not intercept the next-study link", () => {
    // The drawer stays and its content cross-fades (drawer-shell.tsx): the link
    // is a plain push, with no fade of its own to schedule.
    const fade = vi.spyOn(Element.prototype, "animate");
    renderReader(<p>Case-study body</p>);

    const next = screen.getByRole("link", {
      name: "Next project: The title sequence",
    });
    const click = createEvent.click(next);
    fireEvent(next, click);

    expect(click.defaultPrevented).toBe(false);
    expect(fade).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
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
