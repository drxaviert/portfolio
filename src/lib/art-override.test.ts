import { describe, expect, it } from "vitest";
import { parseArtOverride } from "./art-override";

describe("parseArtOverride", () => {
  it("reads a valid era, art id and phase", () => {
    expect(parseArtOverride("?era=modern&art=512&phase=night")).toEqual({
      artId: 512,
      era: "modern",
      phase: "night",
    });
  });

  it("treats a missing query as no override", () => {
    expect(parseArtOverride("")).toEqual({
      artId: null,
      era: null,
      phase: null,
    });
  });

  it("ignores unknown eras and phases", () => {
    expect(parseArtOverride("?era=baroque&phase=noon")).toEqual({
      artId: null,
      era: null,
      phase: null,
    });
  });

  it("rejects malformed or non-positive art ids", () => {
    expect(parseArtOverride("?art=0").artId).toBeNull();
    expect(parseArtOverride("?art=-3").artId).toBeNull();
    expect(parseArtOverride("?art=1.5").artId).toBeNull();
    expect(parseArtOverride("?art=12x").artId).toBeNull();
    expect(parseArtOverride("?art=9999999999").artId).toBeNull();
  });
});
