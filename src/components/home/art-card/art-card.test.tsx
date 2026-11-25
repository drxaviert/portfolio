import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DailyArt } from "@/lib/daily-art";
import { ArtCard } from "./art-card";

const TODAY = "2026-11-25";
const OLDEST = "2026-10-27";

function art(overrides: Partial<DailyArt> = {}): DailyArt {
  return {
    date: TODAY,
    id: 9,
    title: "A painting",
    artist: "An artist",
    dateDisplay: "1850",
    dateStart: 1850,
    placeOfOrigin: "France",
    styleTitle: "Realism",
    medium: "Oil on canvas",
    imageId: "image-1",
    imageUrl: "https://www.artic.edu/iiif/2/image-1/full/843,/0/default.jpg",
    largeImageUrl:
      "https://www.artic.edu/iiif/2/image-1/full/1686,/0/default.jpg",
    width: 1200,
    height: 900,
    lqip: null,
    color: { h: 30, s: 40, l: 50 },
    articUrl: "https://www.artic.edu/artworks/9",
    alt: "A painted landscape with a river.",
    fallback: false,
    ...overrides,
  };
}

function matchMedia(matches: (query: string) => boolean) {
  return (query: string) => ({
    matches: matches(query),
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  });
}

beforeEach(() => {
  // Desktop is the default: a fine pointer, motion allowed.
  vi.stubGlobal(
    "matchMedia",
    vi.fn(
      matchMedia(
        (query) => query.includes("hover") && query.includes("pointer"),
      ),
    ),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function renderCard(initial = art()) {
  return render(<ArtCard initialArt={initial} today={TODAY} oldest={OLDEST} />);
}

describe("ArtCard", () => {
  it("renders the wall label and the frame's accessible full-view button", () => {
    renderCard();

    expect(
      screen.getByRole("heading", { name: "A painting" }),
    ).toBeInTheDocument();
    expect(screen.getByText("An artist")).toBeInTheDocument();
    expect(screen.getByText(/1850 · Oil on canvas/)).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: "View A painting by An artist in full",
      }),
    ).toBeInTheDocument();
  });

  it("disables Next on today and Previous on the oldest day", () => {
    const view = renderCard();

    expect(
      screen.getByRole("button", { name: /Next painting, Nov 26/ }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: /Previous painting, Nov 24/ }),
    ).toBeEnabled();

    view.unmount();
    renderCard(art({ date: OLDEST }));

    expect(
      screen.getByRole("button", { name: /Previous painting, Oct 26/ }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: /Next painting, Oct 28/ }),
    ).toBeEnabled();
  });

  it("fetches the previous day and swaps the frame and label", async () => {
    const user = userEvent.setup();
    const next = art({
      date: "2026-11-24",
      id: 10,
      title: "Earlier work",
      artist: "Another artist",
    });
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify(next), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    vi.stubGlobal("fetch", fetchMock);
    renderCard();

    await user.click(
      screen.getByRole("button", { name: /Previous painting, Nov 24/ }),
    );

    expect(await screen.findByText("Earlier work")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe("/api/art/2026-11-24");
    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      headers: { Accept: "application/json" },
    });
    expect(
      screen.getByRole("button", { name: /Next painting, Today/ }),
    ).toBeEnabled();
  });

  it("keeps the old painting and explains when a day fails to load", async () => {
    const user = userEvent.setup();
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockRejectedValue(new Error("offline"));

    vi.stubGlobal("fetch", fetchMock);
    renderCard();

    await user.click(
      screen.getByRole("button", { name: /Previous painting, Nov 24/ }),
    );

    expect(
      await screen.findByText("That day’s painting didn’t load. Try again."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "A painting" }),
    ).toBeInTheDocument();
  });

  it("opens the full view, traps Tab, closes on Escape and restores focus", async () => {
    const user = userEvent.setup();
    const dialogProto = window.HTMLDialogElement?.prototype;
    const showModal = dialogProto?.showModal;
    const close = dialogProto?.close;

    // Force the documented fallback path so the test is layout-independent.
    if (dialogProto) {
      Object.defineProperty(dialogProto, "showModal", {
        configurable: true,
        value: undefined,
      });
      Object.defineProperty(dialogProto, "close", {
        configurable: true,
        value: undefined,
      });
    }

    try {
      renderCard();

      const trigger = screen.getByRole("button", {
        name: "View A painting by An artist in full",
      });

      await user.click(trigger);

      const dialog = screen.getByRole("dialog");
      const closeButton = screen.getByRole("button", {
        name: "Close full view",
      });

      expect(dialog).toHaveAttribute("open");
      expect(closeButton).toHaveFocus();
      expect(
        within(dialog).getByRole("heading", { name: "A painting" }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("link", { name: /Art Institute/ }),
      ).toHaveAttribute("href", "https://www.artic.edu/artworks/9");

      // Tab from Close reaches the link; another Tab wraps back to Close.
      await user.tab();
      expect(screen.getByRole("link", { name: /Art Institute/ })).toHaveFocus();
      await user.tab();
      expect(closeButton).toHaveFocus();

      await user.keyboard("{Escape}");

      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(trigger).toHaveFocus();
    } finally {
      if (dialogProto) {
        Object.defineProperty(dialogProto, "showModal", {
          configurable: true,
          value: showModal,
        });
        Object.defineProperty(dialogProto, "close", {
          configurable: true,
          value: close,
        });
      }
    }
  });

  it("keeps the spotlight off for reduced motion and coarse pointers", () => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn(matchMedia((query) => query.includes("prefers-reduced-motion"))),
    );

    const { container } = renderCard();

    expect(container.querySelector(".art-card")).toHaveAttribute(
      "data-spotlight",
      "off",
    );
  });

  it("leaves the light on for a fine pointer when motion is allowed", () => {
    const { container } = renderCard();

    expect(container.querySelector(".art-card")).toHaveAttribute(
      "data-spotlight",
      "on",
    );
  });
});
