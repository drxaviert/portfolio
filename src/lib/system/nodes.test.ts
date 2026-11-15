import { describe, expect, it } from "vitest";
import { rawRoleTokens } from "@/lib/system/css-oracle";
import { chainFor, consumersOf } from "@/lib/system/nodes";
import type { Phase } from "@/lib/theme";

const PHASES: readonly Phase[] = ["dawn", "day", "dusk", "night"];

describe("chain reflects globals.css", () => {
  for (const phase of PHASES) {
    it(`links every ${phase} role to the vars it references`, () => {
      for (const [token, value] of Object.entries(rawRoleTokens(phase))) {
        const node = chainFor(token).find((entry) => entry.id === token);

        expect(node, `${phase} ${token}`).toBeDefined();

        const references = [
          ...value.matchAll(/var\(\s*(--[\w-]+)\s*\)/g),
        ].map((match) => match[1]);

        for (const reference of references) {
          expect(
            node?.from,
            `${phase} ${token} should derive from ${reference}`,
          ).toContain(reference);
        }
      }
    });
  }

  it("chains a primitive to the hue parameter", () => {
    expect(chainFor("--palette-blue-600").map((node) => node.id)).toEqual([
      "hue",
      "--palette-blue-600",
    ]);
  });

  it("chains a radius to roundness and reports the Card consumer", () => {
    expect(chainFor("--radius-lg").map((node) => node.id)).toEqual([
      "round",
      "--radius-lg",
    ]);
    expect(consumersOf("--radius-lg")).toContain("Card");
  });

  it("reaches both a primitive and time of day from a role", () => {
    const ids = chainFor("--primary").map((node) => node.id);

    expect(ids).toContain("hue");
    expect(ids).toContain("tod");
    expect(ids.at(-1)).toBe("--primary");
  });
});
