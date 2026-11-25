"use client";

/**
 * Dev-only open profiler for the canvas. It is completely inert unless the
 * page is loaded with `?perf=1` in a development build: no observers, no rAF
 * loop, no WebGL wrappers, no history patch.
 *
 * It answers five questions about the pointer-up/open frame:
 *  a) React state/render or DOM/layout work on click
 *  b) texture/shader/material creation or first-use compile
 *  c) video play()/decode or texture upload
 *  d) style recalc/layout from pointerup cursor/class changes
 *  e) Next router/prefetch or URL/history updates
 */

type PhaseDetail = Record<string, unknown>;

export type PerfPhase = {
  name: string;
  at: number;
  end?: number;
  duration?: number;
  detail?: PhaseDetail;
};

type PerfFrame = { at: number; delta: number };

type PerfLoafScript = {
  sourceURL: string;
  functionName: string;
  invoker: string;
  duration: number;
  forcedStyleAndLayoutDuration: number;
};

type PerfLoaf = {
  startTime: number;
  duration: number;
  renderStart: number;
  styleAndLayoutStart: number;
  blockingDuration: number;
  scripts: PerfLoafScript[];
};

type PerfEvent = {
  name: string;
  startTime: number;
  duration: number;
  processingStart: number;
  processingEnd: number;
  interactionId: number;
};

type PerfLongTask = {
  startTime: number;
  duration: number;
  name: string;
};

type PerfGl = {
  at: number;
  kind: string;
  duration: number;
  gpuDuration: number | null;
  detail: PhaseDetail;
};

type PerfHistory = { at: number; kind: string; url: string };
type PerfResource = {
  at: number;
  name: string;
  initiatorType: string;
  duration: number;
  transferSize: number;
};

export type PerfWorstFrame = {
  at: number;
  delta: number;
  from: number;
  phases: string[];
  nearPhases: string[];
  loaf: {
    duration: number;
    blockingDuration: number;
    renderDelay: number | null;
    styleLayoutDelay: number | null;
    scripts: PerfLoafScript[];
  }[];
  events: {
    name: string;
    duration: number;
    processing: number;
    presentation: number;
    inputDelay: number;
  }[];
  longtasks: PerfLongTask[];
  gl: PerfGl[];
  history: PerfHistory[];
  resources: PerfResource[];
};

export type PerfSnapshot = {
  openCount: number;
  lastOpenStart: number;
  lastOpenEnd: number;
  frames: number;
  worst: PerfWorstFrame[];
  phases: PerfPhase[];
  hypotheses: {
    react: boolean;
    texture: boolean;
    video: boolean;
    layout: boolean;
    router: boolean;
  };
  glSummary: {
    texImage2D: number;
    texSubImage2D: number;
    compile: number;
    link: number;
  };
};

const isDev = process.env.NODE_ENV !== "production";
const params =
  typeof window === "undefined"
    ? null
    : new URLSearchParams(window.location.search);

export const perfEnabled = Boolean(isDev && params?.get("perf") === "1");

const phases: PerfPhase[] = [];
const frames: PerfFrame[] = [];
const loafs: PerfLoaf[] = [];
const events: PerfEvent[] = [];
const longtasks: PerfLongTask[] = [];
const glEntries: PerfGl[] = [];
const historyEntries: PerfHistory[] = [];
const resources: PerfResource[] = [];

let started = false;
let startedAt = 0;
let lastFrameAt = 0;
let raf = 0;
let openCount = 0;
let lastOpenStart = 0;
let lastOpenEnd = 0;
let firstOpenFrameMarked = false;
let historyPatched = false;
let detachHistory: (() => void) | null = null;

const observers: PerformanceObserver[] = [];
const glInstrumented = new WeakSet<object>();
const gpuQueries: {
  query: unknown;
  entry: PerfGl;
  mode: "webgl2" | "ext";
  ext: Record<string, unknown>;
  gl: WebGLRenderingContext | WebGL2RenderingContext;
}[] = [];
let gpuQueryActive = false;

function cap<T>(list: T[], max: number, drop = Math.ceil(max / 2)): void {
  if (list.length > max) list.splice(0, drop);
}

