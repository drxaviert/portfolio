import { render, screen } from "@testing-library/react";
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

  it("keeps the times decorative and leaves a polite status", () => {
    const { container } = render(<NowPlayingCard />);

    expect(screen.getByText("0:00")).toBeInTheDocument();
    expect(screen.getByText("4:09")).toBeInTheDocument();
    expect(container.querySelector(".now-playing-art")).toHaveAttribute(
      "aria-hidden",
      "true",
    );

    const status = screen.getByRole("status");

    expect(status).toHaveAttribute("aria-live", "polite");
    expect(status).toHaveTextContent("");
  });
});
