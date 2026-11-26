import { useState } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
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

function group(name: RegExp) {
  return screen.getByRole("radiogroup", { name });
}

function radio(groupName: RegExp, label: string) {
  return within(group(groupName)).getByRole("radio", { name: label });
}

function Harness({ onChange }: { onChange: (next: ArtOverride) => void }) {
  const [value, setValue] = useState<ArtOverride>(BASE);

  return (
    <HomeArtControls
      override={value}
      onChange={(next) => {
        setValue(next);
        onChange(next);
      }}
    />
  );
}

describe("HomeArtControls", () => {
  it("writes each pill through the shared override", async () => {
    const onChange = vi.fn();

    render(<HomeArtControls override={BASE} onChange={onChange} />);
    await screen.findByRole("heading", { name: "Frame lab" });

    await userEvent.click(radio(/^Frame$/, "Modern"));
    expect(onChange).toHaveBeenLastCalledWith({
      ...BASE,
      era: "modern",
    });

    await userEvent.click(radio(/^Frames$/, "Current"));
    expect(onChange).toHaveBeenLastCalledWith({
      ...BASE,
      frames: true,
    });

    await userEvent.click(radio(/^Phase$/, "Night"));
    expect(onChange).toHaveBeenLastCalledWith({
      ...BASE,
      phase: "night",
    });

    await userEvent.click(radio(/^Painting$/, "512"));
    expect(onChange).toHaveBeenLastCalledWith({
      ...BASE,
      artId: 512,
    });
  });

  it("clears auto, new and today values", async () => {
    const onChange = vi.fn();
    const active: ArtOverride = {
      artId: 512,
      era: "modern",
      phase: "night",
      frames: true,
    };

    render(<HomeArtControls override={active} onChange={onChange} />);
    await screen.findByRole("heading", { name: "Frame lab" });

    await userEvent.click(radio(/^Frame$/, "Auto"));
    expect(onChange).toHaveBeenLastCalledWith({ ...active, era: null });

    await userEvent.click(radio(/^Frames$/, "New"));
    expect(onChange).toHaveBeenLastCalledWith({ ...active, frames: false });

    await userEvent.click(radio(/^Phase$/, "Auto"));
    expect(onChange).toHaveBeenLastCalledWith({ ...active, phase: null });

    await userEvent.click(radio(/^Painting$/, "Today"));
    expect(onChange).toHaveBeenLastCalledWith({ ...active, artId: null });
  });

  it("moves the checked pill with the arrow keys", async () => {
    const onChange = vi.fn();

    render(<Harness onChange={onChange} />);
    await screen.findByRole("heading", { name: "Frame lab" });

    const auto = radio(/^Frame$/, "Auto");

    auto.focus();
    await userEvent.keyboard("{ArrowRight}");

    const gilt = radio(/^Frame$/, "Gilt");

    expect(onChange).toHaveBeenLastCalledWith({
      ...BASE,
      era: "gilt-ornate",
    });
    expect(gilt).toHaveFocus();
    expect(gilt).toHaveAttribute("aria-checked", "true");

    await userEvent.keyboard("{ArrowLeft}");

    expect(auto).toHaveFocus();
    expect(auto).toHaveAttribute("aria-checked", "true");
  });

  it("applies a free AIC id and shows it as the custom painting", async () => {
    const onChange = vi.fn();

    render(<HomeArtControls override={BASE} onChange={onChange} />);
    await screen.findByRole("heading", { name: "Frame lab" });

    const input = screen.getByLabelText("AIC id");

    await userEvent.type(input, "27992");
    await userEvent.click(screen.getByRole("button", { name: "Apply" }));

    expect(onChange).toHaveBeenLastCalledWith({
      ...BASE,
      artId: 27992,
    });
  });

  it("leaves every painting pill unchecked for a custom id", async () => {
    render(
      <HomeArtControls
        override={{ ...BASE, artId: 9000 }}
        onChange={vi.fn()}
      />,
    );
    await screen.findByRole("heading", { name: "Frame lab" });

    expect(screen.getByLabelText("AIC id")).toHaveValue("9000");

    for (const label of ["Today", "512", "2169", "4887", "8900"]) {
      expect(radio(/^Painting$/, label)).toHaveAttribute(
        "aria-checked",
        "false",
      );
    }
  });

  it("collapses and toggles from Shift+F, but not inside an input", async () => {
    render(<HomeArtControls override={BASE} onChange={vi.fn()} />);
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

    const input = screen.getByLabelText("AIC id");

    input.focus();
    fireEvent.keyDown(input, { key: "F", shiftKey: true });
    expect(
      screen.getByRole("heading", { name: "Frame lab" }),
    ).toBeInTheDocument();
  });
});
