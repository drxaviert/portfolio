import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createPlayerStore } from "@/components/player/player-store";
import type { PlayerStore } from "@/components/player/player-store";
import { NowPlayingCard } from "./now-playing-card";

const imageMock = vi.hoisted(() => ({ renders: 0 }));

vi.mock("next/image", () => ({
  default: function MockImage() {
    imageMock.renders += 1;
    return null;
  },
}));

let store: PlayerStore;

beforeEach(() => {
  imageMock.renders = 0;
  store = createPlayerStore();
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
  store.destroy();
  vi.unstubAllGlobals();
});

function stubScrubRect(slider: HTMLElement) {
  vi.spyOn(slider, "getBoundingClientRect").mockReturnValue({
    width: 200,
    height: 2,
    top: 0,
    right: 200,
    bottom: 2,
    left: 0,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  } as DOMRect);
}

describe("NowPlayingCard", () => {
  it("names the card and the play control for the track", () => {
    render(<NowPlayingCard store={store} />);

    expect(
      screen.getByRole("group", { name: "Now playing" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Play Get Lucky" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Daft Punk")).toBeInTheDocument();
  });

  it("exposes a seek slider with aria values and keyboard steps", () => {
    render(<NowPlayingCard store={store} />);

    const slider = screen.getByRole("slider", { name: "Seek" });

    expect(slider).toHaveAttribute("aria-valuemin", "0");
    expect(slider).toHaveAttribute("aria-valuemax", "249");
    expect(slider).toHaveAttribute("aria-valuenow", "0");
    expect(slider).toHaveAttribute("aria-valuetext", "0:00 of 4:09");

    fireEvent.keyDown(slider, { key: "ArrowRight" });
    expect(slider).toHaveAttribute("aria-valuenow", "5");
    expect(slider).toHaveAttribute("aria-valuetext", "0:05 of 4:09");
    expect(screen.getByText("0:05")).toBeInTheDocument();

    fireEvent.keyDown(slider, { key: "ArrowUp" });
    expect(slider).toHaveAttribute("aria-valuenow", "10");
    expect(slider).toHaveAttribute("aria-valuetext", "0:10 of 4:09");

    fireEvent.keyDown(slider, { key: "ArrowDown" });
    expect(slider).toHaveAttribute("aria-valuenow", "5");
    expect(slider).toHaveAttribute("aria-valuetext", "0:05 of 4:09");

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

  it("commits a pointer preview on pointer up", () => {
    render(<NowPlayingCard store={store} />);

    const slider = screen.getByRole("slider", { name: "Seek" });
    stubScrubRect(slider);

    fireEvent.pointerDown(slider, {
      pointerId: 1,
      pointerType: "mouse",
      button: 0,
      clientX: 100,
    });
    expect(slider).toHaveAttribute("aria-valuenow", "124");

    fireEvent.pointerUp(slider, { pointerId: 1 });

    expect(slider).toHaveAttribute("aria-valuenow", "124");
    expect(store.getSnapshot().currentTime).toBeCloseTo(124.5);
  });

  it("discards a pointer preview on pointer cancel", () => {
    render(<NowPlayingCard store={store} />);

    const slider = screen.getByRole("slider", { name: "Seek" });
    stubScrubRect(slider);

    fireEvent.pointerDown(slider, {
      pointerId: 1,
      pointerType: "mouse",
      button: 0,
      clientX: 100,
    });
    expect(slider).toHaveAttribute("aria-valuenow", "124");
    expect(screen.getByText("2:04")).toBeInTheDocument();

    fireEvent.pointerCancel(slider, { pointerId: 1 });

    expect(slider).toHaveAttribute("aria-valuenow", "0");
    expect(screen.getByText("0:00")).toBeInTheDocument();
    expect(store.getSnapshot().currentTime).toBe(0);
  });

  it("keeps the times decorative and leaves a polite status", () => {
    const { container } = render(<NowPlayingCard store={store} />);

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

  it("renders the shared playhead from the store", () => {
    store.seek(42);

    render(<NowPlayingCard store={store} />);

    const slider = screen.getByRole("slider", { name: "Seek" });

    expect(slider).toHaveAttribute("aria-valuenow", "42");
    expect(slider).toHaveAttribute("aria-valuetext", "0:42 of 4:09");
    expect(screen.getByText("0:42")).toBeInTheDocument();
  });

  it("keeps the card shell out of time-tick renders", () => {
    render(<NowPlayingCard store={store} />);

    expect(imageMock.renders).toBe(1);

    act(() => store.seek(42));

    expect(screen.getByText("0:42")).toBeInTheDocument();
    expect(imageMock.renders).toBe(1);
  });

  it("labels the error-state button as a retry", async () => {
    store.play();

    await vi.waitFor(() =>
      expect(store.getSnapshot().status).toBe("error"),
    );

    render(<NowPlayingCard store={store} />);

    expect(
      screen.getByRole("button", { name: "Retry playing Get Lucky" }),
    ).toBeInTheDocument();
  });
});
