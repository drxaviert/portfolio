import type { Project } from "./works";
import type { Setup } from "./types";

/**
 * The placeholder case study: a full reading layout, long enough to scroll
 * roughly four screens. Copy is templated from the project's own metadata so
 * every project reads differently without a second content file.
 */

type Section = {
  heading: string;
  paragraphs: [string, string];
  figure: string;
};

function sectionsFor(project: Project): Section[] {
  const team = project.team.toLowerCase();

  return [
    {
      heading: "The brief",
      figure: "Working wall, week two",
      paragraphs: [
        `${project.summary} The first brief was three sentences long and one of them was a question. We kept that question on the wall for the whole project and used it to throw out anything that looked impressive but did not answer it.`,
        `I came in as ${project.role.toLowerCase()} alongside ${team}. The opening month was mostly listening: watching people use the thing, reading the support inbox, and writing down the moments where the interface asked for more attention than the task deserved.`,
      ],
    },
    {
      heading: "The work",
      figure: "Early studies, before the rule was written",
      paragraphs: [
        `We worked in short, public rounds. Every week produced something that could be tried, not a deck. ${project.discipline} decisions were made against real content and real constraints, and anything that only worked with placeholder copy was treated as unfinished.`,
        `The hard part was subtraction. The first three directions all worked; they just worked loudly. The version we shipped kept the same structure and removed the announcements: fewer states, fewer transitions, fewer places where the product asked to be admired for doing its job.`,
      ],
    },
    {
      heading: "Where it landed",
      figure: "The shipped system in daily use",
      paragraphs: [
        `The release went out in ${project.year} with a short migration note and a long list of things we chose not to build. Adoption was quiet, which was the point. The people closest to the work stopped noticing the interface and started noticing each other again.`,
        `Looking back, the useful lesson was not about ${project.discipline.toLowerCase()} at all. It was that restraint has to be designed, documented and defended in the same way as any new surface. Otherwise it disappears the first time someone asks for one more badge.`,
      ],
    },
  ];
}

function Figure({ art, caption }: { art: number; caption: string }) {
  return (
    <figure className="wd-figure-wrap">
      <div className="wd-figure" data-art={art} aria-hidden="true">
        <span className="wd-figure-mark" />
      </div>
      <figcaption className="wd-caption">{caption}</figcaption>
    </figure>
  );
}

export function CaseStudy({
  project,
  next,
  index,
  total,
  setup,
  onNext,
}: {
  project: Project;
  next: Project;
  index: number;
  total: number;
  setup: Setup;
  onNext: () => void;
}) {
  const sections = sectionsFor(project);

  return (
    <article className="wd-study">
      <div className="wd-hero" data-art={project.art} aria-hidden="true">
        <span className="wd-hero-mark" />
        <span className="wd-hero-index">
          {String(index + 1).padStart(2, "0")}
        </span>
      </div>

      <p className="wd-eyebrow wd-eyebrow-first">{project.discipline}</p>

      <h2
        id="wd-study-title"
        className="wd-title text-balance text-title-sm font-semibold md:text-title"
      >
        {project.title}
      </h2>

      <p className="wd-summary text-lg leading-7 text-on-surface-variant">
        {project.summary}
      </p>

      <dl className="wd-meta">
        <div>
          <dt>Role</dt>
          <dd>{project.role}</dd>
        </div>
        <div>
          <dt>Year</dt>
          <dd>{project.year}</dd>
        </div>
        <div>
          <dt>Team</dt>
          <dd>{project.team}</dd>
        </div>
      </dl>

      <p className="wd-lead">
        This is a placeholder case study, written to give the drawer something
        honest to scroll: a real reading measure, a hero, three sections with
        images, and a result you can measure. The words are stand-ins. The
        rhythm of the page is the thing on trial.
      </p>

      {sections.map((section, sectionIndex) => (
        <section key={section.heading} className="wd-section">
          <h3 className="text-2xl leading-8 font-semibold">
            {section.heading}
          </h3>
          <p className="wd-body">{section.paragraphs[0]}</p>
          <p className="wd-body">{section.paragraphs[1]}</p>
          <Figure
            art={(project.art + sectionIndex + 1) % 4}
            caption={`Fig. ${String(sectionIndex + 1).padStart(2, "0")} — ${section.figure}`}
          />
        </section>
      ))}

      <section className="wd-outcome" aria-labelledby="wd-outcome-title">
        <p className="wd-eyebrow" id="wd-outcome-title">
          Outcome
        </p>
        <ul className="wd-stats">
          {project.stats.map((stat) => (
            <li key={stat.label}>
              <p className="wd-stat-value">{stat.value}</p>
              <p className="wd-stat-label">{stat.label}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="wd-next" aria-labelledby="wd-next-title">
        <div className="wd-next-head">
          <p className="wd-eyebrow" id="wd-next-title">
            {setup === "stack" ? "Up next" : "Next project"}
          </p>
          <span className="wd-next-count">
            {String(index + 1).padStart(2, "0")} /{" "}
            {String(total).padStart(2, "0")}
          </span>
        </div>

        <button
          type="button"
          className="wd-next-card"
          data-peek={setup === "stack" ? "" : undefined}
          onClick={onNext}
        >
          <span
            className="wd-next-art"
            data-art={next.art}
            aria-hidden="true"
          />
          <span className="wd-next-body">
            <span className="wd-next-title">{next.title}</span>
            <span className="wd-next-meta">
              {next.discipline} · {next.year}
            </span>
            {setup === "stack" ? (
              <span className="wd-next-cta">Continue reading</span>
            ) : null}
          </span>
          <span className="wd-next-arrow" aria-hidden="true">
            {setup === "stack" ? "↓" : "→"}
          </span>
        </button>
      </section>
    </article>
  );
}
