import { createEvent, fireEvent, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { getWork } from "@/lib/work";
import { READER_TITLE_ID, Reader } from "./reader";
import { DrawerActionsProvider } from "./drawer-actions";

const { push, replace } = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
}));
const stepBack = vi.fn();
const close = vi.fn();

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
  const meta = getWork("ai-agents-google");
  if (!meta) throw new Error("missing fixture");
  return meta;
}

beforeEach(() => {
  push.mockReset();
  replace.mockReset();
  stepBack.mockReset();
  close.mockReset();
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
      <DrawerActionsProvider close={close} stepBack={stepBack} exit={vi.fn()}>
        <Reader meta={featured()}>{children}</Reader>
      </DrawerActionsProvider>
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

  it("puts the shared Breadcrumb above the article, before the column", () => {
    renderReader(<p>Case-study body</p>);

    const nav = screen.getByRole("navigation", { name: "Breadcrumb" });
    const home = screen.getByRole("link", { name: "Home" });
    const work = screen.getByRole("link", { name: "Work" });
    const title = screen.getByText("AI AGENTS | GOOGLE", {
      selector: ".breadcrumb-current",
    });
    const row = document.querySelector(".wd-reader-back-row");
    const column = document.querySelector(".wd-reader-column");

    expect(nav).toHaveTextContent("Home/Work/AI AGENTS | GOOGLE");
    expect(home).toHaveAttribute("href", "/");
    expect(work).toHaveAttribute("href", "/work");
    expect(title).toHaveAttribute("aria-current", "page");
    expect(title.closest("a")).toBeNull();
    expect(nav.closest(".wd-reader-back-row")).toBe(row);
    expect(
      row!.compareDocumentPosition(column!) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

    const workClick = createEvent.click(work);
    fireEvent(work, workClick);
    expect(workClick.defaultPrevented).toBe(true);
    expect(stepBack).toHaveBeenCalledTimes(1);

    const homeClick = createEvent.click(home);
    fireEvent(home, homeClick);
    expect(homeClick.defaultPrevented).toBe(true);
    expect(close).toHaveBeenCalledTimes(1);
  });

  it("no longer puts the way back in the rail or the thumb pair", () => {
    renderReader(<p>Case-study body</p>);

    const rail = document.querySelector<HTMLElement>(".wd-rail");
    const thumb = document.querySelector<HTMLElement>(".wd-reader-actions");

    expect(rail?.querySelector("a")).toBeNull();
    expect(thumb?.querySelector("a")).toBeNull();
    expect(rail?.querySelector(".wd-rail-top")).not.toBeNull();
    expect(thumb?.querySelector(".wd-reader-action")).not.toBeNull();
  });

  it("anchors the reach-to-top rail to the whole column", () => {
    renderReader(<p>Case-study body</p>);

    const rail = document.querySelector<HTMLElement>(".wd-rail");
    const column = document.querySelector<HTMLElement>(".wd-reader-column");

    // The rail must span the article for the sticky "↑ Top" to hold at the
    // foot while the study scrolls. The way back lives above the column now.
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
      name: "Next project: KLARIS",
    });

    expect(next).toHaveAttribute("href", "/work/klaris");
    expect(next).toHaveAttribute("data-replace", "false");
  });

  it("does not intercept the next-study link", () => {
    // The drawer stays and its content cross-fades (drawer-shell.tsx): the link
    // is a plain push, with no fade of its own to schedule.
    const fade = vi.spyOn(Element.prototype, "animate");
    renderReader(<p>Case-study body</p>);

    const next = screen.getByRole("link", {
      name: "Next project: KLARIS",
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
