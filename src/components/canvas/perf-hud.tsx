"use client";

import {
  useCallback,
  useEffect,
  useState,
  useSyncExternalStore,
} from "react";
import {
  clearPerf,
  getPerfReport,
  getPerfSnapshot,
  perfEnabled,
  startPerf,
  stopPerf,
} from "./perf";
import type { PerfSnapshot, PerfWorstFrame } from "./perf";

function phaseTag(name: string): string {
  if (/pointer|react|open-state|hover|cursor/i.test(name)) return "a/d";
  if (/texture|hi-res|shader/i.test(name)) return "b";
  if (/video|play/i.test(name)) return "c";
  if (/history|resource|router|prefetch/i.test(name)) return "e";
  if (/layout/i.test(name)) return "d";
  return "a";
}

const subscribePerf = () => () => {};
const clientPerf = () => perfEnabled;
const serverPerf = () => false;

function basename(url: string): string {
  if (!url) return "(inline)";
  try {
    return new URL(url).pathname.split("/").pop() || url;
  } catch {
    return url.split("/").pop() || url;
  }
}

function FrameEntry({ frame, openStart }: { frame: PerfWorstFrame; openStart: number }) {
  const rel = Math.round(frame.at - openStart);

  return (
    <li style={{ marginBottom: 8 }}>
      <strong>
        {Math.round(frame.delta)}ms @ +{rel}ms
      </strong>
      <div style={{ opacity: 0.9 }}>
        phases:{" "}
        {frame.phases.length > 0
          ? frame.phases
              .map((phase) => `${phase} [${phaseTag(phase)}]`)
              .join(", ")
          : "none"}
      </div>
      {frame.nearPhases.filter((phase) => !frame.phases.includes(phase)).length >
      0 ? (
        <div style={{ opacity: 0.75 }}>
          near phases:{" "}
          {frame.nearPhases
            .filter((phase) => !frame.phases.includes(phase))
            .map((phase) => `${phase} [${phaseTag(phase)}]`)
            .join(", ")}
        </div>
      ) : null}
      {frame.loaf.map((entry, index) => (
        <div key={`loaf-${index}`} style={{ marginTop: 2 }}>
          LoAF {Math.round(entry.duration)}ms
          {entry.renderDelay !== null
            ? ` · render +${Math.round(entry.renderDelay)}`
            : ""}
          {entry.styleLayoutDelay !== null
            ? ` · style/layout +${Math.round(entry.styleLayoutDelay)}`
            : ""}
          {entry.blockingDuration > 0
            ? ` · block ${Math.round(entry.blockingDuration)}`
            : ""}
          {entry.scripts.map((script, scriptIndex) => (
            <div key={`script-${scriptIndex}`} style={{ paddingLeft: 8 }}>
              {basename(script.sourceURL)}:{script.functionName || "?"} —{" "}
              {Math.round(script.duration)}ms
              {script.forcedStyleAndLayoutDuration > 0
                ? ` (forced layout ${Math.round(script.forcedStyleAndLayoutDuration)}ms)`
                : ""}
            </div>
          ))}
        </div>
      ))}
      {frame.events.map((event, index) => (
        <div key={`event-${index}`}>
          event {event.name} {Math.round(event.duration)}ms · processing{" "}
          {Math.round(event.processing)} · input{" "}
          {Math.round(event.inputDelay)} · presentation{" "}
          {Math.round(event.presentation)}
        </div>
      ))}
      {frame.longtasks.map((task, index) => (
        <div key={`task-${index}`}>
          longtask {Math.round(task.duration)}ms
        </div>
      ))}
      {frame.gl.map((entry, index) => (
        <div key={`gl-${index}`}>
          GL {entry.kind}
          {entry.detail.width ? ` ${entry.detail.width}x${entry.detail.height}` : ""}
          {" "}— {entry.duration.toFixed(1)}ms JS
          {entry.gpuDuration !== null
            ? ` · ${entry.gpuDuration.toFixed(1)}ms GPU`
            : ""}
        </div>
      ))}
      {frame.history.map((entry, index) => (
        <div key={`history-${index}`}>
          history {entry.kind} {entry.url}
        </div>
      ))}
      {frame.resources.map((entry, index) => (
        <div key={`resource-${index}`}>
          resource {entry.initiatorType} {basename(entry.name)}{" "}
          {Math.round(entry.duration)}ms
        </div>
      ))}
    </li>
  );
}

