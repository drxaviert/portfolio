# Portfolio — session handoff (2026-11-09)

Paste this into a fresh session instead of resuming the old 320k-token one.

## Repo state (verified 2026-11-09)

| Item | Value |
|---|---|
| Local repo | `C:\Users\Dat\orca\portfolio` |
| Branch | `main`, clean working tree |
| HEAD | `38d9e8a chore: pin Node 24` |
| Remote | `git@github.com:drxaviert/portfolio.git` (pushed) |
| CI | First GitHub Actions run passed (install, lint, typecheck, test, build) |
| Extra branch | `drxaviert/mobbin-nav-type-inspiration` |
| Worktree | `C:\Users\Dat\orca\workspaces\portfolio\eagleray` on that branch, at `38d9e8a`, `pnpm install` done |

Old experiment branches (`hero-ui`, `scaffold-app`, `scaffold-go`) were deleted; there is no other worktree.

## Stack on `main`

- Next.js 16 App Router, TypeScript, Tailwind v4, Motion, MDX, pnpm, Node 24 pinned (`.nvmrc`, `engines`).
- Neutral placeholder design tokens, class-based light/dark theme with a no-flash inline script, system-following default, persisted choice, accessible toggle.
- 12 Vitest tests; ESLint, Prettier and `format:check` wired; README present.
- Docs: `docs/superpowers/specs/2026-11-08-portfolio-repo-setup-design.md` and `docs/superpowers/plans/2026-11-08-portfolio-repo-setup.md`.
- No real page content yet — home route is a bare shell.

## Working rules (agreed, still in force)

- **Opus is the orchestrator only.** It plans, specs, reviews and merges. It does not implement code.
- **Implementation → Orca workers.** Use the Orca skill and the full Run/Task/Dispatch lifecycle with self-contained task specs.
- **Agent:** `opencode`, never `opencode2`.
- **Never pass `--model` or `--effort`** (not even `--model default`). Let Orca's Config default apply.
- **Verify before launch** that the worker resolves to `opencode-go/deepseek-v4.1-flash` at max effort. If not, stop and report.
- **UI/UX work → Claude Orca worker on Sonnet 5.5, medium effort** (Figma/Paper, wireframes, components, design systems, Mobbin research).
- Ask before anything that touches `main`, GitHub, or cannot be undone.
- Multi-worktree finished work: review each branch → run all checks → merge into `main` one at a time (foundations first) → re-check after each merge → clean up worktrees.

## Tools / MCPs

- **Paper** — primary design surface. Requires Paper Desktop running. File: `portfolio` (id `01M6WKV32PWB1CH8KKRGGD5YW2`).
- **Mobbin** — configured in OpenCode (`https://api.mobbin.com/mcp`, remote) and works read-only; requires a paid plan. Claude uses the claude.ai connector.
- **codebase-memory-mcp** — required for the workflow; indexes rebuild on demand.
- **chrome-devtools** — for checking the running app.
- **talk-to-figma** — **disabled for OpenCode** because it leaked orphaned processes. Claude still has it.
- **Figma Console MCP** — evaluated, **not installed**. Verdict: likely better than talk-to-figma (130+ tools, MIT, ~3.2k stars, v1.46.0 on Oct 29; can write variables/components/auto layout; needs a personal access token + the Desktop Bridge plugin). Install alongside, user-level, and test with a read-only probe before retiring talk-to-figma.

## Known issues / gotchas

- **Orca launch bug:** it appends `#max` to the model id, producing `opencode-go/deepseek-v4.1-flash#max`. Workaround already applied: pin the project model without the effort hint in `opencode.json`.
- **Orca runs `pnpm install` in every new worktree terminal.** Worktrees created before the scaffold existed failed with `ERR_PNPM_NO_PKG_MANIFEST`; fixed by fast-forwarding that branch to `main`. New worktrees from `main` are fine.
- **Paper must be open** before any design worker runs, or it blocks.
- **Mobbin** returns a paywall error if the plan lapses or the connector is not signed in.

## Context / cost setup (done 2026-11-09)

- `~/.claude/CLAUDE.md` — new global rules: new session per topic, `/context` at 60%, `/compact`, never paste screenshots into long sessions, bound tool output.
- `~/.claude/agents/research.md` — Sonnet, web research, read-only, ≤40-line brief.
- `~/.claude/agents/explore.md` — Sonnet, codebase mapping via codebase-memory, read-only.
- `~/.claude/settings.json` — main model `claude-opus-5-5`, `MAX_THINKING_TOKENS=12000`.
- Decision: **no DeepSeek for research** — Claude Code would need a translation proxy; keep Sonnet.

## Where the design stands

- Design was intentionally reset. Nothing from the earlier Paper/Figma exploration is authoritative.
- One test artboard remains in Paper (`homepage/hero/.../light`); it is disposable.
- The `eagleray` worktree is on `drxaviert/mobbin-nav-type-inspiration` with no work of its own yet — it is ready for the next design implementation.

## Next actions

1. Finish deciding the visual direction (deferred; design not final).
2. Once direction is set, build the home page in the `eagleray` worktree, following the existing tokens and theme.
3. Optional: install Figma Console MCP and run the read-only probe.
4. Optional: import `drxaviert/portfolio` on Vercel (user action) — CI is already green.
