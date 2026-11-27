import { describe, expect, it } from "vitest";
import {
  KEYBOARD_GLIDE_MS,
  adjacentCell,
  keyboardGlideProgress,
} from "./keyboard-nav";

describe("adjacentCell", () => {
  it("moves one cell in each direction", () => {
    expect(adjacentCell({ col: 2, row: 3 }, 1, 0, 6, 5)).toEqual({
      col: 3,
      row: 3,
    });
    expect(adjacentCell({ col: 2, row: 3 }, -1, 0, 6, 5)).toEqual({
      col: 1,
      row: 3,
    });
    expect(adjacentCell({ col: 2, row: 3 }, 0, 1, 6, 5)).toEqual({
      col: 2,
      row: 4,
    });
    expect(adjacentCell({ col: 2, row: 3 }, 0, -1, 6, 5)).toEqual({
      col: 2,
      row: 2,
    });
  });

  it("wraps at both edges", () => {
    expect(adjacentCell({ col: 0, row: 0 }, -1, -1, 6, 5)).toEqual({
      col: 5,
      row: 4,
    });
    expect(adjacentCell({ col: 5, row: 4 }, 1, 1, 6, 5)).toEqual({
      col: 0,
      row: 0,
    });
  });
});

describe("keyboardGlideProgress", () => {
  it("runs the 700ms power3.inOut segment", () => {
    expect(KEYBOARD_GLIDE_MS).toBe(700);
    expect(keyboardGlideProgress(1000, 1000)).toBe(0);
    expect(keyboardGlideProgress(1000, 1350)).toBeCloseTo(0.5, 6);
    expect(keyboardGlideProgress(1000, 1700)).toBe(1);
  });

  it("clamps before the start and after the end", () => {
    expect(keyboardGlideProgress(1000, 900)).toBe(0);
    expect(keyboardGlideProgress(1000, 3000)).toBe(1);
  });

  it("lands immediately when the duration is zero", () => {
    expect(keyboardGlideProgress(1000, 1000, 0)).toBe(1);
  });
});
