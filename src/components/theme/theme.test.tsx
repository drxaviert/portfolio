import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { MODE_STORAGE_KEY } from "@/lib/theme";

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
  root().classList.remove("dark");
  vi.useRealTimers();
});

afterEach(() => {
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

  it("re-evaluates the phase while the mode is Auto", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 1, 6, 0));
    renderToggle();

    expect(root().dataset.phase).toBe("dawn");

    vi.setSystemTime(new Date(2026, 0, 1, 9, 0));

    act(() => {
      vi.advanceTimersByTime(60_000);
    });

    expect(root().dataset.mode).toBe("auto");
    expect(root().dataset.phase).toBe("day");
  });
});
