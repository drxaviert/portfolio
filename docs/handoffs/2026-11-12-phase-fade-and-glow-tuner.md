# Handoff: phase fade, glow tuner, boundary clock (2026-11-11 session)

Follows `2026-11-11-v7-play-card-and-prototype.md`. Orca run `run_90f0a459a8ff`. Branch `feat/phase-horizon-glow`, all work **uncommitted**.

## Decisions (user)
- Play-card art **paused** again. Skip v7 review, Dawn/Dusk/Night v7, and the art drop-in.
- Glow switch: **400ms ease-in-out** (now the defaults).
- **Every colour fades** on a phase switch, site-wide, with the glow's timing. Reduced motion: 150ms fade.
- Auto (clock) switches have their own tokens (`--phase-auto-transition-duration/-ease`), and the tuner can preview them.
- The clock check should be **one timer to the next phase boundary**, Auto/clock modes only (replacing the 60s poll).
- Use Emil skills whenever they apply (memory `use-emil-skills`).

## State
- Per-phase glow tokens `--horizon-*` live in `src/app/globals.css`, with values from `docs/handoffs/2026-11-10-prototype-audit.md`. The glow renders only on `/dev/prototype`.
- Glow tuner: `src/app/dev/prototype/glow-tuner.tsx` and `glow-tuner-css.ts`. Press G to toggle it. It saves to localStorage `prototype.horizon-glow.v1`, and Copy CSS outputs the phase block plus a `:root` block.
- The phase fade uses the transient `data-phase-switching=click|auto` on `<html>` (`src/lib/theme.ts`, `markPhaseSwitch`), and it is marked BEFORE the phase write (snap-bug fix). Colour transitions only on text elements (`globals.css:92-135`). Tracker cells are excluded via `.tracker-cell`.
- Jank fix, measured on a 160Hz pane at 1500ms: click went from 24ms to 6.1ms median per frame, auto from 24ms to 6.1ms. 54/54 tests pass.
- **IN PROGRESS:** the boundary-timer task, queued on worker dispatch `ctx_6d6672c4f9db` (follow-up of the same terminal). It touches `theme-provider.tsx` and `theme.ts`, with tests for DST and the boundary.

## Gotchas
- Text placed directly inside a `div` (not h*/p/span/li/…) won't fade its colour. It's a known trade-off of the text-only rule.
- Gradient backgrounds (nav orb, play-card) and the three.js canvas still switch instantly.
- The worker resets tuner localStorage after browser tests, so ask the user to Copy CSS before tests run.
- Reduced motion was verified only through the token path; the OS-level setting is untested.

## Next
1. Review the boundary-timer report (check the fake-timer tests and that only Auto/clock modes schedule).
2. Run `emil-animations` on the phase fade, then `emil-ui-review` on the branch.
3. Paste the user's tuned Copy CSS into `globals.css` as the defaults.
4. Ask whether to use the glow on the home page, and whether to commit (in tidy commits).
