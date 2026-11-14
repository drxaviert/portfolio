"use client";

import Link from "next/link";
import { useState } from "react";
import type { KeyboardEvent, ReactNode } from "react";
import type { WorkMeta } from "@/lib/work";

/**
 * The Margin layout's parts. Media is always a plain gray box: the site's
 * neutral container-highest, 12px radius, nothing inside.
 */

export const READER_TITLE_ID = "wd-study-title";

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

/** Placeholder until the cover scene lands; a 16:9 neutral box. */
export function Hero() {
  return <div className="wd-hero" aria-hidden="true" />;
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
        className="wd-intro-title text-balance text-title-sm font-semibold md:text-title"
      >
        {meta.title}
      </h1>
      <p className="wd-intro-subtitle">{meta.subtitle}</p>
      <p className="wd-intro-meta">
        {meta.role} · {meta.year}
      </p>
    </header>
  );
}

export function Figure({
  caption,
  aspect = "16 / 9",
  marginCaption = false,
  wide = false,
  className = "",
}: {
  caption: string;
  aspect?: string;
  marginCaption?: boolean;
  wide?: boolean;
  className?: string;
}) {
  const classes = ["wd-fig", wide && "wd-fig-wide", className]
    .filter(Boolean)
    .join(" ");

  return (
    <figure className={classes}>
      <div className="wd-media" style={{ aspectRatio: aspect }} />
      <figcaption
        className={["wd-caption", marginCaption && "wd-caption-margin"]
          .filter(Boolean)
          .join(" ")}
      >
        {caption}
      </figcaption>
    </figure>
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

export function StepFigure({ steps }: { steps: string[] }) {
  const [step, setStep] = useState(0);
  const tabId = (index: number) => `wd-step-tab-${index}`;

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let next = index;

    switch (event.key) {
      case "ArrowRight":
      case "ArrowDown":
        next = (index + 1) % steps.length;
        break;
      case "ArrowLeft":
      case "ArrowUp":
        next = (index + steps.length - 1) % steps.length;
        break;
      case "Home":
        next = 0;
        break;
      case "End":
        next = steps.length - 1;
        break;
      default:
        return;
    }

    event.preventDefault();
    setStep(next);
    document.getElementById(tabId(next))?.focus();
  }

  return (
    <figure className="wd-step">
      <div
        id="wd-step-panel"
        className="wd-step-panel"
        role="tabpanel"
        aria-labelledby={tabId(step)}
      >
        <div className="wd-media wd-step-media" />

        <div className="wd-step-bar">
          <div
            className="wd-step-tabs"
            role="tablist"
            aria-label="Figure steps"
          >
            {steps.map((caption, index) => (
              <button
                key={caption}
                id={tabId(index)}
                type="button"
                role="tab"
                className="wd-step-tab"
                aria-selected={index === step}
                aria-controls="wd-step-panel"
                tabIndex={index === step ? 0 : -1}
                onClick={() => setStep(index)}
                onKeyDown={(event) => onKeyDown(event, index)}
              >
                {index + 1}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="wd-step-replay"
            onClick={() => setStep(0)}
          >
            Replay
          </button>
        </div>

        <p className="wd-caption" aria-live="polite">
          {steps[step]}
        </p>
      </div>
    </figure>
  );
}

export function ContactSheet({ caption }: { caption: string }) {
  return (
    <figure className="wd-contact">
      <div className="wd-contact-grid" aria-hidden="true">
        {Array.from({ length: 8 }, (_, index) => (
          <div key={index} className="wd-media" />
        ))}
      </div>
      <figcaption className="wd-caption">{caption}</figcaption>
    </figure>
  );
}

export function NextLink({ next }: { next: WorkMeta }) {
  return (
    <section className="wd-nextlink" aria-labelledby="wd-nextlink-title">
      <p className="wd-kicker" id="wd-nextlink-title">
        Next project
      </p>
      <Link
        href={`/work/${next.slug}`}
        className="wd-nextlink-link"
        aria-label={`Next project: ${next.title}`}
      >
        <span>{next.title}</span>
        <span aria-hidden="true">→</span>
      </Link>
    </section>
  );
}
