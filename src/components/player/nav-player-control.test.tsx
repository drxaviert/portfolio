import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  YouTubeCallbacks,
  YouTubeHandle,
  YouTubeState,
} from "@/components/home/now-playing-youtube";
import { createPlayerStore } from "./player-store";
import { NavPlayerControl } from "./nav-player-control";

const mocks = vi.hoisted(() => ({ pathname: "/work" }));

vi.mock("next/navigation", () => ({
  usePathname: () => mocks.pathname,
}));

const YT_STATE: YouTubeState = {
  unstarted: -1,
  ended: 0,
  playing: 1,
  paused: 2,
  buffering: 3,
  cued: 5,
};

const cleanups: (() => void)[] = [];

afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup();
});

beforeEach(() => {
  mocks.pathname = "/work";
});

function makeHarness() {
  const host = document.createElement("div");
  document.body.append(host);

  const handle: YouTubeHandle = {
    play: vi.fn(),
    pause: vi.fn(),
    seek: vi.fn(),
    currentTime: vi.fn(() => 0),
    duration: vi.fn(() => 249),
    state: vi.fn(() => -1),
    destroy: vi.fn(),
  };

  let callbacks: YouTubeCallbacks | null = null;
  const createPlayer = vi.fn(
    (_host: HTMLElement, _videoId: string, next: YouTubeCallbacks) => {
      callbacks = next;
      return handle;
    },
  );
  const store = createPlayerStore({
    loadApi: async () => ({}) as never,
    createPlayer,
  });

  store.attachHost(host);

  cleanups.push(() => {
    store.destroy();
    host.remove();
  });

  async function playThrough() {
    store.play();
    await vi.waitFor(() => expect(createPlayer).toHaveBeenCalled());
    callbacks?.onReady(handle, YT_STATE, 249);
    await vi.waitFor(() => expect(handle.play).toHaveBeenCalled());
    callbacks?.onStateChange(1, handle);
  }

  return { store, handle, playThrough };
}

function control(container: HTMLElement) {
  return container.querySelector<HTMLElement>(".nav-player");
}

describe("nav player control", () => {
  it("appears off-home while playing and names the track", async () => {
    const harness = makeHarness();

    await harness.playThrough();

    const { container } = render(<NavPlayerControl store={harness.store} />);
    const el = control(container);

    expect(el).toHaveAttribute("data-visible", "true");
    expect(el).toHaveAttribute("aria-hidden", "false");
    expect(
      screen.getByRole("button", { name: "Pause Get Lucky" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Get Lucky - Daft Punk" }),
    ).toHaveAttribute("href", "/");
    expect(el?.querySelectorAll(".nav-player-eq span")).toHaveLength(3);
    expect(el?.querySelector(".nav-player-eq")).toHaveAttribute(
      "data-playing",
      "true",
    );
    expect(el?.querySelector(".nav-player-tooltip")).toHaveTextContent(
      "Get Lucky - Daft Punk",
    );
  });

  it("is hidden and inert at rest", () => {
    const harness = makeHarness();
    const { container } = render(<NavPlayerControl store={harness.store} />);
    const el = control(container);

    expect(el).toHaveAttribute("data-visible", "false");
    expect(el).toHaveAttribute("aria-hidden", "true");
    expect(el).toHaveAttribute("inert");
  });

  it("is hidden on the home route", async () => {
    mocks.pathname = "/";
    const harness = makeHarness();

    await harness.playThrough();

    const { container } = render(<NavPlayerControl store={harness.store} />);

    expect(control(container)).toHaveAttribute("data-visible", "false");
  });

  it("shows a frozen equalizer while paused", async () => {
    const harness = makeHarness();

    await harness.playThrough();
    harness.store.pause();

    const { container } = render(<NavPlayerControl store={harness.store} />);

    expect(control(container)).toHaveAttribute("data-visible", "true");
    expect(container.querySelector(".nav-player-eq")).toHaveAttribute(
      "data-playing",
      "false",
    );
    expect(
      screen.getByRole("button", { name: "Play Get Lucky" }),
    ).toBeInTheDocument();
  });

  it("toggles the shared player from the orb", async () => {
    const harness = makeHarness();

    await harness.playThrough();

    render(<NavPlayerControl store={harness.store} />);

    fireEvent.click(screen.getByRole("button", { name: "Pause Get Lucky" }));
    expect(harness.store.getSnapshot().status).toBe("paused");

    fireEvent.click(screen.getByRole("button", { name: "Play Get Lucky" }));
    expect(harness.store.getSnapshot().status).toBe("playing");
  });
});
