"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef } from "react";
import type { MouseEvent, ReactNode } from "react";
import type { WorkMeta } from "@/lib/work";
import { announceProgressionEntry, leaveForNextStudy } from "./progression";

/**
 * The Margin layout's parts. The media slots live in `media-parts.tsx`, which
 * is a server component so a `media` id can be resolved before render.
 */

export const READER_TITLE_ID = "wd-study-title";

/**
 * The reader's one scroll container, in the overlay and on a direct load. It
 * lives beside the title id so the client-side ways back (`reader-rail.tsx`)
 * can find the box without importing the server-rendered reader.
 */
export const READER_SCROLL_ID = "wd-reader-scroll";

function jumpTo(id: string) {
  const target = document.getElementById(id);
  if (!target) return;

  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  target.scrollIntoView({
    block: "start",
    behavior: reduce ? "auto" : "smooth",
  });
  target.focus({ preventScroll: true });
}

export function Intro({
  meta,
  titleId = READER_TITLE_ID,
}: {
  meta: WorkMeta;
  titleId?: string;
}) {
  return (
    <header className="wd-intro">
      <h1
        id={titleId}
        tabIndex={-1}
        dir="auto"
        className="wd-intro-title text-balance text-title-sm font-semibold md:text-title"
      >
        {meta.title}
      </h1>
      <p className="wd-intro-subtitle" dir="auto">
        {meta.subtitle}
      </p>
      <p className="wd-intro-meta" dir="auto">
        {meta.role} · {meta.year}
      </p>
    </header>
  );
}

export function FootnoteLink({ n }: { n: number }) {
  return (
    <sup className="wd-fnref">
      <a
        id={`fnref-${n}`}
        href={`#fn-${n}`}
        aria-label={`Footnote ${n}`}
        onClick={(event) => {
          event.preventDefault();
          jumpTo(`fn-${n}`);
        }}
      >
        {n}
      </a>
    </sup>
  );
}

function BackLink({ n }: { n: number }) {
  return (
    <a
      className="wd-backlink"
      href={`#fnref-${n}`}
      aria-label={`Back to reference ${n}`}
      onClick={(event) => {
        event.preventDefault();
        jumpTo(`fnref-${n}`);
      }}
    >
      Back
    </a>
  );
}

function MarginNote({ n, children }: { n: number; children: ReactNode }) {
  return (
    <aside
      id={`fn-${n}`}
      className="wd-margin-note"
      tabIndex={-1}
      aria-label={`Note ${n}`}
    >
      <span className="wd-note-num">{n}.</span> {children}
    </aside>
  );
}

/** `<Note n={1}>` in MDX: one note, parked in the margin from 1024px up. */
export function Note({ n, children }: { n: number; children: ReactNode }) {
  return (
    <div className="wd-note">
      <MarginNote n={n}>{children}</MarginNote>
    </div>
  );
}

export function NoteBlock({
  n,
  note,
  children,
}: {
  n: number;
  note: string;
  children: ReactNode;
}) {
  return (
    <div className="wd-note-block">
      <p className="wd-p">
        {children} <FootnoteLink n={n} />
      </p>
      <MarginNote n={n}>
        {note} <BackLink n={n} />
      </MarginNote>
    </div>
  );
}

export function Footnotes({ notes }: { notes: string[] }) {
  return (
    <section className="wd-notes" aria-labelledby="wd-notes-title">
      <p className="wd-kicker" id="wd-notes-title">
        Notes
      </p>
      <ol>
        {notes.map((note, index) => (
          <li
            key={note}
            id={`fn-${index + 1}`}
            tabIndex={-1}
            aria-label={`Footnote ${index + 1}`}
          >
            <span className="wd-note-num">{index + 1}.</span> {note}{" "}
            <BackLink n={index + 1} />
          </li>
        ))}
      </ol>
    </section>
  );
}

export function BriefQuote({ children }: { children: ReactNode }) {
  return (
    <figure className="wd-brief">
      <figcaption className="wd-kicker">The brief, as we wrote it</figcaption>
      <pre>{children}</pre>
    </figure>
  );
}

export type DecisionRow = { step: string; decision: string };

export function DecisionTable({ rows }: { rows: DecisionRow[] }) {
  return (
    <figure className="wd-table-fig">
      <table className="wd-table">
        <caption className="wd-caption">What changed, and why.</caption>
        <thead>
          <tr>
            <th scope="col">Step</th>
            <th scope="col">What was decided</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.step}>
              <th scope="row">{row.step}</th>
              <td>{row.decision}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

export function NextLink({ next }: { next: WorkMeta }) {
  const router = useRouter();
  const committed = useRef(false);

  async function onClick(event: MouseEvent<HTMLAnchorElement>) {
    // Modified clicks, middle clicks and anything already handled keep the
    // browser's own behaviour.
    if (event.defaultPrevented || event.button !== 0) return;

    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }

    event.preventDefault();
    if (committed.current) return;

    committed.current = true;

    // The article leaves on the close fade; then the route moves and the
    // incoming mount joins the same drawer with the open's entrance. The entry
    // keeps a depth so a close can return to the homepage in one step and a
    // Back can return to this study.
    const depth = window.history.state?.workDepth;
    announceProgressionEntry((typeof depth === "number" ? depth : 0) + 1);
    await leaveForNextStudy();

    router.push(`/work/${next.slug}`);
  }

  return (
    <section className="wd-nextlink" aria-labelledby="wd-nextlink-title">
      <p className="wd-kicker" id="wd-nextlink-title">
        Next project
      </p>
      <Link
        href={`/work/${next.slug}`}
        className="wd-nextlink-link"
        aria-label={`Next project: ${next.title}`}
        onClick={onClick}
      >
        <span>{next.title}</span>
        {/* Drawn, not typed: Work Sans does have U+2192, but Google's three
            subsets (latin, latin-ext, vietnamese) all omit it, so the text
            glyph fell back to Arial. 1.25em matches the 13x11px ink the glyph
            would have had at 16px, and centres on the line box like it did. */}
        <span className="wd-nextlink-arrow" aria-hidden="true">
          <svg
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.25"
            strokeLinecap="round"
            strokeLinejoin="round"
            focusable="false"
          >
            <path d="M3.5 10h13M11 4.5l5.5 5.5-5.5 5.5" />
          </svg>
        </span>
      </Link>
    </section>
  );
}
