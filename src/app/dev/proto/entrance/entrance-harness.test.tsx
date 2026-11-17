import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EMPTY_WORK_LABEL } from "@/components/home/empty-work";
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
      screen.getByRole("heading", { name: EMPTY_WORK_LABEL }),
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

  it("mounts one blur layer for horizon clear and none for the others", () => {
    mount();

    expect(document.querySelector(".entrance-clear")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Horizon clear" }));

    expect(document.querySelector("main")?.dataset.entrance).toBe("clear");
    expect(document.querySelectorAll(".entrance-clear")).toHaveLength(1);

    fireEvent.click(screen.getByRole("button", { name: "Rise" }));

    expect(document.querySelector(".entrance-clear")).toBeNull();
  });

  it("puts the grain between the horizon and the cards, only for grain sky", () => {
    mount();

    expect(document.querySelector(".entrance-grain")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Grain sky" }));

    const main = document.querySelector("main");
    const grain = main?.querySelector(".entrance-grain");
    const content = main?.querySelector(".entrance-cell");

    expect(main?.dataset.entrance).toBe("grain");
    expect(grain).not.toBeNull();
    // Earlier in the tree than the cards, so it paints over the glow and under
    // the content.
    expect(
      grain && content
        ? grain.compareDocumentPosition(content) &
            Node.DOCUMENT_POSITION_FOLLOWING
        : 0,
    ).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Rise" }));

    expect(document.querySelector(".entrance-grain")).toBeNull();
  });

  it("mounts the mist layer only for mist lift", () => {
    mount();

    expect(document.querySelector(".entrance-mist")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Mist lift" }));

    expect(document.querySelector("main")?.dataset.entrance).toBe("mist");
    expect(document.querySelectorAll(".entrance-mist")).toHaveLength(1);

    fireEvent.click(screen.getByRole("button", { name: "Rise" }));

    expect(document.querySelector(".entrance-mist")).toBeNull();
  });

  it("mounts the dawn veil only for dawn bloom", () => {
    mount();

    expect(document.querySelector(".entrance-dawn")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Dawn bloom" }));

    expect(document.querySelector("main")?.dataset.entrance).toBe("dawn");
    expect(document.querySelectorAll(".entrance-dawn")).toHaveLength(1);

    fireEvent.click(screen.getByRole("button", { name: "Rise" }));

    expect(document.querySelector(".entrance-dawn")).toBeNull();
  });

  it("mounts the soft-focus layer only for soft focus", () => {
    mount();

    expect(document.querySelector(".entrance-soft")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Soft focus" }));

    expect(document.querySelector("main")?.dataset.entrance).toBe("soft");
    expect(document.querySelectorAll(".entrance-soft")).toHaveLength(1);

    fireEvent.click(screen.getByRole("button", { name: "Rise" }));

    expect(document.querySelector(".entrance-soft")).toBeNull();
  });

  it("switches the soft-focus blur method from the panel", () => {
    mount();

    fireEvent.click(screen.getByRole("button", { name: "Soft focus" }));

    const scope = document.querySelector(".entrance-scope");

    expect(scope?.getAttribute("data-soft-method")).toBe("split");
    expect(screen.getByRole("button", { name: "Split blur" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    // Split keeps the veil and drops the backdrop filter; the CSS does the rest.
    expect(document.querySelector(".entrance-soft-grain")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Grain" }));

    expect(scope?.getAttribute("data-soft-method")).toBe("grain");
    expect(document.querySelectorAll(".entrance-soft-grain")).toHaveLength(1);

    fireEvent.click(screen.getByRole("button", { name: "Lighter" }));

    expect(scope?.getAttribute("data-soft-method")).toBe("lighter");
    expect(document.querySelector(".entrance-soft-grain")).toBeNull();
    // The lighter method writes its own radius and veil into the sliders.
    expect(
      document.querySelector<HTMLInputElement>("#ent-soft-blur")?.value,
    ).toBe("4");
    expect(
      document.querySelector<HTMLInputElement>("#ent-soft-veil")?.value,
    ).toBe("32");
  });

  it("switches the soft-focus card order from the panel", () => {
    mount();

    fireEvent.click(screen.getByRole("button", { name: "Soft focus" }));

    const scope = document.querySelector(".entrance-scope");

    expect(scope?.getAttribute("data-soft-order")).toBe("horizon");
    expect(screen.getByRole("button", { name: "Horizon-up" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    fireEvent.click(screen.getByRole("button", { name: "Reading" }));

    expect(scope?.getAttribute("data-soft-order")).toBe("reading");
    expect(screen.getByRole("button", { name: "Reading" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });
});
