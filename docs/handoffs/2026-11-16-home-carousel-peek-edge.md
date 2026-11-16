# Handoff: home carousel peek edge (2026-11-16)

Goal: finish the homepage middle-row stepped carousel on branch drxaviert/home-carousel (no push/merge until Dat approves). Earlier context: 2026-11-15-home-carousel-lead.md.

## Decided with Dat (this session)
- ONE version only: sliver = crop, blur = edge. The ?sliver/?blur switches and the "responsive" preset are removed (44da535). The ?tune=1 tuner is KEPT for iterating.
- Left hover peek target (Dat's wireframe): the previous card slides in, the row shifts right, the 4th card leaves, and the 3rd becomes the right-most.
  The peek card's LEFT edge and the right-most card's RIGHT edge get a progressive blur plus a fade to transparent (card, border, ring, shadow), held for the whole hover. Middle cards untouched.
- Step: all slots already share one start time (proven, test locked, d08a2e7). The perceived lag was the slow-start curve. Dat liked a faster-start curve in the tuner but has NOT pasted Copy values yet.

## Commits this session (on top of 9259df3)
44da535 one variant | c2b5414 / bc299d7 glide on hard Back (no snap) | 7d91b25 step END on unmount | 2489daa ResizeObserver on the hover box |
b8e3874 / 9a8104e progressive blur (smears outward, max 8px) | ad3f645 placeholder blur + hold | e1bee38 edge fade to transparent (Peek fade width 40%) | cf6de45 ring layers fade too. 313 tests pass.

## Done after the handoff
- 5a9b7f8: each layer now carries the same ramp relative to the card (fill, ring frame and surface, blur). No seam, no notches, ring alpha rises monotonically in Day and Night. 313 tests pass.
  Trade-off: the edge cards drop their box-shadow while peeking, because a shadow can't follow the fade. Dat still needs to confirm this looks right.
- Worker dispatch for follow-ups: ctx_5bab449ea599 (send to reopen).
- Dev server: PID 29644, `PORT=3005 pnpm dev:log`. Share both http://localhost:3005 and http://192.168.2.33:3005.

## Next
1. Review the worker's fix, then send Dat the links (hard refresh).
2. Get the tuner Copy values from Dat (step curve, peek blur width/max, fade width) and make them the defaults.
3. Remove the tuner, log the final values in docs/design-system/motion.md, and quarantine .orca-brief-single.md (my brief scratch, untracked) and the stale 2026-11-15-home-carousel-edge-fix.md (ask before deleting).
4. Open question for Dat: none pending except the Copy values.
5. worker_done to the coordinator per the lead handoff.

## Gotchas
- Never run `pnpm format`. The Bash guard blocked a heredoc into the scratchpad: write briefs with Write into the worktree (.orca-brief-single.md) and send via `--body "$(cat ...)"`.
- Chromium drops an element that has both a filter and a mask: put the mask on the wrapper and the filter on the inner copy.
- Ring layers (.ring-frame/.ring-glow/.ring-surface) sit 3.5px/6px outside the card at negative z-index and escape the row mask.
- The worker used to verify by DOM only. Always demand pixel crops in Day AND Night.
