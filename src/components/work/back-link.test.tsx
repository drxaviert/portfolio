import { createEvent, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { BackLink, ReaderBackLink } from "./back-link";
import { DrawerActionsProvider } from "./drawer-actions";

describe("BackLink", () => {
  it("renders the visible word and the action's name", () => {
    render(
      <BackLink
        label="Work"
        ariaLabel="Back to work"
        href="/work"
        onBack={vi.fn()}
      />,
    );

    const link = screen.getByRole("link", { name: "Back to work" });
    expect(link).toHaveTextContent("Work");
    expect(link).toHaveAttribute("href", "/work");
    expect(link).toHaveClass("wd-back-link");
    // The wrapper is the future hover menu's anchor.
    expect(link.parentElement).toHaveAttribute("data-back-menu-anchor");
  });

  it("runs the action and keeps the default navigation", async () => {
    const user = userEvent.setup();
    const back = vi.fn();
    render(<BackLink label="Home" ariaLabel="Home" href="/" onBack={back} />);

    await user.click(screen.getByRole("link", { name: "Home" }));

    expect(back).toHaveBeenCalledTimes(1);
  });

  it("prevents the fallback href for a plain click, not a modified one", () => {
    const back = vi.fn();
    render(<BackLink label="Home" ariaLabel="Home" href="/" onBack={back} />);
    const link = screen.getByRole("link", { name: "Home" });

    const plain = createEvent.click(link);
    fireEvent(link, plain);
    expect(plain.defaultPrevented).toBe(true);
    expect(back).toHaveBeenCalledTimes(1);

    const modified = createEvent.click(link, { metaKey: true });
    fireEvent(link, modified);
    expect(modified.defaultPrevented).toBe(false);
    expect(back).toHaveBeenCalledTimes(1);

    const middle = createEvent.click(link, { button: 1 });
    fireEvent(link, middle);
    expect(middle.defaultPrevented).toBe(false);
  });

  it("follows its href when there is no drawer action", () => {
    render(<BackLink label="Work" ariaLabel="Back to work" href="/work" />);
    const link = screen.getByRole("link", { name: "Back to work" });
    const click = createEvent.click(link);
    fireEvent(link, click);

    expect(click.defaultPrevented).toBe(false);
  });

  it("holds a menu slot for the future Work/Home menu", () => {
    const view = render(
      <BackLink
        label="Work"
        ariaLabel="Back to work"
        href="/work"
        onBack={vi.fn()}
      />,
    );

    expect(document.querySelector(".wd-back-menu")).toBeNull();
    view.unmount();

    render(
      <BackLink
        label="Work"
        ariaLabel="Back to work"
        href="/work"
        onBack={vi.fn()}
        menu={<span>Work or home</span>}
      />,
    );

    const slot = document.querySelector(".wd-back-menu");
    expect(slot).toHaveAttribute("data-back-menu-slot");
    expect(slot).toHaveTextContent("Work or home");
  });
});

describe("ReaderBackLink", () => {
  it("steps back to the index through the drawer's own action", async () => {
    const user = userEvent.setup();
    const stepBack = vi.fn();
    const close = vi.fn();

    render(
      <DrawerActionsProvider close={close} stepBack={stepBack} exit={vi.fn()}>
        <ReaderBackLink />
      </DrawerActionsProvider>,
    );

    const link = screen.getByRole("link", { name: "Back to work" });
    expect(link).toHaveTextContent("Work");
    expect(link).toHaveAttribute("href", "/work");

    await user.click(link);

    expect(stepBack).toHaveBeenCalledTimes(1);
    expect(close).not.toHaveBeenCalled();
  });
});
