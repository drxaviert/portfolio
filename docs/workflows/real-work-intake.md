# Real work intake: turning a project into a case study

The portfolio exists to impress viewers and land a design engineer job. The author's work is motion
graphics: components, scripts and procedural systems built in After Effects, Cinema 4D and Houdini,
plus UI animation for SaaS videos. There is no interactive product work yet.

So every case study tells the same story — *I build systems that produce motion* — and each one
proves the system can live in a product by rebuilding its core idea as something interactive on the
web.

## 1. Intake

Everything for a project goes in `content/work/<slug>/`:

- Renders and video exports
- Screenshots of node graphs, expressions, rigs
- `notes.md` with rough notes (bullets are fine)

Keep large video files out of git: add them to `.gitignore` or host them externally and note the
link in `notes.md`. The orchestrator lists what is there and what is missing.

## 2. Interview

The orchestrator asks 5–8 short, specific questions grounded in that material:

- What was the brief or problem?
- What are the system's inputs and controls?
- What was parameterized, and what was hand-animated?
- Which tools or scripts were built to avoid manual work?
- What broke?
- Which options were rejected, and why?

The answers become the story.

## 3. Outline

Order the decision points. Each one needs one piece of evidence: a before/after, a rejected option, a
node graph, a parameter sweep. Choose the single key moment for the featured home card.

## 4. Build

Same loop as all site work: a DeepSeek worker in its own worktree and port builds a dev proto with
variant toggles:

- The MDX case study at `/work/<slug>` — narrow text column, wide media breakouts, captions,
  footnotes, and a decision table or step-through figure where useful.
- **One** interactive web translation of the core system. A Houdini or C4D procedural setup becomes
  a three.js/canvas scene with live parameter controls; a SaaS promo UI animation becomes a real
  clickable component.
- The featured-card scene for the key moment.

The author picks variants, then we merge. Motion specs are logged to `docs/design-system/motion.md`.

## 5. Next project

Case studies chain to each other in the order set in the content index.

## Presentation references

The site follows Emil Kowalski (emilkowal.ski) and Rauno Freiberg (rauno.me): restraint, small
polished interaction demos, little text. Each case study's interactive translation follows Bartosz
Ciechanowski (ciechanow.ski) — live parameter sliders that expose the system the way a procedural rig
exposes controls — with Josh Comeau (joshwcomeau.com) as the model for inline UI-animation demos.
Avoid scroll-jacking, long intro loaders, and game-style portfolios (e.g. Bruno Simon) that delay
reaching the work.

## Principles

- Lead with the interactive piece; the reasoning follows.
- Label original work honestly as video/render work, and the web piece as a rebuild.
- Focus on the system, not the shot: inputs, parameters, tools.
- Anti-goal: walls of process text, or generic discover/define/deliver templates.
- Until real work exists, gray placeholders and generic faux-UI scenes (`/dev/proto/faux-ui`) hold
  the slots.
