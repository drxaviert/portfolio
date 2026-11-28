"use client";

import { useEffect, useRef, useState } from "react";
import type { WorkMeta } from "@/lib/work";
import { Breadcrumb } from "./breadcrumb";
import {
  FILTER_IN_MS,
  FILTER_IN_STEP_MS,
  FILTER_OUT_MS,
  FILTER_OUT_STEP_MS,
  FILTER_REDUCED_MS,
  FILTER_STAGGER_CAP,
  MOTION_3D,
  type RowMotion,
  filterDuration,
  filterWork,
} from "./work-filter";
import { INDEX_SCROLL_ID } from "./work-index-ids";
import { WorkList } from "./work-list";
import "./work-index.css";

export { INDEX_SCROLL_ID, INDEX_TITLE_ID } from "./work-index-ids";

/**
 * The pill's last state, kept for the session's client navigation: closing the
 * drawer to Home and opening Work again remounts the index with it. A reload
 * starts on again, which is also what the server renders.
 */
let rememberedMotion3d = true;

function prefersReducedMotion(): boolean {
  return (
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/** Slugs whose rows are on screen in the index's scroll area. */
function visibleSlugs(rows: WorkMeta[]): Set<string> | null {
  const scroll = document.getElementById(INDEX_SCROLL_ID);
  if (!scroll) return null;

  const view = scroll.getBoundingClientRect();
  const seen = new Set<string>();

  scroll.querySelectorAll<HTMLElement>("[data-work-index]").forEach((row) => {
    const rect = row.getBoundingClientRect();
    const work = rows[Number(row.dataset.workIndex)];

    if (work && rect.bottom > view.top && rect.top < view.bottom) {
      seen.add(work.slug);
    }
  });

  return seen;
}

/**
 * Stagger steps for the rows that change, capped. In runs top-down. Out runs
 * bottom-up, counted over the rows on screen only, so the last visible row
 * leaves first and the wave climbs; rows off screen go at step 0, unseen.
 */
function stagger(
  rows: WorkMeta[],
  changed: Set<string>,
  kind: RowMotion["kind"],
): Record<string, RowMotion> {
  const motion: Record<string, RowMotion> = {};
  const visible = kind === "out" ? visibleSlugs(rows) : null;
  const order = kind === "out" ? [...rows].reverse() : rows;
  let i = 0;

  for (const row of order) {
    if (visible && !visible.has(row.slug) && changed.has(row.slug)) {
      motion[row.slug] = { kind, i: 0 };
      continue;
    }
    if (!changed.has(row.slug)) continue;
    motion[row.slug] = { kind, i: Math.min(i, FILTER_STAGGER_CAP) };
    i += 1;
  }

  return motion;
}

/**
 * The /work index: one list of case studies inside the drawer panel, under the
 * nav. The list owns its own scroll container and the hover thumbnail; this
 * wrapper keeps the drawer's stable `INDEX_TITLE_ID` import and puts the shared
 * Breadcrumb ("Home / Work") and the Motion/3D pill at the top of the list.
 *
 * The pill starts on; turning it off hides every Motion/3D study except
 * Motion & Stills. Leaving rows stay mounted while they rise and fade out, and
 * are dropped once the last one is gone; arriving rows mount at once and play
 * the list's own entrance (rise out of a blur), both staggered top-down.
 */
export function WorkIndex({ works }: { works: WorkMeta[] }) {
  const [motion3d, setMotion3d] = useState(rememberedMotion3d);
  const [shown, setShown] = useState(() =>
    filterWork(works, rememberedMotion3d),
  );
  const [motion, setMotion] = useState<Record<string, RowMotion>>({});
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, []);

  const toggle = () => {
    const on = !motion3d;
    const next = filterWork(works, on);
    const nextSlugs = new Set(next.map((work) => work.slug));
    const reduce = prefersReducedMotion();

    setMotion3d(on);
    rememberedMotion3d = on;
    if (timerRef.current) window.clearTimeout(timerRef.current);

    // Rows still mid-exit are on screen: they count as shown.
    const leaving = new Set(
      shown.map((work) => work.slug).filter((slug) => !nextSlugs.has(slug)),
    );

    if (leaving.size > 0) {
      const out = stagger(shown, leaving, "out");
      setMotion(out);
      timerRef.current = window.setTimeout(
        () => {
          timerRef.current = null;
          setShown(next);
          setMotion({});
        },
        reduce
          ? FILTER_REDUCED_MS
          : filterDuration(leaving.size, FILTER_OUT_MS, FILTER_OUT_STEP_MS),
      );
      return;
    }

    // Arriving rows, plus any that were leaving and are now wanted back.
    const settled = new Set(
      shown
        .filter((work) => motion[work.slug]?.kind !== "out")
        .map((work) => work.slug),
    );
    const arriving = new Set(
      next.map((work) => work.slug).filter((slug) => !settled.has(slug)),
    );

    setShown(next);
    setMotion(stagger(next, arriving, "in"));
    timerRef.current = window.setTimeout(
      () => {
        timerRef.current = null;
        setMotion({});
      },
      reduce
        ? FILTER_REDUCED_MS
        : filterDuration(arriving.size, FILTER_IN_MS, FILTER_IN_STEP_MS),
    );
  };

  return (
    <WorkList
      works={shown}
      rowMotion={motion}
      topControl={
        <div className="wd-work-controls">
          <Breadcrumb />
          <button
            type="button"
            className="wd-work-pill"
            aria-pressed={motion3d}
            onClick={toggle}
          >
            {MOTION_3D}
          </button>
        </div>
      }
    />
  );
}
