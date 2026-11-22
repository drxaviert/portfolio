import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DrawerActionsProvider } from "../drawer-actions";
import { ReaderBackMenu } from "./back-menu";
import {
  BACK_MENU_STORAGE_KEY,
  syncBackMenuVariantFromEnvironment,
} from "./back-menu-variant";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: () => undefined, replace: () => undefined }),
}));

function setVariant(variant: string) {
  window.history.replaceState({}, "", `/work/systems-in-motion?bm=${variant}`);
  syncBackMenuVariantFromEnvironment();
}

function renderMenu() {
  const stepBack = vi.fn();
  const close = vi.fn();
  const exit = vi.fn();

  const view = render(
    <DrawerActionsProvider close={close} stepBack={stepBack} exit={exit}>
      <ReaderBackMenu title="Systems in motion" />
    </DrawerActionsProvider>,
  );

  return { ...view, stepBack, close, exit };
}

function root() {
  return document.querySelector<HTMLElement>(".bm-root")!;
}

function link() {
  return screen.getByRole("link", { name: "Back to work" });
}

function chevron() {
  return document.querySelector<HTMLButtonElement>(".bm-chevron")!;
}

function panel() {
  return document.querySelector<HTMLElement>(".bm-panel")!;
}

function hoverEnter() {
  fireEvent.pointerEnter(root(), { pointerType: "mouse" });
}

function hoverLeave() {
  fireEvent.pointerLeave(root(), { pointerType: "mouse" });
}

beforeEach(() => {
  vi.useFakeTimers();
  window.localStorage.clear();
  setVariant("dropdown");
  syncBackMenuVariantFromEnvironment();
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches: query.includes("hover"),
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
  vi.useRealTimers();
  vi.unstubAllGlobals();
  window.history.replaceState({}, "", "/work/systems-in-motion");
});

describe("SplitBackMenu resting control", () => {
  it("shows the label and a chevron at rest, with the card closed", () => {
    renderMenu();

    expect(link()).toHaveTextContent("Work");
    expect(chevron()).toHaveAttribute("aria-label", "Open work menu");
    expect(chevron()).toHaveAttribute("aria-expanded", "false");
    expect(chevron()).toHaveAttribute("aria-haspopup", "menu");
    expect(chevron().querySelector("path")).toHaveAttribute(
      "d",
      "M3 5.25 7 9.25 11 5.25",
    );
    expect(panel()).toHaveAttribute("data-open", "false");
    expect(panel()).toHaveAttribute("aria-hidden", "true");
  });

  it("renders the side chevron pointing right", () => {
    setVariant("side");
    renderMenu();

    expect(root()).toHaveAttribute("data-bm-variant", "side");
    expect(panel()).toHaveClass("bm-side");
    expect(chevron().querySelector("path")).toHaveAttribute(
      "d",
      "M5.25 3 9.25 7 5.25 11",
    );
  });
});

describe("SplitBackMenu hover", () => {
  it("waits for the intent delay, then opens", () => {
    renderMenu();

    hoverEnter();
    act(() => vi.advanceTimersByTime(149));
    expect(chevron()).toHaveAttribute("aria-expanded", "false");

    act(() => vi.advanceTimersByTime(1));
    expect(chevron()).toHaveAttribute("aria-expanded", "true");
    expect(panel()).toHaveAttribute("data-open", "true");
  });

  it("keeps the menu open while the pointer crosses into it", () => {
    renderMenu();

    hoverEnter();
    act(() => vi.advanceTimersByTime(150));

    // The gap outside the control and the card: the leave starts the grace
    // timer, but re-entering the wrapper cancels it.
    hoverLeave();
    act(() => vi.advanceTimersByTime(100));
    hoverEnter();
    act(() => vi.advanceTimersByTime(400));

    expect(chevron()).toHaveAttribute("aria-expanded", "true");
  });

  it("closes after the grace period, not on the leave itself", () => {
    renderMenu();

    hoverEnter();
    act(() => vi.advanceTimersByTime(150));

    hoverLeave();
    act(() => vi.advanceTimersByTime(199));
    expect(chevron()).toHaveAttribute("aria-expanded", "true");

    act(() => vi.advanceTimersByTime(1));
    expect(chevron()).toHaveAttribute("aria-expanded", "false");
  });

  it("does not open for a touch pointer, but the label still goes to Work", () => {
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

    const { stepBack } = renderMenu();

    fireEvent.pointerEnter(root(), { pointerType: "touch" });
    act(() => vi.advanceTimersByTime(500));

    expect(chevron()).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(link());
    expect(stepBack).toHaveBeenCalledTimes(1);
  });

  it("opens the card when the touch user taps the chevron", () => {
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

    renderMenu();
    fireEvent.click(chevron());
    act(() => vi.runAllTimers());

    expect(chevron()).toHaveAttribute("aria-expanded", "true");
    expect(panel()).toHaveAttribute("data-open", "true");
  });
});

