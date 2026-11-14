import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import {
  applyDayPhase,
  DAY_PHASE_STORAGE_KEY,
  MODE_STORAGE_KEY,
  msUntilNextPhaseBoundary,
} from "@/lib/theme";

vi.mock("@/lib/theme", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/theme")>();

  return {
    ...actual,
    msUntilNextPhaseBoundary: vi.fn(actual.msUntilNextPhaseBoundary),
  };
});

function renderToggle() {
  return render(
    <ThemeProvider>
      <ThemeToggle />
    </ThemeProvider>,
  );
}

function root() {
  return document.documentElement;
}

function phaseRow(): HTMLElement {
  return document.querySelector<HTMLElement>('[data-phase-row="true"]')!;
}

function themeHost(): HTMLElement {
  return screen.getByRole("radiogroup", { name: "Theme" }).parentElement!;
}

/** jsdom has no hover media query of its own. */
function mockHoverCanHover(hover: boolean) {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: hover ? query === "(hover: hover)" : query === "(hover: none)",
    media: query,
    onchange: null,
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent: () => false,
  }));
}

beforeEach(() => {
  applyDayPhase("clock");
  window.localStorage.clear();
  delete root().dataset.mode;
  delete root().dataset.phase;
  delete root().dataset.dayPhase;
  delete root().dataset.phasePreview;
  delete root().dataset.phaseSwitching;
  root().classList.remove("dark");
  vi.mocked(msUntilNextPhaseBoundary).mockClear();
  vi.useRealTimers();
});

