<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Task tracking (beads)

- Run `bd ready` before starting; work from the issue ID (`pf-...`).
- Claim with `bd update <id> --claim`, add findings with
  `bd update <id> --append-notes "..."`, close with
  `bd close <id> --reason "..."`.
- Do not create new `docs/handoffs/*.md` files; existing ones are historical.
  Full reference: `docs/beads.md`.