describe("SplitBackMenu actions", () => {
  it("sends Work back to the index through the drawer action", () => {
    const { stepBack, close } = renderMenu();

    hoverEnter();
    act(() => vi.advanceTimersByTime(150));
    fireEvent.click(
      screen.getByRole("menuitem", { name: "Work, All projects" }),
    );

    expect(stepBack).toHaveBeenCalledTimes(1);
    expect(close).not.toHaveBeenCalled();
  });

  it("closes the whole drawer for Home", () => {
    const { stepBack, close } = renderMenu();

    hoverEnter();
    act(() => vi.advanceTimersByTime(150));
    fireEvent.click(
      screen.getByRole("menuitem", { name: "Home, Back to start" }),
    );

    expect(close).toHaveBeenCalledTimes(1);
    expect(stepBack).not.toHaveBeenCalled();
  });

  it("keeps the label itself going to Work", () => {
    const { stepBack, close } = renderMenu();

    fireEvent.click(link());

    expect(stepBack).toHaveBeenCalledTimes(1);
    expect(close).not.toHaveBeenCalled();
  });

  it("opens the card from the chevron and focuses its first item", () => {
    renderMenu();

    fireEvent.click(chevron());
    act(() => vi.runAllTimers());

    expect(chevron()).toHaveAttribute("aria-expanded", "true");
    expect(document.activeElement).toBe(
      screen.getByRole("menuitem", { name: "Work, All projects" }),
    );
  });
});

describe("SplitBackMenu keyboard and Escape", () => {
  it("opens from ArrowDown on the label and focuses the first item", () => {
    renderMenu();

    fireEvent.keyDown(link(), { key: "ArrowDown" });
    act(() => vi.runAllTimers());

    expect(chevron()).toHaveAttribute("aria-expanded", "true");
    expect(document.activeElement).toBe(
      screen.getByRole("menuitem", { name: "Work, All projects" }),
    );
  });

  it("opens from Space on the label too", () => {
    renderMenu();

    fireEvent.keyDown(link(), { key: " " });
    act(() => vi.runAllTimers());

    expect(chevron()).toHaveAttribute("aria-expanded", "true");
  });

  it("closes on a pointerdown outside", () => {
    renderMenu();

    hoverEnter();
    act(() => vi.advanceTimersByTime(150));
    expect(chevron()).toHaveAttribute("aria-expanded", "true");

    fireEvent.pointerDown(document.body);
    expect(chevron()).toHaveAttribute("aria-expanded", "false");
  });

  it("moves between items with the arrow keys", () => {
    renderMenu();

    fireEvent.keyDown(link(), { key: "ArrowDown" });
    act(() => vi.runAllTimers());
    fireEvent.keyDown(panel(), { key: "ArrowDown" });

    expect(document.activeElement).toBe(
      screen.getByRole("menuitem", { name: "Home, Back to start" }),
    );
  });

  it("eats the first Escape and leaves the drawer's Escape for the next press", () => {
    const { stepBack, close, exit } = renderMenu();
    const drawerEsc = vi.fn();

    function onWindowKey(event: KeyboardEvent) {
      if (event.key === "Escape" && !event.defaultPrevented) drawerEsc();
    }

    window.addEventListener("keydown", onWindowKey);

    fireEvent.click(chevron());
    act(() => vi.runAllTimers());
    fireEvent.keyDown(document, { key: "Escape" });

    expect(chevron()).toHaveAttribute("aria-expanded", "false");
    expect(drawerEsc).not.toHaveBeenCalled();
    expect(stepBack).not.toHaveBeenCalled();
    expect(close).not.toHaveBeenCalled();
    expect(exit).not.toHaveBeenCalled();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(drawerEsc).toHaveBeenCalledTimes(1);

    window.removeEventListener("keydown", onWindowKey);
  });

  it("closes when focus tabs out", () => {
    renderMenu();

    fireEvent.click(chevron());
    act(() => vi.runAllTimers());

    act(() => {
      fireEvent.blur(root(), { relatedTarget: document.body });
    });

    expect(chevron()).toHaveAttribute("aria-expanded", "false");
  });
});

