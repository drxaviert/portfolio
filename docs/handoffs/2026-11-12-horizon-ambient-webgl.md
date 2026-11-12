# Handoff: horizon ambient motion + WebGL (2026-11-12, updated end of day)

## Goal
Homepage horizon glow moves (drift + breathe) without banding. DONE and merged.

## Shipped (main)
- PR #4 merged (16b558e): WebGL renderer (float math + 1.5 LSB dither, dpr cap 1.5) with CSS + 3% grain fallback.
- Final motion (user-tuned with a boost-glow toggle): drift 30s, travel 15% x / 10% y; breathe 6s, scale 1.06, opacity 1 → 0.70.
  Values: `src/components/horizon/horizon-preset.ts`. Phase fades 4000ms auto / 400ms toggle / 150ms reduced motion.
- PR #5 merged (84507be): removed the tuning prototype `src/app/dev/proto/horizon/`.
- Leftover: optional `intensity` prop/uniform in `src/components/horizon/*` (default 1, unused by production since the proto is gone). Keep or remove in a cleanup.

## Verified
- Lint, tsc, vitest 69/69, CI build, CLS 0, ~6ms/frame (Chrome, 1440/1920). No h-scroll or visible glow edge at 375/1440 with max travel.
- Real Safari via TestingBot free plan (no card): Safari 27 / macOS GOLDENGATE, Apple GPU — hydrates in 151ms, no JS errors, ctx.filter absent → CSS fallback, Night works, reduced motion respected.
  Safari 16.3 shows CSS drift/breathe running but the JS never hydrates (below Next 16's Safari 16.4 baseline; accepted).
- Not measured: motion on Safari 27 (TestingBot's Mac has Reduce Motion on). Real-laptop GPU/thermal cost.

## Tools
- Safari check script: `.next/safari-check/run.mjs <url>` (git-ignored; creds in `.next/safari-check/.env`, which `.next` cleans can wipe). Pins newest Safari via TestingBot `/v1/browsers`.
- Vercel previews are SSO-protected: remote browsers need the deployment's **Share** link (`?_vercel_share=`). Revoke the one used today if not done.
- `pnpm.cmd`; dev server `pnpm.cmd dev:log` on :3000; background tasks die at their timeout — use the 2h max.

## Next (user to choose)
1. Homepage real content.
2. Pre-launch pass (`emil-prep-for-prod`): favicon.ico 404 known.
3. Optional cleanup: drop the unused `intensity` prop.
