"use client";

import { usePathname, useRouter } from "next/navigation";
import {
  WORK_VARIANTS,
  WORK_VARIANT_LABELS,
  WORK_VARIANT_NOTES,
  noteWorkVariantParam,
  setWorkVariant,
  useWorkVariant,
  useWorkVariantParam,
} from "./work-variant";
import "./work-variant-switcher.css";

/**
 * The review pill: current / A full / A grow / A plain.
 *
 * It is mounted once in the root layout so it can be reached on `/` (where the
 * drawer is opened from) and stays above the nav. Development always shows it; a
 * production build shows it only when the URL carries `?wv=`, which is also
 * what keeps a shared review link honest.
 *
 * Choosing is a reset, not a live swap: the drawer is closed on the homepage so
 * the next Work click plays the chosen open from its first frame.
 */
export function WorkVariantSwitcher() {
  const variant = useWorkVariant();
  const hasParam = useWorkVariantParam();
  const pathname = usePathname() ?? "/";
  const router = useRouter();

  if (process.env.NODE_ENV === "production" && !hasParam) return null;

  const choose = (next: (typeof WORK_VARIANTS)[number]) => {
    if (next === variant) return;

    setWorkVariant(next);
    noteWorkVariantParam();

    // Keep the review's fake-row flag when moving to E2, so a `?fake=1` link
    // can be switched around and back without losing the placeholders.
    let fake = false;
    let fakeValue = "";

    try {
      const value = new URLSearchParams(window.location.search).get("fake");
      fakeValue = value === "1" || value === "2" ? value : "";
      fake = next === "e2" && fakeValue !== "";
    } catch {
      fake = false;
    }

    const href = `/?wv=${next}${fake ? `&fake=${fakeValue}` : ""}`;

    // Off the homepage the choice is a reset: the route has to change so the
    // next Work click is a fresh open. On `/` the query alone is enough, and
    // replacing it avoids a server round-trip for a review switch.
    if (pathname !== "/") {
      router.push(href);
      return;
    }

    try {
      window.history.replaceState(window.history.state, "", href);
    } catch {
      // A blocked history write still leaves the store switched for this visit.
    }
  };

  return (
    <div
      className="wd-wv-pill"
      data-on-work={pathname.startsWith("/work") ? "" : undefined}
      role="group"
      aria-label="Work prototype variant"
    >
      <span className="wd-wv-pill-label" aria-hidden="true">
        Work
      </span>

      {WORK_VARIANTS.map((value) => (
        <button
          key={value}
          type="button"
          className="wd-wv-option"
          aria-pressed={variant === value}
          title={WORK_VARIANT_NOTES[value]}
          onClick={() => choose(value)}
        >
          {WORK_VARIANT_LABELS[value]}
        </button>
      ))}
    </div>
  );
}
