"use client";

import Link from "next/link";
import { Cover } from "@/components/work/cover";
import type { WorkMeta } from "@/lib/work";
import "./restructured.css";

/**
 * B, Restructured: the first study is a featured tile (two thirds from 960px);
 * the rest are compact rows in the right third, or full width under the tile
 * below 960px.
 */
export function RestructuredIndex({ works }: { works: WorkMeta[] }) {
  const [featured, ...rest] = works;

  return (
    <section aria-labelledby="wi-b-title">
      <header className="wi-b-head">
        <h1 id="wi-b-title" className="wi-b-title">
          Work
        </h1>
        <p className="wi-b-count">{works.length} studies</p>
      </header>

      <div className="wi-b-layout">
        {featured ? (
          <Link href={`/work/${featured.slug}`} className="wi-b-feature">
            <span className="wi-b-feature-cover" aria-hidden="true">
              <Cover
                scene={featured.cover}
                fit="cover"
                coverImage={featured.coverImage}
              />
            </span>

            <span className="wi-b-feature-body">
              <span className="wi-b-feature-title">{featured.title}</span>
              <span className="wi-b-feature-summary">{featured.summary}</span>
              <span className="wi-b-feature-facts">
                {featured.year} · {featured.role}
              </span>
            </span>
          </Link>
        ) : null}

        <ul className="wi-b-rows">
          {rest.map((work, i) => (
            <li key={`${work.slug}-${i}`}>
              <Link href={`/work/${work.slug}`} className="wi-b-row">
                <span className="wi-b-year">{work.year}</span>

                <span className="wi-b-thumb" aria-hidden="true">
                  <Cover
                    scene={work.cover}
                    fit="cover"
                    coverImage={work.coverImage}
                  />
                </span>

                <span className="wi-b-text">
                  <span className="wi-b-name">{work.title}</span>
                  <span className="wi-b-role">{work.role}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
