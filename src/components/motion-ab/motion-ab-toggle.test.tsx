import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { setMotionAbFlag } from "@/lib/motion-ab";
import { MotionAbToggle } from "./motion-ab-toggle";

afterEach(() => {
  // The store outlives a render, so hand it back the shipped state.
  setMotionAbFlag("b1", false);
  setMotionAbFlag("reveal", false);
  window.history.replaceState({}, "", "/");
  delete document.documentElement.dataset.b1;
  delete document.documentElement.dataset.motionReveal;
});

describe("motion A/B pill", () => {
  it("renders outside production, showing the shipped state", async () => {
    render(<MotionAbToggle />);

    const b1 = await screen.findByRole("button", { name: "B1 ring" });
    const reveal = screen.getByRole("button", { name: "R reveal" });

    expect(b1).toHaveAttribute("aria-pressed", "false");
    expect(reveal).toHaveAttribute("aria-pressed", "false");
  });

  it("toggles a candidate and writes it to the document", async () => {
    render(<MotionAbToggle />);

    const b1 = await screen.findByRole("button", { name: "B1 ring" });
    await userEvent.click(b1);

    expect(b1).toHaveAttribute("aria-pressed", "true");
    expect(document.documentElement.dataset.b1).toBe("");
    expect(window.location.search).toContain("b1=1");
  });
});
