import { describe, expect, it } from "vitest";
import { extract } from "../../../scripts/gen-system-source.mjs";
import {
  DURATIONS,
  EASES,
  PALETTE,
  RADII,
  ROLES,
} from "@/lib/system/source.generated";

describe("generated token source", () => {
  it("is fresh", () => {
    expect(extract()).toEqual({
      PALETTE,
      ROLES,
      RADII,
      DURATIONS,
      EASES,
    });
  });
});
