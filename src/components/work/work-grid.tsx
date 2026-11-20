"use client";

import Link from "next/link";
import { RingLayers } from "@/components/home/ring-hover";
import { Cover } from "@/components/work/cover";
import type { WorkMeta } from "@/lib/work";

/**
 * The index's card layout: the same cover scenes, ring surface and card shadow
 * the homepage uses, at three columns from 1024px, two from 640 and one below.
 *
 * Every card is a link into the drawer's study. The drawer is already open, so
 * the click is a content swap, not a morph: nothing here measures a card.
 */
export function WorkGrid({ works }: { works: WorkMeta[] }) {
  return (
    <ul className="wd-grid">
      {works.map((work) => (
        <li key={work.slug}>
          <Link
            href={`/work/${work.slug}`}
            className="wd-grid-card ring-host"
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
