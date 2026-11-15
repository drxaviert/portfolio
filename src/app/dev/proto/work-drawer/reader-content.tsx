"use client";

import "./reader.css";
import { storyFor } from "./reader-story";
import {
  BriefQuote,
  ContactSheet,
  DecisionTable,
  Figure,
  FigurePair,
  Footnotes,
  FootnoteLink,
  Intro,
  NextLink,
  NoteBlock,
  StatsRow,
  StepFigure,
} from "./reader-parts";
import type { ContentVariant } from "./types";
import type { Project } from "./works";

/**
 * The three reading layouts, for Featured + Expand. V1 and V2 share the same
 * quiet 550px column; V2 moves captions and notes into the right margin and
 * lets two figures break out to ~880px. V3 is the visual treatment.
 */

export function ReaderContent({
  project,
  next,
  content,
  onNext,
}: {
  project: Project;
  next: Project;
  content: ContentVariant;
  onNext: () => void;
}) {
  if (content === "margin") {
    return <MarginLayout project={project} next={next} onNext={onNext} />;
  }

  if (content === "visual") {
    return <VisualLayout project={project} next={next} onNext={onNext} />;
  }

  return <EssayLayout project={project} next={next} onNext={onNext} />;
}

function EssayLayout({
  project,
  next,
  onNext,
}: {
  project: Project;
  next: Project;
  onNext: () => void;
}) {
  const story = storyFor(project);

  return (
    <article className="wd-reader wd-reader-essay">
      <Intro project={project} />
      <p className="wd-p wd-lede">{story.lead}</p>

      <section className="wd-sec">
        <h3 className="wd-h3">The starting point</h3>
        <p className="wd-p">
          {story.start[0]} <FootnoteLink n={1} />
        </p>
        <p className="wd-p">{story.start[1]}</p>
        <Figure caption={story.fig1} />
        <FigurePair
          left={{ caption: story.pair[0] }}
          right={{ caption: story.pair[1] }}
        />
      </section>

      <section className="wd-sec">
        <h3 className="wd-h3">The work</h3>
        <p className="wd-p">{story.work[0]}</p>
        <p className="wd-p">
          {story.work[1]} <FootnoteLink n={2} />
        </p>
        <BriefQuote text={story.brief} />
        <DecisionTable rows={story.table} />
        <StepFigure steps={story.steps} />
      </section>

      <section className="wd-sec">
        <h3 className="wd-h3">What stayed</h3>
        <p className="wd-p">
          {story.stay[0]} <FootnoteLink n={3} />
        </p>
        <p className="wd-p">{story.stay[1]}</p>
        <Figure caption={story.fig2} />
        <ContactSheet caption={story.contact} />
      </section>

      <Footnotes notes={story.notes} />
      <NextLink next={next} onNext={onNext} />
    </article>
  );
}

function MarginLayout({
  project,
  next,
  onNext,
}: {
  project: Project;
  next: Project;
  onNext: () => void;
}) {
  const story = storyFor(project);

  return (
    <article className="wd-reader wd-reader-margin">
      <Intro project={project} />
      <p className="wd-p wd-lede">{story.lead}</p>

      <section className="wd-sec">
        <h3 className="wd-h3">The starting point</h3>
        <NoteBlock n={1} note={story.notes[0]}>
          {story.start[0]}
        </NoteBlock>
        <p className="wd-p">{story.start[1]}</p>
        <Figure caption={story.fig1} marginCaption />
        <FigurePair
          left={{ caption: story.pair[0] }}
          right={{ caption: story.pair[1] }}
        />
        <Figure caption={story.wide1} wide />
      </section>

      <section className="wd-sec">
        <h3 className="wd-h3">The work</h3>
        <p className="wd-p">{story.work[0]}</p>
        <NoteBlock n={2} note={story.notes[1]}>
          {story.work[1]}
        </NoteBlock>
        <BriefQuote text={story.brief} />
        <DecisionTable rows={story.table} />
        <Figure caption={story.wide2} wide />
      </section>

      <section className="wd-sec">
        <h3 className="wd-h3">What stayed</h3>
        <NoteBlock n={3} note={story.notes[2]}>
          {story.stay[0]}
        </NoteBlock>
        <p className="wd-p">{story.stay[1]}</p>
        <StepFigure steps={story.steps} />
        <ContactSheet caption={story.contact} />
      </section>

      <NextLink next={next} onNext={onNext} />
    </article>
  );
}

function VisualLayout({
  project,
  next,
  onNext,
}: {
  project: Project;
  next: Project;
  onNext: () => void;
}) {
  const story = storyFor(project);

  return (
    <article className="wd-reader wd-reader-visual">
      <div className="wd-media wd-v3-hero" />

      <div className="wd-reader-col">
        <Intro project={project} />
        <p className="wd-p wd-lede">{story.lead}</p>
        <p className="wd-p">{story.visualLead}</p>
        <p className="wd-p">{story.visualLead2}</p>
      </div>

      <div className="wd-v3-wide">
        <div className="wd-bento" aria-hidden="true">
          <div className="wd-media wd-bento-a" />
          <div className="wd-media wd-bento-b" />
          <div className="wd-media wd-bento-c" />
          <div className="wd-media wd-bento-d" />
          <div className="wd-media wd-bento-e" />
          <div className="wd-media wd-bento-f" />
        </div>
        <p className="wd-caption">{story.bento}</p>
      </div>

      <div className="wd-reader-col">
        <p className="wd-p">{story.visualAfter}</p>
      </div>

      <figure className="wd-v3-seq">
        <div className="wd-media wd-v3-16x9" />
        <figcaption className="wd-caption">{story.sequence}</figcaption>
      </figure>

      <div className="wd-reader-col">
        <p className="wd-p">{story.visualClose}</p>
        <StatsRow stats={project.stats} />
        <NextLink next={next} onNext={onNext} />
      </div>
    </article>
  );
}
