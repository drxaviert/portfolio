# Audits in flight — handoff (2026-11-17)

## Goal
Run a typography audit plus five site audits, merge the findings into one list, then ship the invisible fixes as one PR. The owner (Dat) approves the visible fixes.

## Done today (on main)
- Typography audit report `docs/handoffs/2026-11-17-typography-audit.md` (49fe42d).
- PR #51 reader type pass (T1–T4, T6) and PR #52 site metadata, OG, robots and sitemap are merged (b5cc189).
- HANDOFF.md rewritten to the current state (e590d04).

## Waiting on Dat
- **PR #53** `fix/typography-lows` (T5 + T7–T12). CI and Vercel are green, and the orchestrator reviewed it. The test change follows the tooltip hoist for T11. T5 lifts tracker levels 1–2 to about 1.3–1.4:1 against the card; the dim character is kept. Preview: http://192.168.2.33:3108/ (dev server in the `typography-lows` worktree). Merge when Dat approves.
- Worktree removal, which Dat runs because a guard hook blocks it: `typography-lows` after #53 merges, `polish-metadata`, `aquarium`, `html-in-canvas`, `reader-typography` (its files were half-deleted; safe to remove), and the five `audit-*` worktrees once their reports are in.
- `drxaviert/design-system` has 35 local, unpushed commits after PR #26. Dat said to leave it for now; do not drop it.

## Audits (Orca opencode workers, run run_90f0a459a8ff, each in a child worktree `audit-<name>`)
Each writes `docs/audits/2026-11-17-<name>.md` in the main checkout, uncommitted. They are audit-only; every finding is tagged VISIBLE or INVISIBLE.
- touch-a11y — DONE: 2 High, 3 Medium, 5 Low.
  - High: the drawer focus trap is mis-ordered (`expand-shell.tsx:161-188`).
  - High: below 768px only 1 of 3 studies is linked on home.
  - Medium: the nav dock is below the fold on phones.
- color — DONE: 1 High, 2 Medium, 6 Low.
  - High: the focus ring uses the pastel phase accent, measuring 1.49–2.11:1 in Dawn/Dusk against a required 3:1.
  - Medium: the 404 page is white in Night because Next's unlayered body rule beats the layered base.
  - Medium: the selected toggle capsule (1.26–1.54:1) and the current nav item (1.10:1) are near-invisible.
  - Fixing C3 would move a Figma-defined pair, which is Dat's call.
- performance — DONE: 1 High, 1 Medium, 5 Low.
  - F1 High: the entrance animations hold the LCP element at opacity 0. Mobile LCP is 3.7s/4.4s, with about 470ms added to first legible paint. This touches the motion Dat kept, so it is VISIBLE and needs approval.
  - F2 Medium: WebGL plus 22 CSS loops keep running behind the reader, which covers the viewport.
  - Lows: Motion lazy-loads 57k gz on home; the nav dock lands 7px low on hard load; 8 render-blocking CSS files; permanent will-change; a canvas getImageData probe.
  - Checked fine: no three.js or Motion in first-load JS; WebGL DPR cap, pause-on-hidden and cleanup all OK.
- prep-for-prod — DONE: 1 High, 4 Medium, 5 Low.
  - P1 High: `/?tune=1` mounts the carousel dev tuner in production, and the shipped carousel values live in its DEFAULT_SETTINGS.
  - P3 Medium: there is no custom 404; Next's stock page renders white in Night (duplicates the color audit).
  - P4 Medium: the nav fill comes from `ring-hover.css`, which only home imports, so the nav is broken on other routes.
  - Medium: the Play/About/Design-system nav buttons are inert. These are probably the deliberate placeholders from PR #40; confirm with Dat.
  - P6 Medium: the metadata origin falls back to localhost:3000 until Dat sets NEXT_PUBLIC_SITE_URL in Vercel.
- break-ui — DONE: 2 High, 5 Medium, 4 Low.
  - High: reader tables clip on mobile with no scroll.
  - High: long unbreakable tokens overflow the reader.
  - Medium: a BOM or a missing frontmatter field returns 500 on every route.
  - Medium: the Auto tooltip adds 13px of horizontal overflow at 768px.
  - Medium: RTL titles are not handled.
  - Deferred as design calls: carousel empty slots, nav labels wrapping.

## Dat's decisions (2026-11-17)
- PR #53 merged (8e7c573).
- Do now: the invisible fixes, the 404 page with the Night body background, and the entrance LCP fix.
- Deferred: focus-ring contrast, selected states, mobile carousel/nav-dock layout, nav placeholder buttons, design-system branch, case-study content.

## Running now
- `fix/audit-invisible` (ctx_bfb8535a8523, port 3120):
  - tuner out of prod, drawer focus order, nav CSS on all routes, pause WebGL behind the reader;
  - perf lows, `.gitattributes` LF;
  - break-ui B1, B2, BOM/frontmatter, tooltip overflow, RTL.
- `fix/404-and-entrance` (ctx_dc1c201ac115, port 3121):
  - body background wins on every route, custom not-found/error page;
  - hero LCP paints immediately, with Lighthouse before/after.
- Commit of audit reports + this handoff to main (ctx_e65e5b27de9e).
- Dat still has to:
  - set NEXT_PUBLIC_SITE_URL in Vercel;
  - remove the finished worktrees (typography-lows, reader-typography, polish-metadata, aquarium, html-in-canvas, audit-prep-for-prod, audit-touch-a11y, audit-performance, audit-color, audit-break-ui). (ctx_6332305ffdaf): **still running**. If this session is gone, check them with `orca orchestration worker-list` or `inbox --terminal run:run_90f0a459a8ff`.
- Shared brief (skips the owner's deliberate decisions): scratchpad `audit-common.md`. Its rules are restated inside each worker spec.

## Next
1. When all five reports are in, write one combined, de-duplicated list at `docs/audits/2026-11-17-summary.md`, ranked by severity.
2. Open one PR for the INVISIBLE fixes via a worker in a new child worktree.
3. Present the VISIBLE fixes to Dat for approval. The mobile carousel and nav-dock items are design calls.
4. Commit the audit reports to main.

## Gotchas
- The bash guard blocks commands containing worktree `rm` text, even inside heredocs. Write worker specs to scratchpad files with the Write tool.
- `format:check` fails on 16 files with CRLF line endings on the local Windows tree. CI on Linux passes.
- Use `pnpm dev:log`, never plain `pnpm dev`.
