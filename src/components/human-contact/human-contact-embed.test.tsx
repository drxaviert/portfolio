import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HumanContactEmbed } from "./human-contact-embed";

vi.mock("next/dynamic", () => ({
  default: () => () => <div data-experience="embed" />,
}));

// HumanContactTransition reads the preference for the route morph.
beforeEach(() => {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("HumanContactEmbed", () => {
  it("keeps a static still in the markup as the no-WebGL fallback", () => {
    const { container } = render(<HumanContactEmbed />);
    const still = container.querySelector<HTMLImageElement>("img.hc-still");

    expect(still).not.toBeNull();
    expect(still).toHaveAttribute(
      "src",
      "/human-contact/human-contact-still.webp",
    );
    expect(still).toHaveAttribute("width", "1920");
    expect(still).toHaveAttribute("height", "1080");
    expect(container.querySelector("[data-experience='embed']")).not.toBeNull();
  });

  it("links to the full-screen route", () => {
    render(<HumanContactEmbed />);

    expect(
      screen.getByRole("link", { name: /open full screen/i }),
    ).toHaveAttribute("href", "/live/human-contact");
  });
});
