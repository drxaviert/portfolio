import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  YouTubeCallbacks,
  YouTubeHandle,
} from "@/components/home/now-playing-youtube";
import { createPlayerStore } from "./player-store";
import type { PlayerStore } from "./player-store";
import { NavOrb } from "./nav-orb";

const mocks = vi.hoisted(() => ({ pathname: "/work" }));

vi.mock("next/navigation", () => ({
  usePathname: () => mocks.pathname,
}));

const cleanups: (() => void)[] = [];

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
  for (const cleanup of cleanups.splice(0)) cleanup();
  vi.unstubAllGlobals();
});

function makeHarness() {
  const host = document.createElement("div");
  document.body.append(host);

  const handle: YouTubeHandle = {
    play: vi.fn(),
    pause: vi.fn(),
    seek: vi.fn(),
    currentTime: vi.fn(() => 0),
    duration: vi.fn(() => 375),
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
    callbacks?.onReady(handle, 375);
    await vi.waitFor(() => expect(handle.play).toHaveBeenCalled());
    callbacks?.onStateChange(1, handle);
  }

  return { store, handle, playThrough };
}

function renderOrb(store: PlayerStore) {
  return render(<NavOrb store={store} />);
}

describe("orb satellite control", () => {
  it("keeps the idle nav as the normal Home link", () => {
    mocks.pathname = "/work";
    const harness = makeHarness();
    const { container } = renderOrb(harness.store);

    expect(screen.getByRole("link", { name: "Home" })).toHaveAttribute(
      "href",
      "/",
    );
    const satellite = container.querySelector(".orb-satellite");

    expect(satellite).toHaveAttribute("data-visible", "false");
    expect(satellite).toHaveAttribute("inert");
  });

  it("keeps the Home link before the satellite in DOM order", () => {
    mocks.pathname = "/work";
    const harness = makeHarness();
    const { container } = renderOrb(harness.store);
    const shell = container.querySelector(".orb-shell");

    expect(shell?.firstElementChild?.tagName).toBe("A");
    expect(shell?.lastElementChild).toHaveClass("orb-satellite");
  });

  it("shows the satellite off-home, toggles, and parks as play when paused", async () => {
    mocks.pathname = "/work";
    const harness = makeHarness();

    await harness.playThrough();

    const { container } = renderOrb(harness.store);
    const satellite = container.querySelector(".orb-satellite");
    const dot = container.querySelector(".orb-sat-dot");
    const pauseIcon = container.querySelector(".orb-sat-icon-pause");
    const playIcon = container.querySelector(".orb-sat-icon-play");
    const button = screen.getByRole("button", {
      name: "Pause music: Door to the Cosmos",
    });

    expect(satellite).toHaveAttribute("data-visible", "true");
    expect(satellite).toHaveAttribute("data-paused", "false");
    expect(dot).toHaveAttribute("data-playing", "true");
    expect(pauseIcon).toHaveAttribute("data-active", "true");
    expect(playIcon).toHaveAttribute("data-active", "false");
    expect(pauseIcon?.querySelector("svg")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
    expect(screen.getByRole("link", { name: "Home" })).toHaveAttribute(
      "href",
      "/",
    );

    fireEvent.click(button);

    expect(harness.store.getSnapshot().status).toBe("paused");
    expect(satellite).toHaveAttribute("data-paused", "true");
    expect(dot).toHaveAttribute("data-playing", "false");
    expect(pauseIcon).toHaveAttribute("data-active", "false");
    expect(playIcon).toHaveAttribute("data-active", "true");
    expect(
      screen.getByRole("button", {
        name: "Play music: Door to the Cosmos",
      }),
    ).toBeInTheDocument();
  });

  it("suppresses hover after a mouse resume until the pointer leaves", async () => {
    mocks.pathname = "/work";
    const harness = makeHarness();

    await harness.playThrough();

    const { container } = renderOrb(harness.store);
    const button = screen.getByRole("button", {
      name: "Pause music: Door to the Cosmos",
    });

    fireEvent.click(button, { detail: 1 });
    expect(button).toHaveAttribute("data-paused", "true");

    fireEvent.click(button, { detail: 1 });
    expect(harness.store.getSnapshot().status).toBe("playing");
    expect(button).toHaveAttribute("data-suppress-hover", "true");

    fireEvent.pointerLeave(container.querySelector(".orb-shell")!);
    expect(button).not.toHaveAttribute("data-suppress-hover");
  });

  it("keeps the satellite hidden on the home route", async () => {
    mocks.pathname = "/";
    const harness = makeHarness();

    await harness.playThrough();

    const { container } = renderOrb(harness.store);

    const satellite = container.querySelector(".orb-satellite");

    expect(satellite).toHaveAttribute("data-visible", "false");
    expect(satellite).toHaveAttribute("inert");
    expect(satellite).not.toHaveAttribute("aria-hidden");
    expect(screen.getByRole("link", { name: "Home" })).toHaveAttribute(
      "href",
      "/",
    );
  });

  it("keeps the satellite hidden while idle off-home", () => {
    mocks.pathname = "/work";
    const harness = makeHarness();
    const { container } = renderOrb(harness.store);

    expect(container.querySelector(".orb-satellite")).toHaveAttribute(
      "data-visible",
      "false",
    );
  });
});
