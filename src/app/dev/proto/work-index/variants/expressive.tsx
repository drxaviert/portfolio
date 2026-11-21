"use client";

import { useState } from "react";
import Link from "next/link";
import { Cover } from "@/components/work/cover";
import type { WorkMeta } from "@/lib/work";
import "./expressive.css";

/**
 * C, Expressive: a large heading over a numbered list. On a wide, fine-pointer
 * screen, hovering or focusing a row dims the others and crossfades a sticky
 * preview panel to that study's cover. Anywhere else there is no panel; each
 * row carries a small inline cover.
 *
 * `shown` is the study in the panel (it stays on the last one, so the panel is
 * never empty); `hot` is whether a row is currently engaged, which drives the
 * dimming.
 */
export function ExpressiveIndex({ works }: { works: WorkMeta[] }) {
  const [shown, setShown] = useState(0);
  const [hot, setHot] = useState(false);

  const engage = (index: number) => {
    setShown(index);
    setHot(true);
  };

  return (
    <section aria-labelledby="wi-c-title" className="wi-c">
      <h1 id="wi-c-title" className="wi-c-title">
        Work
      </h1>

      <div className="wi-c-body">
        <ol
          className="wi-c-list"
          data-hot={hot ? "" : undefined}
          onPointerLeave={() => setHot(false)}
        >
          {works.map((work, i) => (
            <li
              key={`${work.slug}-${i}`}
              className="wi-c-item"
              data-current={hot && shown === i ? "" : undefined}
              onPointerEnter={() => engage(i)}
              onFocus={() => engage(i)}
              onBlur={() => setHot(false)}
            >
              <Link href={`/work/${work.slug}`} className="wi-c-row">
                <span className="wi-c-num" aria-hidden="true">
                  {String(i + 1).padStart(2, "0")}
                </span>

                <span className="wi-c-name">{work.title}</span>

                <span className="wi-c-aside">
                  <span className="wi-c-role">{work.role}</span>
                  <span className="wi-c-year">{work.year}</span>
                </span>

                <span className="wi-c-inline" aria-hidden="true">
                  <Cover
                    scene={work.cover}
                    fit="cover"
                    coverImage={work.coverImage}
                  />
                </span>
              </Link>
            </li>
          ))}
        </ol>

        <div className="wi-c-preview" aria-hidden="true">
          <div className="wi-c-frame">
            {works.map((work, i) => (
              <div
                key={`${work.slug}-${i}`}
                className="wi-c-shot"
                data-on={shown === i ? "" : undefined}
              >
                <Cover
                  scene={work.cover}
                  fit="cover"
                  coverImage={work.coverImage}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
