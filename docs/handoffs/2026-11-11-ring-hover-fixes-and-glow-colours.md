# Handoff: ring hover fixes, glow colours, dev-server hang (2026-11-11)

Follows `2026-11-11-hover-shipped-carousel-paused.md`. Orca run `run_90f0a459a8ff`. Branch `feat/time-of-day-phases`.

## Done (committed: c1089b9 code, 7d7f035 docs; NOT pushed)
- Work carousel finished, then PAUSED by user (`src/app/dev/proto/work-carousel/`). <768 overlapping stack restored, overlap control default 8px. Checks green.
- Ring hover critique: `docs/handoffs/2026-11-11-ring-hover-critique.md`. Findings 1-5 fixed (toggle focus outline via outline-hidden + focus-visible:outline-solid; focusin glow position; rAF pointer tracking; will-change scoped; snap on re-entry), plus --ring-shift-x 5px.
- Night ring glow = orb hues (tan #d6b49d -> #fd6850 at 55%), globals.css:236-243. User APPROVED night as-is.
- Dev server hang root-caused: Next 16.4.5 EPIPE loop when the stdout reader exits (next.js#96216). `pnpm dev:log` script added (package.json:12). Workers must use it. Memory saved.

## Ring glow per phase (approved + committed)
- Day: horizon blues at 0.75 (#65A9DD, 2.43:1). Dawn: pink to purple at 0.9 (2.05:1). Dusk: sunset #f0b075 to #e08030 at 0.9 (2.0-2.17:1); the horizon hues were too light. Night: orb tan to #fd6850 at 0.55.
- Dev phase picker on /dev/prototype (phase-picker.tsx, bottom-right; Dawn/Day/Dusk/Night/Clock; ?phase=<name>). Uses applyPhase in src/lib/theme.ts:116.

## Decisions
- Hover is Ring + nav bar with horizon glow; theme toggle segments get no ring (only the focus outline).
- Hydration warning on layout.tsx:23 is from a Chrome extension (popups-script.js), not our code. Optional fix: suppressHydrationWarning on the <script>.

## Gotchas
- 20 MB of PNGs committed in docs/handoffs (play-cards/ is 15 MB). Ask before pushing whether to drop them from the commit.
- The PC has GPU driver crashes (0x141), so a frozen machine isn't always the app.

## Next
1. Finish the day glow review and commit.
2. Push and open a PR against main (decide about the PNGs first).
3. Review the carousel at /dev/proto/work-carousel.
4. Approve deleting src/app/dev/proto/card-hover/ (only comments reference it).
5. Finding 6 (reduced-motion rest shape), saved for later. Optional 6px radius token.
