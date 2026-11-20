import { beforeEach, describe, expect, it } from "vitest";
import {
  forgetOffset,
  rememberOffset,
  restoredOffset,
} from "./carousel-memory";

describe("carousel memory", () => {
  beforeEach(forgetOffset);

  it("starts at the default card", () => {
    expect(restoredOffset(5)).toBe(0);
  });

  it("restores the remembered offset", () => {
    rememberOffset(3);
    expect(restoredOffset(5)).toBe(3);
  });

  it("falls back to 0 when the item count no longer covers it", () => {
    rememberOffset(4);
    expect(restoredOffset(3)).toBe(0);
    expect(restoredOffset(0)).toBe(0);
  });
});
