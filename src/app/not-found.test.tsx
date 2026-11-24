import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import NotFound, { metadata } from "@/app/not-found";

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

describe("not-found page", () => {
  it("titles the page", () => {
    expect(metadata.title).toBe("Page not found");
  });

  it("offers the way home and the studies", () => {
    render(<NotFound />);

    expect(
      screen.getByRole("heading", { name: "This page doesn't exist." }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Back to the work" }),
    ).toHaveAttribute("href", "/");

    const studies = screen
      .getAllByRole("link")
      .filter((link) => link.getAttribute("href")?.startsWith("/work/"));
    expect(studies.map((link) => link.getAttribute("href"))).toEqual([
      "/work/systems-in-motion",
      "/work/title-sequence",
      "/work/type-in-motion",
      "/work/motion-and-stills",
      "/work/human-contact",
    ]);
  });

  it("draws no nav and reserves no space for one", () => {
    render(<NotFound />);

    expect(document.querySelector("[data-message-screen]")).toBeInTheDocument();
    expect(document.querySelector("[data-nav-slot]")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("navigation", { name: "Primary" }),
    ).not.toBeInTheDocument();
  });
});
