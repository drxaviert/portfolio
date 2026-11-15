# Procedural Design-System Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a public `/design-system` docs route where five source parameters derive every token live, with chain visibility, and a test proving the engine at defaults equals `globals.css`.

**Architecture:** A page-scoped TypeScript engine (`src/lib/system/`) derives a flat token map from `Params` and writes it as CSS custom properties on `<html>` (rAF-coalesced), removing them on unmount. Source values are generated from `globals.css` into a committed TS file; a vitest parity test and a browser parity test keep them honest. The page shell, token rows and documented components read the engine; documented components are new shared modules (home files untouched).

**Tech Stack:** Next.js 16 App Router, React 19, Tailwind v4, vitest 5 + jsdom + Testing Library (existing), Playwright (added in Task 15), three.js horizon shader (existing).

**Spec:** `docs/superpowers/specs/2026-11-14-procedural-design-system-page-design.md`

## Global Constraints

- Do NOT edit `src/components/home/home-layout.tsx` or `src/components/home/home-cards.tsx`. Documented components live in NEW modules under `src/components/system/`. Switching home to them is a follow-up (see "Follow-ups"), not a task.
- Do NOT wire the nav "Design system" item (`nav-items.tsx`). The page is reachable by URL only. Do not edit `nav-items.tsx`.
- Engine output is only hex / `rgba(r, g, b, a)` / `px` / `ms` / `s`. No relative-colour syntax (`rgb(from …)`), no `color-mix`, no `oklch()` in output (Safari < 18). OKLCH is internal.
- Parity tolerance: sRGB 8-bit, ±1 per channel, ±0.01 alpha; px/ms/s must match exactly; four phases (dawn, day, dusk, night).
- Parameters and keys: `hue` (Δh deg, default 0), `round` (default 1), `tod` (continuous Dawn→Midday→Dusk→Night), `contrast` (default 1), `speed` (default 1). URL keys exactly `hue`, `round`, `tod`, `contrast`, `speed`. Out-of-range clamps; unparseable falls back to default. Nothing in localStorage. Read client-side from `window.location` in an effect (no `useSearchParams`) so the route stays static. `history.replaceState` debounced.
- Hue rotation is multiplied by a smoothstep weight on OKLCH chroma from 0.01 (weight 0) to 0.03 (weight 1), so near-neutrals rotate partially and nothing pops at a boundary (horizon/orb tokens included). `@property` initial values stay literal.
- Roundness multiplies finite radii only; `0` stays 0 and `9999px` stays 9999px. Motion speed multiplies every duration token incl. entrance timings; easings unchanged; Glide spring time-scaled (stiffness x 1/s², damping x 1/s); `prefers-reduced-motion` wins.
- Scheme (`data-phase="night"`, `color-scheme`, `.dark`) flips at the midpoint of the Dusk→Night segment only; colours are continuous.
- AA: text/icon pairs (`on-surface`, `on-surface-variant`, `primary` as text, each on its surface) >= 4.5:1 in every phase and at every tod; decorative tokens (outline, frame-line…) exempt. Contrast range is clamped to what passes.
- Drags: rAF-coalesced variable writes on `<html>`, no React re-render per frame for previews, no view transitions during drags. 60fps on a mid laptop.
- Accessibility: labelled range/segmented inputs, keyboard operable, reduced motion respected. Chain popover opens on hover/focus (pointer) and tap (touch). "Copied" inline for 1500ms.
- Live site must render identically (computed-style + pixel parity on `/`, as PR #26).
- Dev server: `PORT=<n> pnpm dev:log` (never a piped `next dev`); share localhost and `http://192.168.2.33:<n>`. Check `package.json` exists before running pnpm.
- Commit messages: Conventional subject, then a body saying what changed and why (root cause for fixes), then the Co-Authored-By trailer your harness specifies.
- Path alias `@/` = `src/`. Tests are `src/**/*.test.{ts,tsx}` (vitest, jsdom).
- Do not log motion to `docs/design-system/motion.md` until Dat approves; Figma remains source of resting sizes.

## Review Focus

Most likely first. Each has a test in the task named.

1. Garbage or hostile URL (`?hue=abc&round=NaN&tod=-5&speed=0&hue=1&hue=2`, empty values, repeated keys, huge numbers): clamp or default, never NaN in CSS, never a throw. (Task 5)
2. Leaving the page mid-drag (and React StrictMode double mount): every engine variable removed from `<html>`, pending rAF/debounce cancelled, `/` renders default tokens afterwards. (Tasks 4, 6)
3. Speed at the floor and reduced motion: no divide-by-zero or Infinity in spring scaling or durations; reduced motion still wins at any speed. (Tasks 3, 4)
4. Out-of-gamut colours after hue rotation / OKLCH blend / contrast scaling: clamp into sRGB without hue drift or NaN; a colour and its neutral partner (primary vs on-primary) stay legible together at every hue. (Tasks 1, 3)
5. Site theme toggled while on the page (including during its view transition) and Reset: slider follows the site phase, Reset returns to defaults at the CURRENT phase, no stale phase. (Task 5)

## File Structure

- `src/lib/system/color.ts` — sRGB/OKLCH maths, parse, serialise, contrast.
- `scripts/gen-system-source.mjs` + `src/lib/system/source.generated.ts` — tokens extracted from `globals.css` and `home-entrance.css`.
- `src/lib/system/params.ts` — `Params`, ranges, defaults, URL parse/serialise.
- `src/lib/system/nodes.ts` — node table (parameter → primitive → role → component) for chain visibility.
- `src/lib/system/derive.ts` — `derive(params, siteBlend)` pure token derivation.
- `src/lib/system/engine.ts` — runtime (rAF write, subscribe, cleanup, spring scaling).
- `src/lib/system/use-system-params.ts` — React hook: URL state + site-phase sync.
- `src/app/design-system/` — route (`page.tsx`, `system-shell.tsx`, `sections/*`), `src/app/dev/system/page.tsx` becomes a redirect.
- `src/components/system/` — `controls-panel.tsx`, `bottom-sheet.tsx`, `token-row.tsx`, `chain-popover.tsx`, `component-doc.tsx`, `samples/*` (extracted components).
- `e2e/` + `playwright.config.ts` — browser matrix (Task 15).

---

### Task 1: Colour maths

**Files:**
- Create: `src/lib/system/color.ts`
- Test: `src/lib/system/color.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type Rgba = { r: number; g: number; b: number; a: number }; // r,g,b 0..255 (float), a 0..1
  export type Oklch = { l: number; c: number; h: number; a: number }; // l 0..1, h degrees
  export function parseColor(css: string): Rgba; // #rgb/#rrggbb/#rrggbbaa, rgb()/rgba() comma or space + "/ a", oklch(L% C H [/ a]); throws on anything else
  export function toOklch(c: Rgba): Oklch;
  export function fromOklch(o: Oklch): Rgba; // gamut-clamps by reducing chroma at fixed l,h
  export function blendOklch(a: Oklch, b: Oklch, t: number): Oklch; // shortest-arc hue; hue of an achromatic side (c<1e-4) is taken from the other side
  export function rotateHue(o: Oklch, deg: number): Oklch; // rotates by deg * smoothstep(0.01, 0.03, o.c)
  export function toCss(c: Rgba): string; // opaque -> "#rrggbb" lowercase; a<1 -> "rgba(r, g, b, a)" a to 2dp
  export function contrastRatio(fg: Rgba, bg: Rgba): number; // WCAG 2.x, fg composited over bg if a<1
  ```

- [ ] **Step 1: Write the failing tests** in `color.test.ts`: `parseColor("rgb(0 0 0 / 0.08)")` equals `{r:0,g:0,b:0,a:0.08}`; `parseColor("oklch(89% 0.0138 247.97)")` converts to within ±1/channel of `#dde4ed`-class value computed from the CSS Color 4 reference (use `fromOklch(toOklch(x))` round-trip within ±1 for 20 sampled palette hexes from globals.css); `blendOklch(red,blue,0.5)` takes the short hue arc; `rotateHue` by 90: at `c:0.005` the hue is unchanged, at `c:0.04` it moves the full 90, at `c:0.02` it moves about 45 (±2); `fromOklch({l:0.7,c:0.4,h:140,a:1})` returns channels all within 0..255, no NaN, and hue within 2° of 140; `toCss` of `{255,255,255,0.08}` is `"rgba(255, 255, 255, 0.08)"`; `contrastRatio(#000,#fff)` is 21 and `contrastRatio(#777,#777)` is 1.
- [ ] **Step 2: Run** `pnpm vitest run src/lib/system/color.test.ts`. Expected: FAIL, module missing.
- [ ] **Step 3: Implement** `color.ts` per the Interfaces (Björn Ottosson OKLab matrices; linear-sRGB gamma per CSS Color 4; binary-search chroma for gamut clamp).
- [ ] **Step 4: Run** the same command. Expected: PASS.
- [ ] **Step 5: Commit** `feat(system): add OKLCH colour maths for the token engine` — body: why OKLCH is internal and sRGB is the only output (Safari < 18), and what the gamut clamp guarantees.

---

### Task 2: Generated token source + defaults parity (engine at defaults == globals.css)

**Files:**
- Create: `scripts/gen-system-source.mjs`, `src/lib/system/source.generated.ts`, `src/lib/system/derive.ts`, `src/lib/system/nodes.ts`
- Modify: `package.json` (add script `"gen:system": "node scripts/gen-system-source.mjs"`)
- Test: `src/lib/system/source.test.ts`, `src/lib/system/parity.test.ts`, `src/lib/system/css-oracle.ts` (test-only helper, imported only by tests)

**Interfaces:**
- Consumes: `parseColor`, `toCss`, `Rgba` (Task 1).
- Produces:
  ```ts
  // source.generated.ts (committed; header comment "generated by pnpm gen:system, do not edit")
  export const PALETTE: Record<string, string>;                      // "--palette-blue-600": "#60a8e2"
  export const ROLES: Record<Phase, Record<string, string>>;         // value is the CSS text: "var(--palette-neutral-200)", "82%", "oklch(…)", "linear-gradient(…)" etc.; includes the :root/[data-phase=day] block as `day`
  export const RADII: Record<string, string>;                        // "--radius-lg": "0.75rem"
  export const DURATIONS: Record<string, string>;                    // "--duration-short-1": "100ms"; also the home-entrance.css custom-property durations ("--rise-duration": "380ms", var() aliases kept as "var(--duration-medium-7)")
  export const EASES: Record<string, string>;
  export type Phase = "dawn" | "day" | "dusk" | "night";             // re-exported from "@/lib/theme", not redefined

  // derive.ts
  export type TokenMap = Record<string, string>;                     // custom property name -> resolved output value (hex / rgba() / px / ms / s / unitless / easing / gradient with literal rgba stops)
  export function derive(params: Params, siteBlend: TodPosition): TokenMap;
  export type TodPosition = number;                                  // 0..1; 0 dawn, 1/3 day, 2/3 dusk, 1 night
  export function phaseAtTod(tod: TodPosition): Phase;               // which data-phase to set: night only when tod > 5/6
  // nodes.ts
  export type NodeKind = "param" | "primitive" | "role" | "radius" | "duration" | "component";
  export type SystemNode = { id: string; kind: NodeKind; label: string; from: string[]; consumers?: string[] };
  export function chainFor(token: string): SystemNode[];            // param -> ... -> token, root first
  export function consumersOf(token: string): string[];              // component names
  ```
  (`Params` is defined in Task 3's `params.ts`; Task 2 creates `params.ts` with only the `Params` type and `DEFAULT_PARAMS` so this task compiles: `type Params = { hue:number; round:number; tod:number; contrast:number; speed:number }`, `DEFAULT_PARAMS = { hue:0, round:1, tod:1/3, contrast:1, speed:1 }`.)

- [ ] **Step 1: Write failing tests.**
  - `source.test.ts` "source.generated.ts is fresh": run the generator's exported `extract()` in memory and `expect(extract()).toEqual(<current exports>)`.
  - `parity.test.ts` "defaults equal globals.css" for each `[phase, tod]` in `[["dawn",0],["day",1/3],["dusk",2/3],["night",1]]`: `css-oracle.ts` resolves every engine token from the raw `globals.css` text (cascade: `:root` + `[data-phase=X]` override; resolve `var()` chains recursively; `@theme` radii; `home-entrance.css` custom properties) to a string; compare with `derive({...DEFAULT_PARAMS, tod}, tod)` per token: colours parsed with `parseColor` and compared per tolerance (±1 channel, ±0.01 alpha), non-colours (px/ms/s/%/easings) by exact string after normalising `0.75rem` -> `12px` and `0.25rem` -> `4px`. Also assert the set of token names equals the oracle's set (no extra, no missing).
  - `nodes.test.ts` "chain reflects globals.css": for each phase and each role node in the table, its parent equals the `--palette-*` that role references in `globals.css` for that phase (use `css-oracle.ts`; check the nearest phase for tod positions between stops).
- [ ] **Step 2: Run** `pnpm vitest run src/lib/system`. Expected: FAIL.
- [ ] **Step 3: Implement** `scripts/gen-system-source.mjs` (regex/line parser over `globals.css` and `src/components/home/home-entrance.css`; exports `extract()` and writes the generated file when run directly; run it once and commit the output).
- [ ] **Step 4: Implement `derive` at default params** : resolve each token to output form (hex/rgba, px, ms). Roles resolve `var()` against `PALETTE`; `oklch()` literal tokens (`--frame-line`, `--frame-spot-color`) are converted to hex; `--horizon-ring-glow` and `--orb-gradient` are re-emitted with literal `rgba()` stops. Blend between phases for `siteBlend` positions between stops (OKLCH, Task 1) and select the nearest segment; at exact stops return the stop untouched (byte-exact path, no OKLCH round-trip). Non-colour tokens that change between phases (`--horizon-mid-at`, `--orb-2-at`, `--frame-spot-opacity`) snap to linear interpolation of the number.
- [ ] **Step 5: Implement `nodes.ts`**: **build parent links by parsing the `var()` graph in `globals.css` (via the generated source), not by hand, so the chain popover reflects the real source; the engine writes resolved palette and role values, and the table stays the declarative chain. Only param and component nodes are hand-written. **node table for every param, every `--palette-*` primitive, every role, radius and duration, and the four documented components with the tokens each consumes (consumers: Card -> `--shadow-card`, `--radius-lg`, `--surface-container-low`, ring tokens; Nav item + Glide -> `--primary`, `--on-surface`, glide spring + durations used by `nav-items.css`; Theme toggle -> `--toggle-*`, `--primary`; Tracker -> `--tracker-0..4`, `--on-surface-variant`). `hue` derives from every primitive with chroma > 0.01 (the smoothstep(0.01, 0.03) weight from Task 1); `contrast` derives from surface and on-* roles; `round` from radii; `speed` from durations; `tod` from every role.
- [ ] **Step 6: Run** `pnpm vitest run src/lib/system && pnpm typecheck`. Expected: PASS.
- [ ] **Step 7: Commit** `feat(system): derive tokens at defaults, parity-tested against globals.css` — body: why a generated source plus a test-side CSS cascade oracle (a hand-mirrored table drifts silently), why the exact-stop path bypasses OKLCH, and that nothing in `globals.css` changed.

---

### Task 3: Parameter derivation (hue, contrast, round, speed, tod) + AA clamp

**Files:**
- Modify: `src/lib/system/derive.ts`, `src/lib/system/params.ts`
- Test: `src/lib/system/derive.test.ts`, `src/lib/system/contrast.test.ts`

**Interfaces:**
- Consumes: Task 2 `derive`, `TokenMap`, `phaseAtTod`; Task 1 colour functions.
- Produces (in `params.ts`):
  ```ts
  export const PARAM_RANGES: Record<keyof Params, { min: number; max: number; step: number }>;
  // hue -180..180 step 1; round 0..2 step 0.05; tod 0..1 step 0.001; contrast CONTRAST_MIN..CONTRAST_MAX step 0.05; speed 0.25..2 step 0.05
  export const CONTRAST_MIN: number; export const CONTRAST_MAX: number; // set from the AA test below, must include 1
  export function clampParams(p: Params): Params;                    // clamps each key; NaN/Infinity -> default
  export function todForPhase(phase: Phase): TodPosition;            // dawn 0, day 1/3, dusk 2/3, night 1
  ```
  `derive` now honours all five params: `hue` rotates every colour primitive/role/horizon/orb token weighted by smoothstep(0.01, 0.03, chroma) via `rotateHue` (also the `rgba()` stops in ring-glow and orb gradients); `round` multiplies finite radii (0 and `9999px` unchanged); `speed` divides durations (`ms`/`s` kept in their unit), incl. entrance durations, and never emits a value for speed < 0.25; `contrast` scales OKLCH L distance of each `surface*` role from `--surface` and of each `on-*` role from its surface partner, about the default.

- [ ] **Step 1: Write failing tests.**
  - `derive.test.ts`: `derive({…DEFAULT, round:0}, 1/3)["--radius-lg"] === "0px"`; `round:1.5` gives `18px` for lg; a `9999px` token stays `9999px`; `speed:2` halves `--duration-medium-5` to `150ms` and `--duration-ambient-1` to `8s`; `speed:0.25` gives `1200ms` and no value contains `NaN`/`Infinity`; `hue:90` changes `--palette-blue-600` but leaves `--palette-neutral-450` byte-identical and leaves `--palette-black-a8` identical; at tod = 1/6 (halfway Dawn→Day) `--primary` lies between Dawn and Day `--primary` in OKLCH L; `phaseAtTod(0.83)==="dusk"`, `phaseAtTod(0.84)==="night"`; every output colour string matches `/^(#[0-9a-f]{6}|rgba\([^)]*\))$/` or is a gradient/shadow containing only such colours; no output contains `oklch(`, `color-mix`, or `from `.
  - `derive.test.ts` hue weight: with `hue:90`, a colour of OKLCH chroma 0.005 gets rotation 0; chroma 0.04 gets the full 90; chroma 0.02 gets about 45 (±2); and over chroma 0.005 to 0.04 in steps of 0.0025 the applied rotation is monotonically non-decreasing.
  - `contrast.test.ts`: for pairs `[on-surface on surface-container-low/surface/surface-container-high]`, `[on-surface-variant on surface-container-low/surface]`, `[primary on surface-container-low]` (primary-as-text), assert ratio >= 4.5 in every phase over the grid `tod ∈ {0, 0.05, …, 1}` x `hue ∈ {-180,-90,0,90,180}` x `contrast ∈ {CONTRAST_MIN, 1, CONTRAST_MAX}`. If the pair fails at default parameters in the source CSS, record the pair in an `AA_KNOWN_FAILING` list inside the test and assert it does not get worse than the default (report each in the commit body). Choose `CONTRAST_MIN/MAX` as the widest range for which the grid passes.
- [ ] **Step 2: Run** `pnpm vitest run src/lib/system`. Expected: FAIL on the new tests; Task 2 parity still PASS.
- [ ] **Step 3: Implement** parameter handling in `derive.ts`; after each colour step run a sRGB gamut clamp (Task 1). Keep the exact-default byte-exact path (all params at default and tod on a stop returns Task 2 output).
- [ ] **Step 4: Run** `pnpm vitest run src/lib/system && pnpm typecheck`. Expected: PASS (including the unchanged parity test).
- [ ] **Step 5: Commit** `feat(system): derive tokens from hue, contrast, roundness, motion speed and time of day` — body: the chroma smoothstep weight (0.01 to 0.03) and why neutral partners stay put, how the contrast range was chosen from the AA grid, any `AA_KNOWN_FAILING` pair.

---

### Task 4: Engine runtime (write, subscribe, cleanup, spring scaling)

**Files:**
- Create: `src/lib/system/engine.ts`
- Test: `src/lib/system/engine.test.ts`

**Interfaces:**
- Consumes: `derive`, `phaseAtTod`, `TokenMap`, `Params`, `clampParams`.
- Produces:
  ```ts
  export type SystemEngine = {
    set(params: Params): void;                       // schedules one write on next rAF; multiple set() before a frame coalesce to the last
    get(): Params;
    subscribe(listener: (tokens: TokenMap, params: Params) => void): () => void; // called once per frame after the write, never synchronously from set()
    spring(base: GlideSpring): GlideSpring;          // stiffness x 1/s^2, dampingRatio unchanged
    dispose(): void;                                 // cancels rAF, removes every variable and data-phase/color-scheme/.dark overrides it set, restores the site's own phase attributes
  };
  export function createSystemEngine(root?: HTMLElement): SystemEngine; // default document.documentElement
  export const SYSTEM_OWNED_ATTR = "data-system-engine"; // set on root while engine is live
  ```
  `GlideSpring` is from `@/components/home/glide-spring`. Spring scaling: spec says stiffness x 1/s² and damping x 1/s; the stored model is `dampingRatio` (ratio), which is already scale-invariant, so scaling stiffness by 1/s² is the whole change; document that in a comment.

- [ ] **Step 1: Write failing tests** (jsdom, fake `requestAnimationFrame`): five `set()` calls in one frame produce exactly one `style.setProperty` pass with the last params; after `dispose()` `root.style` has zero engine custom properties (assert by recording the names set), `data-system-engine` removed, and `data-phase` back to its value before the engine existed; `dispose()` before the frame cancels the pending write; calling `dispose()` twice is safe; `set()` after `dispose()` is a no-op; when `matchMedia("(prefers-reduced-motion: reduce)")` matches, every `--duration-*` written equals the speed-1 value regardless of `speed`, and `spring(base)` returns `base` unchanged; `spring(base)` at `speed:0.25` returns `stiffness === base.stiffness / (0.25 * 0.25)` (finite) and the same `dampingRatio`; `data-phase` flips to `night` only when `phaseAtTod(tod)==="night"`.
- [ ] **Step 2: Run** `pnpm vitest run src/lib/system/engine.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** `createSystemEngine`: one rAF scheduled flag; write via `root.style.setProperty` for each token (remove keys no longer present); set `data-phase`, `color-scheme` and `.dark` from `phaseAtTod`; never use view transitions. Record the original `data-phase`, `data-mode`, `dark` class on creation.
- [ ] **Step 4: Run** the same command plus `pnpm typecheck`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(system): add engine runtime with coalesced writes and clean disposal` — body: rAF coalescing rationale (no per-event style writes), disposal contract (no leak onto `/`), reduced-motion precedence, why spring only scales stiffness.

---

### Task 5: URL state + `useSystemParams` hook (site-phase sync, Reset)

**Files:**
- Modify: `src/lib/system/params.ts`
- Create: `src/lib/system/use-system-params.ts`
- Test: `src/lib/system/params.test.ts`, `src/lib/system/use-system-params.test.tsx`

**Interfaces:**
- Consumes: Task 3 params, Task 4 `createSystemEngine`, `@/lib/theme` (`THEME_CHANGE_EVENT`, `getActiveMode`, `phaseFor`/`phaseForHour`, `PHASE_STARTS` as already exported; read `document.documentElement.dataset.phase` for the site phase).
- Produces:
  ```ts
  // params.ts
  export function parseQuery(search: string, sitePhase: Phase): Params; // tod missing -> todForPhase(sitePhase); invalid -> default; repeated key -> last valid value; always clamped
  export function serializeQuery(p: Params, sitePhase: Phase): string;   // only non-default keys, "" when all default; e.g. "?hue=40&round=1.5"
  // use-system-params.ts
  export function useSystemParams(): {
    params: Params;
    setParam<K extends keyof Params>(key: K, value: Params[K]): void;
    reset(): void;                      // defaults at the CURRENT site phase
    sitePhase: Phase;                   // phase the site theme is on (without engine overrides)
    engine: SystemEngine;
  };
  ```
  Hook: reads `window.location.search` in `useEffect` (not during render, so SSR output is default params), creates the engine on mount and disposes on unmount (StrictMode-safe), debounces `history.replaceState` (200ms trailing), moves `tod` to the new phase when `THEME_CHANGE_EVENT` fires and the site phase changed, and does not push params into React state per frame: `setParam` updates the engine immediately and React state at most once per animation frame.

- [ ] **Step 1: Write failing tests.** `params.test.ts`: `parseQuery("?hue=abc&round=NaN&tod=-5&speed=0", "dusk")` equals `{hue:0, round:1, tod:0, contrast:1, speed:0.25}` (clamped `-5`->0, `0`->min, unparseable->default; `tod` default dusk is only for missing key); `parseQuery("?hue=1&hue=2","day").hue === 2`; `parseQuery("?hue=1e9","day").hue === 180`; `parseQuery("","night").tod === 1`; `serializeQuery(DEFAULT with tod at site phase)==="" `; round-trip `serializeQuery(parseQuery(q))` is stable for `?hue=40&round=1.5`. `use-system-params.test.tsx`: unmount removes all engine variables (spy on the engine's `dispose`); StrictMode mount/unmount/mount leaves exactly one live engine; fire `THEME_CHANGE_EVENT` after setting `document.documentElement.dataset.phase="dusk"` and `tod` becomes `todForPhase("dusk")`; `reset()` while site phase is dusk gives tod dusk and everything else default; `replaceState` is called once after 5 quick `setParam` calls (fake timers) and not at all before 200ms.
- [ ] **Step 2: Run** `pnpm vitest run src/lib/system`. Expected: FAIL.
- [ ] **Step 3: Implement** `parseQuery`/`serializeQuery` and the hook.
- [ ] **Step 4: Run** `pnpm vitest run src/lib/system && pnpm typecheck`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(system): add URL-shareable parameter state and site-phase sync` — body: client-side read to keep the route static, debounced replaceState, why `tod` follows the site theme toggle and Reset targets the current phase.

---

### Task 6: Route shell, `/dev/system` redirect, section nav

**Files:**
- Create: `src/app/design-system/page.tsx`, `src/app/design-system/system-shell.tsx`, `src/app/design-system/sections.ts`, `src/app/design-system/system-shell.test.tsx`
- Modify: `src/app/dev/system/page.tsx` (replace body with `redirect("/design-system")`), move any existing tests of the old page next to the new route (grep `dev/system` in `src`; update imports)

**Interfaces:**
- Consumes: `useSystemParams` (Task 5).
- Produces:
  ```ts
  // sections.ts
  export type SectionId = "overview" | "parameters" | "colour" | "type" | "radius" | "shadow" | "motion" | "components";
  export const SECTIONS: readonly { id: SectionId; label: string }[];
  // system-shell.tsx ("use client")
  export function SystemShell({ children }: { children: React.ReactNode }): JSX.Element;
  export const SystemParamsContext: React.Context<ReturnType<typeof useSystemParams> | null>;
  export function useSystem(): ReturnType<typeof useSystemParams>; // throws outside the shell
  ```
  `page.tsx` is a server component exporting `metadata` (title "Design system", indexable, no `robots` block) and rendering `SystemShell` with each section component (stubs from `sections/*.tsx`, filled by Tasks 8-14). Shell layout: horizon background and existing type; desktop (>= 1024px) left sidebar of `SECTIONS` anchors (current section marked `aria-current`), phone: sections collapse into a top `<select>`-style dropdown. Controls panel slot is a `<aside aria-label="Controls">` filled by Task 7.

- [ ] **Step 1: Write failing tests**: rendering `SystemShell` shows one anchor per `SECTIONS` entry; `aria-current` follows the hash; mounting adds `data-system-engine` to `<html>` and unmounting removes it and every engine custom property (Review Focus 2); `src/app/dev/system/page.tsx` calls `redirect("/design-system")` (mock `next/navigation`).
- [ ] **Step 2: Run** `pnpm vitest run src/app/design-system src/app/dev`. Expected: FAIL.
- [ ] **Step 3: Implement** shell + stubs + redirect; honour `emil-design-foundations` and shadow-not-stroke (no card borders). No view transitions anywhere in this route.
- [ ] **Step 4: Run** the same command plus `pnpm typecheck && pnpm lint`. Expected: PASS. Then `PORT=3100 pnpm dev:log`, open `/design-system` and `/dev/system` (expect redirect), report both URLs (localhost and LAN).
- [ ] **Step 5: Commit** `feat(system): add /design-system route shell and redirect /dev/system` — body: why `/dev/system` redirects instead of being deleted (existing links, tests move with it) and that the nav link is deliberately not wired yet.

---

### Task 7: Controls panel + phone bottom sheet

**Files:**
- Create: `src/components/system/controls-panel.tsx`, `src/components/system/bottom-sheet.tsx`, matching `.test.tsx` files
- Modify: `src/app/design-system/system-shell.tsx` (mount the panel in the aside)

**Interfaces:**
- Consumes: `useSystem()`, `PARAM_RANGES`.
- Produces:
  ```ts
  export function ControlsPanel(): JSX.Element;               // five labelled <input type="range"> using PARAM_RANGES, live value readout, "Reset" button; tod slider has tick labels Dawn/Midday/Dusk/Night
  export function BottomSheet(props: { children: React.ReactNode; label: string }): JSX.Element; // handle <button aria-expanded>, snap points "peek" | "half", drag by handle, tap toggles
  ```
  Range inputs write through `setParam` on `input` (engine updates immediately; no React re-render of previews), keyboard arrows step by `PARAM_RANGES[k].step`. Desktop: sticky right column. < 1024px: `BottomSheet` with peek = the five handles visible, half = adds readouts + Reset; previews scroll above it (add bottom padding equal to the peek height).

- [ ] **Step 1: Write failing tests** (user-event): each input has an accessible name and `min/max/step` from `PARAM_RANGES`; `userEvent.keyboard("{ArrowRight}")` on `hue` raises it by one step; Reset restores defaults at the current site phase; `BottomSheet` handle toggles `aria-expanded` between peek and half on click and on Enter/Space; dragging the handle more than 40px up snaps to half, more than 40px down snaps to peek.
- [ ] **Step 2: Run** `pnpm vitest run src/components/system`. Expected: FAIL.
- [ ] **Step 3: Implement** both components (pointer events, `touch-action: none` on the handle, 44px minimum hit area per `emil-touch-and-accessibility`).
- [ ] **Step 4: Run** the same command plus `pnpm typecheck && pnpm lint`. Expected: PASS. Manually drag `hue` in the dev server and confirm the page recolours with no console errors.
- [ ] **Step 5: Commit** `feat(system): add parameter controls and phone bottom sheet` — body: why previews do not re-render per frame, snap-point behaviour, hit-area sizing.

---

### Task 8: Token row, chain popover, Foundations: Colour, Type, Radius, Shadow

**Files:**
- Create: `src/components/system/token-row.tsx`, `src/components/system/chain-popover.tsx`, `src/components/system/use-copy.ts`, `src/app/design-system/sections/colour.tsx`, `type.tsx`, `radius.tsx`, `shadow.tsx`, tests
- Modify: `src/app/design-system/page.tsx`

**Interfaces:**
- Consumes: `chainFor`, `consumersOf` (Task 2), `useSystem`, `SYSTEM tokens` via `getComputedStyle(document.documentElement).getPropertyValue(name)` read in a frame-coalesced `engine.subscribe`.
- Produces:
  ```ts
  export type TokenRowProps = { token: string; usage: string; preview?: React.ReactNode }; // usage = "use for …, don't use for …"
  export function TokenRow(props: TokenRowProps): JSX.Element;  // live value text, copy button, chain popover trigger
  export function ChainPopover(props: { token: string }): JSX.Element; // renders chainFor(token) then consumersOf(token)
  export function useCopy(): { copied: string | null; copy(text: string): void }; // copied resets to null after 1500ms
  ```
  Colour section: `--palette-*` grid grouped by family + per-phase role table (values read live, each phase shown by declaring `data-phase` on its card is NOT used because phases here are blended: show the roles of the current tod only, plus a static "defaults per phase" table from `source.generated.ts`). Type: the `--text-*` scale and Work Sans. Radius: `--radius-xs..lg` + pill, noting geometry that is not a radius token stays fixed (grep `rounded-` in `src/` and list the offenders in the section). Shadow: `--shadow-card` light/dark. Popover: opens on hover/focus for `(pointer: fine)`, on tap for coarse; Escape closes; `aria-expanded`.

- [ ] **Step 1: Write failing tests**: `TokenRow` shows the live value (stub `getComputedStyle`), clicking copy writes the token name to `navigator.clipboard` and shows "Copied" for 1500ms (fake timers), then reverts; `ChainPopover` for `--radius-lg` lists `round` first and a Card consumer; tap (coarse pointer mock) opens it; Escape closes; Colour section renders one row per `--palette-*` in `PALETTE` (count asserted from the export).
- [ ] **Step 2: Run** `pnpm vitest run src/components/system src/app/design-system`. Expected: FAIL.
- [ ] **Step 3: Implement** components and the four sections; `.dark`-independent styling via tokens only (no hex in components).
- [ ] **Step 4: Run** the same command plus `pnpm typecheck && pnpm lint`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(system): document colour, type, radius and shadow with live token rows` — body: values read from the live computed style so they cannot drift, chain popover input modes, fixed-geometry list for non-token radii.

---

### Task 9: Motion section, Overview, Parameters, duration-scale comparison

**Files:**
- Create: `src/app/design-system/sections/motion.tsx`, `overview.tsx`, `parameters.tsx`, `src/components/system/motion-demo.tsx`, `src/lib/system/m3-scale.ts`, tests
- Modify: `src/app/design-system/page.tsx`

**Interfaces:**
- Consumes: `TokenRow`, `useSystem`, `DURATIONS`, `EASES` (Task 2), `engine.spring` (Task 4).
- Produces:
  ```ts
  export const M3_DURATIONS: readonly { token: string; ms: number }[]; // M3 coarse scale: 50,100,150,200,250,300,350,400,450,500,550,600,700,800,900,1000
  export function MotionDemo(props: { kind: "ease" | "duration"; token: string }): JSX.Element; // a dot travelling a track using the token, "Replay" button restarts via the Web Animations API, respects prefers-reduced-motion by not animating and showing the end state
  ```
  Overview: what the system is, a rendered parameter -> primitive -> role -> component chain (from `chainFor("--primary")`), and a one-screen live demo. Parameters: one row per param with what it moves (from `nodes.ts`). Motion: a `TokenRow` + `MotionDemo` for every `--ease-*` and `--duration-*`, the Glide spring documented as a spring (stiffness/dampingRatio from `GLIDE_LEAD_SPRING`/`GLIDE_TRAIL_SPRING`, live-scaled via `engine.spring`), and the comparison table "today's durations vs M3-style scale" (comparison only; no tokens change).

- [ ] **Step 1: Write failing tests**: `MotionDemo` replay calls `Element.animate` with duration equal to the live `--duration-*` value parsed to ms; with reduced motion mocked it never calls `animate`; Motion section renders one `MotionDemo` per ease and duration from the exports; the comparison table lists every `M3_DURATIONS` entry and nearest-today token for each; the Glide row shows `stiffness` scaled by `1/s²` when `speed` is 2 (via a stubbed `engine.spring`).
- [ ] **Step 2: Run** `pnpm vitest run src/app/design-system src/components/system`. Expected: FAIL.
- [ ] **Step 3: Implement** the three sections and `MotionDemo`.
- [ ] **Step 4: Run** the same command plus `pnpm typecheck && pnpm lint`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(system): add overview, parameters and motion documentation` — body: replay mechanism, comparison-only scope of the M3 scale (no token changes until Dat decides), spring documented as a spring.

---

### Task 10: Component documentation frame + Card sample

**Files:**
- Create: `src/components/system/component-doc.tsx`, `src/components/system/samples/card-sample.tsx`, `src/app/design-system/sections/components.tsx`, tests
- Reference only (do not edit): `src/components/home/home-cards.tsx`, `src/components/home/ring-hover.tsx`, `ring-hover.css`

**Interfaces:**
- Produces:
  ```ts
  export type ForceState = "rest" | "hover" | "focus-visible" | "pressed" | "active";
  export type ComponentDocProps = {
    name: string;
    description: string;
    states: readonly ForceState[];
    render: (state: ForceState | undefined) => React.ReactNode; // undefined = live (unforced) preview
    use: readonly string[]; dont: readonly string[];
    tokens: readonly string[];
    notes?: string;
  };
  export function ComponentDoc(props: ComponentDocProps): JSX.Element; // live preview, state matrix (every state side by side, labelled), use/don't lists, TokenRow-style token list with chain popovers
  // card-sample.tsx
  export function CardSample(props: { forceState?: ForceState; children?: React.ReactNode }): JSX.Element; // sets data-state={forceState} on the root; same classes, shadow-card and ring-hover markup as the live Card
  ```
  `data-state` styling: add selectors beside the existing hover/focus rules in a NEW CSS file `src/components/system/force-state.css` that duplicates the live rule bodies under `[data-state="hover"]` / `[data-state="focus-visible"]`, so the home CSS is untouched.

- [ ] **Step 1: Write failing tests**: `CardSample forceState="hover"` renders `data-state="hover"`; `ComponentDoc` renders one cell per `states` entry plus a live preview; renders use/dont lists and one token row per `tokens` entry; Card doc includes the note that cards are hover-only today.
- [ ] **Step 2: Run** `pnpm vitest run src/components/system`. Expected: FAIL.
- [ ] **Step 3: Implement** the frame, `CardSample`, `force-state.css` and the Components section with the Card entry (states rest, hover, focus-visible).
- [ ] **Step 4: Run** the same command plus `pnpm typecheck && pnpm lint`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(system): add component doc frame and documented Card` — body: why the sample duplicates the live markup instead of editing home files (merge-conflict zone with work-drawer/home-carousel), `data-state` forcing mechanism.

---

### Task 11: Nav item + Glide capsule sample

**Files:**
- Create: `src/components/system/samples/nav-item-sample.tsx`, test
- Modify: `src/app/design-system/sections/components.tsx`
- Reference only (do not edit): `src/components/home/nav-items.tsx`, `nav-items.css`, `glide-spring.ts`, `nav-glyph-icon.tsx`

**Interfaces:**
- Consumes: `ComponentDoc`, `ForceState`, `createEdge`, `stepEdge`, `GLIDE_LEAD_SPRING`, `GLIDE_TRAIL_SPRING`, `engine.spring` (names exactly as exported in `glide-spring.ts`; read it for `stepEdge`'s signature).
- Produces:
  ```ts
  export function NavItemSample(props: { label: string; forceState?: ForceState; active?: boolean }): JSX.Element; // renders a nav item with the shared Glide capsule; forceState sets data-state
  export function NavGlideDemo(): JSX.Element; // three items; hover/focus moves one shared capsule using stepEdge with engine.spring(GLIDE_*) so motion speed scales it
  ```
  States documented: rest, hover, active, focus-visible.

- [ ] **Step 1: Write failing tests**: `NavItemSample forceState="active"` sets `data-state="active"`; `NavGlideDemo` uses the spring returned by a stubbed `engine.spring` (assert `stepEdge` called with the scaled stiffness); capsule position at rest equals the hovered item's box (jsdom with mocked `getBoundingClientRect`).
- [ ] **Step 2: Run** `pnpm vitest run src/components/system`. Expected: FAIL.
- [ ] **Step 3: Implement** the sample and demo, reusing the existing exports and CSS classes from `nav-items.css` (import the CSS; do not modify it), then add the Nav entry to the Components section.
- [ ] **Step 4: Run** the same command plus `pnpm typecheck && pnpm lint`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(system): document nav item and Glide capsule` — body: that the Glide spring is read through the engine so the Motion speed parameter scales it, and that `nav-items.tsx` stays untouched.

---

### Task 12: Theme toggle sample

**Files:**
- Create: `src/components/system/samples/theme-toggle-sample.tsx`, test
- Modify: `src/app/design-system/sections/components.tsx`
- Reference only: `src/components/theme/theme-toggle.tsx` (exports `ThemeToggle`, `PHASE_ROW_*`), `theme-provider.tsx`, `theme-toggle.css`

**Interfaces:**
- Consumes: `ThemeToggle`, `useTheme`.
- Produces:
  ```ts
  export function ThemeToggleSample(): JSX.Element; // the real ThemeToggle (Day · Night · Auto + Day phase row Clock/Dawn/Midday/Dusk) inside the doc preview; choosing a phase also moves the tod slider through the existing THEME_CHANGE_EVENT path
  ```
  Because the toggle's pointer/open states are driven by JS, the state matrix shows labelled screenshots-by-markup only for `rest` and `focus-visible` (via `data-state`), and the live preview covers the rest; note this on the doc. If `ThemeToggle` cannot take `forceState` without editing it, do NOT edit it: show the live preview only plus the states table text.

- [ ] **Step 1: Write failing tests**: the sample renders the three segments and, after clicking Day, the four Day-phase options; clicking "Dusk" dispatches `THEME_CHANGE_EVENT` and `useSystem().params.tod` becomes `todForPhase("dusk")` (mount within `SystemShell` with a `ThemeProvider`).
- [ ] **Step 2: Run** `pnpm vitest run src/components/system`. Expected: FAIL.
- [ ] **Step 3: Implement** the sample and its Components-section entry (use/don't copy: tokens `--toggle-track`, `--toggle-selected`, `--primary`).
- [ ] **Step 4: Run** the same command plus `pnpm typecheck && pnpm lint`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(system): document the theme toggle` — body: the toggle is documented as it exists and drives the tod slider on this page; why `theme-toggle.tsx` is not edited.

---

### Task 13: Tracker widget sample

**Files:**
- Create: `src/components/system/samples/tracker-sample.tsx`, test
- Modify: `src/app/design-system/sections/components.tsx`
- Reference only: `src/components/home/tracker-widget.tsx`

**Interfaces:**
- Produces:
  ```ts
  export function TrackerSample(props: { forceState?: Extract<ForceState, "rest" | "hover"> }): JSX.Element; // 32-week grid, bottom dots, hover caption; forceState="hover" shows the caption
  ```
  Uses `--tracker-0..4` and `--on-surface-variant`; grid data is a fixed in-file sample array (no network).

- [ ] **Step 1: Write failing tests**: renders 32 week columns and five legend dots; `forceState="hover"` shows the caption, `rest` does not; each cell's background uses a `--tracker-N` var (assert `style` or class mapping).
- [ ] **Step 2: Run** `pnpm vitest run src/components/system`. Expected: FAIL.
- [ ] **Step 3: Implement** the sample and the Components entry; mark the final Components section as complete (all four entries, each with preview, state matrix, do/don't, tokens consumed).
- [ ] **Step 4: Run** the same command plus `pnpm typecheck && pnpm lint && pnpm test`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(system): document the tracker widget` — body: sample-data rationale, tokens consumed, hover-caption forcing.

---

### Task 14: Horizon follows the engine (uniform subscription)

**Files:**
- Modify: `src/components/horizon/horizon-shader.tsx` (add an optional subscription; reference `readTokens` ~line 200 and the uniform block ~line 657)
- Create: `src/components/horizon/horizon-engine-bridge.ts`, test
- Test: `src/components/horizon/horizon-engine-bridge.test.ts`

**Interfaces:**
- Consumes: `SystemEngine.subscribe`, `TokenMap` (Task 4).
- Produces:
  ```ts
  export type HorizonUniforms = {
    base: [number, number, number]; mid: [number, number, number]; horizon3: [number, number, number];
    midAt: number;
    color1: [number, number, number]; color2: [number, number, number];
    alpha1: number; alpha2: number;
  };                                                   // channels 0..1
  export function uniformsFromTokens(tokens: TokenMap): HorizonUniforms; // reads --horizon-base/mid/3/1/2, -mid-at, -1-alpha, -2-alpha
  export function bindHorizonToEngine(engine: SystemEngine, apply: (u: HorizonUniforms) => void): () => void; // returns unsubscribe; apply is called at most once per rAF, no React state
  ```
  `HorizonShader` gains an optional prop `engine?: SystemEngine`; when present it uses `bindHorizonToEngine` to set uniforms directly (no re-render) and skips re-reading CSS. Existing behaviour without the prop is unchanged. Safari keeps the CSS horizon (existing rule); the CSS horizon follows the vars unmodified. The route shell passes the engine; home does not (home files untouched).

- [ ] **Step 1: Write failing tests**: `uniformsFromTokens` converts `--horizon-base:#f1f3f6` to `[241/255,243/255,246/255]` and `--horizon-mid-at:82%` to `0.82`; `bindHorizonToEngine` with a fake engine emitting 5 token updates in one frame calls `apply` once; returned function unsubscribes (no calls after); `apply` is not called synchronously inside `subscribe`.
- [ ] **Step 2: Run** `pnpm vitest run src/components/horizon`. Expected: FAIL.
- [ ] **Step 3: Implement** the bridge and the optional prop wiring in `horizon-shader.tsx`; add `engine` pass-through in the route shell. Run `pnpm test` to confirm existing horizon tests (`horizon-intensity.test.ts`) still pass.
- [ ] **Step 4: Run** `pnpm vitest run && pnpm typecheck && pnpm lint`. Expected: PASS. Then in the dev server drag `tod` and `hue` and confirm the WebGL horizon recolours with the cards in Chrome; confirm Safari path is untouched by reading the capability branch (do not test Safari here; Task 15 covers it).
- [ ] **Step 5: Commit** `feat(horizon): let the design-system page drive horizon uniforms` — body: why uniforms via a rAF-coalesced subscription (no per-frame React render), that default behaviour and the Safari CSS path are unchanged, and that home does not pass the prop.

---

### Task 15: Browser matrix, live-site parity, Card screenshot diff

**Files:**
- Create: `playwright.config.ts`, `e2e/parity.spec.ts`, `e2e/system-page.spec.ts`, `e2e/card-diff.spec.ts`, `e2e/safari-fallback.spec.ts`
- Modify: `package.json` (devDependency `@playwright/test`, scripts `"e2e": "playwright test"`, `"e2e:install": "playwright install chromium firefox webkit"`), `.gitignore` (`test-results/`, `playwright-report/`), `vitest.config.ts` only if needed to keep `e2e/**` out of vitest (its `include` already limits to `src/**`)

**Interfaces:**
- Consumes: the running app via Playwright `webServer: { command: "pnpm dev:log", env: { PORT: "3200" }, url: "http://localhost:3200", reuseExistingServer: true }`; projects `chromium`, `firefox`, `webkit`.
- Produces: no code interfaces; test names below.

- [ ] **Step 1: Install and write the specs** (no Playwright exists in the repo today):
  - `parity.spec.ts` "tokens at defaults equal globals.css" (all projects): on `/design-system?tod=<x>` for `x` in `0, 0.3333, 0.6667, 1`, collect `getComputedStyle(html).getPropertyValue(name)` for every name in `PALETTE`/`ROLES`/`RADII`/`DURATIONS` and compare to the same names read from `/` with `data-phase` forced to that phase (ground truth, engine absent); same tolerances (±1 channel, ±0.01 alpha, exact px/ms).
  - `parity.spec.ts` "home unaffected": visit `/design-system`, navigate to `/`, assert no `--palette-*`/role inline custom properties remain on `<html>` and a computed-style snapshot of 20 sampled elements on `/` equals one taken before visiting the page.
  - `system-page.spec.ts`: drag `hue` (keyboard steps) and assert `--primary` computed changes; `?hue=abc&round=NaN` loads without console errors; `speed=2` halves a measured transition duration; phone viewport (390x844) shows the bottom sheet handle and the section dropdown; `prefers-reduced-motion: reduce` keeps `--duration-*` at speed-1 values.
  - `card-diff.spec.ts`: at defaults, screenshot the documented Card and the live home Card at the same size and theme and compare with `toHaveScreenshot` (threshold 0.2%) for day and night.
  - `safari-fallback.spec.ts` (webkit project only): the horizon renders the CSS layer, no WebGL canvas element is mounted, and the layer's computed `background-image` changes when `tod` changes.
- [ ] **Step 2: Run** `pnpm e2e:install && pnpm e2e`. Expected: all pass on chromium/firefox/webkit; fix real failures in the source task they point to (do not loosen tolerances).
- [ ] **Step 3: Perf check**: in chromium, drag `hue` via 120 `fill` calls at rAF cadence under `page.evaluate` timing; assert fewer than 5 long frames (> 25ms) in `PerformanceObserver` `longtask`/frame samples. Record the result in the commit body; if it fails, report to the lead rather than weakening.
- [ ] **Step 4: Commit** `test(e2e): add Playwright browser matrix for the design-system page` — body: parity ground truth is the live `/` tokens, Card diff scope and threshold, WebKit CSS-fallback check, perf measurement result.

---

## Follow-ups (listed, NOT in this plan)

- After the work-drawer (`drxaviert/work-drawer`) and home-carousel (`drxaviert/home-carousel`) jobs merge: switch `home-layout.tsx` / `home-cards.tsx` to the shared modules in `src/components/system/samples/`, then delete the duplicated markup and `force-state.css` duplication.
- Wire the nav "Design system" item in `nav-items.tsx` to `/design-system` (waits for the drawer job).
- Optional Changelog link section.
- Per-token editing (Option A) and node-graph editor (Option C), on top of the engine.
- Log any approved motion changes to `docs/design-system/motion.md`.

## Self-review notes

- Spec coverage: every Goal, Decided parameter, layout, section, token-row, component, duration comparison, output format, parity/AA/browser-matrix constraint maps to a task above. Changelog link is optional and left to follow-ups. Safari CSS horizon path is verified in Task 15.
- Types: `Params`, `TodPosition`, `TokenMap`, `SystemEngine`, `ForceState`, `ComponentDocProps` are each defined once (Tasks 2/3/4/10) and consumed by exact name later.