describe("InlineBackMenu resting pair", () => {
  it("is always visible and has both actions in the tab order", () => {
    setVariant("inline");
    const { stepBack, close } = renderMenu();

    const group = screen.getByRole("group", { name: "Work navigation" });
    const work = screen.getByRole("button", { name: "Work" });
    const home = screen.getByRole("button", { name: "Home" });

    expect(group).toHaveClass("bm-inline-track");
    expect(work).toHaveAttribute("tabindex", "0");
    expect(home).toHaveAttribute("tabindex", "0");
    expect(screen.queryByRole("link", { name: "Back to work" })).toBeNull();
    expect(document.querySelector('[role="menu"]')).toBeNull();

    fireEvent.click(work);
    expect(stepBack).toHaveBeenCalledTimes(1);

    stepBack.mockClear();
    fireEvent.click(home);
    expect(close).toHaveBeenCalledTimes(1);
    expect(stepBack).not.toHaveBeenCalled();
  });

  it("keeps the selected Work capsule at rest and shows the hover layer on focus", () => {
    setVariant("inline");
    renderMenu();

    const work = screen.getByRole("button", { name: "Work" });
    const home = screen.getByRole("button", { name: "Home" });
    const hoverLayer = document.querySelector(".shape-layer--hover");

    expect(work).toHaveClass("bg-toggle-selected");
    expect(hoverLayer).not.toHaveClass("is-visible");

    fireEvent.focus(work);
    expect(hoverLayer).toHaveClass("is-visible");

    fireEvent.focus(home);
    expect(hoverLayer).toHaveClass("is-visible");
  });
});

describe("CrumbBackMenu resting breadcrumb", () => {
  it("is always visible with Home, Work and the static title", () => {
    setVariant("crumb");
    const { stepBack, close } = renderMenu();

    const nav = screen.getByRole("navigation", { name: "Breadcrumb" });

    expect(nav).toHaveClass("bm-crumb");
    expect(screen.getByRole("link", { name: "Home" })).toHaveAttribute(
      "href",
      "/",
    );
    expect(screen.getByRole("link", { name: "Work" })).toHaveAttribute(
      "href",
      "/work",
    );
    expect(screen.getByText("Systems in motion")).toHaveClass(
      "bm-crumb-current",
    );
    expect(screen.getByText("Systems in motion")).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(document.querySelector('[role="menu"]')).toBeNull();

    fireEvent.click(screen.getByRole("link", { name: "Work" }));
    expect(stepBack).toHaveBeenCalledTimes(1);

    stepBack.mockClear();
    fireEvent.click(screen.getByRole("link", { name: "Home" }));
    expect(close).toHaveBeenCalledTimes(1);
    expect(stepBack).not.toHaveBeenCalled();
  });
});

describe("ReaderBackMenu variant selection", () => {
  it("reads the variant from ?bm and remembers it", () => {
    setVariant("side");
    const { unmount } = renderMenu();

    expect(root()).toHaveAttribute("data-bm-variant", "side");
    expect(panel()).toHaveClass("bm-side");
    expect(window.localStorage.getItem(BACK_MENU_STORAGE_KEY)).toBe("side");
    unmount();
  });

  it("falls back to the remembered variant without a query", () => {
    window.localStorage.setItem(BACK_MENU_STORAGE_KEY, "crumb");
    window.history.replaceState({}, "", "/work/systems-in-motion");
    syncBackMenuVariantFromEnvironment();

    renderMenu();

    expect(root()).toHaveAttribute("data-bm-variant", "crumb");
    expect(
      screen.getByRole("navigation", { name: "Breadcrumb" }),
    ).toBeInTheDocument();
  });

  it("uses the menu role and hints for the dropdown and side cards", () => {
    setVariant("dropdown");
    const view = renderMenu();
    expect(document.querySelector('[role="menu"]')).toHaveClass("bm-dropdown");
    expect(screen.getByText("All projects")).toBeInTheDocument();
    view.unmount();

    setVariant("side");
    renderMenu();
    expect(document.querySelector('[role="menu"]')).toHaveClass("bm-side");
    expect(screen.getByText("Back to start")).toBeInTheDocument();
  });
});
