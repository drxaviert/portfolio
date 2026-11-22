import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { BackMenuDevSwitch } from "./dev-switch";
import {
  BACK_MENU_STORAGE_KEY,
  initialBackMenuVariant,
  readBackMenuVariantFromSearch,
  setBackMenuVariant,
} from "./back-menu-variant";

beforeEach(() => {
  window.localStorage.clear();
  window.history.replaceState({}, "", "/work");
});

afterEach(() => {
  window.history.replaceState({}, "", "/work");
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
