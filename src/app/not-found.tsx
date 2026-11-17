import type { Metadata } from "next";
import Link from "next/link";
import {
  MESSAGE_LINK,
  MessageScreen,
} from "@/components/system/message-screen";
import { listWork } from "@/lib/work";

export const metadata: Metadata = {
  title: "Page not found",
};

/**
 * The 404 for an unmatched URL. It renders inside the root layout, so it keeps
 * the one nav and the phase tokens; the body paint comes from the unlayered
 * `html[data-phase] body` rule in globals.css.
 */
export default function NotFound() {
  return (
    <MessageScreen kicker="404" title="This page doesn't exist.">
      <p>The address may be mistyped, or the page has moved.</p>

      <p>
        <Link href="/" className={MESSAGE_LINK}>
          Back to the work
        </Link>
      </p>

      <div>
        <p>Or read a case study:</p>
        <ul className="mt-2 flex flex-col gap-1.5">
          {listWork().map((work) => (
            <li key={work.slug}>
              <Link href={`/work/${work.slug}`} className={MESSAGE_LINK}>
                {work.title}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </MessageScreen>
  );
}
