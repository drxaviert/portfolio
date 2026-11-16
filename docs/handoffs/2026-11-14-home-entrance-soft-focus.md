# Handoff — Home entrance: Soft focus (Split) → `/` (2026-11-14)

**Goal:** a page-load entrance for `/` that feels calm and ethereal, like a premium wellness app. I'm the lead for this job, and the orchestrator session is `orca_session_id:claude_f568d03b_f4f9_4cfe_8c2f_fa710a0a0e00`. Send it `worker_done` once the job is settled. That message goes from lead session `orca_session_id:699f4049-8f50-4f0a-a8a1-fae41cda1ddb` with task `task_3220796452da` and dispatch `ctx_af98d680f6ae`.

## Decisions (Dat)
- He tuned 12 variants on `/dev/proto/entrance` and picked **Soft focus** with the **Split** blur method, in horizon-up order.
- Final values:
  - curve: Calm `cubic-bezier(0.4,0,0.2,1)`
  - veil: blur 8px, veil 0.24, dissolve 1400ms
  - cards: delay 250ms, duration 1100ms, rise 7px, stagger 60ms
  - settles by 1710ms
- Calm motion deliberately goes past the usual 700ms budget. The Calm curve is new, and motion.md has to record both.
- The default overlay blur looked blotchy. The cause was the full-screen backdrop blur smearing card edges and gutters, which the veil then flattened into 8-bit bands. Split fixes it: each card blurs itself, and the glow blurs through the `uSoftUv` shader uniform, with dither applied after the blur.
- WebGL stays. WebGPU brings no benefit for a single full-screen shader.

## Commits (branch drxaviert/home-entrance, not pushed)
- `76f8961`: variants 1–4.
- `af451f6`: slider panel.
- `e78a580`: Horizon clear.
- `908df91` / `593dbb2` / `42f5597`: Base44-inspired step cut, grain sky and horizon grow.
- `05f5893` / `d0f8811` / `39dda6b` / `5ee20eb`: the calm family.
- `c485340`: rise and stagger added to Soft focus.
- `d0bb276`: Soft focus blur-method toggle and shader uniform.

## In flight
- DeepSeek worker, dispatch `ctx_9569621fc739`, task `task_5c4aff658f4d`. It is shipping Soft focus Split to `/` and adding a motion.md section. The brief is in the scratchpad file `brief-ship-soft.md`.
- The brief also covers:
  - once per tab load
  - no flash on first paint
  - reduced motion as a 120ms fade
  - CLS and LCP numbers
  - **fixing the per-frame `getComputedStyle(--soft-softness)` call** in `src/components/horizon/horizon-shader.tsx:700`, which currently runs on every route

## Review gate when it reports
1. Check the diff of the shared files: `horizon-shader.tsx`, `home-layout.tsx`, `entrance-cell.tsx`.
2. Confirm the shader output is byte-identical after the entrance settles.
3. Confirm the per-frame style read has no cost on `/` once the entrance ends.
4. Confirm build, lint and test pass.
5. Check the motion.md table matches the values above.

Then give Dat both URLs, `http://localhost:3004/` and `http://192.168.2.33:3004/`, and ask him for a Safari check.

## Next
- After Dat approves: the memory rule "auto-merge after approval" means open the PR, merge and push to main. Clean up after the merge: release the workers and remove the worktree, which may need Dat to run the removal.
- Then send `worker_done` to the orchestrator with the decision, the commit hashes and the motion values.
