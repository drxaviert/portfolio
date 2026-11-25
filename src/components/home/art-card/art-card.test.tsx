import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DailyArt } from "@/lib/daily-art";
import { ArtCard } from "./art-card";
import { ArtImage, artImageSrc } from "./art-image";

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

      const dialogImage = dialog.querySelector(".art-image img");

      fireEvent.error(dialogImage as HTMLImageElement);

      expect(within(dialog).getByRole("status")).toHaveTextContent(
        "image service did not respond",
      );

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

  it("uses the native showModal/close path when the environment provides it", async () => {
    const user = userEvent.setup();
    const proto = window.HTMLDialogElement?.prototype;

    if (!proto) return;

    const originalShow = proto.showModal;
    const originalClose = proto.close;
    const showModal = vi.fn(function (this: HTMLDialogElement) {
      this.setAttribute("open", "");
    });
    const close = vi.fn(function (this: HTMLDialogElement) {
      this.removeAttribute("open");
      this.dispatchEvent(new Event("close"));
    });

    Object.defineProperty(proto, "showModal", {
      configurable: true,
      value: showModal,
    });
    Object.defineProperty(proto, "close", {
      configurable: true,
      value: close,
    });

    try {
      renderCard();
      await user.click(
        screen.getByRole("button", {
          name: "View A painting by An artist in full",
        }),
      );

      expect(showModal).toHaveBeenCalledTimes(1);
      expect(screen.getByRole("dialog")).toHaveAttribute("open");

      await user.keyboard("{Escape}");

      expect(close).toHaveBeenCalled();
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    } finally {
      Object.defineProperty(proto, "showModal", {
        configurable: true,
        value: originalShow,
      });
      Object.defineProperty(proto, "close", {
        configurable: true,
        value: originalClose,
      });
    }
  });

  it("clears the image-failure note when the art changes and returns", async () => {
    const user = userEvent.setup();
    const earlier = art({
      date: "2026-11-24",
      id: 10,
      title: "Earlier work",
      artist: "Another artist",
    });
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify(earlier), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(art()), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

    vi.stubGlobal("fetch", fetchMock);

    const { container } = renderCard();
    const image = container.querySelector(".art-image img");

    fireEvent.error(image as HTMLImageElement);

    expect(container.querySelector(".art-image-unavailable")).not.toBeNull();
    expect(container.querySelector(".art-card-image-note")).not.toBeNull();

    await user.click(
      screen.getByRole("button", { name: /Previous painting, Nov 24/ }),
    );
    expect(await screen.findByText("Earlier work")).toBeInTheDocument();
    expect(container.querySelector(".art-card-image-note")).toBeNull();
    expect(container.querySelector(".art-image-unavailable")).toBeNull();

    await user.click(
      screen.getByRole("button", { name: /Next painting, Today/ }),
    );
    expect(await screen.findByText("A painting")).toBeInTheDocument();
    expect(container.querySelector(".art-card-image-note")).toBeNull();
    expect(container.querySelector(".art-image-unavailable")).toBeNull();
  });

  it("clears the dialog image note when the dialog reopens", async () => {
    const user = userEvent.setup();
    const dialogProto = window.HTMLDialogElement?.prototype;
    const showModal = dialogProto?.showModal;
    const close = dialogProto?.close;

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

      fireEvent.error(
        dialog.querySelector(".art-image img") as HTMLImageElement,
      );

      expect(within(dialog).getByRole("status")).toHaveTextContent(
        "image service did not respond",
      );

      await user.keyboard("{Escape}");

      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

      await user.click(trigger);

      const reopened = screen.getByRole("dialog");

      expect(within(reopened).queryByRole("status")).not.toBeInTheDocument();
      expect(reopened.querySelector(".art-image-unavailable")).toBeNull();
      expect(reopened.querySelector(".art-dialog-note")).toBeNull();
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

  it("keys an image failure to the src and clears it on a successful load", () => {
    const onUnavailable = vi.fn();
    const onAvailable = vi.fn();
    const view = render(
      <ArtImage
        art={art({ imageId: "image-1" })}
        onUnavailable={onUnavailable}
        onAvailable={onAvailable}
      />,
    );

    fireEvent.error(view.container.querySelector("img") as HTMLImageElement);

    expect(onUnavailable).toHaveBeenCalledWith(artImageSrc("image-1", "card"));
    expect(
      view.container.querySelector(".art-image-unavailable"),
    ).not.toBeNull();

    view.rerender(
      <ArtImage
        art={art({ imageId: "image-2" })}
        onUnavailable={onUnavailable}
        onAvailable={onAvailable}
      />,
    );

    const nextImage = view.container.querySelector("img");

    expect(view.container.querySelector(".art-image-unavailable")).toBeNull();

    fireEvent.load(nextImage as HTMLImageElement);

    expect(onAvailable).toHaveBeenCalledWith(artImageSrc("image-2", "card"));
  });

  it("shows an intentional unavailable state when the painting image fails", () => {
    const { container } = renderCard();
    const image = container.querySelector(".art-image img");

    expect(image).not.toBeNull();
    fireEvent.error(image as HTMLImageElement);

    expect(container.querySelector(".art-image-unavailable")).not.toBeNull();
    expect(container.querySelector(".painting-frame-window > svg")).toBeNull();
    expect(
      screen.getByRole("heading", { name: "A painting" }),
    ).toBeInTheDocument();

    const trigger = screen.getByRole("button", {
      name: "View A painting by An artist in full",
    });
    const describedBy = trigger.getAttribute("aria-describedby");

    expect(describedBy).toBeTruthy();
    expect(
      document.getElementById(describedBy as string)?.textContent,
    ).toContain("image service did not respond");
  });

  it("keeps the spotlight off for a coarse pointer", () => {
    vi.stubGlobal("matchMedia", vi.fn(matchMedia(() => false)));

    const { container } = renderCard();

    expect(container.querySelector(".art-card")).toHaveAttribute(
      "data-spotlight",
      "off",
    );
  });

  it("keeps the spotlight off for reduced motion", () => {
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
