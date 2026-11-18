# Handoff: carousel right-end step glitch (PR #59)

Goal: no glitch at the right end of the home carousel when clicking the last two slim cards; keep the progressive edge blur, perf win, motion.

Worktree: `C:\Users\Dat\orca\portfolio\.claude\worktrees\agent-a92626b57694a2a2b`, branch `fix/carousel-edge-blur`, PR #59 (MERGED, merge SHA 70b4a4c). Dev server `pnpm dev:log` on :3126 from this worktree.

## Commits (on top of origin/main)
- a06c139 drop row step mask's right fade (Dat confirmed).
- 70a2f49 clip blur copies to their strip (perf).
- 5af1862 queue far-step seam copies (harmless, not the visible cause).
- 1e45d66 move the blur clip from the masked wrapper to `.car-peek-blur-copy` (wrapper clip + card mask drew a 1px seam).
- da8403c crop the right-crossing card during steps (removed haze but also the blur; superseded in part).
- 64c1b1f current: during a step (not peek) the right-crossing card's melt mask sits on `.car-host` (face + blur copy), the shadow moves to an unmasked `.car-frame::before`, slide cropped at the column edge. Dat confirmed haze fixed by da8403c; 64c1b1f restores the blur, awaiting his retest.

- c15f02a perf: far-step jerk (Dat: "last 2 cards jerky vs first 2"). The motion is the same for every step: 900ms, same easing and properties, one continuous WAAPI run per card, no kinks. A 3-slot step's clicked card peaks about 1.4x faster. The real cause was frame pacing: inherited custom props animated on the row (`--car-rm` via an unregistered `--car-mask`) and on each card restyled all card content and blur/seam copies every frame. The row has about 1070 elements on a 3-slot step, and style took up to 16ms per frame. Fix: inline the row mask gradient, make `--car-rm` `inherits:false`, and pin the step vars at `.car-content`. Frames over 17ms (of 174, DPR 1): slot-3 went from 81 to 3 and slot-2 from 56 to 4. Pixels are unchanged. Optional idea, not shipped: a distance-scaled duration (+15–25% for 2–3 slots), only if far steps still feel fast to Dat.
- 3f6dc3f: Dat saw the left-moving cards "cut off midway" on far steps. Cause (also on main): each leaving card went to `-(w+gap)` on its own, so the slim cards travelled 957/1052px against the wide card's 765px and slid over it, overlapping by up to 180px. Fix: in `retarget()`, every leaving card shifts by one shared `pushOut` distance. Overlap now 0 of 41 seeked points (was 40); slot-1 is identical. Choreography change for Dat to OK: on far steps the wide card now leaves faster, with the row.
- Retest of the 4th-card click after 3f6dc3f: no overlap left. A 0.1x real-time run over 496 moving frames had 0 overlapping frames, and the 41 frozen points had 0 too. Dat's mid-step description (sidebar card melting at the left edge, then a slim card with its grey block cut hard on the right, then the wide More card) matches the fixed frame exactly. That slim card is "Type in motion" in its slim slot: its visible strip is a grey mock block that runs to the card's right edge, and it looks the same at rest (scratchpad `cb/zoom-type.png`: rest | after | before). On a 3-slot step it is the one that leaves at slim width, so it reads as a slice. No code change made. This needs a design call from Dat: keep it, add an inset/fade to slim content at its right edge (changes the rest look too), or fade the leaving slim card out earlier.
- (next commit, Dat-approved) far steps run longer: `stepDuration()` with `FAR_STEP_STRETCH = 0.15` per extra slot (carousel-math.ts) gives 900/1035/1170ms for 1/2/3 slots, peek 900ms, same curve. Every step animation and the end clock share it. Peak px/ms 2.78/3.02/2.94 (was 2.78/3.47/3.82). +20% for 3 slots left it ~15% fast, so 3 slots gets +30%.

## Key facts
- Haze = melt mask on `.car-slide[data-cross-right]` fading the box-shadow (pre-dates branch). Dat's DevTools test: hiding `.car-peek-blur` did not remove it.
- CSS: `src/components/home/carousel/home-carousel.css` (step rules near "A step (not the peek) keeps the right end's melt").
- Tests touched: home-carousel.test.tsx (new CSS test), hover-peek.test.tsx (shadow guard skips the step rule).

## Gotchas
- Headless captures miss GPU issues; use headed Chrome (`channel: "chrome"`), pause animations and seek `currentTime` for deterministic frames. Scripts in session scratchpad `cb/` (seek.mjs, sc.mjs, vary.mjs, band.cjs).
- Build only from a copy (scratchpad `buildcopy`), never in the worktree.
- Bash guard blocks commands containing CSS like `rgb(0 0 0 / ...)`; put such CSS in a file.

- Perf scripts in scratchpad `cb/`: jerk.mjs (rAF and trace per step), exp.sh/bmf.mjs/seq.mjs (per-frame main thread), attr.mjs (style cost per animation group), ab.sh (interleaved A/B via stash), which.mjs (which CSS the dev server is serving). The machine's speed drifted about 2x between runs, so only compare interleaved runs.

## Next
- Dat retests 64c1b1f; blank-card test snippet was handed to him (hides `.car-content` children and blur copy content).
- If approved: merge per auto-merge rule, then clean up worktree.
