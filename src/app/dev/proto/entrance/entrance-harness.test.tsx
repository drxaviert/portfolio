import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { EntranceHarness } from "./entrance-harness";

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

function mount() {
  return render(
    <ThemeProvider>
      <EntranceHarness />
    </ThemeProvider>,
  );
}

describe("entrance harness", () => {
  it("wraps the seven reading-order items on first load", () => {
    mount();

    expect(document.querySelector("main")?.dataset.entrance).toBe("scale");
    expect(document.querySelectorAll("[data-entrance-item]")).toHaveLength(7);
    expect(
      screen.getByRole("heading", { name: "Project name" }),
    ).toBeInTheDocument();
  });

  it("does not replay when the route mounts again in the same tab", () => {
    const first = mount();

    first.unmount();
    mount();

    // The module flag survives a client-side navigation, so the second mount
    // renders the plain layout: no attribute, no wrappers, no animation.
    expect(document.querySelector("main")?.dataset.entrance).toBeUndefined();
    expect(document.querySelectorAll("[data-entrance-item]")).toHaveLength(0);
  });

  it("plays again when the user picks a variant", () => {
    const first = mount();

    first.unmount();
    mount();

    fireEvent.click(screen.getByRole("button", { name: "Rise" }));

    expect(document.querySelector("main")?.dataset.entrance).toBe("rise");
    expect(document.querySelectorAll("[data-entrance-item]")).toHaveLength(7);
  });
});
