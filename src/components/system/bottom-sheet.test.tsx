import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { BottomSheet } from "@/components/system/bottom-sheet";

function renderSheet(children: React.ReactNode = <input aria-label="Inner" />) {
  return render(
    <BottomSheet label="Controls">{children}</BottomSheet>,
  );
}

function handle(): HTMLElement {
  return screen.getByRole("button", { name: "Controls" });
}

function drag(from: number, to: number): void {
  fireEvent.pointerDown(handle(), { clientY: from, pointerId: 1 });
  fireEvent.pointerMove(handle(), { clientY: to, pointerId: 1 });
  fireEvent.pointerUp(handle(), { clientY: to, pointerId: 1 });
}

describe("BottomSheet", () => {
  it("starts in the peek position and opens on a handle click", async () => {
    const user = userEvent.setup();

    renderSheet();

    expect(handle()).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await user.click(handle());

    expect(handle()).toHaveAttribute("aria-expanded", "true");
    expect(
      screen.getByRole("dialog", { name: "Controls" }),
    ).toBeInTheDocument();

    await user.click(handle());

    expect(handle()).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("keeps the closed content inert while the handle stays reachable", async () => {
    const user = userEvent.setup();
    const { container } = renderSheet();
    const content = container.querySelector("[data-sheet-content]");

    expect(content).toHaveAttribute("inert");
    expect(handle()).not.toHaveAttribute("inert");

    await user.click(handle());

    expect(content).not.toHaveAttribute("inert");

    await user.click(handle());

    expect(content).toHaveAttribute("inert");
  });

  it("toggles on Enter and Space", async () => {
    const user = userEvent.setup();

    renderSheet();
    handle().focus();

    await user.keyboard("{Enter}");
    expect(handle()).toHaveAttribute("aria-expanded", "true");

    handle().focus();
    await user.keyboard(" ");
    expect(handle()).toHaveAttribute("aria-expanded", "false");
  });

  it("snaps to half when dragged more than 40px up", () => {
    renderSheet();

    drag(400, 340);

    expect(handle()).toHaveAttribute("aria-expanded", "true");
  });

  it("snaps to peek when dragged more than 40px down", async () => {
    const user = userEvent.setup();

    renderSheet();
    await user.click(handle());

    drag(400, 460);

    expect(handle()).toHaveAttribute("aria-expanded", "false");
  });

  it("ignores drags under the threshold", () => {
    renderSheet();

    drag(400, 370);

    expect(handle()).toHaveAttribute("aria-expanded", "false");
  });

  it("moves focus in, closes on Escape and returns focus to the handle", async () => {
    const user = userEvent.setup();

    renderSheet();
    await user.click(handle());

    expect(screen.getByRole("dialog")).toHaveFocus();

    await user.keyboard("{Escape}");

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(handle()).toHaveFocus();
  });

  it("traps Tab inside the open sheet", async () => {
    const user = userEvent.setup();

    renderSheet(
      <>
        <button type="button">One</button>
        <button type="button">Two</button>
      </>,
    );
    await user.click(handle());

    screen.getByRole("button", { name: "Two" }).focus();
    await user.tab();

    expect(handle()).toHaveFocus();

    await user.tab({ shift: true });

    expect(screen.getByRole("button", { name: "Two" })).toHaveFocus();
  });

  it("animates only transform/opacity and respects safe-area and reduced motion", async () => {
    const user = userEvent.setup();

    const { container } = renderSheet();
    const sheet = container.lastElementChild as HTMLElement;

    expect(sheet.className).toContain("transition-transform");
    expect(sheet.className).toContain("duration-[250ms]");
    expect(sheet.className).toContain("ease-out");
    expect(sheet.className).toContain("motion-reduce:transition-none");
    expect(sheet.style.paddingBottom).toContain("safe-area-inset-bottom");

    await user.click(handle());

    expect(sheet.style.transform).toMatch(/^translateY\(0(px)?\)$/);
  });
});