export function markPerf(name: string, detail?: PhaseDetail): void {
  if (!perfEnabled || !started) return;

  const at = performance.now();
  const phase: PerfPhase = { name, at, detail };
  phases.push(phase);
  cap(phases, 6000);

  if (name === "open-start") {
    openCount += 1;
    lastOpenStart = at;
    lastOpenEnd = 0;
    firstOpenFrameMarked = false;
  } else if (
    openCount > 0 &&
    (name === "open-ready" || name === "hi-res-swap")
  ) {
    lastOpenEnd = Math.max(lastOpenEnd, at);
  }
}

export function beginPerf(
  name: string,
  detail?: PhaseDetail,
): (extra?: PhaseDetail) => void {
  if (!perfEnabled || !started) return () => {};

  const at = performance.now();
  const phase: PerfPhase = { name, at, detail };
  phases.push(phase);
  cap(phases, 6000);

  let closed = false;
  return (extra?: PhaseDetail) => {
    if (closed) return;
    closed = true;
    phase.end = performance.now();
    phase.duration = phase.end - at;
    if (extra) phase.detail = { ...detail, ...extra };
  };
}

export function markFirstOpenFrame(): void {
  if (!perfEnabled || !started) return;
  if (firstOpenFrameMarked || openCount === 0) return;

  firstOpenFrameMarked = true;
  markPerf("first-open-frame");
}

export function startPerf(): void {
  if (!perfEnabled || started) return;
  started = true;
  startedAt = performance.now();
  lastFrameAt = startedAt;

  try {
    const loaf = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const e = entry as unknown as {
          startTime: number;
          duration: number;
          renderStart: number;
          styleAndLayoutStart: number;
          blockingDuration: number;
          scripts: PerfLoafScript[];
        };

        loafs.push({
          startTime: e.startTime,
          duration: e.duration,
          renderStart: e.renderStart,
          styleAndLayoutStart: e.styleAndLayoutStart,
          blockingDuration: e.blockingDuration,
          scripts: (e.scripts ?? []).map((script) => ({
            sourceURL: script.sourceURL ?? "",
            functionName: script.functionName ?? "",
            invoker: script.invoker ?? "",
            duration: script.duration ?? 0,
            forcedStyleAndLayoutDuration:
              script.forcedStyleAndLayoutDuration ?? 0,
          })),
        });
        cap(loafs, 120);
      }
    });
    loaf.observe({ type: "long-animation-frame" });
    observers.push(loaf);
  } catch {
    // Unsupported browser; the other observers still work.
  }

  try {
    const eventObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const e = entry as PerformanceEventTiming & {
          interactionId?: number;
        };
        events.push({
          name: e.name,
          startTime: e.startTime,
          duration: e.duration,
          processingStart: e.processingStart ?? 0,
          processingEnd: e.processingEnd ?? 0,
          interactionId: e.interactionId ?? 0,
        });
        cap(events, 240);
      }
    });
    eventObserver.observe({ type: "event", durationThreshold: 16 } as PerformanceObserverInit);
    observers.push(eventObserver);
  } catch {
    // Ignore.
  }

  try {
    const longtaskObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        longtasks.push({
          startTime: entry.startTime,
          duration: entry.duration,
          name: entry.name,
        });
        cap(longtasks, 160);
      }
    });
    longtaskObserver.observe({ type: "longtask" });
    observers.push(longtaskObserver);
  } catch {
    // Ignore.
  }

  try {
    const resourceObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const e = entry as PerformanceResourceTiming;
        resources.push({
          at: e.startTime,
          name: e.name,
          initiatorType: e.initiatorType,
          duration: e.duration,
          transferSize: e.transferSize ?? 0,
        });
        cap(resources, 240);
      }
    });
    resourceObserver.observe({ type: "resource" });
    observers.push(resourceObserver);
  } catch {
    // Ignore.
  }

  detachHistory = patchHistory();
  raf = requestAnimationFrame(tick);
}

function tick(now: number): void {
  if (!started) return;

  const delta = now - lastFrameAt;
  lastFrameAt = now;
  frames.push({ at: now, delta });
  cap(frames, 4000, 2000);

  pollGpuQueries();
  raf = requestAnimationFrame(tick);
}

export function stopPerf(): void {
  if (!started) return;
  started = false;
  cancelAnimationFrame(raf);
  raf = 0;

  for (const observer of observers) observer.disconnect();
  observers.length = 0;
  detachHistory?.();
  detachHistory = null;
}

