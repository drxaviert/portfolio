import { afterEach, describe, expect, it } from "vitest";
import { ENTRANCE_INIT_SCRIPT } from "@/lib/entrance-script";

function runWithSearch(search: string) {
  window.history.replaceState({}, "", `/work/systems-in-motion${search}`);
  new Function(ENTRANCE_INIT_SCRIPT)();
}

afterEach(() => {
  document.documentElement.removeAttribute("data-entrance");
  window.history.replaceState({}, "", "/");
});

describe("ENTRANCE_INIT_SCRIPT", () => {
  it("puts the blur variant on the document before paint", () => {
    runWithSearch("?entrance=blur");

    expect(document.documentElement.dataset.entrance).toBe("blur");
  });

  it("reads the value alongside other parameters", () => {
    runWithSearch("?utm=x&entrance=blur&ref=y");

    expect(document.documentElement.dataset.entrance).toBe("blur");
  });

  it("ignores anything else, keeping the cascade", () => {
    for (const search of [
      "?entrance=cascade",
      "?entrance=blue",
      "?entranced=blur",
      "",
    ]) {
      runWithSearch(search);
      expect(document.documentElement.hasAttribute("data-entrance")).toBe(
        false,
      );
    }
  });
});
