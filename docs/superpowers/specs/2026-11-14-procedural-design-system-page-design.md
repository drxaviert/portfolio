# Procedural design-system page — design

Date: 2026-11-14 · Owner: Dat (chao@dattran.design) · Repo: portfolio (Next.js App Router, Tailwind v4)

## Intent

Dat builds reusable, interactive procedural systems in Houdini and is aiming for a design-engineer role. The portfolio's "Design system" nav item should open a real documentation site, the kind Google (Material 3) or Vercel (Geist) publish, covering tokens and components, when and how to use them, and their states. On top of that, the visitor can **change the system through a few source parameters and see every token and component on the page update live**. The page is the evidence that Dat builds systems where a few inputs drive everything, applied to UI.

## Goals

- A public route documenting foundations (colour, type, radius, shadow, motion) and components (with states and usage guidance), with values read from the real tokens, not hand-typed.
- A parameter panel with a few source parameters. Moving one recomputes the derived tokens and the whole page updates in real time.
- **Chain visibility:** for any token, the page can show which parameter(s) and primitive it derives from, and which components consume it ("Roundness → --radius-lg → Card, Glide capsule, ring").
- At default parameters, the page is identical to the live site's tokens, and a test guarantees it.

## Non-goals (for now)

- No per-token editing (Option A). Possibly added later on top of the engine.
- No visual node-graph editor (Option C). Possibly added later, because the engine already holds the graph.
- No change to the live site's tokens or behaviour. Visitors' changes never leak outside this page (the engine's variables are removed on unmount).
- No general component library rewrite; only the components the page documents get extracted (see Components).

## Anti-goals (failure even if it works)

- Reads like a generic theme-picker or colour-picker demo.
- Page values drift from `globals.css` (a design system page that lies).
- Janky while dragging a parameter.
- Breaks in Safari < 18, or on phones.
- Looks like a copy of Material/Geist rather than Dat's own visual language.

## Approaches considered

1. **Pure CSS:** parameters as custom properties, with tokens rewritten as `calc()` / relative-colour formulas in `globals.css`. Rejected: it rewrites the just-verified production tokens, needs relative-colour syntax (Safari 18+, which was removed in PR #26 for that reason), and can't introspect the chain.
2. **Page-scoped TypeScript engine (chosen by Dat).** A module holds the parameters and derivation rules. While the page is mounted it writes the computed token values as CSS custom properties on `<html>`, and removes them on unmount. The site stays static. Exact parity at defaults is enforced by a test, and the engine's dependency data drives chain visibility.
3. **Visual node-graph editor:** the most on-brand, but the heaviest, buries the documentation, and is poor on phones. Deferred, as a later layer on top of 2.

## Decided

- Approach 2, parameter-driven (Option B).
- **Parameters (defaults reproduce today exactly):**
  - **Time of day:** one continuous slider over Dawn → Midday → Dusk → Night (Midday is the code phase `day`, `theme.ts`). Colours blend in OKLCH between adjacent phases. The light/dark flip (`data-phase="night"`, `color-scheme`, Tailwind `dark:`) happens at the midpoint of the Dusk→Night segment; only the scheme flips there, the colours are already continuous.
  - **Base hue:** rotates the hue (Δh, default 0) of every colour with OKLCH chroma ≥ 0.02, horizon/orb tokens included. Below that counts as neutral and is unaffected. `@property` initial values stay literal; the engine sets the custom properties themselves.
  - **Contrast:** scales the lightness distance between surface roles and on-* text/icon roles (default 1). Range is clamped so text/icon pairs stay at WCAG AA (see Constraints).
  - **Roundness:** multiplies finite radius tokens (default 1). 0 stays 0 and pill (9999px) stays pill. Geometry that isn't a radius token stays fixed.
  - **Motion speed:** multiplies every duration token, including the entrance timings (default 1). Easings are unchanged. The Glide spring is time-scaled (stiffness ×1/s², damping ×1/s). `prefers-reduced-motion` still wins.
- **Engine node table:** the engine rewrites the `--palette-*` primitives; role tokens keep their `var()` references and follow. That makes the chain (parameter → primitive → role → component) real. The doc for the implementation lists the engine's nodes explicitly (parameter, primitive, role, radius/duration tokens, consumers).
- **Scope is the whole `/design-system` page:** nav, horizon background and docs all follow the parameters.
  - The time-of-day slider starts at the visitor's current site phase. Using the site theme toggle while on the page moves the slider to that phase.
  - Reset = defaults at the current site phase.
  - On unmount the engine's variables are removed and the rest of the site returns to the site theme.
- **Horizon:** the WebGL horizon follows live. The shader takes derived colours as uniforms through an engine subscription, coalesced per rAF, with no React re-render. Safari keeps the CSS horizon per the existing rule, and the CSS horizon follows the vars for free.
- The page is public and documents what exists: `--palette-*`, the per-phase colour roles, `--radius-*`, `--shadow-card`, type tokens, and `--ease-*` / `--duration-*` (plus the Glide spring from `glide-spring.ts`, documented as a spring).

## Proposed (Opus's calls, which Dat can correct)

- **Route:** `/design-system`. `/dev/system` redirects to it, and its tests move with it.
- **Scope of changes:** page-only. A Reset button returns everything to defaults (see Decided). The parameter state is encoded in the URL query so a configuration can be shared, like a saved Houdini preset. Nothing is written to localStorage.
  - Keys: `hue`, `round`, `tod`, `contrast`, `speed` (e.g. `?hue=40&round=1.5`). Out-of-range values clamp; unparseable ones fall back to the default.
  - Params are read client-side from `window.location` in an effect (no `useSearchParams`), so the route stays static. `history.replaceState` is debounced.
- **Layout:**
  - **Desktop:** left sidebar for sections, and a sticky parameter panel ("Controls") on the right.
  - **Phone:** the panel becomes a bottom sheet with a handle and two snap points (peek = the parameter handles, half). Drag by the handle; tap toggles. Previews scroll above it. The section nav collapses into a top dropdown.
  - The visual language matches the existing portfolio: horizon background, shadow-not-stroke cards, existing type.
  - No view transitions during parameter drags.
- **Sections:**
  - Overview: what the system is, the parameter → primitive → role → component chain, and a one-screen live demo.
  - Parameters.
  - Foundations: Colour (palette + roles per phase), Type, Radius, Shadow, Motion (live demo per easing and duration, with a replay button).
  - Components.
  - Changelog link (optional).
- **Token rows:** each shows the live value, the token name (copyable; "Copied" shows inline for 1.5s), its "derived from" chain, and a one-line usage note ("use for…, don't use for…"). The chain popover opens on hover/focus with a pointer and on tap on touch.
- **Components documented** (real components, extracted to new shared modules, each with a `forceState` prop that sets a `data-state` attribute for hover / focus-visible / pressed in the state matrix):
  1. **Card:** shadow-card plus the hover ring. States: rest, hover, focus-visible. The usage note says cards are hover-only today.
  2. **Nav item + Glide capsule.** States: rest, hover, active, focus-visible.
  3. **Theme toggle:** Day · Night · Auto, plus the Day phase row (Clock/Dawn/Midday/Dusk). Documented as it exists on the site; on this page it also moves the time-of-day slider.
  4. **Tracker widget:** 32-week grid, bottom dots, hover caption.

  Each gets a live preview, a state matrix (forced states rendered side by side), usage do/don't, and a list of tokens consumed. A browser screenshot diff checks the documented Card against the live Card at defaults.
- **Duration-scale comparison:** the Motion section shows today's durations next to an M3-style coarse scale, so Dat can judge them by eye. Comparison only; nothing changes until Dat decides.
- **Output format:** the engine emits only hex/rgba/px/ms (OKLCH blending is internal; output is sRGB). No relative-colour syntax and no `color-mix` in the output.

## Constraints

- Don't edit `src/components/home/home-layout.tsx` or `home-cards.tsx` until the work-drawer (`drxaviert/work-drawer`) and home-carousel (`drxaviert/home-carousel`) jobs merge. The documented components live in new shared modules so those files can adopt them later; a follow-up switches home to the shared modules once both jobs merge.
- Wiring the nav "Design system" item (`nav-items.tsx`) to the route waits for the drawer job to merge. Until then the page is reachable by URL only.
- Live-site rendering must stay identical. This is verified the same way as PR #26 (computed-style + pixel parity on `/`).
- **Parity test:** the engine at defaults must equal `globals.css` for every token in all four phases. Resolve `var()` chains to sRGB 8-bit; tolerance ±1 per channel and ±0.01 alpha; px/ms must match exactly.
- Parameter drags: rAF-coalesced CSS-variable writes on `<html>` (removed on unmount), with no React re-render per frame for the previews. Keep 60fps on a mid laptop.
- Accessibility: the controls are real inputs (labelled range/segmented), keyboard operable; reduced motion is respected.
- **Contrast/AA:** measured on text and icon pairs on their surfaces (on-surface, on-surface-variant, primary-as-text) in every phase and at every slider position. Decorative tokens (outline, frame-line, etc.) are exempt. The test samples parameter extremes plus a grid, and the contrast range is clamped to what passes.
- **Browser matrix:** Chrome, Firefox and WebKit (Playwright) for the engine path, plus the Safari CSS-fallback check.
- Motion changes follow the existing rules: log them to `docs/design-system/motion.md` only after Dat approves; Figma is the source for resting sizes.
- Dev server: `PORT=<n> pnpm dev:log`; share localhost and http://192.168.2.33:<n>.

## Left to the builder

- Exact derivation maths (OKLCH blending, hue rotation, contrast scaling), parameter ranges and steps, as long as the defaults are exact and the extremes stay AA-legible.
- How the engine reads the source tokens (generated from `globals.css` at build time vs a TS source of truth that `globals.css` mirrors). Either is fine if the parity test holds.
- Component file structure and naming for the new shared modules.

## Decision log

**Dat chose**

- A. Time of day is one continuous slider (Dawn → Midday → Dusk → Night), OKLCH blend between phases, scheme flips at the Dusk→Night midpoint.
- B. The whole `/design-system` page follows the parameters via vars on `<html>`, removed on unmount; slider starts at and follows the site phase; Reset = defaults at current phase.
- C. The WebGL horizon follows live through engine uniforms (rAF-coalesced, no re-render); Safari keeps the CSS horizon.

**Opus's calls**

1. AA contrast measured on text/icon pairs in every phase and slider position; decorative tokens exempt; extremes plus grid sampled.
2. Engine rewrites `--palette-*` primitives; roles keep `var()` refs; node table listed explicitly.
3. Hue rotation applies at OKLCH chroma ≥ 0.02, horizon/orb included; `@property` initials stay literal.
4. `/dev/system` redirects to `/design-system`; tests move.
5. Documented components are real, extracted to shared modules with `forceState`; home files untouched; Card screenshot diff at defaults.
6. Parity test resolves to sRGB 8-bit, ±1 per channel, ±0.01 alpha, px/ms exact, four phases.
7. Roundness multiplies finite radii; 0 and pill stay; non-radius geometry fixed.
8. Motion speed scales all durations incl. entrance; Glide spring time-scaled; reduced-motion wins.
9. URL keys `hue`/`round`/`tod`/`contrast`/`speed`; clamp or default; client-side read in an effect; debounced `replaceState`.
10. Phone bottom sheet: two snap points, drag handle, tap toggles, previews scroll above.
11. Chain popover on hover/focus (pointer) and tap (touch); "Copied" inline for 1.5s.
12. No view transitions during parameter drags.
13. Browser matrix: Chrome, Firefox, WebKit plus the Safari CSS fallback check.