function patchHistory(): () => void {
  if (typeof history === "undefined" || historyPatched) return () => {};
  historyPatched = true;

  const originalPush = history.pushState.bind(history);
  const originalReplace = history.replaceState.bind(history);

  const record = (kind: string, url: string) => {
    if (!perfEnabled || !started) return;
    historyEntries.push({ at: performance.now(), kind, url });
    cap(historyEntries, 80);
  };

  history.pushState = (...args: Parameters<History["pushState"]>) => {
    record("pushState", String(args[2] ?? location.href));
    return originalPush(...args);
  };
  history.replaceState = (...args: Parameters<History["replaceState"]>) => {
    record("replaceState", String(args[2] ?? location.href));
    return originalReplace(...args);
  };

  const onPop = () => record("popstate", location.href);
  const onHash = () => record("hashchange", location.href);
  window.addEventListener("popstate", onPop);
  window.addEventListener("hashchange", onHash);

  const navigation = (window as unknown as {
    navigation?: {
      addEventListener?: (name: string, handler: () => void) => void;
      removeEventListener?: (name: string, handler: () => void) => void;
    };
  }).navigation;
  const onEntry = () => record("navigation", location.href);
  navigation?.addEventListener?.("currententrychange", onEntry);

  return () => {
    history.pushState = originalPush;
    history.replaceState = originalReplace;
    window.removeEventListener("popstate", onPop);
    window.removeEventListener("hashchange", onHash);
    navigation?.removeEventListener?.("currententrychange", onEntry);
    historyPatched = false;
  };
}

