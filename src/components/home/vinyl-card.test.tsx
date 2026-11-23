import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { VinylCard } from "./vinyl-card";

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
});

describe("VinylCard", () => {
  it("names the card and the play control for the track", () => {
    render(<VinylCard />);

    expect(
      screen.getByRole("group", { name: "「不停的」" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Play 「不停的」" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Official Music Video · YouTube"),
    ).toBeInTheDocument();
  });

  it("keeps the time out of the live region and leaves a polite status", () => {
    render(<VinylCard />);

    expect(screen.getByText("3:48")).toHaveAttribute("aria-hidden", "true");

    const status = screen.getByRole("status");

    expect(status).toHaveAttribute("aria-live", "polite");
    expect(status).toHaveTextContent("");
  });
});
