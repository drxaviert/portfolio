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

    const isE2 = (value: string) => value === "e2" || value === "e2-v1";

    // Keep the review's fake-row flag when moving between E2 variants, so a
    // `?fake=1` or `?fake=2` link can be switched around without losing the
    // placeholders.
    let fake = false;
    let fakeValue = "";

    try {
      const value = new URLSearchParams(window.location.search).get("fake");
      fakeValue = value === "1" || value === "2" ? value : "";
      fake = isE2(next) && fakeValue !== "";
    } catch {
      fake = false;
    }

    // Comparing the two E2s is a live switch: the drawer stays open, the list
    // re-renders, and only the URL changes. The A variants still reset because
    // their open has to be played from the homepage.
    if (pathname.startsWith("/work") && isE2(next) && isE2(variant)) {
      try {
        const url = new URL(window.location.href);
        url.searchParams.set("wv", next);

        if (fake) url.searchParams.set("fake", fakeValue);
        else url.searchParams.delete("fake");

        window.history.replaceState(window.history.state, "", url);
      } catch {
        // The store already switched; only the URL annotation was missed.
      }

      return;
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
