import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ART_OVERRIDE_EVENT,
  parseArtOverride,
  writeArtOverride,
} from "./art-override";

describe("parseArtOverride", () => {
  it("reads a valid era, art id, phase and frame treatment", () => {
    expect(
      parseArtOverride("?era=modern&art=512&phase=night&frames=current"),
    ).toEqual({
      artId: 512,
      era: "modern",
      phase: "night",
      frames: true,
    });
  });

  it("treats a missing query as no override", () => {
    expect(parseArtOverride("")).toEqual({
      artId: null,
      era: null,
      phase: null,
      frames: false,
    });
  });

  it("ignores unknown eras, phases and frame treatments", () => {
    expect(parseArtOverride("?era=baroque&phase=noon&frames=legacy")).toEqual({
      artId: null,
      era: null,
      phase: null,
      frames: false,
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

describe("writeArtOverride", () => {
  beforeEach(() => {
    window.history.replaceState({}, "", "/");
  });

  afterEach(() => {
    window.history.replaceState({}, "", "/");
  });

  it("writes every value and announces the change", () => {
    const onChange = vi.fn();
    window.addEventListener(ART_OVERRIDE_EVENT, onChange);

    writeArtOverride({
      artId: 512,
      era: "modern",
      phase: "night",
      frames: true,
    });

    expect(window.location.search).toBe(
      "?art=512&era=modern&phase=night&frames=current",
    );
    expect(onChange).toHaveBeenCalledTimes(1);

    window.removeEventListener(ART_OVERRIDE_EVENT, onChange);
  });

  it("clears auto/new/today values and keeps unrelated params", () => {
    window.history.replaceState({}, "", "/?foo=bar&art=512&frames=current");

    writeArtOverride({
      artId: null,
      era: null,
      phase: null,
      frames: false,
    });

    expect(window.location.search).toBe("?foo=bar");
  });
});
