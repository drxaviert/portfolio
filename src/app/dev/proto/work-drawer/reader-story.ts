import type { Project } from "./works";

/**
 * Placeholder copy for the three reader layouts. One fictional design story,
 * told in three shapes; the project's own title, tagline, role, year, team and
 * stats fill the intro and outcome. No lorem, no borrowed text.
 */
export type Story = {
  lead: string;
  start: [string, string];
  work: [string, string];
  stay: [string, string];
  fig1: string;
  fig2: string;
  pair: [string, string];
  brief: string;
  table: { step: string; decision: string }[];
  steps: string[];
  contact: string;
  notes: [string, string, string];
  wide1: string;
  wide2: string;
  visualLead: string;
  visualLead2: string;
  visualAfter: string;
  visualClose: string;
  bento: string;
  sequence: string;
};

export function storyFor(project: Project): Story {
  const discipline = project.discipline.toLowerCase();

  return {
    lead: `${project.summary} The brief was one sentence long, which turned out to be the useful constraint: everything that did not answer it could go.`,
    start: [
      `I was the ${project.role.toLowerCase()} on the work. The first two weeks were reading: support threads, old decks, and the comments people leave when nobody is watching. The pattern was not that people wanted fewer choices; they wanted fewer moments where the product asked them to decide something it could have decided for them.`,
      `We wrote the brief back as three lines and pinned it above the desk. If a screen needed a sentence to explain itself, the screen was not finished. That rule survived the whole project, including the parts where we ignored it.`,
    ],
    work: [
      `The first prototype was deliberately plain: one action per screen, one place for the thing you came to do, and a default that did not move. We tested it with six people who had never seen the old version. The notes were shorter than usual, which we took as a good sign.`,
      `Most of the work was subtraction. The last round removed a badge, a tour, two empty states and a small animation that had survived three reviews because nobody could remember who asked for it.`,
    ],
    stay: [
      `What stayed is not very photogenic: a written rule for every state, a decision table, and defaults that do not need to be explained. The release was quiet, which was the point. The best compliment came from someone who said they had stopped noticing the interface.`,
      `The lesson was not about ${discipline}. It was that restraint has to be designed and defended in the same way as any new surface, or it disappears the first time someone asks for one more badge.`,
    ],
    fig1: "The wall at the end of week two.",
    fig2: "The first prototype, before the tour was removed.",
    pair: ["A page from the first pass.", "The rule, written out."],
    brief: `brief — ${project.year}\n\nmake the first five minutes feel\nlike the building is already open.\n\nno new features this round.`,
    table: [
      {
        step: "01 · Start with the default",
        decision:
          "One primary action; everything else moved behind a single menu.",
      },
      {
        step: "02 · Keep the page still",
        decision:
          "No entrance motion on navigation. Only the workspace animates.",
      },
      {
        step: "03 · Name the states",
        decision:
          "Every empty, loading and error state wrote its own sentence.",
      },
      {
        step: "04 · Write the rule down",
        decision: "The component docs carry the reason, not just the example.",
      },
    ],
    steps: [
      "Before: every state explained itself twice.",
      "One default, one action.",
      "The first prototype, with the tour removed.",
      "The states, written out.",
      "The release, in place.",
    ],
    contact:
      "Contact sheet, first pass. The frames we kept are the quiet ones.",
    notes: [
      "Six interviews, all with people who had used the service for at least a year.",
      "The animation was 180ms. It survived two rounds before someone asked what it was for.",
      "Baseline: four weeks before the release. Follow-up: four weeks after.",
    ],
    wide1: "The system, in twelve pieces.",
    wide2: "The workspace, after the first release.",
    visualLead:
      "The work was mostly a question of sequence: what a visitor sees before they have decided whether to stay. We treated the first screen as a room, not a poster.",
    visualLead2:
      "We kept that first screen short on purpose: a title, one line of context, and nothing that asked to be watched. The rest of the page could be generous once the visitor had decided to stay.",
    visualAfter:
      "The final round was about scale: the same few decisions, repeated at every size, until the system stopped needing an introduction.",
    visualClose: `The release went out in ${project.year} with a short migration note and a longer list of things we chose not to build. The page got quieter as the work went on, which is the only outcome we could measure honestly.`,
    bento: "A first pass at the system, in six parts.",
    sequence: "The sequence, at full width.",
  };
}
