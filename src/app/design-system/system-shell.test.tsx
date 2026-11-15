import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SECTIONS } from "@/app/design-system/sections";
import {
  SystemShell,
  useSystem,
} from "@/app/design-system/system-shell";

let frames: FrameRequestCallback[] = [];

function stubFrames(): void {
  if (typeof window.requestAnimationFrame !== "function") {
    Object.defineProperty(window, "requestAnimationFrame", {
      configurable: true,
      writable: true,
      value: () => 0,
    });
  }

  if (typeof window.cancelAnimationFrame !== "function") {
    Object.defineProperty(window, "cancelAnimationFrame", {
      configurable: true,
      writable: true,
      value: () => {},
    });
  }

  frames = [];
  vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
    frames.push(callback);

    return frames.length;
  });
  vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});
}

function flushFrames(): void {
  const queued = frames.splice(0);

  queued.forEach((callback) => callback(0));
}

beforeEach(() => {
  stubFrames();
  window.localStorage.clear();
  window.history.replaceState(null, "", "/design-system");
});

afterEach(() => {
  vi.restoreAllMocks();
  window.history.replaceState(null, "", "/");
  window.localStorage.clear();
  document.documentElement.removeAttribute("data-system-engine");
  document.documentElement.removeAttribute("data-phase");
  document.documentElement.classList.remove("dark");
});

describe("SystemShell", () => {
  it("renders one navigation anchor per section", () => {
    render(
      <SystemShell>
        <p>Section content</p>
      </SystemShell>,
    );

    expect(screen.getAllByRole("link")).toHaveLength(SECTIONS.length);

    for (const section of SECTIONS) {
      expect(
        screen.getByRole("link", { name: section.label }),
      ).toHaveAttribute("href", `#${section.id}`);
    }
  });

  it("follows the hash with aria-current", () => {
    const { container } = render(
      <SystemShell>
        <p>Section content</p>
      </SystemShell>,
    );

    expect(container.querySelector('a[href="#overview"]')).toHaveAttribute(
      "aria-current",
      "location",
    );

    act(() => {
      window.location.hash = "#motion";
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });

    expect(container.querySelector('a[href="#motion"]')).toHaveAttribute(
      "aria-current",
      "location",
    );
    expect(container.querySelector('a[href="#overview"]')).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("mounts the engine and removes every engine property on unmount", () => {
    const baseline = document.documentElement.getAttribute("style");

    const { unmount } = render(
      <SystemShell>
        <p>Section content</p>
      </SystemShell>,
    );

    expect(document.documentElement).toHaveAttribute("data-system-engine");

    act(() => flushFrames());

    expect(
      document.documentElement.style.getPropertyValue("--palette-blue-600"),
    ).not.toBe("");
    expect(document.documentElement.style.getPropertyValue("--radius-lg")).not.toBe(
      "",
    );

    unmount();

    expect(document.documentElement).not.toHaveAttribute("data-system-engine");
    expect(
      document.documentElement.style.getPropertyValue("--palette-blue-600"),
    ).toBe("");
    expect(document.documentElement.style.getPropertyValue("--radius-lg")).toBe(
      "",
    );
    expect(document.documentElement.getAttribute("style")).toBe(baseline);
  });

  it("throws when a consumer sits outside the shell", () => {
    function Probe() {
      useSystem();

      return null;
    }

    const silence = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(() => render(<Probe />)).toThrow(/SystemShell/);

    silence.mockRestore();
  });
});
