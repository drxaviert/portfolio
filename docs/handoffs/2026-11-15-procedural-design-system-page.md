# Handoff: procedural design-system page (brainstorm → design doc)

Lead: Opus, design-system job. Worktree `portfolio/design-system`, branch `drxaviert/design-system` (PR #26 is merged; the branch is fast-forwarded to main).

## Done this session
- Audit steps 1 and 3 merged as PR #26: motion tokens (`--ease-*`, `--duration-*`), entrance choreography kept in `--entrance-*` component vars, 81 `--palette-*` primitives, `tokens.md`/`motion.md` fixed. Browser parity against main: 0 diffs.
- Gotcha learned: no relative-colour syntax (`rgb(from …)`) in output. It breaks Safari < 18; `--horizon-ring-glow` stays literal rgba.

## Goal (Dat's words)
"Design system" in the nav opens a Google/Vercel-style docs site (tokens + components, when/how to use, states). The visitor can change the system and see the change reflected live on the page. Why: Dat builds reusable, interactive procedural systems in Houdini and wants the portfolio to show that systems thinking. Target: design-engineer role.

## Decisions (Dat chose)
- Option B: a few source parameters drive everything (not per-token editing, not a node graph).
- Approach 2: a page-scoped TypeScript engine derives tokens from the parameters and writes CSS vars on the page wrapper. The live site stays static. A parity test enforces engine at defaults == `globals.css`.

## State
- Draft design doc: `docs/superpowers/specs/2026-11-14-procedural-design-system-page-design.md` (untracked, not committed). Dat has NOT seen or approved it yet.
- The doc's "Proposed" section holds Opus's calls: `/design-system` route, URL-encoded presets + Reset, sidebar + sticky Controls (bottom sheet on phone), 4 components (Card, Nav item + Glide, Theme toggle + phase row, Tracker widget), and an M3 duration-scale comparison.

## Next steps (brainstorming skill, resume at "Builder check")
1. Dispatch the builder check: a fresh subagent with `C:\Users\Dat\.claude\plugins\cache\superpowers-marketplace\superpowers\7.0.2\skills\brainstorming\builder-check-prompt.md` against the doc. Sort its questions into answered / minor (Opus's call) / Dat's.
2. Bring Dat's questions in one message, update the doc, hand it over with the list of Opus's calls, and get approval.
3. Commit the doc (clear body), then run superpowers:writing-plans. Implementation goes to DeepSeek workers; Opus reviews.

## Constraints
- Don't edit `home-layout.tsx` / `home-cards.tsx` until the work-drawer and home-carousel jobs merge (neither had pushed as of 2026-11-14). Wiring the nav link waits for the drawer job.
- Dev server: `PORT=<n> pnpm dev:log`. Share localhost and http://192.168.2.33:<n>.
