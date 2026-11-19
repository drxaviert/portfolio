import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  ProtoToggles,
  getCloseBehaviour,
  setCloseBehaviour,
  setProtoLayout,
} from "./proto-layout-toggle";

/**
 * The prototype switches: `?layout=grid|list` and `?close=a|b`, with the keys
 * G / L and A / B. They disappear with the file once Dat has picked.
 */

function press(key: string) {
  fireEvent.keyDown(window, { key });
}

function pressed(name: string) {
  return screen.getByRole("button", { name }).getAttribute("aria-pressed");
}

beforeEach(() => {
  window.history.replaceState({}, "", "/work");
  window.sessionStorage.clear();
  setProtoLayout("grid");
  setCloseBehaviour("a");
  render(<ProtoToggles />);
});

afterEach(() => {
  window.sessionStorage.clear();
  window.history.replaceState({}, "", "/work");
});

describe("prototype options", () => {
  it("writes the choice into the URL and remembers it for the tab", () => {
    fireEvent.click(screen.getByRole("button", { name: "List" }));
    fireEvent.click(screen.getByRole("button", { name: "B" }));

    const url = new URL(window.location.href);

    expect(url.searchParams.get("layout")).toBe("list");
    expect(url.searchParams.get("close")).toBe("b");
    expect(window.sessionStorage.getItem("wd-proto-layout")).toBe("list");
    expect(window.sessionStorage.getItem("wd-proto-close")).toBe("b");
    expect(getCloseBehaviour()).toBe("b");
    expect(pressed("List")).toBe("true");
    expect(pressed("B")).toBe("true");
  });

  it("answers the G / L and A / B keys", () => {
    press("l");
    expect(pressed("List")).toBe("true");

    press("a");
    expect(pressed("A")).toBe("true");

    press("b");
    expect(getCloseBehaviour()).toBe("b");
    expect(pressed("B")).toBe("true");

    press("g");
    expect(pressed("Grid")).toBe("true");
  });

  it("does not take a key while typing in a field", () => {
    const input = document.createElement("input");
    document.body.append(input);
    input.focus();

    fireEvent.keyDown(input, { key: "l" });

    expect(pressed("List")).toBe("false");
    input.remove();
  });
});
