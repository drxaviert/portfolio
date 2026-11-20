import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EdgeBlurTuner } from "./edge-blur-tuner";

function input(label: string): HTMLInputElement {
  return screen.getByLabelText(label) as HTMLInputElement;
}

afterEach(() => {
  const root = document.documentElement;

  root.style.removeProperty("--edge-blur-height");
  root.style.removeProperty("--edge-blur-max");
  vi.unstubAllEnvs();
  window.history.replaceState({}, "", "/");
});

describe("EdgeBlurTuner", () => {
  it("starts at the shipped tokens and writes them to the root", () => {
    render(<EdgeBlurTuner />);

    expect(input("Band height").value).toBe("64");
    expect(input("Peak blur").value).toBe("8");
    expect(
      document.documentElement.style.getPropertyValue("--edge-blur-height"),
    ).toBe("64px");
    expect(
      document.documentElement.style.getPropertyValue("--edge-blur-max"),
    ).toBe("8px");
  });

  it("retunes the band live, showing the current px value", () => {
    render(<EdgeBlurTuner />);

    fireEvent.change(input("Band height"), { target: { value: "120" } });
    fireEvent.change(input("Peak blur"), { target: { value: "12" } });

    expect(screen.getByText("120px")).toBeInTheDocument();
    expect(screen.getByText("12px")).toBeInTheDocument();
    expect(
      document.documentElement.style.getPropertyValue("--edge-blur-height"),
    ).toBe("120px");
    expect(
      document.documentElement.style.getPropertyValue("--edge-blur-max"),
    ).toBe("12px");
  });

  it("stays out of production unless the URL asks for it", () => {
    vi.stubEnv("NODE_ENV", "production");

    const { unmount } = render(<EdgeBlurTuner />);
    expect(screen.queryByLabelText("Band height")).not.toBeInTheDocument();
    unmount();

    window.history.replaceState({}, "", "/?tune");
    render(<EdgeBlurTuner />);
    expect(screen.getByLabelText("Band height")).toBeInTheDocument();
  });
});
