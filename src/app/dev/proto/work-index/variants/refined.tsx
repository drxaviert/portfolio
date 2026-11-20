"use client";

import Link from "next/link";
import { Cover } from "@/components/work/cover";
import type { WorkMeta } from "@/lib/work";
import "./refined.css";

/**
 * A, Refined: today's grid, tuned. One column, two from 640px, three from
 * 1024px; the first study spans two columns with a 16:9 cover, the rest keep
 * 4:3. Meta is title, a one-line subtitle, then "year · role".
 */
export function RefinedIndex({ works }: { works: WorkMeta[] }) {
  return (
    <section aria-labelledby="wi-a-title">
      <header className="wi-a-head">
        <h1 id="wi-a-title" className="wi-a-title">
          Work
        </h1>
        <p className="wi-a-count">{works.length} studies</p>
      </header>

      <ul className="wi-a-grid">
        {works.map((work, i) => (
          <li
            key={`${work.slug}-${i}`}
            className="wi-a-item"
            data-featured={i === 0 ? "" : undefined}
          >
            <Link href={`/work/${work.slug}`} className="wi-a-card">
              <span className="wi-a-cover" aria-hidden="true">
                <Cover
                  scene={work.cover}
                  fit="cover"
                  coverImage={work.coverImage}
                />
              </span>

              <span className="wi-a-meta">
                <span className="wi-a-name">{work.title}</span>
                <span className="wi-a-sub">{work.subtitle}</span>
                <span className="wi-a-facts">
                  {work.year} · {work.role}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
