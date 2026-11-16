# Handoff: home carousel peek click + hover zone (2026-11-16)

Goal: finish the homepage middle-row stepped carousel on branch drxaviert/home-carousel. No push/merge until Dat approves. Earlier: 2026-11-16-home-carousel-peek-edge.md, 2026-11-15-home-carousel-lead.md.

## Decided with Dat (this session)
- Edge cards KEEP their shadow while peeking: the masked box is grown 8px (f1c524e). Approved.
- No border pop at step settle: host drawn at visible width instead of clip-path (0cb9b79). Approved.
- Step curve for ALL steps = "quick" cubic-bezier(0.25, 0.8, 0.25, 1), 900ms; old "smooth" kept as tuner preset (16e9953). Right-most card barely moving on peek click is accepted.
- Peek click with pointer held: ONE run straight into the NEXT peek, no settle-then-replay (b326c63). "This is the motion I like." Pointer leaves mid-glide -> blend to rest; enters mid-glide -> blend to peek; Enter key ends at rest.
- Right-edge fade/blur ramps on the run, anchored to the drawn edge (acd8ea7).
- Stuck shifted row after leaving a landed peek fixed (37ec22c). 322 tests pass.

## Done after the first write
- Hover zone is a band (6c624cd, 323 tests): closed = row.left-24 .. row.left+32; open = row.left-24 .. row.left+96 (layout.shift, so the peek card stays clickable). Tuner sliders "Hover zone inside/outside". Links sent to Dat; awaiting feedback.
- Dat approved the band ("looks good").
- Spam-click on the peek card chains like arrow spam (eb5c619, 325 tests); chained runs use the retarget curve cubic-bezier(0.22,1,0.36,1). Open check for Dat: each click frame changes ~10k px in the left copy band (x120..280, copy re-reveals from the gutter) - ask if that reads as a flicker. Follow-up dispatch: ctx_7da806a5b906.
- Opus fix 0cd5a9b (329 tests): left-edge strength now follows how far the card's left edge has crossed the column (edgeLeftKeys, carousel-math.ts), not the eased clock; every left-leaving card gets the treatment (was only the first: home-carousel.tsx:1219). Awaiting Dat's look. Frames in scratchpad\glitch\{before,after}. Was: glitch STILL there after 939d242 -> escalated to an Opus subagent (Claude Agent tool, background) to reproduce visually with dense frame PNGs in scratchpad\glitch\, fix and commit. If this session is gone, re-brief a fresh Opus agent. 939d242 notes: left ramp now anchored to the column edge (--car-cut). Was: after fa6595c, clicking slots 1-3 still shows a hard vertical cut + bright 1-2px line where the leaving card crosses the column's left edge (fade sits at the card's off-screen left edge, row clip cuts it). Fix = soft fade/blur where it crosses the column edge.
- DONE fa6595c (326 tests): clicking a non-featured card -> leaving feature card's left exit looked weird. Dat chose "mirror the peek": slide out past the left edge with the peek's one-ramp left fade + progressive blur, anchored to the drawn edge, ramping on the run. Brief in .orca-brief-shadow.md; dispatch ctx_b22c282eadcd.

## Next
1. Dat's feedback on the band size (tweak via tuner values). Dev server PID 27776, `PORT=3005 pnpm dev:log`; links http://localhost:3005 and http://192.168.2.33:3005.
2. Ask Dat whether the cover artwork visibly restarts when cards land (settle DOM reorder restarts the covers' CSS animations, per worker). Fix if yes.
3. Get final tuner values (peek blur width/max, fade width, hover band) -> make defaults, remove tuner, log values in docs/design-system/motion.md.
4. Quarantine untracked scratch: .orca-brief-single.md, .orca-brief-shadow.md, stale 2026-11-15-home-carousel-edge-fix.md (ask first). Then PR/merge per auto-merge-after-approval once Dat approves, worker_done to coordinator.

## Gotchas
- Never run `pnpm format`. Write briefs to .orca-brief-shadow.md and send with `--body "$(cat ...)"`.
- No filter + mask on the same element in Chromium (mask on wrapper, filter on inner copy).
- Demand pixel crops in Day AND Night plus per-rAF tables; DOM-only checks missed bugs before.
- A moving card's box is the wider end of its step and cropped by --car-r: anything anchored to the box edge (masks, blur) is off by up to ~100px mid-run.