afterEach(() => {
  applyDayPhase("clock");
  window.localStorage.clear();
  delete root().dataset.phaseSwitching;
  delete root().dataset.phasePreview;
  Reflect.deleteProperty(document, "hidden");
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("ThemeToggle", () => {
  it("renders Day, Night and Auto with Auto selected by default", () => {
    renderToggle();

    expect(
      screen.getByRole("radiogroup", { name: "Theme" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Day" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Night" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Auto" })).toBeChecked();
  });

  it("applies Night and stores the choice", async () => {
    const user = userEvent.setup();
    renderToggle();

    await user.click(screen.getByRole("radio", { name: "Night" }));

    expect(root().dataset.mode).toBe("night");
    expect(root().dataset.phase).toBe("night");
    expect(root()).toHaveClass("dark");
    expect(window.localStorage.getItem(MODE_STORAGE_KEY)).toBe("night");
    expect(screen.getByRole("radio", { name: "Night" })).toBeChecked();
  });

  it("moves the selection with the arrow keys", async () => {
    const user = userEvent.setup();
    renderToggle();

    await user.click(screen.getByRole("radio", { name: "Day" }));
    await user.keyboard("{ArrowRight}");

    expect(screen.getByRole("radio", { name: "Night" })).toBeChecked();
    expect(window.localStorage.getItem(MODE_STORAGE_KEY)).toBe("night");
  });

  it("still applies the mode when storage throws", async () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("storage blocked");
    });
    const user = userEvent.setup();
    renderToggle();

    await user.click(screen.getByRole("radio", { name: "Night" }));

    expect(root()).toHaveClass("dark");
  });

  it("opens the phone menu with the selected mode checked", async () => {
    const user = userEvent.setup();
    renderToggle();

    await user.click(
      screen.getByRole("button", { name: "Choose theme, currently Auto" }),
    );

    const menu = screen.getByRole("menu", { name: "Theme" });
    expect(menu).toBeInTheDocument();
    expect(screen.getByRole("menuitemradio", { name: "Auto" })).toBeChecked();
  });

  it("chooses a mode from the phone menu and closes it", async () => {
    const user = userEvent.setup();
    renderToggle();

    await user.click(
      screen.getByRole("button", { name: "Choose theme, currently Auto" }),
    );
    await user.click(screen.getByRole("menuitemradio", { name: "Day" }));

    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(root().dataset.mode).toBe("day");
    expect(window.localStorage.getItem(MODE_STORAGE_KEY)).toBe("day");
  });

  it("fires at the next boundary and reschedules", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 1, 7, 59));
    renderToggle();

    expect(root().dataset.phase).toBe("dawn");

    act(() => {
      vi.advanceTimersByTime(60_000 + 250);
    });

    expect(root().dataset.mode).toBe("auto");
    expect(root().dataset.phase).toBe("day");
    expect(root().dataset.phaseSwitching).toBe("auto");

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(root().dataset.phaseSwitching).toBeUndefined();

    // 17:00 is 9h away; the 6h cap re-checks, then the remainder lands.
    act(() => {
      vi.advanceTimersByTime(9 * 60 * 60 * 1000 + 1000);
    });

    expect(root().dataset.phase).toBe("dusk");
  });

  it("follows clock boundaries in Day mode, including the 2:00 mirror", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 1, 1, 0));
    window.localStorage.setItem(MODE_STORAGE_KEY, "day");
    renderToggle();

    expect(root().dataset.phase).toBe("day");

    act(() => {
      vi.advanceTimersByTime(60 * 60 * 1000 + 250);
    });

    expect(root().dataset.phase).toBe("dawn");
  });

  it("does not schedule a boundary timer in Night mode", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 1, 7, 0));
    window.localStorage.setItem(MODE_STORAGE_KEY, "night");
    renderToggle();

    expect(root().dataset.phase).toBe("night");
    expect(vi.mocked(msUntilNextPhaseBoundary)).not.toHaveBeenCalled();
  });

  it("clears the boundary timer on unmount", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 1, 7, 59));
    const view = renderToggle();

    expect(root().dataset.phase).toBe("dawn");

    view.unmount();

    act(() => {
      vi.advanceTimersByTime(60 * 60 * 1000);
    });

    expect(root().dataset.phase).toBe("dawn");
  });

  it("re-evaluates on focus after a clock jump", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 1, 6, 0));
    renderToggle();

    expect(root().dataset.phase).toBe("dawn");

    vi.setSystemTime(new Date(2026, 0, 1, 12, 0));

    act(() => {
      window.dispatchEvent(new Event("focus"));
    });

    expect(root().dataset.phase).toBe("day");
  });

  it("reschedules the boundary timer once when the mode changes", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 1, 7, 0));
    window.localStorage.setItem(MODE_STORAGE_KEY, "night");
    renderToggle();

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(root().dataset.phase).toBe("night");
    expect(vi.mocked(msUntilNextPhaseBoundary)).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("radio", { name: "Auto" }));

    expect(root().dataset.mode).toBe("auto");
    expect(root().dataset.phase).toBe("dawn");
    // The theme-change listener is the single schedule path; a second call
    // would clear and reset the same boundary timer twice per mode change.
    expect(vi.mocked(msUntilNextPhaseBoundary)).toHaveBeenCalledTimes(1);
  });

  it("cancels the boundary timer while hidden and reschedules when visible", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 1, 7, 0));
    renderToggle();

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(root().dataset.phase).toBe("dawn");
    expect(vi.getTimerCount()).toBe(1); // the 08:00 boundary

    Object.defineProperty(document, "hidden", {
      configurable: true,
      get: () => true,
    });

    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });

    expect(vi.getTimerCount()).toBe(0);

    // Time passes while hidden; with no timer the phase must stay put.
    vi.setSystemTime(new Date(2026, 0, 1, 9, 0));
    act(() => {
      vi.advanceTimersByTime(2 * 60 * 60 * 1000);
    });
    expect(root().dataset.phase).toBe("dawn");

    Object.defineProperty(document, "hidden", {
      configurable: true,
      get: () => false,
    });

    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });

    expect(root().dataset.phase).toBe("day");
    expect(vi.getTimerCount()).toBeGreaterThan(0);

    act(() => {
      vi.advanceTimersByTime(8 * 60 * 60 * 1000 + 250);
    });
    expect(root().dataset.phase).toBe("dusk");
  });

  it("clears the boundary timer in Night mode and schedules it again in Auto", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 1, 7, 0));
    renderToggle();

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(root().dataset.phase).toBe("dawn");

    fireEvent.click(screen.getByRole("radio", { name: "Night" }));
    expect(root().dataset.phase).toBe("night");

    act(() => {
      vi.advanceTimersByTime(500);
    });

    // Night never leaves night, so the Auto boundary timer is gone.
    expect(vi.getTimerCount()).toBe(0);

    act(() => {
      vi.advanceTimersByTime(2 * 60 * 60 * 1000);
    });
    expect(root().dataset.phase).toBe("night");

    fireEvent.click(screen.getByRole("radio", { name: "Auto" }));
    expect(root().dataset.phase).toBe("day"); // the clock is now 09:00

    act(() => {
      vi.advanceTimersByTime(8 * 60 * 60 * 1000 + 250);
    });
    expect(root().dataset.phase).toBe("dusk");
  });

  it("shows the Day phase row only after Day opens it", async () => {
    const user = userEvent.setup();
    renderToggle();

    expect(
      screen.queryByRole("radiogroup", { name: "Day phase" }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("radio", { name: "Day" }));

    const row = screen.getByRole("radiogroup", { name: "Day phase" });
    expect(row).toHaveAttribute("data-visible", "true");
    expect(screen.getByRole("radio", { name: "Clock" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Dawn" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Midday" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Dusk" })).toBeInTheDocument();

    await user.click(screen.getByRole("radio", { name: "Night" }));

    expect(
      screen.queryByRole("radiogroup", { name: "Day phase" }),
    ).not.toBeInTheDocument();
    expect(row).toHaveAttribute("data-visible", "false");
    expect(row).toHaveAttribute("aria-hidden", "true");
  });

  it("pins a Day phase at a non-matching hour and stores it", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 1, 12, 0));
    renderToggle();

    fireEvent.click(screen.getByRole("radio", { name: "Day" }));
    expect(root().dataset.phase).toBe("day");

    fireEvent.click(screen.getByRole("radio", { name: "Dusk" }));

    expect(root().dataset.mode).toBe("day");
    expect(root().dataset.phase).toBe("dusk");
    expect(root().dataset.dayPhase).toBe("dusk");
    expect(window.localStorage.getItem(DAY_PHASE_STORAGE_KEY)).toBe("dusk");
  });

  it("keeps the pin while Auto is active and restores it on Day", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 1, 12, 0));
    renderToggle();

    fireEvent.click(screen.getByRole("radio", { name: "Day" }));
    fireEvent.click(screen.getByRole("radio", { name: "Dusk" }));
    expect(root().dataset.phase).toBe("dusk");

    fireEvent.click(screen.getByRole("radio", { name: "Auto" }));
    expect(root().dataset.phase).toBe("day");
    expect(root().dataset.dayPhase).toBe("dusk");

    fireEvent.click(screen.getByRole("radio", { name: "Day" }));
    expect(root().dataset.phase).toBe("dusk");
  });

  it("moves through the Day phase row with the arrow keys", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 1, 12, 0));
    renderToggle();

    fireEvent.click(screen.getByRole("radio", { name: "Day" }));
    expect(screen.getByRole("radio", { name: "Clock" })).toBeChecked();

    fireEvent.keyDown(screen.getByRole("radio", { name: "Clock" }), {
      key: "ArrowRight",
    });

    expect(screen.getByRole("radio", { name: "Dawn" })).toBeChecked();
    expect(root().dataset.phase).toBe("dawn");
    expect(window.localStorage.getItem(DAY_PHASE_STORAGE_KEY)).toBe("dawn");

    fireEvent.keyDown(screen.getByRole("radio", { name: "Dawn" }), {
      key: "End",
    });

    expect(screen.getByRole("radio", { name: "Dusk" })).toBeChecked();
    expect(root().dataset.phase).toBe("dusk");
  });

  it("does not schedule a boundary timer for a pinned Day phase", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 1, 7, 0));
    renderToggle();

    fireEvent.click(screen.getByRole("radio", { name: "Day" }));
    fireEvent.click(screen.getByRole("radio", { name: "Dusk" }));
    expect(root().dataset.phase).toBe("dusk");

    vi.mocked(msUntilNextPhaseBoundary).mockClear();

    act(() => {
      vi.advanceTimersByTime(24 * 60 * 60 * 1000);
    });

    expect(root().dataset.phase).toBe("dusk");
    expect(vi.mocked(msUntilNextPhaseBoundary)).not.toHaveBeenCalled();
  });

  it("adds the phase choices under Day in the phone menu", async () => {
    const user = userEvent.setup();
    renderToggle();

    await user.click(screen.getByRole("radio", { name: "Day" }));
    await user.click(
      screen.getByRole("button", { name: /Choose theme, currently Day/ }),
    );

    expect(
      screen.getByRole("menuitemradio", { name: "Clock" }),
    ).toBeChecked();
    expect(
      screen.getByRole("menuitemradio", { name: "Dawn" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("menuitemradio", { name: "Midday" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("menuitemradio", { name: "Dusk" }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("menuitemradio", { name: "Dusk" }));

    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(root().dataset.phase).toBe("dusk");
    expect(window.localStorage.getItem(DAY_PHASE_STORAGE_KEY)).toBe("dusk");
  });

  it("hides the phone phase choices in Auto", async () => {
    const user = userEvent.setup();
    renderToggle();

    await user.click(
      screen.getByRole("button", { name: /Choose theme, currently Auto/ }),
    );

    expect(
      screen.queryByRole("menuitemradio", { name: "Clock" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("menuitemradio", { name: "Dusk" }),
    ).not.toBeInTheDocument();
  });

  it("offers the phase choices under Day in Night and picks Day plus that phase", async () => {
    const user = userEvent.setup();
    window.localStorage.setItem(MODE_STORAGE_KEY, "night");
    renderToggle();

    await user.click(
      screen.getByRole("button", { name: /Choose theme, currently Night/ }),
    );

    expect(
      screen.getByRole("menuitemradio", { name: "Clock" }),
    ).toBeChecked();

    await user.click(screen.getByRole("menuitemradio", { name: "Dusk" }));

    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(root().dataset.mode).toBe("day");
    expect(root().dataset.phase).toBe("dusk");
    expect(root().dataset.dayPhase).toBe("dusk");
    expect(window.localStorage.getItem(MODE_STORAGE_KEY)).toBe("day");
    expect(window.localStorage.getItem(DAY_PHASE_STORAGE_KEY)).toBe("dusk");
  });

  it("opens the Day row on click and closes it after the pointer leaves", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 1, 12, 0));
    mockHoverCanHover(true);
    renderToggle();

    const day = screen.getByRole("radio", { name: "Day" });
    expect(phaseRow()).toHaveAttribute("data-visible", "false");

    fireEvent.click(day);
    expect(phaseRow()).toHaveAttribute("data-visible", "true");

    fireEvent.pointerOut(themeHost(), { relatedTarget: document.body });

    act(() => {
      vi.advanceTimersByTime(99);
    });
    expect(phaseRow()).toHaveAttribute("data-visible", "true");

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(phaseRow()).toHaveAttribute("data-visible", "false");
  });

  it("cancels the close when the pointer moves into the row", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 1, 12, 0));
    mockHoverCanHover(true);
    renderToggle();

    fireEvent.click(screen.getByRole("radio", { name: "Day" }));
    fireEvent.pointerOut(themeHost(), { relatedTarget: document.body });

    act(() => {
      vi.advanceTimersByTime(50);
    });

    fireEvent.pointerOver(screen.getByRole("radio", { name: "Dusk" }), {
      relatedTarget: document.body,
    });

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(phaseRow()).toHaveAttribute("data-visible", "true");
  });

  it("closes after the pointer leaves Day for another segment", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 1, 12, 0));
    window.localStorage.setItem(MODE_STORAGE_KEY, "day");
    mockHoverCanHover(true);
    renderToggle();

    const day = screen.getByRole("radio", { name: "Day" });
    const night = screen.getByRole("radio", { name: "Night" });

    fireEvent.pointerOver(day, { relatedTarget: document.body });
    expect(phaseRow()).toHaveAttribute("data-visible", "true");

    // Moving onto Night counts as leaving Day, even though the pointer never
    // leaves the toggle.
    fireEvent.pointerOut(day, { relatedTarget: night });
    fireEvent.pointerOver(night, { relatedTarget: day });

    act(() => {
      vi.advanceTimersByTime(99);
    });
    expect(phaseRow()).toHaveAttribute("data-visible", "true");

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(phaseRow()).toHaveAttribute("data-visible", "false");
  });

  it("keeps the row open when the pointer moves from Day into the row", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 1, 12, 0));
    window.localStorage.setItem(MODE_STORAGE_KEY, "day");
    mockHoverCanHover(true);
    renderToggle();

    const day = screen.getByRole("radio", { name: "Day" });

    fireEvent.pointerOver(day, { relatedTarget: document.body });
    const dusk = screen.getByRole("radio", { name: "Dusk" });
    fireEvent.pointerOut(day, { relatedTarget: dusk });
    fireEvent.pointerOver(dusk, { relatedTarget: day });

    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(phaseRow()).toHaveAttribute("data-visible", "true");
  });

  it("keeps the row open while crossing the gap bridge", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 1, 12, 0));
    window.localStorage.setItem(MODE_STORAGE_KEY, "day");
    mockHoverCanHover(true);
    renderToggle();

    const day = screen.getByRole("radio", { name: "Day" });

    fireEvent.pointerOver(day, { relatedTarget: document.body });
    const bridge = themeHost().querySelector(":scope > span")!;
    fireEvent.pointerOut(day, { relatedTarget: bridge });
    fireEvent.pointerOver(bridge, { relatedTarget: day });

    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(phaseRow()).toHaveAttribute("data-visible", "true");

    // Moving off the bridge into Night is a leave again.
    const night = screen.getByRole("radio", { name: "Night" });
    fireEvent.pointerOut(bridge, { relatedTarget: night });
    fireEvent.pointerOver(night, { relatedTarget: bridge });
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(phaseRow()).toHaveAttribute("data-visible", "false");
  });

  it("closes when keyboard focus leaves while the pointer sits on Night", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 1, 12, 0));
    window.localStorage.setItem(MODE_STORAGE_KEY, "day");
    mockHoverCanHover(true);
    renderToggle();

    const day = screen.getByRole("radio", { name: "Day" });
    const night = screen.getByRole("radio", { name: "Night" });

    // Keyboard focus holds the row open even with the pointer on Night.
    fireEvent.keyDown(document, { key: "Tab" });
    act(() => day.focus());
    fireEvent.pointerOut(day, { relatedTarget: night });
    fireEvent.pointerOver(night, { relatedTarget: day });

    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(phaseRow()).toHaveAttribute("data-visible", "true");

    // Once the focus is gone, Night is outside the hover region.
    act(() => day.blur());
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(phaseRow()).toHaveAttribute("data-visible", "false");
  });

  it("keeps the row open while keyboard focus is inside, then closes after focus leaves", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 1, 12, 0));
    mockHoverCanHover(true);
    renderToggle();

    fireEvent.click(screen.getByRole("radio", { name: "Day" }));

    const dusk = screen.getByRole("radio", { name: "Dusk" });

    // Tab is what makes the subsequent focus keyboard focus.
    fireEvent.keyDown(document, { key: "Tab" });
    act(() => dusk.focus());
    fireEvent.pointerOut(themeHost(), { relatedTarget: document.body });

    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(phaseRow()).toHaveAttribute("data-visible", "true");

    act(() => dusk.blur());
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(phaseRow()).toHaveAttribute("data-visible", "false");
  });

  it("does not let pointer focus hold the row open", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 1, 12, 0));
    mockHoverCanHover(true);
    renderToggle();

    fireEvent.pointerDown(screen.getByRole("radio", { name: "Day" }));
    fireEvent.click(screen.getByRole("radio", { name: "Day" }));

    const dusk = screen.getByRole("radio", { name: "Dusk" });

    fireEvent.pointerDown(dusk);
    fireEvent.click(dusk);
    // A real mouse click leaves focus on the clicked button.
    act(() => dusk.focus());
    expect(dusk).toHaveFocus();

    fireEvent.pointerOut(themeHost(), { relatedTarget: document.body });

    act(() => {
      vi.advanceTimersByTime(99);
    });
    expect(phaseRow()).toHaveAttribute("data-visible", "true");

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(phaseRow()).toHaveAttribute("data-visible", "false");
  });

  it("keeps the raise flag through the exit fade, then clears it", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 1, 12, 0));
    mockHoverCanHover(true);
    renderToggle();

    fireEvent.click(screen.getByRole("radio", { name: "Day" }));
    expect(phaseRow()).toHaveAttribute("data-exiting", "false");

    fireEvent.pointerOut(themeHost(), { relatedTarget: document.body });

    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(phaseRow()).toHaveAttribute("data-visible", "false");
    expect(phaseRow()).toHaveAttribute("data-exiting", "true");

    // The fallback is the CSS exit duration (240ms) plus 50ms.
    act(() => {
      vi.advanceTimersByTime(289);
    });
    expect(phaseRow()).toHaveAttribute("data-exiting", "true");

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(phaseRow()).toHaveAttribute("data-exiting", "false");
  });

  it("clears the raise flag on the row's opacity transitionend", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 1, 12, 0));
    mockHoverCanHover(true);
    renderToggle();

    fireEvent.click(screen.getByRole("radio", { name: "Day" }));
    fireEvent.pointerOut(themeHost(), { relatedTarget: document.body });

    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(phaseRow()).toHaveAttribute("data-exiting", "true");

    fireEvent.transitionEnd(phaseRow(), { propertyName: "opacity" });
    expect(phaseRow()).toHaveAttribute("data-exiting", "false");
  });

  it("clears immediately when the exit duration is zero", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 1, 12, 0));
    mockHoverCanHover(true);
    renderToggle();

    fireEvent.click(screen.getByRole("radio", { name: "Day" }));
    phaseRow().style.setProperty("--phase-row-exit-ms", "0");
    fireEvent.pointerOut(themeHost(), { relatedTarget: document.body });

    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(phaseRow()).toHaveAttribute("data-visible", "false");
    expect(phaseRow()).toHaveAttribute("data-exiting", "false");
  });

  it("follows the exit duration for the fallback", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 1, 12, 0));
    mockHoverCanHover(true);
    renderToggle();

    fireEvent.click(screen.getByRole("radio", { name: "Day" }));
    phaseRow().style.setProperty("--phase-row-exit-ms", "200");
    fireEvent.pointerOut(themeHost(), { relatedTarget: document.body });

    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(phaseRow()).toHaveAttribute("data-exiting", "true");

    act(() => {
      vi.advanceTimersByTime(249);
    });
    expect(phaseRow()).toHaveAttribute("data-exiting", "true");

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(phaseRow()).toHaveAttribute("data-exiting", "false");
  });

  it("sets the entering flag and clears it after the settle", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 1, 12, 0));
    mockHoverCanHover(true);
    renderToggle();

    fireEvent.click(screen.getByRole("radio", { name: "Day" }));

    expect(phaseRow()).toHaveAttribute("data-entering", "true");

    act(() => {
      vi.advanceTimersByTime(989);
    });
    expect(phaseRow()).toHaveAttribute("data-entering", "true");

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(phaseRow()).toHaveAttribute("data-entering", "false");
  });

  it("keeps the raise and clears exiting when the row reopens mid-fade", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 1, 12, 0));
    mockHoverCanHover(true);
    renderToggle();

    fireEvent.click(screen.getByRole("radio", { name: "Day" }));
    fireEvent.pointerOut(themeHost(), { relatedTarget: document.body });

    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(phaseRow()).toHaveAttribute("data-exiting", "true");

    fireEvent.click(screen.getByRole("radio", { name: "Day" }));

    expect(phaseRow()).toHaveAttribute("data-visible", "true");
    expect(phaseRow()).toHaveAttribute("data-exiting", "false");

    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(phaseRow()).toHaveAttribute("data-visible", "true");
  });

  it("closes on Escape and puts focus back on Day without reopening", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 1, 12, 0));
    mockHoverCanHover(true);
    renderToggle();

    const day = screen.getByRole("radio", { name: "Day" });
    fireEvent.click(day);

    act(() => screen.getByRole("radio", { name: "Dawn" }).focus());
    fireEvent.keyDown(document, { key: "Escape" });

    expect(phaseRow()).toHaveAttribute("data-visible", "false");
    expect(day).toHaveFocus();

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(phaseRow()).toHaveAttribute("data-visible", "false");
  });

  it("starts closed on load but opens when Day is hovered", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 1, 12, 0));
    window.localStorage.setItem(MODE_STORAGE_KEY, "day");
    mockHoverCanHover(true);
    renderToggle();

    expect(root().dataset.mode).toBe("day");
    expect(phaseRow()).toHaveAttribute("data-visible", "false");

    fireEvent.pointerOver(screen.getByRole("radio", { name: "Day" }), {
      relatedTarget: document.body,
    });

    expect(phaseRow()).toHaveAttribute("data-visible", "true");

    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(phaseRow()).toHaveAttribute("data-visible", "true");
  });

  it("opens the row from Night and picking a phase lands in Day at it", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 1, 12, 0));
    window.localStorage.setItem(MODE_STORAGE_KEY, "night");
    mockHoverCanHover(true);
    renderToggle();

    expect(root().dataset.mode).toBe("night");
    expect(phaseRow()).toHaveAttribute("data-visible", "false");

    fireEvent.pointerOver(screen.getByRole("radio", { name: "Day" }), {
      relatedTarget: document.body,
    });

    expect(phaseRow()).toHaveAttribute("data-visible", "true");

    // Night shows the stored pin as checked; picking one switches and pins.
    expect(screen.getByRole("radio", { name: "Clock" })).toBeChecked();

    fireEvent.click(screen.getByRole("radio", { name: "Dusk" }));

    expect(root().dataset.mode).toBe("day");
    expect(root().dataset.phase).toBe("dusk");
    expect(root().dataset.dayPhase).toBe("dusk");
    expect(root()).not.toHaveClass("dark");
    expect(window.localStorage.getItem(MODE_STORAGE_KEY)).toBe("day");
    expect(window.localStorage.getItem(DAY_PHASE_STORAGE_KEY)).toBe("dusk");
    expect(screen.getByRole("radio", { name: "Dusk" })).toBeChecked();
  });

  it("closes the row from Night after the pointer leaves", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 1, 12, 0));
    window.localStorage.setItem(MODE_STORAGE_KEY, "night");
    mockHoverCanHover(true);
    renderToggle();

    fireEvent.pointerOver(screen.getByRole("radio", { name: "Day" }), {
      relatedTarget: document.body,
    });
    expect(phaseRow()).toHaveAttribute("data-visible", "true");

    fireEvent.pointerOut(themeHost(), { relatedTarget: document.body });

    act(() => {
      vi.advanceTimersByTime(99);
    });
    expect(phaseRow()).toHaveAttribute("data-visible", "true");

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(phaseRow()).toHaveAttribute("data-visible", "false");
  });

  it("reaches the row from Day by keyboard in Night and picks Day plus the phase", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 1, 12, 0));
    window.localStorage.setItem(MODE_STORAGE_KEY, "night");
    mockHoverCanHover(true);
    renderToggle();

    const day = screen.getByRole("radio", { name: "Day" });

    // Keyboard focus on Day opens the row in Night exactly as it does in Day.
    fireEvent.keyDown(document, { key: "Tab" });
    act(() => day.focus());
    expect(phaseRow()).toHaveAttribute("data-visible", "true");

    // Night's own segment is a tab stop between Day and the row, so Tab from
    // Day has to hand focus to the checked phase itself.
    fireEvent.keyDown(day, { key: "Tab" });
    const clock = screen.getByRole("radio", { name: "Clock" });

    expect(clock).toHaveFocus();

    fireEvent.keyDown(clock, { key: "ArrowRight" });

    expect(screen.getByRole("radio", { name: "Dawn" })).toBeChecked();
    expect(root().dataset.mode).toBe("day");
    expect(root().dataset.phase).toBe("dawn");
    expect(screen.getByRole("radio", { name: "Dawn" })).toHaveFocus();
  });

  it("reopens the row from Day by Tab in Night after Escape", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 1, 12, 0));
    window.localStorage.setItem(MODE_STORAGE_KEY, "night");
    renderToggle();

    const day = screen.getByRole("radio", { name: "Day" });

    fireEvent.keyDown(document, { key: "Tab" });
    act(() => day.focus());

    const clock = screen.getByRole("radio", { name: "Clock" });

    act(() => clock.focus());
    fireEvent.keyDown(document, { key: "Escape" });

    expect(phaseRow()).toHaveAttribute("data-visible", "false");
    expect(day).toHaveFocus();

    // The row is closed but Day keeps focus, so Tab reopens it and lands on
    // the checked phase instead of walking on to the Night segment.
    fireEvent.keyDown(day, { key: "Tab" });

    expect(phaseRow()).toHaveAttribute("data-visible", "true");

    act(() => {
      vi.advanceTimersByTime(0);
    });

    expect(clock).toHaveFocus();
  });

  it("moves up from Day into the phase row with the Up arrow", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 1, 12, 0));
    window.localStorage.setItem(MODE_STORAGE_KEY, "day");
    mockHoverCanHover(true);
    renderToggle();

    const day = screen.getByRole("radio", { name: "Day" });

    fireEvent.keyDown(document, { key: "Tab" });
    act(() => day.focus());
    expect(phaseRow()).toHaveAttribute("data-visible", "true");

    const clock = screen.getByRole("radio", { name: "Clock" });

    fireEvent.keyDown(day, { key: "ArrowUp" });

    expect(clock).toHaveFocus();
    // Up reaches the row instead of stepping the mode back to Auto.
    expect(day).toBeChecked();
    expect(root().dataset.mode).toBe("day");

    // With the row closed, Up opens it and lands on the checked phase.
    fireEvent.keyDown(document, { key: "Escape" });
    expect(phaseRow()).toHaveAttribute("data-visible", "false");
    expect(day).toHaveFocus();

    fireEvent.keyDown(day, { key: "ArrowUp" });
    expect(phaseRow()).toHaveAttribute("data-visible", "true");

    act(() => {
      vi.advanceTimersByTime(0);
    });

    expect(clock).toHaveFocus();
  });

  it("moves up from Day into the phase row in Night without changing mode", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 1, 12, 0));
    window.localStorage.setItem(MODE_STORAGE_KEY, "night");
    mockHoverCanHover(true);
    renderToggle();

    const day = screen.getByRole("radio", { name: "Day" });

    fireEvent.keyDown(document, { key: "Tab" });
    act(() => day.focus());
    expect(phaseRow()).toHaveAttribute("data-visible", "true");

    fireEvent.keyDown(day, { key: "ArrowUp" });

    expect(screen.getByRole("radio", { name: "Clock" })).toHaveFocus();
    expect(root().dataset.mode).toBe("night");
  });

  it("leaves Auto unchanged: hovering Day opens no row", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 1, 12, 0));
    mockHoverCanHover(true);
    renderToggle();

    fireEvent.pointerOver(screen.getByRole("radio", { name: "Day" }), {
      relatedTarget: document.body,
    });

    expect(root().dataset.mode).toBe("auto");
    expect(phaseRow()).toHaveAttribute("data-visible", "false");
    expect(
      screen.queryByRole("radiogroup", { name: "Day phase" }),
    ).not.toBeInTheDocument();
  });

  it("clips each sun on its own side of the horizon", () => {
    vi.useFakeTimers();
    window.localStorage.setItem(MODE_STORAGE_KEY, "day");
    mockHoverCanHover(true);
    renderToggle();

    fireEvent.pointerOver(screen.getByRole("radio", { name: "Day" }), {
      relatedTarget: document.body,
    });

    const dawnClip = phaseRow().querySelector(
      '[data-glyph="dawn"] clipPath rect',
    )!;
    const duskClip = phaseRow().querySelector(
      '[data-glyph="dusk"] clipPath rect',
    )!;

    // Dawn rises, so its disk is clipped above the horizon; dusk has already
    // set, so its disk is clipped below it. Both keep a clear margin so the
    // resting icons are untouched.
    expect(Number(dawnClip.getAttribute("y"))).toBe(0);
    expect(Number(dawnClip.getAttribute("height"))).toBeGreaterThan(11);
    expect(Number(duskClip.getAttribute("y"))).toBeGreaterThan(0);

    // The dusk rays live above the horizon and must stay outside that clip,
    // otherwise they vanish for the whole settle.
    const dusk = phaseRow().querySelector('[data-glyph="dusk"]')!;
    expect(dusk.querySelector("g[clip-path] [data-rays]")).toBeNull();
    expect(dusk.querySelector("[data-rays]")).not.toBeNull();

    const ids = Array.from(phaseRow().querySelectorAll("clipPath")).map(
      (clip) => clip.id,
    );
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("taps Day open and an outside tap closes on touch", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 1, 12, 0));
    mockHoverCanHover(false);
    renderToggle();

    const day = screen.getByRole("radio", { name: "Day" });
    fireEvent.click(day);
    expect(phaseRow()).toHaveAttribute("data-visible", "true");

    // No pointer-leave timer on touch.
    fireEvent.pointerOut(themeHost(), { relatedTarget: document.body });
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(phaseRow()).toHaveAttribute("data-visible", "true");

    fireEvent.pointerDown(document.body);
    expect(phaseRow()).toHaveAttribute("data-visible", "false");
  });

  it("returns focus to Day when the row closes with a phase focused", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 1, 12, 0));
    mockHoverCanHover(true);
    renderToggle();

    const day = screen.getByRole("radio", { name: "Day" });

    fireEvent.click(day);

    const dawn = screen.getByRole("radio", { name: "Dawn" });

    fireEvent.pointerDown(dawn);
    act(() => dawn.focus());

    // The pointer leaves while Dawn still has focus; the row goes inert, so
    // focus must come back to Day instead of falling through to <body>.
    fireEvent.pointerOut(themeHost(), { relatedTarget: document.body });

    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(phaseRow()).toHaveAttribute("data-visible", "false");
    expect(day).toHaveFocus();
  });

  it("opens the closed row when Tab leaves the focused Day segment", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 1, 12, 0));
    mockHoverCanHover(true);
    renderToggle();

    const day = screen.getByRole("radio", { name: "Day" });

    fireEvent.click(day);
    act(() => screen.getByRole("radio", { name: "Dusk" }).focus());
    fireEvent.keyDown(document, { key: "Escape" });

    expect(phaseRow()).toHaveAttribute("data-visible", "false");
    expect(day).toHaveFocus();

    // The row is closed while Day keeps focus, so Tab has to reopen it before
    // the browser picks the next focusable or the phase group is skipped.
    fireEvent.keyDown(day, { key: "Tab" });

    expect(phaseRow()).toHaveAttribute("data-visible", "true");
  });
});

