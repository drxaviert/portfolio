# Handoff: ring hover promoted, carousel paused (2026-11-11)

Follows `2026-11-11-v7-play-card-and-prototype.md`. Orca run `run_90f0a459a8ff`. Figma talk-to-figma channel was `jyptcofg` (will change on reconnect).

## Done
- Prototype audit vs Figma: 39 props, all fixed/matched; table in `2026-11-10-prototype-audit.md`. Theme toggle now matches Figma (33.3x28, r6, 2px inset; 6px radius is a literal, no token yet).
- Card + nav hover DECIDED: Ring + nav bar, horizon glow. Record: `2026-11-10-card-hover-decision.md`. Promoted into src/app/dev/prototype (ring-hover.css/.tsx, ring-pointer.tsx, new `--horizon-ring-glow` tokens). typecheck/lint/test 45/45 green.
- Play-card art (v7) rejected and PAUSED by user; don't resume unless asked.

## Paused
- Work carousel prototype (`src/app/dev/proto/work-carousel/`), worker ctx_033cdc084868 STOPPED mid-build by user (bedtime). Files may be partial; state unverified. Spec: scratch brief = featured far-left wide card, click small card -> rotates into featured slot ("shift along"), featured card opens work, Ring hover (no arrow), no auto-advance, Stripe squeezy timings (1000ms easeOutExpo [0.16,1,0.3,1], weights .61/.30/.15, slivers), <768 tight overlapping vertical stack (user's phone reference; overlap control default 8px). Middle row in prototype = highlight card + three slivers.

## Next
1. Resume carousel: retry on the same task (`orca orchestration worker-start --task task_ff6cb8c5836b --retry-of ctx_033cdc084868 --worktree current --agent opencode`), check what's already in work-carousel/ first.
2. Ask user to approve deleting `src/app/dev/proto/card-hover/` (only after carousel no longer needs its ring code).
3. Optional: add a 6px radius token for the theme toggle.
4. Commit only when asked.
