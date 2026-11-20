import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PlayPage from "./page";

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
  // jsdom has no playback; the video's observer effect only needs the calls.
  vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("play page", () => {
  it("renders each post with its title, date and media", () => {
    const { container } = render(<PlayPage />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Play" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: "Pipeline test" }),
    ).toBeInTheDocument();

    const time = container.querySelector("time");
    expect(time).toHaveAttribute("datetime", "2026-11-19");
    expect(time).toHaveTextContent("19 Nov 2026");

    expect(container.querySelectorAll("[data-media-kind]")).toHaveLength(2);
    expect(
      container.querySelector("[data-media-kind='image'] img"),
    ).not.toBeNull();
    expect(
      container.querySelector("[data-media-kind='video'] video"),
    ).not.toBeNull();
  });

  it("names the route Play", async () => {
    const { metadata } = await import("./page");

    expect(metadata.title).toBe("Play");
  });
});
