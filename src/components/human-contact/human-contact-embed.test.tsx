import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { HumanContactEmbed } from "./human-contact-embed";

vi.mock("next/dynamic", () => ({
  default: () => () => <div data-experience="embed" />,
}));

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
