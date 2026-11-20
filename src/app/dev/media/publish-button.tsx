"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { PublishState } from "./publish";

/**
 * The one click that publishes. The server refuses anything but a clean main
 * with only media changes, so the reason is shown next to the button instead
 * of failing after the press.
 */
export function PublishButton({ state }: { state: PublishState }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);

  const count = state.unpublished.length;

  async function publish() {
    if (busy || state.blocker) return;

    setBusy(true);
    setFailed(false);
    setMessage("Publishing…");

    try {
      const response = await fetch("/dev/media/api/publish", {
        method: "POST",
      });
      const data = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        sha?: string;
        error?: string;
      };

      if (!response.ok || !data.ok) {
        setFailed(true);
        setMessage(data.error ?? `Publish failed (${response.status}).`);
        return;
      }

      setMessage(`Published ${data.sha}. Live in about 2 min.`);
      router.refresh();
    } catch {
      setFailed(true);
      setMessage("Could not reach the dev server. Is it still running?");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-1 sm:items-end">
      <div className="flex items-center gap-3">
        <p className="text-sm text-on-surface-variant tabular-nums">
          {count} unpublished
        </p>
        <button
          type="button"
          className="mlib-button min-h-11 bg-primary px-4 text-sm font-medium text-on-primary disabled:bg-surface-container disabled:text-on-surface-variant"
          onClick={publish}
          disabled={busy || state.blocker !== null}
          title={state.blocker ?? undefined}
        >
          {busy ? "Publishing…" : "Publish"}
        </button>
      </div>

      {state.blocker ? (
        <p className="max-w-72 text-xs leading-5 text-right text-on-surface-variant">
          {state.blocker}
        </p>
      ) : null}

      {message ? (
        <p
          role="status"
          className={`max-w-72 text-right text-xs leading-5 ${
            failed ? "text-on-surface" : "text-on-surface-variant"
          }`}
        >
          {message}
        </p>
      ) : null}
    </div>
  );
}
