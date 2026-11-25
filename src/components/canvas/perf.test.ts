import { describe, expect, it } from "vitest";
import {
  beginPerf,
  getPerfSnapshot,
  markPerf,
  perfEnabled,
  startPerf,
} from "./perf";

describe("canvas perf HUD", () => {
  it("is inert without ?perf=1", () => {
    expect(perfEnabled).toBe(false);

    startPerf();
    markPerf("open-start", { test: true });
    const end = beginPerf("texture-upload");
    end();
    markPerf("open-ready");

    const snapshot = getPerfSnapshot();
    expect(snapshot.openCount).toBe(0);
    expect(snapshot.worst).toEqual([]);
    expect(snapshot.glSummary).toEqual({
      texImage2D: 0,
      texSubImage2D: 0,
      compile: 0,
      link: 0,
    });
  });
});
