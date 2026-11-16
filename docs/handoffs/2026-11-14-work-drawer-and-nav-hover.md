# Handoff: orchestrator view (updated 2026-11-14, late)

## Goal
This chat dispatches, merges, cleans up and reports status (memory `one-lead-chat-per-job`). Each job has its own kept-open Opus lead chat. Run `run_90f0a459a8ff`.

## Jobs
| Job | Dispatch | Worktree / port | State |
|---|---|---|---|
| Drawer BUILD | ctx_10599d77ad9d (+ T9 worker ctx_38905721fc84) | work-drawer :3002 | Tasks 1–8 are done and reviewed clean. T9 (Dat's feedback): A (pinned ← Work) and B (`?entrance=a\|b\|c`) are committed; C (persistent nav morph) is not visible yet. The lead sends worker_done after Dat approves. Not pushed. |
| Home entrance | released | home-entrance | **Merged as PR #25 (`0de36cc`).** Soft focus with Split blur, values logged in motion.md. The dev server is stopped, the workers are released (except ctx_d1645fd7c506, which returned "retained") and the remote branch is deleted. The worktree still needs removing: Dat runs `git worktree remove C:/Users/Dat/orca/workspaces/portfolio/home-entrance`. Dat still has a Safari hard-reload check to do. |
| Home carousel | ctx_e298a4a6ef8e (task_4a2ff415bc35) | home-carousel :3005, based on drxaviert/work-drawer | Built: 3 commits, 240 tests passing, not pushed. **Waiting for Dat to test**: `?sliver=crop\|grey\|tint`, `&tune=1`. Dat checks stepping, drawer-from-front, shadow/ring clipping during a step, picks a sliver, and copies the values. Rebase onto main after the drawer merges. |
| Design system audit | no dispatch (worktree create) | design-system (from main) | Parked chat holding the audit. Next steps there: motion tokens → public generated system page → primitive palette tier + tokens.md drift. It waits for Dat. |

## Carousel decisions (Dat)
- **Target:** the home grid's MIDDLE row: the wide featured Project card plus 3 shrinking Work slivers. The Play cards are not part of it.
- **Motion:** Stripe-style stepped endless wrap with no idle motion. Stripe's squeezy-carousel has no auto-scroll: 1000ms easeOutExpo per step, modulo wrap.
- **Clicks:** a click on a non-front card brings it to the front, and a click on the front card opens its drawer. The arrow keys also step. There are no buttons.
- **Items:** 4 (3 real works + an inert placeholder). The logic is generic for n > 4.
- **Reduced motion:** a 120ms crossfade.

## Next
1. **Entrance:** Dat confirms it's approved → `gh pr create` from drxaviert/home-entrance → merge (auto-merge rule) → cleanup recipe below. Check for overlap with the drawer branch on home files.
2. **Carousel:** relay Dat's test feedback to ctx_e298a4a6ef8e.
3. **Drawer:** on worker_done, review, give Dat the port, then merge and clean up. After that the carousel rebases.
4. **Log to motion.md:** the drawer motion values (open 480ms cubic-bezier(0.32,0.72,0,1), close 300ms ease-in, content in 240ms (0.23,1,0.32,1)/out 140ms, reduced motion opacity 120ms) and the faux-UI loops (Window 8000ms, Phone 7800ms, Tiles 8200ms) after approval.
5. **Uncommitted on main:** docs/workflows/ and this handoff. Dat commits these.

## Cleanup recipe (memory `cleanup-after-merge`)
1. Stop the dev server: `npx kill-port <port>`.
2. Merge: `gh pr merge N --merge --delete-branch`.
3. Release the worker: `orca orchestration worker-release --dispatch <id>`.
4. Remove the folder with a lone `rm -rf C:/Users/Dat/orca/workspaces/portfolio/<name>`. This is allowed only when the folder has no `.git` entry.

## Gotchas
- `worker-read` is paginated (use `--cursor`) and can be stale. Read git instead.
- `worker-list --json` → `.result` is an object; find the array inside it.
- `dev:log` ignores `--port`. Use `PORT=N pnpm dev:log`.
- Leads end their turn while waiting for Dat, which shows up as an "escalation". That's normal; relay their questions.
