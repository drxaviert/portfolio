"use client";

import Link from "next/link";
import {
  MESSAGE_BUTTON,
  MESSAGE_LINK,
  MessageScreen,
} from "@/components/system/message-screen";

/**
 * The boundary for an uncaught render error below the root layout. Retrying
 * re-fetches and re-renders the segment; the home link is the way out if it
 * fails again. Errors from the root layout itself need `global-error.tsx`.
 */
export default function Error({
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  return (
    <MessageScreen kicker="Error" title="Something broke.">
      <p>The page hit an error before it could finish rendering.</p>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
        <button
          type="button"
          onClick={() => retry()}
          className={MESSAGE_BUTTON}
        >
          Try again
        </button>
        <Link href="/" className={MESSAGE_LINK}>
          Back to the work
        </Link>
      </div>
    </MessageScreen>
  );
}
