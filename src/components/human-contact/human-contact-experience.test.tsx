import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { HumanContactExperience } from "./human-contact-experience";

vi.mock("./environment", () => ({
  hasWebGLSupport: () => false,
  isSafari: () => true,
}));

vi.mock("next/dynamic", () => ({
  default: () => () => null,
}));

describe("HumanContactExperience", () => {
  it("keeps the scene overlay free of the credit and links back to the study", () => {
    const { container } = render(<HumanContactExperience mode="full" />);
    const overlay = container.querySelector(".hc-overlay");

    expect(overlay).not.toBeNull();
    expect(overlay?.textContent).not.toContain("Original design");
    expect(overlay?.textContent).not.toContain("Hover interaction");
    expect(container.querySelector(".hc-credit")).toBeNull();
    expect(screen.getByRole("link", { name: /case study/i })).toHaveAttribute(
      "href",
      "/work/human-contact",
    );
  });
});