export function instrumentWebGL(
  gl: WebGLRenderingContext | WebGL2RenderingContext,
): void {
  if (!perfEnabled || glInstrumented.has(gl)) return;
  glInstrumented.add(gl);

  const webgl2Ext = gl.getExtension("EXT_disjoint_timer_query_webgl2") as
    | (Record<string, unknown> & { TIME_ELAPSED_EXT: number })
    | null;
  const legacyExt = webgl2Ext
    ? null
    : (gl.getExtension("EXT_disjoint_timer_query") as
        | (Record<string, unknown> & { TIME_ELAPSED_EXT: number })
        | null);
  const ext = webgl2Ext ?? legacyExt;
  const mode: "webgl2" | "ext" = webgl2Ext ? "webgl2" : "ext";

  const detailFor = (
    kind: string,
    args: unknown[],
  ): PhaseDetail => {
    const detail: PhaseDetail = {};
    if (kind === "texImage2D") {
      if (args.length >= 9) {
        detail.width = Number(args[3]);
        detail.height = Number(args[4]);
      } else {
        const source = args[5] as
          | HTMLVideoElement
          | HTMLImageElement
          | HTMLCanvasElement
          | ImageBitmap
          | ImageData
          | null;
        detail.source = source?.constructor?.name ?? "unknown";
        detail.width =
          (source as HTMLVideoElement)?.videoWidth ??
          (source as HTMLImageElement)?.naturalWidth ??
          (source as HTMLCanvasElement)?.width ??
          (source as ImageBitmap)?.width ??
          null;
        detail.height =
          (source as HTMLVideoElement)?.videoHeight ??
          (source as HTMLImageElement)?.naturalHeight ??
          (source as HTMLCanvasElement)?.height ??
          (source as ImageBitmap)?.height ??
          null;
      }
    } else if (kind === "texSubImage2D") {
      if (args.length >= 9) {
        detail.width = Number(args[4]);
        detail.height = Number(args[5]);
      } else {
        const source = args[6] as
          | HTMLVideoElement
          | HTMLImageElement
          | HTMLCanvasElement
          | ImageBitmap
          | ImageData
          | null;
        detail.source = source?.constructor?.name ?? "unknown";
        detail.width =
          (source as HTMLVideoElement)?.videoWidth ??
          (source as HTMLImageElement)?.naturalWidth ??
          (source as HTMLCanvasElement)?.width ??
          (source as ImageBitmap)?.width ??
          null;
        detail.height =
          (source as HTMLVideoElement)?.videoHeight ??
          (source as HTMLImageElement)?.naturalHeight ??
          (source as HTMLCanvasElement)?.height ??
          (source as ImageBitmap)?.height ??
          null;
      }
    } else if (kind === "compileShader") {
      detail.shaderType = Number(args[0]);
      detail.sourceLength = String(args[1] ?? "").length;
    } else if (kind === "linkProgram") {
      detail.hasProgram = Boolean(args[0]);
    }
    return detail;
  };

  const beginGpuQuery = () => {
    if (!ext || gpuQueryActive) return null;

    try {
      const query =
        mode === "webgl2"
          ? (gl as WebGL2RenderingContext).createQuery()
          : (ext.createQueryEXT as () => unknown)();
      if (!query) return null;

      gpuQueryActive = true;
      if (mode === "webgl2") {
        (gl as WebGL2RenderingContext).beginQuery(
          ext.TIME_ELAPSED_EXT,
          query as WebGLQuery,
        );
      } else {
        (ext.beginQueryEXT as (target: number, query: unknown) => void)(
          ext.TIME_ELAPSED_EXT,
          query,
        );
      }
      return { query, ext: ext as Record<string, unknown>, mode };
    } catch {
      gpuQueryActive = false;
      return null;
    }
  };

  const endGpuQuery = (
    token: { query: unknown; ext: Record<string, unknown>; mode: string } | null,
    entry: PerfGl,
  ) => {
    if (!token) return;

    try {
      if (token.mode === "webgl2") {
        (gl as WebGL2RenderingContext).endQuery(
          token.ext.TIME_ELAPSED_EXT as number,
        );
      } else {
        (token.ext.endQueryEXT as (target: number) => void)(
          token.ext.TIME_ELAPSED_EXT as number,
        );
      }
      gpuQueries.push({
        query: token.query,
        entry,
        mode: token.mode as "webgl2" | "ext",
        ext: token.ext,
        gl,
      });
    } catch {
      // Ignore.
    } finally {
      gpuQueryActive = false;
    }
  };

  const wrap = (kind: string) => {
    const original = (gl as unknown as Record<string, unknown>)[kind];
    if (typeof original !== "function") return;

    try {
      (gl as unknown as Record<string, unknown>)[kind] = function (
        this: unknown,
        ...args: unknown[]
      ) {
        const at = performance.now();
        const token = beginGpuQuery();
        let result: unknown;

        try {
          result = (original as (...inner: unknown[]) => unknown).apply(
            this,
            args,
          );
        } catch (error) {
          if (token) {
            try {
              if (token.mode === "webgl2") {
                (gl as WebGL2RenderingContext).endQuery(
                  token.ext.TIME_ELAPSED_EXT as number,
                );
              } else {
                (token.ext.endQueryEXT as (target: number) => void)(
                  token.ext.TIME_ELAPSED_EXT as number,
                );
              }
            } catch {
              // Ignore.
            }
            gpuQueryActive = false;
          }
          throw error;
        }

        const entry: PerfGl = {
          at,
          kind,
          duration: performance.now() - at,
          gpuDuration: null,
          detail: detailFor(kind, args),
        };
        glEntries.push(entry);
        cap(glEntries, 400);
        endGpuQuery(token, entry);
        return result;
      };
    } catch {
      // A non-writable method; leave it alone.
    }
  };

  wrap("texImage2D");
  wrap("texSubImage2D");
  wrap("compileShader");
  wrap("linkProgram");
}

function pollGpuQueries(): void {
  for (let index = gpuQueries.length - 1; index >= 0; index -= 1) {
    const item = gpuQueries[index];
    try {
      if (item.mode === "webgl2") {
        const gl = item.gl as WebGL2RenderingContext;
        const query = item.query as WebGLQuery;
        if (!gl.getQueryParameter(query, gl.QUERY_RESULT_AVAILABLE)) continue;

        const nanoseconds = gl.getQueryParameter(
          query,
          gl.QUERY_RESULT,
        ) as number;
        item.entry.gpuDuration = nanoseconds / 1_000_000;
        gl.deleteQuery(query);
      } else {
        const getQuery = item.ext.getQueryObjectEXT as (
          query: unknown,
          pname: number,
        ) => unknown;
        const available = getQuery(
          item.query,
          item.ext.QUERY_RESULT_AVAILABLE_EXT as number,
        );
        if (!available) continue;

        const nanoseconds = getQuery(
          item.query,
          item.ext.QUERY_RESULT_EXT as number,
        ) as number;
        item.entry.gpuDuration = nanoseconds / 1_000_000;
        (item.ext.deleteQueryEXT as (query: unknown) => void)(item.query);
      }

      gpuQueries.splice(index, 1);
    } catch {
      gpuQueries.splice(index, 1);
    }
  }
}

