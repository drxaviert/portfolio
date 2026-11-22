import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BackMenuDevSwitch } from "./dev-switch";
import {
  BACK_MENU_STORAGE_KEY,
  currentBackMenuVariant,
  initialBackMenuVariant,
  readBackMenuVariantFromSearch,
  setBackMenuVariant,
  subscribeBackMenuVariant,
  syncBackMenuVariantFromEnvironment,
} from "./back-menu-variant";

beforeEach(() => {
  window.localStorage.clear();
  window.history.replaceState({}, "", "/work");
  syncBackMenuVariantFromEnvironment();
});

afterEach(() => {
  window.history.replaceState({}, "", "/work");
  syncBackMenuVariantFromEnvironment();
});

describe("back menu variant storage", () => {
  it("accepts only the four prototype names", () => {
    expect(readBackMenuVariantFromSearch("?bm=inline")).toBe("inline");
    expect(readBackMenuVariantFromSearch("?bm=nope")).toBeNull();
    expect(readBackMenuVariantFromSearch("")).toBeNull();
  });

  it("prefers the URL, then memory, then the dropdown", () => {
    expect(initialBackMenuVariant()).toBe("dropdown");

    setBackMenuVariant("crumb", { url: false });
    expect(initialBackMenuVariant()).toBe("crumb");

    window.history.replaceState({}, "", "/work?bm=side");
    expect(initialBackMenuVariant()).toBe("side");
  });

  it("writes the shared URL when the pill switches", () => {
    setBackMenuVariant("inline");

    expect(window.localStorage.getItem(BACK_MENU_STORAGE_KEY)).toBe("inline");
    expect(new URL(window.location.href).searchParams.get("bm")).toBe("inline");
  });

  it("notifies the mounted reader even when persistence is blocked", () => {
    const seen: string[] = [];
    const unsubscribe = subscribeBackMenuVariant(() => {
      seen.push(currentBackMenuVariant());
    });

    const store = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new Error("storage blocked");
      });
    const replace = vi
      .spyOn(window.history, "replaceState")
      .mockImplementation(() => {
        throw new Error("history blocked");
      });

    try {
      setBackMenuVariant("side");

      expect(currentBackMenuVariant()).toBe("side");
      expect(seen).toContain("side");
      // The old URL still says nothing; the in-memory store is the truth.
      expect(new URL(window.location.href).searchParams.get("bm")).toBeNull();
    } finally {
      store.mockRestore();
      replace.mockRestore();
      unsubscribe();
    }
  });

  it("trusts a storage update even while the URL still names the old variant", () => {
    window.history.replaceState({}, "", "/work?bm=dropdown");
    syncBackMenuVariantFromEnvironment();

    const seen: string[] = [];
    const unsubscribe = subscribeBackMenuVariant(() => {
      seen.push(currentBackMenuVariant());
    });

    window.localStorage.setItem(BACK_MENU_STORAGE_KEY, "inline");
    window.dispatchEvent(
      new StorageEvent("storage", {
        key: BACK_MENU_STORAGE_KEY,
        newValue: "inline",
      }),
    );

    expect(currentBackMenuVariant()).toBe("inline");
    expect(seen).toContain("inline");
    expect(new URL(window.location.href).searchParams.get("bm")).toBe(
      "dropdown",
    );

    unsubscribe();
  });
});

describe("BackMenuDevSwitch", () => {
  it("marks the remembered variant and switches live", async () => {
    const user = userEvent.setup();
    setBackMenuVariant("crumb", { url: false });

    render(<BackMenuDevSwitch />);

    const crumb = screen.getByRole("button", { name: "crumb" });
    const side = screen.getByRole("button", { name: "side" });

    expect(crumb).toHaveAttribute("aria-pressed", "true");
    expect(side).toHaveAttribute("aria-pressed", "false");

    await user.click(side);

    expect(side).toHaveAttribute("aria-pressed", "true");
    expect(new URL(window.location.href).searchParams.get("bm")).toBe("side");
  });
});
