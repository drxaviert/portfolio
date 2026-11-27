# Portfolio repo rules

Next.js portfolio; design work runs in Orca worktrees.

## Task tracking (beads)

- `bd` is the source of truth for open work. Start with `bd ready`; use the
  issue ID (`pf-...`) in commits, PRs, and reports.
- Claim with `bd update <id> --claim`; record findings with
  `bd update <id> --append-notes "..."`; close with
  `bd close <id> --reason "..."`.
- Do not create new `docs/handoffs/*.md` files. If work has no issue, create
  one under the matching epic (`bd create "Title" -t task -p 2 --parent pf-...`).
  Existing handoffs are historical source material only.
- Before `/clear` or a fresh session, update the active issue (notes + status)
  and give Dat its ID. `bd show <id>` is the handoff.
- Full command reference: `docs/beads.md`. Verify the shared workspace with
  `bd where`.

## Design and MCP sessions

- Opus orchestrates. Delegate Figma, Mobbin, Paper, and browser/design work to a DeepSeek OpenCode worker when it can do it; otherwise Sonnet. Opus makes the final judgment.
- One design pass per session. Start a fresh session for implementation after exploration.
- Image budget: at most 10 new images or node exports per session. Prefer node data and text scans over screenshots. Summarize each image in one or two lines before the next tool call.
- At ~100k tokens, update the active issue (notes + status) and start a fresh session; task state lives in beads (see `docs/beads.md`).
- Never paste screenshots into a session longer than ~50k tokens.

## Worktree hygiene

- Keep the orchestrator chat separate from implementation chats.
- Check for `package.json` before running `pnpm`; a design branch may not include one.

## Specs

- After a feature ships, add/update `specs/<feature>.md` (route, what's on it, actions, states; ≤30 lines).

## Media and browser tests

- Never run browser, playback or performance sessions against production media. Set
  `MEDIA_ORIGIN=local`, populate `media/local/` with `pnpm post --local`, and load the app from the
  dev server. Blob is paused and R2 transfer costs money; tests must not touch either.
- R2 credentials live in `.env.r2` (gitignored). Never print or commit a value; the loader names a
  missing key without echoing it.
- See `docs/design-system/media.md` for the R2 migration and local-media route.
