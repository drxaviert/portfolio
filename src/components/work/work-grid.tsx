"use client";

import Link from "next/link";
import { RingLayers } from "@/components/home/ring-hover";
import { Cover } from "@/components/work/cover";
import { markSheetOrigin } from "@/lib/work-sheet-state";
import type { WorkMeta } from "@/lib/work";

/**
 * The sheet's card layout: the same cover scenes, ring surface and card shadow
 * the homepage uses, at three columns from 1024px, two from 640 and one below.
 *
 * Each card is a morph hook twice over: `data-work-card` is the reader's source
 * box, `data-work-slug` is what the focus return looks for, and the click
 * records this card as the origin so the reader returns here rather than to the
 * homepage card with the same slug.
 */
export function WorkGrid({ works }: { works: WorkMeta[] }) {
  return (
    <ul className="wd-grid">
      {works.map((work) => (
        <li key={work.slug}>
          <Link
            href={`/work/${work.slug}`}
            className="wd-grid-card ring-host"
            data-work-card={work.slug}
            data-work-slug={work.slug}
            onClick={(event) => markSheetOrigin(event.currentTarget)}
          >
            <RingLayers fill="bg-surface-container" />

            <span className="wd-grid-cover" aria-hidden="true">
              <Cover scene={work.cover} fit="cover" />
            </span>

            <span className="wd-grid-meta">
              <span className="wd-grid-title">{work.title}</span>
              <span className="wd-grid-sub">
                {work.year} · {work.role}
              </span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
