# Handoff: review fixes + phase-switch race fix (2026-11-11 evening session)

Follows `2026-11-12-phase-fade-and-glow-tuner.md`. Orca run `run_90f0a459a8ff`, branch `feat/phase-horizon-glow`, all work **uncommitted**.

## Decisions (user)
- Easing stays **400ms ease-in-out** (tested alternatives; prefers original). Extra easings stay in the tuner list only.
- Glow tuner: user has not tuned anything; no Copy CSS to paste. The worker's browser run left tuner localStorage `prototype.horizon-glow.v1` at soft ease-out `cubic-bezier(0.22,1,0.36,1)` — reset it in the panel or clear the key if it looks off.
- Split work across parallel agents only when pieces are sizeable and file-disjoint (memory `parallel-workers-worktrees`).

## Done this session (all verified by worker, 64/64 tests, typecheck + lint clean)
- Boundary timer reviewed + accepted: `theme.ts:79-128` `msUntilNextPhaseBoundary`; `theme-provider.tsx:99-166` schedules Auto + Day only (Day is clock-driven, 2:00 boundary), none for Night/preview/hidden.
- Emil review (0 MUST) fixes applied: h1 restored to `md:text-title` (page.tsx:92, evidence `2026-11-10-prototype-audit.md:36-37`); transform/clip-path/opacity added to the switch transition lists; nav orb fades via registered `--orb-1/2/3`, `--orb-2-at` (globals.css:63-84); tuner clears `data-horizon-tuning` on blur/pointerleave/lostpointercapture; no-op tracker override removed; 600ms comment fixed; tuner EASES has 6 options.
- **Bug: "no transition when hovered on auto switch"** — root cause was not hover: `data-phase-switching` was removed by `setTimeout(duration+50)`, so a throttled/occluded page (first frame late) cancelled the transition → snap. Fix `theme.ts:250-297`: keep the attribute until running colour CSSTransitions finish (rAF + `document.getAnimations()`), timer fallback without WAAPI. Test at `theme.test.ts:335`.

- Hard cap done + accepted: `theme.ts:276-278` `setTimeout(remove, Math.max(duration*4, 2000))`, cleared by `stopPhaseSwitchWatch`/`remove`; test `theme.test.ts:369`. Checks 65/65.

## Gotchas
- `pnpm dev:log` fails if a piped `next dev` already holds the log; a dev server may still be on :3000 (PID 26768).
- Still snapping by design: play-card gradients and three.js canvas (art paused). Safari <16.4 snaps registered properties.
- Hover motion runs at the fade duration (400ms) during a switch, then returns to 0.8s.

## Next
1. Ask: glow on the home page?
2. Commit in tidy commits: boundary timer · phase fade + race fix · glow tuner · review fixes · handoffs.
