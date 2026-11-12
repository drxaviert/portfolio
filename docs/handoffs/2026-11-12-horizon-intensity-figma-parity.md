# Handoff: glow intensity proto + Figma parity (2026-11-12, session 2)

## Shipped
- PR #6 merged (7019fab): homepage matches Figma at rest (38/38 within 0.5px). Ring hover grows OUTWARD
  6/3.5px into the gutters, keeps a constant 1px edge (100ms fade) and a constant radius of 12. Theme menu at 375 is
  132px, opens upward. Audit and evidence are in the old session's scratchpad. Durable rule in memory `figma-is-size-source`.
- PR #7 merged (3d47695): docs/design-system/tokens.md plus the card-hover decision doc were updated.

## In progress: feat/horizon-intensity (main checkout, proto on :3000 /dev/proto/horizon)
- f8af5f5: breathe-locked intensity pulse, in WebGL (uniform) and CSS (stacked copy, opacity on the same 6s keyframes).
  Preset fields in src/components/horizon/horizon-preset.ts: intensityAmp (0 in prod), nightIntensityScale 0.6,
  intensityPeak "core" (B, peak at opacity max) or "expand" (A, peak at scale max).
- User feedback: the pulse isn't noticeable. Make the proto's "boost glow" (base strength x4) the DEFAULT strength.
  Tune it by eye. Night gets its own softer boost. Show the REAL homepage design on top of the glow in the proto.
  Don't change card styles.
- Sent to the DeepSeek worker (dispatch ctx_6dd30af9af1b, task_398ed075a61c, run_90f0a459a8ff): rebase onto main, add
  baseIntensity/nightBaseIntensity in both renderers, Night boost slider, real home layout over the glow, floating panel.
  Prod defaults stay unchanged until the user picks.

- DONE 3384c78 (rebased on main): baseIntensity/nightBaseIntensity in both renderers (prod 1/1/amp 0), proto renders
  the real HomeLayout (new optional `horizon` prop) with a floating GLOW panel (Day x4, Night x2.5, amp 0.30).
  No clipping at x8, 6.1ms/frame, 79 tests + build pass.

- USER PICKED: base day x4.00 / night x2.50, amp 0.50, night scale 0.70, peak core. Worker told to bake these,
  remove the proto and the HomeLayout "horizon" prop, push, open a PR and wait for checks. NOT merge (ask the user).

- PR #8 open, green, not merged (commit 0790da3). Renderer parity verified: WebGL and CSS effective alpha are
  0.168-0.360 (2.14x) in both, within 1.04% across 122 samples.

## Next
0. DONE: PR #8 merged (f15ce59); the main checkout is on main. Next up: the pre-launch pass (emil-prep-for-prod).
1. The user tunes base boost (day/night), pulse amp, and peak A/B on :3000.
3. Set the chosen values in horizon-preset.ts, remove /dev/proto/horizon, open the PR, and merge it once the user says so.

## Gotchas
- Figma: talk-to-figma channel 9lmnuuq6 (it changes on every plugin reconnect). Bridge via the figma-connect skill.
- The figma-parity child worktree (C:\Users\Dat\orca\workspaces\portfolio\figma-parity) is merged and can be removed
  (ask the user first). Its dev server on :3001 may still be running.
- OpenCode default model is deepseek, so `--worktree new-child` works without --model.
