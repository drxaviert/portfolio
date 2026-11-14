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
  it("puts each variant on the document before paint", () => {
    for (const variant of ["a", "b", "c"]) {
      runWithSearch(`?entrance=${variant}`);

      expect(document.documentElement.dataset.entrance).toBe(variant);
    }
  });

  it("reads the value alongside other parameters", () => {
    runWithSearch("?utm=x&entrance=b&ref=y");

    expect(document.documentElement.dataset.entrance).toBe("b");
  });

  it("ignores an unknown or missing value, keeping the default entrance", () => {
    runWithSearch("?entrance=d");
    expect(document.documentElement.hasAttribute("data-entrance")).toBe(false);

    runWithSearch("?entranced=a");
    expect(document.documentElement.hasAttribute("data-entrance")).toBe(false);

    runWithSearch("");
    expect(document.documentElement.hasAttribute("data-entrance")).toBe(false);
  });
});
