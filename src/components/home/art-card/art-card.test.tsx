import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { DailyArt } from "@/lib/daily-art";
import { ArtCard } from "./art-card";
import { ArtImage, artImageSrc } from "./art-image";

const TODAY = "2026-11-25";

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
    synopsis:
      "A painted landscape with a river, seen in the soft light of an afternoon.",
    imageId: "image-1",
    width: 1200,
    height: 900,
    lqip: null,
    articUrl: "https://www.artic.edu/artworks/9",
    alt: "A painted landscape with a river.",
    fallback: false,
    ...overrides,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function renderCard(input = art()) {
  return render(<ArtCard art={input} />);
}

function disableNativeDialog() {
  const proto = window.HTMLDialogElement?.prototype;
  const showModal = proto?.showModal;
  const close = proto?.close;

  if (proto) {
    Object.defineProperty(proto, "showModal", {
      configurable: true,
      value: undefined,
    });
    Object.defineProperty(proto, "close", {
      configurable: true,
      value: undefined,
    });
  }

  return () => {
    if (proto) {
      Object.defineProperty(proto, "showModal", {
        configurable: true,
        value: showModal,
      });
      Object.defineProperty(proto, "close", {
        configurable: true,
        value: close,
      });
    }
  };
}

describe("ArtCard", () => {
  it("leaves the default frame unmarked", () => {
    const { container } = renderCard();

    expect(container.querySelector(".painting-frame")).not.toHaveAttribute(
      "data-frames",
    );
  });

  it("marks the origin/main comparison frame", () => {
    const { container } = render(<ArtCard art={art()} frames="current" />);

    expect(container.querySelector(".painting-frame")).toHaveAttribute(
      "data-frames",
      "current",
    );
  });

  it("renders today's label, synopsis and full-view button", () => {
    renderCard();

    expect(screen.getByText("Today’s painting")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "A painting" }),
    ).toBeInTheDocument();
    expect(screen.getByText("An artist")).toBeInTheDocument();
    expect(screen.getByText(/1850 · Oil on canvas/)).toBeInTheDocument();
    expect(
      screen.getByText(
        "A painted landscape with a river, seen in the soft light of an afternoon.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: "View A painting by An artist in full",
      }),
    ).toBeInTheDocument();
  });

  it("omits the medium separator when the record has none", () => {
    renderCard(art({ medium: null }));

    expect(screen.getByText("1850")).toBeInTheDocument();
    expect(screen.queryByText("1850 · ")).not.toBeInTheDocument();
  });

  it("places the label before the frame and has no browsing controls or tilt", () => {
    const { container } = renderCard();
    const scene = container.querySelector(".art-card-scene");
    const order = Array.from(scene?.children ?? []).map(
      (child) => child.className,
    );

    expect(order[0]).toContain("art-card-label");
    expect(order[1]).toContain("art-card-frame-button");
    expect(container.querySelector(".art-control")).toBeNull();
    expect(
      screen.queryByRole("button", { name: /Previous painting/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Next painting/ }),
    ).not.toBeInTheDocument();
    expect(container.querySelector(".painting-frame")).not.toHaveAttribute(
      "data-tilt",
    );
  });

  it("opens the full view, traps Tab, closes on Escape and restores focus", async () => {
    const user = userEvent.setup();
    const restoreDialog = disableNativeDialog();

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
        within(dialog).getByText(
          "A painted landscape with a river, seen in the soft light of an afternoon.",
        ),
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
      restoreDialog();
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

  it("clears the dialog image note when the dialog reopens", async () => {
    const user = userEvent.setup();
    const restoreDialog = disableNativeDialog();

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
      restoreDialog();
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

  it("uses the plain ring surface with no wall or spotlight layer", () => {
    const { container } = renderCard();

    expect(container.querySelector(".ring-surface")).toHaveClass(
      "bg-surface-container-low",
    );
    expect(container.querySelector(".art-card")).toHaveClass("rounded-lg");
    expect(container.querySelector(".art-card-wall")).toBeNull();
    expect(container.querySelector(".art-card-light")).toBeNull();
    expect(container.querySelector(".art-card-vignette")).toBeNull();
    expect(container.querySelector(".art-card")).not.toHaveAttribute(
      "data-spotlight",
    );
  });
});
