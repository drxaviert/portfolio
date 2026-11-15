import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ChainPopover } from "@/components/system/chain-popover";

function trigger(): HTMLElement {
  return screen.getByRole("button", { name: "Chain" });
}

beforeEach(() => {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      matches: query.includes("pointer: coarse"),
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
});

afterEach(() => {
  Reflect.deleteProperty(window, "matchMedia");
  vi.restoreAllMocks();
});

describe("ChainPopover", () => {
  it("opens on focus and lists the chain root first with its consumers", () => {
    render(<ChainPopover token="--radius-lg" />);

    expect(trigger()).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    fireEvent.focus(trigger());

    expect(trigger()).toHaveAttribute("aria-expanded", "true");

    const panel = screen.getByRole("dialog");
    const items = within(panel).getAllByRole("listitem");

    expect(items[0]).toHaveTextContent("round");
    expect(items.map((item) => item.textContent).join("")).toContain(
      "--radius-lg",
    );
    expect(within(panel).getByText("Card")).toBeInTheDocument();
  });

  it("opens on hover for a fine pointer and closes on leave", () => {
    render(<ChainPopover token="--radius-lg" />);

    fireEvent.pointerEnter(trigger(), { pointerType: "mouse" });
    expect(trigger()).toHaveAttribute("aria-expanded", "true");

    fireEvent.pointerLeave(trigger(), { pointerType: "mouse" });
    expect(trigger()).toHaveAttribute("aria-expanded", "false");
  });

  it("opens on a coarse-pointer tap", () => {
    render(<ChainPopover token="--radius-lg" />);

    fireEvent.click(trigger());

    expect(trigger()).toHaveAttribute("aria-expanded", "true");
  });

  it("closes on Escape and returns focus to the trigger", () => {
    render(<ChainPopover token="--radius-lg" />);

    fireEvent.focus(trigger());
    expect(trigger()).toHaveAttribute("aria-expanded", "true");

    fireEvent.keyDown(document, { key: "Escape" });

    expect(trigger()).toHaveAttribute("aria-expanded", "false");
    expect(trigger()).toHaveFocus();
  });

  it("animates with scale and opacity only and has a trigger origin", () => {
    render(<ChainPopover token="--radius-lg" />);

    fireEvent.focus(trigger());

    const panel = screen.getByRole("dialog");

    expect(panel.className).toContain("scale-100");
    expect(panel.className).toContain("opacity-100");
    expect(panel.className).toContain("duration-150");
    expect(panel.className).toContain("motion-reduce:transition-none");
    expect(panel.className).toContain("fixed");
    expect(panel.style.transformOrigin).toContain("px");
  });
});
