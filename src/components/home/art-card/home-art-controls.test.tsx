import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { ArtOverride } from "@/lib/art-override";
import { HomeArtControls } from "./home-art-controls";

const BASE: ArtOverride = {
  artId: null,
  era: null,
  phase: null,
  frames: false,
};

describe("HomeArtControls", () => {
  it("writes each control through the shared override", async () => {
    const onChange = vi.fn();

    render(<HomeArtControls override={BASE} onChange={onChange} />);
    await screen.findByRole("heading", { name: "Frame lab" });

    await userEvent.selectOptions(
      screen.getByLabelText("Frame style"),
      "modern",
    );
    expect(onChange).toHaveBeenLastCalledWith({
      ...BASE,
      era: "modern",
    });

    await userEvent.selectOptions(screen.getByLabelText("Frames"), "current");
    expect(onChange).toHaveBeenLastCalledWith({
      ...BASE,
      frames: true,
    });

    await userEvent.selectOptions(screen.getByLabelText("Phase"), "night");
    expect(onChange).toHaveBeenLastCalledWith({
      ...BASE,
      phase: "night",
    });

    await userEvent.selectOptions(screen.getByLabelText("Painting"), "512");
    expect(onChange).toHaveBeenLastCalledWith({
      ...BASE,
      artId: 512,
    });
  });

  it("applies a free AIC id", async () => {
    const onChange = vi.fn();

    render(<HomeArtControls override={BASE} onChange={onChange} />);
    await screen.findByRole("heading", { name: "Frame lab" });

    await userEvent.selectOptions(screen.getByLabelText("Painting"), "custom");
    const input = screen.getByLabelText("AIC id");

    await userEvent.type(input, "8900");
    await userEvent.click(screen.getByRole("button", { name: "Apply" }));

    expect(onChange).toHaveBeenLastCalledWith({
      ...BASE,
      artId: 8900,
    });
  });

  it("collapses and toggles from Shift+F, but not inside an input", async () => {
    render(
      <HomeArtControls
        override={{ ...BASE, artId: 9000 }}
        onChange={vi.fn()}
      />,
    );
    await screen.findByRole("heading", { name: "Frame lab" });

    await userEvent.click(
      screen.getByRole("button", { name: "Collapse frame lab" }),
    );
    expect(
      screen.queryByRole("heading", { name: "Frame lab" }),
    ).not.toBeInTheDocument();

    fireEvent.keyDown(window, { key: "F", shiftKey: true });
    expect(
      await screen.findByRole("heading", { name: "Frame lab" }),
    ).toBeInTheDocument();

    await userEvent.selectOptions(screen.getByLabelText("Painting"), "custom");
    const input = screen.getByLabelText("AIC id");

    input.focus();
    fireEvent.keyDown(input, { key: "F", shiftKey: true });
    expect(
      screen.getByRole("heading", { name: "Frame lab" }),
    ).toBeInTheDocument();
  });
});
