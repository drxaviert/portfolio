# Handoff: procedural design-system page (implementation in progress)

Lead: Opus, design-system job. Worktree `portfolio/design-system`, branch `drxaviert/design-system`. Not pushed.

## Goal
`/design-system` is a docs-style page. Five source params (hue, contrast, round, speed, tod) derive every token live through a page-scoped TS engine. Spec: `docs/superpowers/specs/2026-11-14-procedural-design-system-page-design.md` (approved; see its Decision log). Plan: `docs/superpowers/plans/2026-11-14-procedural-design-system-page.md` (15 tasks; Dat said "go").

## Execution
One DeepSeek Orca worker (opencode, `opencode-go/deepseek-v4.1-flash`), driven task by task with `orca orchestration send --to dispatch:<latest id>`. Run `run_c1ad463512e3`, terminal `structworker_59b76ffb-...`. Opus reviews each `worker_done` with one or two checks before sending the next task.

## Done (commits)
- Spec 6def82f · Plan e0c4e54, 20a5e64 (hue smoothstep 0.01–0.03; chain built from the globals.css var() graph)
- T1 colour maths 8d0a4c4 · T2 source/parity/nodes 166153a (independent CSS oracle, 209 tokens per phase)
- T3 derive 5 params + AA grid bf4852d (contrast range 0.9–2.85)
- T4 engine 26bccdb + fix fd402d5 (spring stiffness ×speed²; dispose restores the LIVE site phase)
- T5 URL state + useSystemParams ec9877d (getActivePhase added to theme.ts); full suite 251/251
- IN FLIGHT: dispatch `ctx_15fc1adc53d0`. A T5 fix (invalid ?tod falls back to the site phase), then T6: route shell, /dev/system redirect, section nav. Checks asked for: `pnpm build` lists the route as static, dev on PORT=3107 via dev:log, leaving the page clears the engine vars.

## Findings to raise with Dat
- The live site fails AA today: on-primary on primary (Dawn 2.11, Midday 3.73, Dusk 1.88) and primary text on surface-container-low. The engine records these in AA_KNOWN_FAILING and asserts no regression. Fixing the palette is a separate small job.

## Gotchas
- `derive(params, siteBlend)` is a redundant arg from the plan. The engine always passes `p.tod`.
- The worker calls `pnpm.cmd` (PowerShell script execution is disabled).
- Don't touch home-layout.tsx / home-cards.tsx / nav-items.tsx. No nav-link wiring until the drawer job merges.
- No `rgb(from …)` in output (Safari < 18).

## Next
1. Review T6's worker_done (build line, redirect, var cleanup), then send T7 (controls panel + phone bottom sheet), and so on through T15. T15 adds Playwright.
2. After T15, run a whole-branch review, show Dat on localhost + http://192.168.2.33:3107, and merge after approval.
