# Beads issue tracker

Beads (`bd` 1.3.4) is the repo's agent issue database. Open work lives in
beads issues; `docs/handoffs/*.md` is legacy input for the migration, not the
source of truth.

## Install (Windows)

```powershell
irm https://raw.githubusercontent.com/gastownhall/beads/main/install.ps1 | iex
# -> %LOCALAPPDATA%\Programs\bd\bd.exe (also creates beads.exe)
```

Server mode also needs the Dolt CLI version beads pins, 2.6.0:
download `dolt-windows-amd64.zip` from
`https://github.com/dolthub/dolt/releases/tag/v2.6.0` and put `bin\dolt.exe`
on PATH. Both bins live in `%LOCALAPPDATA%\Programs\{bd,dolt}` and are on the
user PATH. Already-running terminals and Orca need a restart to inherit it;
`bd --version` confirms. A newer Dolt prints an "old version" warning; keep
2.6.0 unless beads changes its pin.

## Where the data lives

- Workspace: `C:\Users\Dat\orca\portfolio\.beads` (main working tree).
- Database: `.beads\dolt\` (gitignored), served by a bd-managed
  `dolt sql-server` on loopback; its port is in `.beads\dolt-server.port`.
- All linked worktrees of this repo discover that workspace and database
  automatically. `bd where` is the authoritative check.

## Commands agents need

```bash
bd ready                      # unblocked issues, highest priority first
bd list                       # everything, as a parent/child tree
bd show pf-elc                # description, children, deps, history
bd create "Title" -t task -p 2 --parent pf-elc
bd update pf-elc.1 --claim    # atomically assign to me + in_progress
bd dep add pf-elc.3 pf-elc.2  # pf-elc.3 is blocked by pf-elc.2
bd close pf-elc.1 --reason "done: setup verified"
bd where                      # which workspace/database this shell resolves
```

Add `--json` to reads for machine parsing. `bd prime` prints the full agent
workflow after a context compaction.

## Sync rule between worktrees

Nothing to commit or pull: every worktree shares the workspace and Dolt
server above, so a write is visible in every worktree on this machine
immediately. For another machine or clone, sync Dolt history with
`bd dolt push` / `bd dolt pull` (`refs/dolt/data` on origin). JSONL is an
export for viewers, never the sync mechanism.
