import { describe, expect, it } from "vitest";
import type { Phase } from "@/lib/theme";
import {
  DEFAULT_PARAMS,
  parseQuery,
  serializeQuery,
  todForPhase,
} from "@/lib/system/params";

const PHASES: readonly Phase[] = ["dawn", "day", "dusk", "night"];

describe("parseQuery", () => {
  it("clamps garbage and keeps every value finite", () => {
    expect(
      parseQuery("?hue=abc&round=NaN&tod=-5&speed=0", "dusk"),
    ).toEqual({
      hue: 0,
      round: 1,
      tod: 0,
      contrast: 1,
      speed: 0.25,
    });
  });

  it("takes the last valid value of a repeated key", () => {
    expect(parseQuery("?hue=1&hue=2", "day").hue).toBe(2);
    expect(parseQuery("?hue=40&hue=abc", "day").hue).toBe(40);
  });

  it("clamps huge values", () => {
    expect(parseQuery("?hue=1e9", "day").hue).toBe(180);
    expect(parseQuery("?speed=1e999", "day").speed).toBe(1);
  });

  it("starts tod at the site phase when no tod is in the URL", () => {
    expect(parseQuery("", "night").tod).toBe(todForPhase("night"));
    expect(parseQuery("", "dusk").tod).toBe(todForPhase("dusk"));
  });

  it("keeps a valid URL tod over the site phase", () => {
    expect(parseQuery("?tod=0.1", "dusk").tod).toBe(0.1);
  });

  it("starts tod at the site phase when a tod is present but unparseable", () => {
    expect(parseQuery("?tod=abc", "dusk").tod).toBe(todForPhase("dusk"));
    expect(parseQuery("?tod=", "dusk").tod).toBe(todForPhase("dusk"));
  });

  it("never returns NaN or throws for hostile input", () => {
    const searches = [
      "?hue=&round=&tod=&contrast=&speed=",
      "?hue=Infinity&round=-Infinity",
      "?hue=1&hue=",
      "?round=1e999",
      "?%",
      "?hue=0x10",
    ];

    for (const search of searches) {
      const parsed = parseQuery(search, "day");

      for (const [key, value] of Object.entries(parsed)) {
        expect(Number.isFinite(value), `${search} ${key}`).toBe(true);
      }
    }
  });
});

describe("serializeQuery", () => {
  it("is empty for the defaults at the site phase", () => {
    for (const phase of PHASES) {
      expect(
        serializeQuery({ ...DEFAULT_PARAMS, tod: todForPhase(phase) }, phase),
      ).toBe("");
    }
  });

  it("writes only the non-default keys, in order", () => {
    expect(serializeQuery({ ...DEFAULT_PARAMS, hue: 40, round: 1.5 }, "day")).toBe(
      "?hue=40&round=1.5",
    );
    expect(serializeQuery({ ...DEFAULT_PARAMS, tod: 0.5 }, "day")).toBe(
      "?tod=0.5",
    );
  });

  it("round-trips a parsed query stably", () => {
    const parsed = parseQuery("?hue=40&round=1.5", "day");
    const query = serializeQuery(parsed, "day");

    expect(query).toBe("?hue=40&round=1.5");
    expect(serializeQuery(parseQuery(query, "day"), "day")).toBe(query);
  });
});