export function PerfHud() {
  const enabled = useSyncExternalStore(
    subscribePerf,
    clientPerf,
    serverPerf,
  );
  const [snapshot, setSnapshot] = useState<PerfSnapshot | null>(null);
  const [status, setStatus] = useState("");

  useEffect(() => {
    if (!enabled) return;

    startPerf();
    const interval = window.setInterval(() => {
      setSnapshot(getPerfSnapshot());
    }, 250);

    return () => {
      window.clearInterval(interval);
      stopPerf();
    };
  }, [enabled]);

  const showStatus = useCallback((message: string) => {
    setStatus(message);
    window.setTimeout(() => setStatus(""), 6000);
  }, []);

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(
        JSON.stringify(getPerfReport(), null, 2),
      );
      showStatus("copied");
    } catch {
      showStatus("copy blocked (LAN is not secure) — use Send report");
    }
  }, [showStatus]);

  const send = useCallback(async () => {
    if (!snapshot || snapshot.openCount === 0 || !snapshot.lastOpenKind) return;

    showStatus("sending…");
    try {
      const response = await fetch("/api/perf-report", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          report: getPerfReport(),
          kind: snapshot.lastOpenKind,
          temperature: snapshot.openCount > 1 ? "warm" : "cold",
        }),
      });
      if (!response.ok) {
        showStatus(`send failed — HTTP ${response.status}`);
        return;
      }
      const data = (await response.json()) as { file?: string };
      showStatus(data.file ? `saved ${data.file}` : "saved report");
    } catch (error) {
      showStatus(
        `send failed — ${error instanceof Error ? error.message : "network error"}`,
      );
    }
  }, [snapshot, showStatus]);

  const download = useCallback(() => {
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const kind = snapshot?.lastOpenKind ?? "open";
    const temperature = snapshot && snapshot.openCount > 1 ? "warm" : "cold";
    const report = {
      ...getPerfReport(),
      kind,
      temperature,
    };
    const blob = new Blob([JSON.stringify(report, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${stamp}-${kind}-${temperature}.json`;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    showStatus(`downloaded ${anchor.download}`);
  }, [snapshot, showStatus]);

  const clear = useCallback(() => {
    clearPerf();
    setSnapshot(getPerfSnapshot());
    setStatus("");
  }, []);

  if (!enabled) return null;

  const worst = snapshot?.worst ?? [];
  const openStart = snapshot?.lastOpenStart ?? 0;
  const canExport = Boolean(
    snapshot && snapshot.openCount > 0 && snapshot.lastOpenKind,
  );

  return (
    <section
      aria-label="Canvas performance HUD"
      style={{
        position: "fixed",
        left: 12,
        bottom: 12,
        zIndex: 9999,
        width: "min(620px, calc(100vw - 24px))",
        maxHeight: "48vh",
        overflow: "auto",
        padding: "10px 12px",
        borderRadius: 8,
        background: "rgba(12, 12, 14, 0.9)",
        color: "#f4f4f5",
        font: "11px/1.45 ui-monospace, SFMono-Regular, Menlo, monospace",
        boxShadow: "0 8px 30px rgba(0,0,0,0.35)",
        pointerEvents: "auto",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 6,
        }}
      >
        <strong style={{ fontSize: 12 }}>Canvas perf</strong>
        <span style={{ opacity: 0.75 }}>
          {snapshot ? `${snapshot.openCount} open(s)` : "starting"}
        </span>
        <span style={{ flex: 1 }} />
        <button
          type="button"
          onClick={() => void send()}
          disabled={!canExport}
          style={{
            padding: "4px 8px",
            border: "1px solid #52525b",
            borderRadius: 4,
            background: "#27272a",
            color: "#fafafa",
            cursor: canExport ? "pointer" : "not-allowed",
            opacity: canExport ? 1 : 0.5,
            font: "inherit",
          }}
        >
          Send report
        </button>
        <button
          type="button"
          onClick={download}
          disabled={!canExport}
          style={{
            padding: "4px 8px",
            border: "1px solid #52525b",
            borderRadius: 4,
            background: "transparent",
            color: "#fafafa",
            cursor: canExport ? "pointer" : "not-allowed",
            opacity: canExport ? 1 : 0.5,
            font: "inherit",
          }}
        >
          Download
        </button>
        <button
          type="button"
          onClick={() => void copy()}
          style={{
            padding: "4px 8px",
            border: "1px solid #52525b",
            borderRadius: 4,
            background: "transparent",
            color: "#fafafa",
            cursor: "pointer",
            font: "inherit",
          }}
        >
          Copy report
        </button>
        <button
          type="button"
          onClick={clear}
          style={{
            padding: "4px 8px",
            border: "1px solid #52525b",
            borderRadius: 4,
            background: "transparent",
            color: "#fafafa",
            cursor: "pointer",
            font: "inherit",
          }}
        >
          Clear
        </button>
      </div>

      <div style={{ opacity: 0.85, marginBottom: 6 }}>
        Open a tile, wait for it to land, then Send report (saves under
        .perf-reports/), Copy, or Download. The list is the worst five frames
        of the last open.
      </div>

      {snapshot ? (
        <div style={{ marginBottom: 6 }}>
          <div>
            a React/DOM {snapshot.hypotheses.react ? "YES" : "no"} · b
            texture/shader {snapshot.hypotheses.texture ? "YES" : "no"} · c
            video {snapshot.hypotheses.video ? "YES" : "no"} · d pointerup
            layout {snapshot.hypotheses.layout ? "YES" : "no"} · e router{" "}
            {snapshot.hypotheses.router ? "YES" : "no"}
          </div>
          <div style={{ opacity: 0.75 }}>
            GL during open: texImage2D {snapshot.glSummary.texImage2D} ·
            texSubImage2D {snapshot.glSummary.texSubImage2D} · compile{" "}
            {snapshot.glSummary.compile} · link {snapshot.glSummary.link}
          </div>
        </div>
      ) : null}

      {worst.length === 0 ? (
        <p style={{ margin: 0, opacity: 0.8 }}>No open captured yet.</p>
      ) : (
        <ol style={{ margin: 0, paddingLeft: 18 }}>
          {worst.map((frame, index) => (
            <FrameEntry
              key={`${frame.at}-${index}`}
              frame={frame}
              openStart={openStart}
            />
          ))}
        </ol>
      )}

      <div style={{ opacity: 0.6, marginTop: 6 }}>
        a React/DOM · b texture/shader · c video · d pointerup style/layout · e
        router/history
      </div>
      {status ? (
        <div style={{ marginTop: 4, color: "#86efac" }}>{status}</div>
      ) : null}
    </section>
  );
}