export function getPerfSnapshot(): PerfSnapshot {
  const hasOpen = lastOpenStart > 0;
  const openStart = lastOpenStart;
  const openEnd =
    lastOpenEnd ||
    (hasOpen ? Math.max(...frames.map((f) => f.at), openStart + 1) : 0);
  const windowStart = hasOpen ? openStart : startedAt;
  const windowEnd = hasOpen ? openEnd + 900 : startedAt;

  const inWindowFrames = hasOpen
    ? frames.filter(
        (frame) => frame.at >= windowStart && frame.at <= windowEnd,
      )
    : [];
  const worst = [...inWindowFrames]
    .sort((a, b) => b.delta - a.delta)
    .slice(0, 5)
    .map((frame) => attributeFrame(frame));

  const inWindowPhases = hasOpen
    ? phases.filter(
        (phase) => phase.at >= windowStart - 50 && phase.at <= windowEnd,
      )
    : [];

  const textureCalls = hasOpen
    ? glEntries.filter(
        (entry) => entry.at >= windowStart && entry.at <= windowEnd,
      )
    : [];
  const openGl = {
    texImage2D: textureCalls.filter((entry) => entry.kind === "texImage2D")
      .length,
    texSubImage2D: textureCalls.filter(
      (entry) => entry.kind === "texSubImage2D",
    ).length,
    compile: textureCalls.filter((entry) => entry.kind === "compileShader")
      .length,
    link: textureCalls.filter((entry) => entry.kind === "linkProgram").length,
  };
  const openHistory = historyEntries.filter(
    (entry) => entry.at >= windowStart && entry.at <= windowEnd,
  );
  const openResources = resources.filter(
    (entry) => entry.at >= windowStart && entry.at <= windowEnd,
  );
  const openLoaf = loafs.filter(
    (entry) =>
      entry.startTime <= windowEnd && entry.startTime + entry.duration >= windowStart,
  );

  const hasReact =
    hasOpen &&
    (inWindowPhases.some((phase) =>
      /react|pointerup|pointerdown|open-state|hover/i.test(phase.name),
    ) ||
      openLoaf.some((entry) =>
        entry.scripts.some((script) => /react-dom/i.test(script.sourceURL)),
      ));
  const hasTexture =
    hasOpen &&
    (openGl.texImage2D + openGl.texSubImage2D + openGl.compile + openGl.link >
      0 ||
      inWindowPhases.some((phase) => /texture|hi-res|shader/i.test(phase.name)));
  const hasVideo =
    hasOpen &&
    (inWindowPhases.some((phase) => /video|play/i.test(phase.name)) ||
      openGl.texSubImage2D > 0);
  const hasLayout =
    hasOpen &&
    (openLoaf.some((entry) => entry.styleAndLayoutStart > 0) ||
      inWindowPhases.some((phase) =>
        /pointerup-dom|layout|hover-clear/i.test(phase.name),
      ));
  const hasRouter =
    hasOpen &&
    (openHistory.length > 0 ||
      openResources.some((entry) =>
        /(fetch|script|link)/i.test(entry.initiatorType),
      ));

  return {
    openCount,
    lastOpenStart,
    lastOpenEnd,
    frames: inWindowFrames.length,
    worst,
    phases: inWindowPhases.slice(-30),
    hypotheses: {
      react: hasReact,
      texture: hasTexture,
      video: hasVideo,
      layout: hasLayout,
      router: hasRouter,
    },
    glSummary: openGl,
  };
}

