# Handoff: orchestrator view, part 4 (2026-11-16)

## Goal
This chat dispatches, merges, cleans up and reports (memory `one-lead-chat-per-job`). Run `run_90f0a459a8ff`. It supersedes 2026-11-16-orchestrator-3.md.

## Done this session
- **Guard exception (v1) is live:** `C:/Users/Dat/.claude/hooks/destructive-guard.cjs` now allows a lone `git [-C portfolio] worktree remove [--force] <p>`, `rm -rf <p>` or `Remove-Item -Recurse -Force <p>`.
  - `<p>` must be a direct child of `workspaces/portfolio/`, and either unregistered or a worktree whose HEAD is merged into origin/main.
  - Unmerged portfolio worktrees are now blocked even in the plain form.
- **Guard v2 is live:** Git Bash `/x/` paths are normalised to `x:/`, which closes a hole where a recursive delete of `/c/Users/Dat` used to fall through.
  - The test runner passes 43/43 against the live file.
  - Backups are in `C:/Users/Dat/orca/quarantine/claude-hooks/` (`*.2026-11-15.bak.cjs` is the original; `*.2026-11-16.v1.bak.cjs` is v1).
  - Tests, diffs and reports are in the session scratchpad `guard/` (temporary).
- `drawer-followups` and `work-drawer` were removed. I checked them against git first; neither had uncommitted work.
- PR #34 (`42f8136`): the 6 drawer and orchestrator handoffs are committed. Carousel PR #33 (`343578d`) was merged by its lead.
- **Carousel cleanup:** the :3005 server is stopped, all 21 workers are released (the lead too), and the worktree is deregistered.
  - Its 3 untracked handoffs are copied to `docs/handoffs/` in the main checkout (uncommitted): `2026-11-15-home-carousel-lead.md`, `2026-11-16-home-carousel-peek-click.md` and `2026-11-16-home-carousel-peek-edge.md`.
- Memory `cleanup-after-merge` is updated with the new guard rule.

## Open
1. **Empty folders locked by an open terminal:** `C:/Users/Dat/orca/workspaces/portfolio/home-carousel` ("Device or resource busy"). Close the Orca terminal that sits in that folder, then run `rm -rf <that path>` as a lone command.
2. `workspaces/portfolio/eagleray`: an unregistered dir the guard worker used as a test target. Check what's in it, and ask Dat before removing it.
3. Commit the 3 carousel handoffs above, with a branch and PR as in #34. The next carousel task appears to be in `peek-click`.
4. **Parked:** real-iPhone blur check; public design-system page.

## Gotchas
- The guard exempts only **lone** commands. Even `cmd 2>&1 | tail` gets blocked, so run removals with no pipe.
- Commands from an opencode worker are not screened by the Claude guard. Run the deletes from Claude Code.
- "needs-input" escalations from a kept-open lead usually just mean it's waiting for Dat in its chat.
- `worker-release` refuses a `ready` lead. Run `worker-stop` first.
