import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { MODE_STORAGE_KEY, msUntilNextPhaseBoundary } from "@/lib/theme";

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

beforeEach(() => {
  window.localStorage.clear();
  delete root().dataset.mode;
  delete root().dataset.phase;
  delete root().dataset.phasePreview;
  delete root().dataset.phaseSwitching;
  root().classList.remove("dark");
  vi.mocked(msUntilNextPhaseBoundary).mockClear();
  vi.useRealTimers();
});

afterEach(() => {
  delete root().dataset.phaseSwitching;
  delete root().dataset.phasePreview;
  Reflect.deleteProperty(document, "hidden");
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.restoreAllMocks();
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
});
