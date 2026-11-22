import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DrawerActionsProvider } from "../drawer-actions";
import { ReaderBackMenu } from "./back-menu";
import { BACK_MENU_STORAGE_KEY } from "./back-menu-variant";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: () => undefined, replace: () => undefined }),
}));

function setVariant(variant: string) {
  window.history.replaceState({}, "", `/work/systems-in-motion?bm=${variant}`);
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

describe("ReaderBackMenu hover", () => {
  it("waits for the intent delay, then opens", () => {
    renderMenu();

    expect(link()).toHaveAttribute("aria-expanded", "false");

    hoverEnter();
    act(() => vi.advanceTimersByTime(149));
    expect(link()).toHaveAttribute("aria-expanded", "false");

    act(() => vi.advanceTimersByTime(1));
    expect(link()).toHaveAttribute("aria-expanded", "true");
    expect(panel()).toHaveAttribute("data-open", "true");
  });

  it("keeps the menu open while the pointer crosses into it", () => {
    renderMenu();

    hoverEnter();
    act(() => vi.advanceTimersByTime(150));

    // The gap outside the link and the card: the leave starts the grace timer,
    // but re-entering the wrapper (the card) before it fires cancels it.
    hoverLeave();
    act(() => vi.advanceTimersByTime(100));
    hoverEnter();
    act(() => vi.advanceTimersByTime(400));

    expect(link()).toHaveAttribute("aria-expanded", "true");
  });

  it("closes after the grace period, not on the leave itself", () => {
    renderMenu();

    hoverEnter();
    act(() => vi.advanceTimersByTime(150));

    hoverLeave();
    act(() => vi.advanceTimersByTime(199));
    expect(link()).toHaveAttribute("aria-expanded", "true");

    act(() => vi.advanceTimersByTime(1));
    expect(link()).toHaveAttribute("aria-expanded", "false");
  });

  it("does not open for a touch pointer", () => {
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

    expect(link()).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(link());
    expect(stepBack).toHaveBeenCalledTimes(1);
  });
});

describe("ReaderBackMenu actions", () => {
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

  it("keeps the link itself going to Work", () => {
    const { stepBack } = renderMenu();

    fireEvent.click(link());

    expect(stepBack).toHaveBeenCalledTimes(1);
  });
});

describe("ReaderBackMenu keyboard and Escape", () => {
  it("opens from ArrowDown and focuses the first item", () => {
    renderMenu();

    fireEvent.keyDown(link(), { key: "ArrowDown" });
    act(() => vi.runAllTimers());

    expect(link()).toHaveAttribute("aria-expanded", "true");
    expect(document.activeElement).toBe(
      screen.getByRole("menuitem", { name: "Work, All projects" }),
    );
  });

  it("opens from Space too", () => {
    renderMenu();

    fireEvent.keyDown(link(), { key: " " });
    act(() => vi.runAllTimers());

    expect(link()).toHaveAttribute("aria-expanded", "true");
  });

  it("closes on a pointerdown outside", () => {
    renderMenu();

    hoverEnter();
    act(() => vi.advanceTimersByTime(150));
    expect(link()).toHaveAttribute("aria-expanded", "true");

    fireEvent.pointerDown(document.body);
    expect(link()).toHaveAttribute("aria-expanded", "false");
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

    fireEvent.keyDown(link(), { key: "ArrowDown" });
    act(() => vi.runAllTimers());
    fireEvent.keyDown(document, { key: "Escape" });

    expect(link()).toHaveAttribute("aria-expanded", "false");
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

    fireEvent.keyDown(link(), { key: "ArrowDown" });
    act(() => vi.runAllTimers());

    act(() => {
      fireEvent.blur(root(), { relatedTarget: document.body });
    });

    expect(link()).toHaveAttribute("aria-expanded", "false");
  });
});

describe("ReaderBackMenu variants", () => {
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

    renderMenu();

    expect(root()).toHaveAttribute("data-bm-variant", "crumb");
    expect(document.querySelector('[aria-label="Breadcrumb"]')).toHaveClass(
      "bm-crumb",
    );
    expect(screen.getByText("Systems in motion")).toHaveClass(
      "bm-crumb-current",
    );
    expect(document.querySelector('[data-bm-item="home"]')).toHaveAttribute(
      "href",
      "/",
    );
  });

  it("renders the inline pair through the theme toggle's segments", () => {
    setVariant("inline");
    const { close } = renderMenu();

    hoverEnter();
    act(() => vi.advanceTimersByTime(150));

    const group = screen.getByRole("radiogroup", { name: "Work navigation" });
    expect(group).toHaveClass("bm-inline-track");
    expect(screen.getByRole("radio", { name: "Work" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("radio", { name: "Home" }));
    expect(close).toHaveBeenCalledTimes(1);
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
