"use client";

import Link from "next/link";
import { Cover } from "@/components/work/cover";
import type { WorkMeta } from "@/lib/work";

/**
 * The index's list layout: one row per study, year · title · summary · role.
 *
 * A cover preview sits in the row's reserved right-hand slot and fades in on
 * hover or keyboard focus. It is absolutely positioned and its slot is padding,
 * so showing it never reflows the row. Touch never sees it: the row is a plain
 * link there.
 */
export function WorkIndexList({ works }: { works: WorkMeta[] }) {
  return (
    <ul className="wd-index-list">
      {works.map((work) => (
        <li key={work.slug}>
          <Link href={`/work/${work.slug}`} className="wd-index-row">
            <span className="wd-index-year">{work.year}</span>

            <span className="wd-index-main">
              <span className="wd-index-title-row">{work.title}</span>
              <span className="wd-index-summary">{work.summary}</span>
            </span>

            <span className="wd-index-role">{work.role}</span>

            <span className="wd-index-preview" aria-hidden="true">
              <Cover scene={work.cover} fit="cover" />
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
