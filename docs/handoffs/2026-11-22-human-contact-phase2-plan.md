# Human Contact clone — Phase 2 (ship variant A "Scale")

## Context
Phase 1 built `/dev/human-contact` (three.js scene, 7 procedural props, hover A/B/C toggle; typecheck/lint/build pass, 60fps). Dat picked **A — plain 1.25× interruptible spring scale**. Phase 2 turns the dev prototype into a shipped, credited case study per the approved plan (docs/handoffs/2026-11-22-human-contact-clone.md).

## Execution
One DeepSeek OpenCode worker (`opencode-go/deepseek-v4.1-flash`) in this worktree, Sonnet fallback. Lead (Opus) reviews diff + evidence, then PR → merge (auto-merge-after-approval), cleanup.

## Steps
1. **Collapse to A** — `src/components/human-contact/`: remove B/C code paths, `variant.ts`, toggle UI and `?variant=` param. Keep `springs.ts` + its test.
2. **Fallbacks** (in `human-contact-scene.tsx` / `-experience.tsx`)
   - Reduced motion: reuse `src/components/home/use-reduced-motion.ts` instead of the direct `matchMedia` read (scene.tsx:161). No drift/tilt, instant scale.
   - Touch / coarse pointer: tap a prop → pop to 1.25× then spring back; detect with the `(hover: hover) and (pointer: fine)` pattern from `home/carousel/hover-peek.ts:122`.
   - Safari + no-WebGL + context-lost: static still render (pre-rendered PNG of the grid or a single `renderer.render` frame with no loop) following the `horizon-live.tsx:28` `webglFailed` pattern; Safari always static (matches horizon-ambient-webgl rule).
   - Off-screen/hidden pause already exists (scene.tsx:538-548) — keep; consider swapping to `faux-ui/use-scene-pause.ts` only if trivial.
3. **Embed component** — `HumanContactEmbed`: client wrapper using `next/dynamic(..., { ssr:false })` around the experience, with an embedded (contained, non-full-bleed, aspect-ratio box) mode and a "Open full screen" link. Register in `src/components/work/mdx-components.tsx`. three.js must only appear in chunks for the case study + standalone route (verify in build output).
4. **Case study** — `content/work/human-contact.mdx` (frontmatter title/subtitle/year/role/summary/cover; worker drafts copy, Dat reviews in the PR). Body: what the original was (3s pre-rendered video, not three.js), the procedural rebuild, the added hover (Dat's addition), the live `<HumanContactEmbed/>`, and a **credit block: "Original design: HUMANCONTACT INC. (humancontact.com)"**. Add slug to `WORK_ORDER` (src/lib/work.ts:15, appended last) and `WORK_BODIES` (src/lib/work-bodies.ts). Cover: existing scene type or a `media:` still.
5. **Standalone route** — full-screen page outside the `/work` layout (so no drawer/HomeScreen), with overlay + credit + back link, at **`/live/human-contact`** (`src/app/live/human-contact/page.tsx`; Dat chose the `/live` namespace). Study goes **last** in `WORK_ORDER`. Metadata via existing helpers; add to sitemap if public.
6. **Dev route** — keep `/dev/human-contact` (already production-gated) or point it at the standalone page.
7. **Tests** — update hardcoded counts/orders: `src/lib/work.test.ts:39,49`, `src/app/work/page.test.tsx:55`, `src/app/not-found.test.tsx:44-46`, `src/components/work/scroll-ruler.test.tsx:243`; mock the embed in `src/app/work/[slug]/page.test.tsx` like the existing MDX mock. Add a small test that the embed renders a fallback when WebGL is unavailable.
8. **Commits** — clear messages (what/why/root cause), Co-Authored-By line; lead opens PR.

## Worker brief must include
Debug from root cause; show evidence before claiming success; emil/animation criteria (interruptible springs, reduced motion, composite-only, pause off-screen); `pnpm dev:log` on a free port; ≤3 screenshots.

## Verification
- `pnpm typecheck`, `pnpm lint`, `pnpm test` (drawer-shell flake noted; run it alone), `pnpm build` — build output shows three.js chunk only on the two routes.
- Browser: `/work/human-contact` (drawer reader, embed renders, hover A works, credit visible), standalone route full-screen, `/work` index lists it, reduced-motion emulation, touch emulation tap-pop, WebGL disabled → static fallback.
- Lead spot-checks diff + one load, then gives Dat localhost + http://192.168.2.33:<port> links before merging.
