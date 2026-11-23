import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NowPlayingCard } from "./now-playing-card";

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
  window.history.replaceState({}, "", "/");
});

describe("NowPlayingCard", () => {
  it("names the card and the play control for the track", () => {
    render(<NowPlayingCard />);

    expect(
      screen.getByRole("group", { name: "Get Lucky" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Play Get Lucky" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Daft Punk")).toBeInTheDocument();
  });

  it("defaults to the flat row-1 surface", () => {
    const { container } = render(<NowPlayingCard />);

    expect(container.querySelector(".now-playing-card")).toHaveAttribute(
      "data-surface",
      "flat",
    );
  });

  it("switches to the pulled-in surface with ?surface=pulled", () => {
    window.history.replaceState({}, "", "/?surface=pulled");

    const { container } = render(<NowPlayingCard />);

    expect(container.querySelector(".now-playing-card")).toHaveAttribute(
      "data-surface",
      "pulled",
    );
  });

  it("exposes a seek slider with aria values and keyboard steps", () => {
    render(<NowPlayingCard />);

    const slider = screen.getByRole("slider", { name: "Seek" });

    expect(slider).toHaveAttribute("aria-valuemin", "0");
    expect(slider).toHaveAttribute("aria-valuemax", "249");
    expect(slider).toHaveAttribute("aria-valuenow", "0");
    expect(slider).toHaveAttribute("aria-valuetext", "0:00 of 4:09");

    fireEvent.keyDown(slider, { key: "ArrowRight" });
    expect(slider).toHaveAttribute("aria-valuenow", "5");
    expect(slider).toHaveAttribute("aria-valuetext", "0:05 of 4:09");
    expect(screen.getByText("0:05")).toBeInTheDocument();

    fireEvent.keyDown(slider, { key: "PageUp" });
    expect(slider).toHaveAttribute("aria-valuenow", "29");
    expect(slider).toHaveAttribute("aria-valuetext", "0:29 of 4:09");

    fireEvent.keyDown(slider, { key: "Home" });
    expect(slider).toHaveAttribute("aria-valuenow", "0");
    expect(slider).toHaveAttribute("aria-valuetext", "0:00 of 4:09");

    fireEvent.keyDown(slider, { key: "End" });
    expect(slider).toHaveAttribute("aria-valuenow", "249");
    expect(slider).toHaveAttribute("aria-valuetext", "4:09 of 4:09");

    fireEvent.keyDown(slider, { key: "ArrowLeft" });
    expect(slider).toHaveAttribute("aria-valuenow", "244");
    expect(slider).toHaveAttribute("aria-valuetext", "4:04 of 4:09");

    fireEvent.keyDown(slider, { key: "PageDown" });
    expect(slider).toHaveAttribute("aria-valuenow", "219");
    expect(slider).toHaveAttribute("aria-valuetext", "3:39 of 4:09");
  });

  it("keeps the times decorative and leaves a polite status", () => {
    const { container } = render(<NowPlayingCard />);

    expect(screen.getByText("0:00")).toBeInTheDocument();
    expect(screen.getByText("4:09")).toBeInTheDocument();
    expect(container.querySelector(".now-playing-times")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
    expect(screen.getByRole("slider", { name: "Seek" })).toBeInTheDocument();

    const status = screen.getByRole("status");

    expect(status).toHaveAttribute("aria-live", "polite");
    expect(status).toHaveTextContent("");
  });
});