function attributeFrame(frame: PerfFrame): PerfWorstFrame {
  const from = frame.at - frame.delta;
  const to = frame.at;
  const overlappingPhases = phases.filter((phase) => {
    const end = phase.end ?? phase.at;
    return phase.at <= to && end >= from;
  });
  const overlappingLoaf = loafs.filter(
    (entry) =>
      entry.startTime <= to && entry.startTime + entry.duration >= from,
  );
  const overlappingEvents = events.filter(
    (entry) =>
      entry.startTime <= to && entry.startTime + entry.duration >= from,
  );
  const overlappingLongtasks = longtasks.filter(
    (entry) =>
      entry.startTime <= to && entry.startTime + entry.duration >= from,
  );
  const overlappingGl = glEntries.filter(
    (entry) => entry.at >= from && entry.at <= to,
  );
  const overlappingHistory = historyEntries.filter(
    (entry) => entry.at >= from && entry.at <= to,
  );
  const overlappingResources = resources.filter(
    (entry) => entry.at >= from && entry.at <= to,
  );

  const nearPhases = phases
    .filter((phase) => phase.at >= from - 240 && phase.at <= to)
    .map((phase) => phase.name);

  return {
    at: frame.at,
    delta: frame.delta,
    from,
    phases: overlappingPhases.map((phase) => phase.name),
    nearPhases,
    loaf: overlappingLoaf.map((entry) => ({
      duration: entry.duration,
      blockingDuration: entry.blockingDuration,
      renderDelay:
        entry.renderStart > 0 ? entry.renderStart - entry.startTime : null,
      styleLayoutDelay:
        entry.styleAndLayoutStart > 0
          ? entry.styleAndLayoutStart - entry.startTime
          : null,
      scripts: [...entry.scripts]
        .sort((a, b) => b.duration - a.duration)
        .slice(0, 4),
    })),
    events: overlappingEvents.map((entry) => ({
      name: entry.name,
      duration: entry.duration,
      processing: entry.processingEnd - entry.processingStart,
      presentation:
        entry.startTime + entry.duration - entry.processingEnd,
      inputDelay: entry.processingStart - entry.startTime,
    })),
    longtasks: overlappingLongtasks,
    gl: overlappingGl,
    history: overlappingHistory,
    resources: overlappingResources,
  };
}

export function getPerfReport(): Record<string, unknown> {
  const snapshot = getPerfSnapshot();
  const openStart = lastOpenStart;
  const openEnd = lastOpenEnd;
  const windowStart = openStart > 0 ? openStart : startedAt;
  const windowEnd = openStart > 0 ? (openEnd || openStart + 2500) + 900 : startedAt + 60000;
  const gl = glEntries.filter(
    (entry) => entry.at >= windowStart && entry.at <= windowEnd,
  );
  const glSummary = {
    texImage2D: gl.filter((entry) => entry.kind === "texImage2D").length,
    texSubImage2D: gl.filter((entry) => entry.kind === "texSubImage2D").length,
    compile: gl.filter((entry) => entry.kind === "compileShader").length,
    link: gl.filter((entry) => entry.kind === "linkProgram").length,
  };

  return {
    version: 1,
    capturedAt: new Date().toISOString(),
    url: typeof location === "undefined" ? "" : location.href,
    userAgent: typeof navigator === "undefined" ? "" : navigator.userAgent,
    dpr: typeof window === "undefined" ? 1 : window.devicePixelRatio,
    startedAt,
    openCount,
    lastOpen: { start: openStart, end: openEnd },
    hypotheses: snapshot.hypotheses,
    worst5: snapshot.worst,
    phases: phases.filter(
      (phase) => phase.at >= windowStart - 50 && phase.at <= windowEnd,
    ),
    frames: frames.filter(
      (frame) => frame.at >= windowStart && frame.at <= windowEnd,
    ),
    loaf: loafs.filter(
      (entry) =>
        entry.startTime <= windowEnd && entry.startTime + entry.duration >= windowStart,
    ),
    events: events.filter(
      (entry) =>
        entry.startTime <= windowEnd && entry.startTime + entry.duration >= windowStart,
    ),
    longtasks: longtasks.filter(
      (entry) => entry.startTime <= windowEnd && entry.startTime + entry.duration >= windowStart,
    ),
    gl,
    glSummary,
    history: historyEntries.filter(
      (entry) => entry.at >= windowStart && entry.at <= windowEnd,
    ),
    resources: resources.filter(
      (entry) => entry.at >= windowStart && entry.at <= windowEnd,
    ),
  };
}

export function clearPerf(): void {
  phases.length = 0;
  frames.length = 0;
  loafs.length = 0;
  events.length = 0;
  longtasks.length = 0;
  glEntries.length = 0;
  historyEntries.length = 0;
  resources.length = 0;
  openCount = 0;
  lastOpenStart = 0;
  lastOpenEnd = 0;
  firstOpenFrameMarked = false;
  lastFrameAt = performance.now();
}
