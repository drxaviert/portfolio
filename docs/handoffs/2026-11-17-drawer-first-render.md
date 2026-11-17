# Drawer first-open render (~245ms at 4× CPU): handoff v2 (2026-11-17)

## Goal
Measure the first drawer open on a prod build at 4× CPU, break it down, and propose fixes labelled invisible or visible. Ship the invisible ones with before/after traces, `pnpm typecheck && pnpm lint && pnpm test && pnpm build`, then PR and merge. Ask Dat before anything visible or anything that touches motion. Don't retune the motion (kept after the 2026-11-13 A/B). Leave B3 / `viewport-fit=cover` alone. Don't use the motion-ab, home-no-motion or perf-invisible worktrees. Finish with worker_done on task_13b91b29b7c0, dispatch ctx_71b6daf60237.

## State
- Branch `perf/drawer-first-render` (site-optimize) at e72cf2f. No code changes yet.
- A prod `next start -p 3011` from this branch is still running. The previous lead started it; stop it when you're done.
- Tools are in `C:\Users\Dat\AppData\Local\Temp\claude\f335a9668ad87a5c\f8497714-22c8-4597-949d-c346209b5afd\scratchpad\`:
  - `open-trace.cjs <port> <prefix> <runs>`: fixed, it now clicks the first *visible* `a[data-work-card]`; the old version clicked a 0×0 carousel card. Prints `[down→mount, down→morph]` per run.
  - `analyze.cjs <winMs> <trace>`: self time by event, plus CPU time by URL and by function.
  - `tasks.cjs <trace> <winMs>`: a breakdown of each long task.
  - `callers.cjs <trace> <winMs> <fn>`: caller chains for a given function.
  - Baseline trace: `base-run0.json` (1 run, down→morph 451.6ms). A 5-run median is still needed.

## Breakdown (base-run0, pointerdown = 0)
- 0–38ms: pointer events and the router push. Small.
- 38→133 and 189→249ms: the main thread is idle. Probably waiting on lazy client chunks or RSC. `ResourceSendRequest` events weren't in the trace categories. Add the `devtools.timeline` network events or check via CDP `Network.enable`. If these are chunk fetches, preloading them is an invisible fix and likely the biggest win.
- @133.8, 55.7ms: module evaluation (turbopack `I`, 36ms) of the reader's client chunks (07hk7yopmmp4s, probably motion plus the reader parts).
- **@258.8, 162ms: the commit task.** Layout 65ms and UpdateLayoutTree 37ms. Almost all of it is forced by `findCard` → `getClientRects` (87ms of samples) in the morph `useLayoutEffect` (`use-morph.ts`, `findCard`/`cardSelector`). This is the first layout of the whole new article, so it isn't wasted, only pulled forward. Another forced relayout of 17ms comes from `moveNav` `getBoundingClientRect` after its style writes (nav-flight in chunk 44mujyjv1nlr3). JS DOM creation is about 55ms.
- **@421.2, 79.6ms: first morph frame.** 21ms is the horizon WebGL `D()` resize check reading `canvas.clientWidth/clientHeight` in rAF (chunk 1j5hlw), which forces layout. UpdateLayoutTree is 22.6ms. The rest is motion `animate()` setup, about 15ms.
- The quoted 245ms is roughly these two tasks (162 + 79).

## Candidate fixes (none tested yet)
1. Invisible: preload the reader's client chunks and modules, or warm them on card hover/idle, if the idle gaps are fetches. This also removes the 55ms evaluation from the click path.
2. Invisible: the horizon `D()` resize check. Cache the size from a ResizeObserver instead of reading `clientWidth` every frame. That removes the forced layout in every frame, not only on open.
3. Invisible, but touches nav-flight code: avoid the second forced layout in `moveNav`. The values must stay identical, so treat it as a motion-adjacent change and ask Dat if unsure.
4. Visible risk: `content-visibility: auto` on below-fold prose. ScrollRuler `measure()` (`scroll-ruler.tsx:288`) reads every block's rect and `scrollHeight`, so placeholder sizes would shift the ruler and the scrollbar. Label it visible.
5. Visible (earlier finding): a Suspense shell or an optimistic morph.
- Also check whether the `useOverlayBehaviour` passive effect (`expand-shell.tsx`: body overflow and `inert` on `main`) causes the 22ms style recalc in the first frame.

## Gotchas
- Host noise: use median-of-5.
- `sleep` chains are blocked. Use Monitor with until-loops, or background runs.

## v3 (2026-11-16): fixes 1 and 2 shipped (PR #43, merged c4e7ca5)
- The "idle gaps" were not fetches: no resources were requested after pointerdown. They were React's transition render running in time slices between horizon frames, with ~40ms of turbopack module evaluation inside it.
- `WarmReader` (`src/components/work/warm-reader.tsx`, in `HomeScreen`) imports the reader modules on idle. The horizon canvas size is now cached from a ResizeObserver.
- Pointerdown→morph median (4x CPU, 5 runs): 527 → 365ms. Module eval is ~0ms, and the commit starts at ~130ms instead of ~300ms.
- Open items, none started: findCard getClientRects (~110ms) is the article's first layout, so fixing it is visible (content-visibility). moveNav relayout (~15ms) is motion-adjacent and needs Dat. A ~70ms UpdateLayoutTree task lands just after the morph starts and probably drops a frame; its cause hasn't been investigated.
- Harness and summary scripts: C:\Users\Dat\AppData\Local\Temp\claude\f335a9668ad87a5c\b466b3ff-b529-4400-ad49-6415f5a2aa63\scratchpad\ (open-trace.cjs, summary.cjs). The :3011 server is stopped.

## v4 (2026-11-16): cause of the ~70ms post-morph style recalc found; no fix shipped yet
- Branch `perf/drawer-style-recalc` (site-optimize) at origin/main c4e7ca5. No code changes. The :3011 server is stopped.
- **Cause:** `useOverlayBehaviour` (`src/components/work/expand-shell.tsx` ~l.109) runs `document.querySelector("body > main").setAttribute("inert", "")` in a passive effect. Inertness is an inherited computed-style flag, so Blink recalcs the whole homepage subtree (633 elements). `useShowTop` (`use-show-top.ts:24`) then reads `scrollTop`/`clientHeight` synchronously in its effect, which forces that recalc inside the same task. That read only forces it; the cost is the `inert` write. The body overflow/padding writes cost ~1ms.
- **Evidence** (prod, 4x CPU, 5 runs, median): the post-morph UpdateLayoutTree is 63.4ms with 633 els, inside a 101ms task. With the `inert` line removed as an experiment, it drops to 15.0ms with 68 els and the task to 75ms. Microbenchmark on home: toggling `inert` on main = 28ms forced recalc; `visibility` = 33ms; overflow = 1ms. Invalidation tracking confirmed MAIN "invalidates self" from the setAttribute, with the forcer `r@1y8av_j--ptw8.js:15456` (useShowTop).
- Down→morph baseline this session: median 409ms. The experiment batch was noisy (480ms, commit times up too), so it doesn't say anything about down→morph.
- **Fix options (none built):**
  1. Defer `inert` on main until the morph settles (`phase === "open"`), or to an idle callback after the morph. Pixel-invisible, and it moves ~50ms out of the morph's first frames. Behaviour change: for the morph's duration (~0.5s) the homepage stays in the a11y tree. Tab is still trapped by the keydown handler, and the backdrop covers pointer input. Needs Dat's or the lead's OK because it changes a11y timing.
  2. Set `aria-hidden` plus the existing focus trap instead of `inert` during the morph. Same caveat; it probably costs less than an inherited-flag recalc, but that's untested.
  3. Making `useShowTop` read in rAF only stops the *forcing*. The recalc still lands in the next frame at the same cost. No gain.
- Tools: this session's scratchpad `C:\Users\Dat\AppData\Local\Temp\claude\f335a9668ad87a5c\156e8499-b28a-4e40-bcaf-a0d3336f5f36\scratchpad\`: `open-trace.cjs` (set `INV=1` for invalidation tracking), `post.cjs` (post-morph recalc per trace), `inv.cjs` (invalidations per big recalc), `probe.cjs` (mutation microbenchmark).
