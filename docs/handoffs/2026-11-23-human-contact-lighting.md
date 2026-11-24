# Handoff — Human Contact clone, lighting pick (2026-11-23)

**Goal:** credited three.js rebuild of humancontact.com's landing grid as /work case study. Background: docs/handoffs/2026-11-22-human-contact-clone.md (+ phase2-plan.md in same folder).

## Decisions (Dat)
- Hover variant A (plain 1.25× interruptible spring scale). B/C removed.
- Standalone route `/live/human-contact` (outside /work layout; NavDock + MobileGate hide on /live). Study last in WORK_ORDER.
- Field is static (no mouse tilt/drift). Each prop bobs in Z on a staggered wave + coupled small turn; shadows grow/fade with height. Config: src/components/human-contact/motion.ts (amplitude 1.25–2, period 5.4–6.8s, turn 0.03–0.06 rad). Dat said "looking good".
- Copy fixed: original homepage = looping video, no pointer reaction; tilt constants came from Work-screen scene (now removed anyway).

## Current state
- Branch drxaviert/human-contact-clone, 7 local commits, HEAD e2372b7, NOT pushed. Uncommitted: docs/handoffs/2026-11-22-human-contact-clone.md edits + this file.
- Dev server running on :3001 (pnpm dev:log). Checks at e2372b7: typecheck/lint pass, test 649/649, build pass.
- Lighting A/B on dev route only: http://192.168.2.33:3001/dev/human-contact?light=1|2|3 (1 key+rim, 2 spotlight pool, 3 film = key+rim + grain/vignette/contrast). /live and /work still use the old "current" rig.
- Worker: Orca OpenCode DeepSeek, latest dispatch ctx_a032d6ae3850 (run run_2c0366c4979f). Send follow-ups with `orca orchestration send --to dispatch:ctx_a032d6ae3850`.

## Gotcha
- Worker canvas stats show presets are subtle (spotlight centre 18.5 vs edge 16.8 mean luminance). If Dat finds them too similar, ask for stronger key/rim contrast before picking.

## Next steps
1. DONE: neutral Film shipped cd6b80a (R/G/B equal, 648 tests, build pass). Overlay credit removed c1f5621 (credit kept in study + /live meta). Awaiting Dat final approval.
2. Lead reviews, then (auto-merge rule) push, PR with clear body + 🤖 line, merge to main, release worker, remove worktree.
