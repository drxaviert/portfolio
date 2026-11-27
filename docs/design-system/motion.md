# Design system motion — 2026-11-13

The shipped motion of the theme toggle, the Day phase row, the home nav's Glide capsule and the Work drawer, recorded from the code (toggle and nav from PR #12, `5bbfba9` / `d574d89`; drawer at `98b6429`; the shipped drawer, its close rules and the index layout switch approved at `cb6785a`, 2026-11-19; the /work hover-thumbnail list approved 2026-11-22; the canvas open/close approved 2026-11-25 in PR #121 (`f0bc21a`) and the Human Contact embed <-> live route on the same motion in PR #119 (`1faa998`), both in the last two sections; the work reader's Lenis smooth scroll approved 2026-11-27 in PR #133; the drawer close was later retuned to 300ms on `ease` in PR #80, and the nav motion blur added in PR #68). Values here are the ones the app actually runs, so new components reuse them instead of re-inventing a curve or a stagger.

## Principles

- One curve family per job: `cubic-bezier(0.23, 1, 0.32, 1)` (`--ease-emphasized-decelerate`) for entrances, `ease-in` (`--ease-accelerate`) for exits, `cubic-bezier(0.34, 1.3, 0.64, 1)` (`--ease-spring`) for the icon settle.
- Calm and ambient entrances use `cubic-bezier(0.4, 0, 0.2, 1)` (`--ease-calm`): it leaves at zero velocity and settles on a long tail, so light and content arrive without anything launching.
- A theme change is one crossfade of the whole page, not a colour transition per element: everything changes on the same frame because it is the same image pair.
- The drawer opens on `cubic-bezier(0.25, 0.8, 0.25, 1)` (panel and nav together) and closes in 300ms on CSS `ease` (`cubic-bezier(0.25, 0.1, 0.25, 1)`, Stripe's dialog close); its content cascades and the blur resolving on top of that fade both run on the open curve, while the nav's own default flight, with no drawer behind it, uses `cubic-bezier(0.32, 0.72, 0, 1)` (`morph.ts`).
- Entrances stagger left to right; exits leave together. Nothing waits on the pointer.
- Hover never restarts the entrance: it replays the icon settle once from its resting pose and ends at rest.
- Reduced motion keeps the state change and drops the movement: one opacity fade, no icon motion.
- Exception, 2026-11-14: the home page entrance settles by 1710ms, over the usual 700ms budget. Dat chose that deliberately after tuning twelve variants — the extra time is what makes Soft focus read as calm and ethereal rather than quick.

## Tokens

Every curve and duration here is either a shipped token in `src/app/globals.css` (`:root` motion scale) or a component variable that lives with its component. One token per distinct value: steps are never rounded together, and one-off choreography stays in the component, so the global scale stays small. TS-owned timings (the WAAPI highlight path, the close and trail-hold timers, the Glide springs) keep their literals so they run before CSS loads; a token named beside one is the scale step for that value, not a property the TS reads.

| Easing token | Value | Role |
| --- | --- | --- |
| `--ease-standard` | `ease-in-out` | ambient loops, whole-page crossfade |
| `--ease-decelerate` | `ease-out` | interaction feedback, entrances |
| `--ease-accelerate` | `ease-in` | exits |
| `--ease-linear` | `linear` | fades, demo loops |
| `--ease-emphasized-decelerate` | `cubic-bezier(0.23, 1, 0.32, 1)` | row and segment entrances |
| `--ease-emphasized-standard` | `cubic-bezier(0.32, 0.72, 0, 1)` | frame-line spotlight |
| `--ease-spring` | `cubic-bezier(0.34, 1.3, 0.64, 1)` | icon settle |
| `--ease-spring-grow` | `cubic-bezier(0.165, 0.84, 0.44, 1)` | ring grow |
| `--ease-spring-follow` | `cubic-bezier(0.16, 1, 0.3, 1)` | ring glow follow |
| `--ease-calm` | `cubic-bezier(0.4, 0, 0.2, 1)` | home entrance veil, cards, glow |
| `--ease-step` | `steps(1)` | z-index raise |

| Duration token | Value | Duration token | Value |
| --- | --- | --- | --- |
| `--duration-short-1` | 100ms | `--duration-medium-4` | 280ms |
| `--duration-short-2` | 120ms | `--duration-medium-5` | 300ms |
| `--duration-short-3` | 150ms | `--duration-medium-6` | 330ms |
| `--duration-short-4` | 160ms | `--duration-medium-7` | 360ms |
| `--duration-short-5` | 170ms | `--duration-long-1` | 400ms |
| `--duration-short-6` | 180ms | `--duration-long-2` | 600ms |
| `--duration-short-7` | 220ms | `--duration-long-3` | 800ms |
| `--duration-short-8` | 230ms | `--duration-long-4` | 1000ms |
| `--duration-medium-1` | 240ms | `--duration-extra-long-1` | 4000ms |
| `--duration-medium-2` | 250ms | `--duration-extra-long-2` | 7800ms |
| `--duration-medium-3` | 270ms | `--duration-extra-long-3` | 8000ms |
| | | `--duration-extra-long-4` | 8200ms |
| | | `--duration-ambient-1` | 16s |
| | | `--duration-ambient-2` | 110s |

The home entrance keeps its one-off timings in a single component block on its root selector (`.entrance-scope, [data-entrance="soft"]`, `home-entrance.css`). They are named by role, not by value:

| Component variable | Value | Component variable | Value |
| --- | --- | --- | --- |
| `--scale-stagger` | 50ms | `--grow-duration` | 420ms |
| `--rise-duration` | 380ms | `--grow-stagger` | 70ms |
| `--rise-stagger` | 60ms | `--breath-inhale` | 1200ms |
| `--ring-edge-in` | 102.5ms | `--breath-delay` | 480ms |
| `--ring-edge-out` | 102.5ms | `--breath-duration` | 540ms |
| `--ring-edge-hold` | 175ms | `--breath-stagger` | 30ms |
| `--ring-fill-delay` | 80ms | `--mist-duration` | 1100ms |
| `--ring-stagger` | 40ms | `--mist-card-duration` | 900ms |
| `--sky-stagger` | 36ms | `--mist-stagger` | 30ms |
| `--clear-duration` | 680ms | `--dawn-bloom-duration` | 1300ms |
| `--step-stagger` | 40ms | `--dawn-content-delay` | 650ms |
| `--step-marker-fade` | 200ms | `--dawn-stagger` | 25ms |
| `--grain-duration` | 460ms | `--soft-duration` | 1400ms |
| `--grain-stagger` | 32ms | `--soft-card-duration` | 1100ms |
| `--grain-item-duration` | 320ms | `--soft-stagger` | 60ms |

Where a value already has a scale step, the component variable points at it instead of repeating the number: `--scale-duration`, `--ring-fill-duration`, `--sky-glow-duration`, `--sky-delay`, `--sky-duration`, `--step-duration`, `--step-marker-hold`, `--grain-rate`, `--grain-delay`, `--dawn-content-duration`, `--soft-card-delay` and `--entrance-reduced-duration` (`var(--duration-short-2)`, 120ms).

## Theme toggle hover

| Trigger | Property | Duration | Delay | Easing | From → to |
| --- | --- | --- | --- | --- | --- |
| Pointer over a segment | hover path `d` | 180ms (`--duration-short-6`) / 220ms (`--duration-short-7`) | 0 / 120ms (`--duration-short-2`) | ease-out cubic / quint | previous hover edge → hovered segment |
| Pointer over a segment | hover layer `opacity` | 150ms (`--duration-short-3`) | 0 | `ease-out` (`--ease-decelerate`) | 0 → 0.55 |
| Pointer leaves the track | hover layer `opacity` | 150ms (`--duration-short-3`) | 0 | `ease-out` (`--ease-decelerate`) | 0.55 → 0 |
| First segment entered | hover path | 0 | 0 | none | placed at the hovered segment, then faded in from 0 |
| Segment pressed | `scale` | 150ms (`--duration-short-3`) | 0 | `ease-out` (`--ease-decelerate`) | 1 → 0.96 |
| Segment hover | `color` | 150ms (`--duration-short-3`) | 0 | `ease-out` (`--ease-decelerate`) | `on-surface-variant` → `on-surface` |
| Segment or icon focused | tooltip `opacity` | 150ms (`--duration-short-3`) | 0 | `ease-out` (`--ease-decelerate`) | 0 → 1 |

Hover only applies on `(hover: hover) and (pointer: fine)`; the hover capsule is not shown on touch, where the row opens by tapping Day. Its motion is the same stretch & snap shape as the selection (see that section).

- `src/components/theme/theme-toggle.css:433` — hover layer opacity and 0.55
- `src/components/theme/theme-toggle.css:439` — hover-only visible state
- `src/components/theme/theme-toggle.tsx:70` — fine-pointer gate for the hover capsule
- `src/components/theme/theme-toggle.tsx:639` — pointer-over drives the hover path
- `src/components/theme/theme-toggle.tsx:407` — hover uses the same path runner
- `src/components/theme/theme-toggle.tsx:576` — `active:scale-[0.96]` and the 150ms (`--duration-short-3`) `ease-out` (`--ease-decelerate`) segment transition
- `src/components/theme/theme-toggle.css:310` — tooltip fade

## Theme change

Switching mode (or crossing a clock boundary in Auto/Day) replaces the colour tokens on `<html>`. That one change is animated as a **single crossfade of the whole page**: `src/lib/theme.ts` applies the write inside `document.startViewTransition()`, and the browser snapshots the page before and after it and blends the two images itself. Nothing animates a colour per element, so the horizon, the cards, the text, the nav, the toggle and the phase row are inside one image pair and start and finish together by construction — and the fade costs two captures instead of a full-page repaint on every frame.

| Trigger | Property | Duration | Delay | Easing | From → to |
| --- | --- | --- | --- | --- | --- |
| Mode click, phase change | whole-page snapshot `opacity` | 400ms (`--duration-long-1`) | 0 | `ease-in-out` (`--ease-standard`) | old snapshot 1 → 0 over the new one |
| Clock-driven change (Auto / Day) | whole-page snapshot `opacity` | 4000ms (`--duration-extra-long-1`) | 0 | `ease-in-out` (`--ease-standard`) | same |
| Reduced motion | whole-page snapshot `opacity` | 150ms (`--duration-short-3`) | 0 | `ease-in-out` (`--ease-standard`) | same |
| No View Transitions API | — | 0 | — | — | instant switch, one frame |
| Phase row opened by the same click | see "Day phase row entrance" | + crossfade duration | — | — | entrance waits for the crossfade |

Details that keep it one piece:

- **The page is a snapshot for the fade.** The live document is not painted (and stops receiving hit tests) for the crossfade, so anything that starts animating on the same click would play invisibly. The row's entrance therefore waits for the crossfade (`--phase-enter-delay`), and the two hover surfaces ignore the phantom pointer-leave it causes (`isPhaseSwitching()`), so the nav capsule and the row keep their state and recover on the next real pointer event.
- **No per-element colour transitions.** The old blanket rule (`:root[data-phase-switching] *`) and the twelve inherited `--horizon-*` / `--orb-*` token transitions were removed. Measured on the 1440x900 home page they cost 9-10ms of style recalc *per frame* and 8-11 dropped frames per switch; the crossfade measures 0.
- **The glow switches in the same frame as the snapshot.** The shader reads the tokens on the `data-phase` mutation, so it draws once with the new palette inside the rendering update that the browser snapshots — no late glow, no texture rebuild, no per-frame token read.
- **The painting frame's material is in the same snapshot.** The frame follows the phase (ornate gilt on Day/Dawn/Dusk, the walnut palette on that same gilt at Night) through phase tokens; it crossfades with the page and has no separate frame transition.
- **The selection capsule crossfades with the page** when the theme changes, instead of flying: a snapshot cannot contain live motion. It still runs the full stretch & snap on every selection change that is not a theme change (the Day phase row, and Day/Night/Auto when the theme is already that mode).
- `data-phase-switching` stays on `<html>` for the length of the crossfade and carries the kind (`click` / `auto`), which is what selects the duration in CSS.

- `src/lib/theme.ts:334` — the crossfade runner (snapshot, write, announce, settle)
- `src/lib/theme.ts:256` — `isPhaseSwitching()`, the "the page is a snapshot" predicate
- `src/app/globals.css:103` — `::view-transition-old(root)` fade and the 400ms (`--duration-long-1`) / auto tokens
- `src/app/globals.css:16` — why the tokens are no longer transitioned
- `src/components/theme/theme-toggle.css:49` — `--phase-enter-delay` holds the row entrance
- `src/components/horizon/horizon-shader.tsx:621` — one draw per token mutation
- `src/components/home/art-card/painting-frame.css` — the frame reads the phase material tokens; the swap is part of the same snapshot
- `src/components/home/nav-items.tsx:397` — hover kept through the crossfade

## Selection feedback

Selection is painted by the stretch highlight (next section); the segment itself no longer carries a fill in the default path, so a fast flip can never paint two selected segments. The incoming label still fades over 150ms (`--duration-short-3`) and is released on the same frame. A theme change is a page-wide crossfade (see "Theme change"), so it does not retime any of these rules.

| Trigger | Property | Duration | Delay | Easing | From → to |
| --- | --- | --- | --- | --- | --- |
| Selection enters, reduced motion | fill `background-color` | 120ms (`--duration-short-2`) | 0 | `ease-out` (`--ease-decelerate`) | transparent → `--toggle-selected` |
| Segment focused | tooltip `opacity` | 150ms (`--duration-short-3`) | 0 | `ease-out` (`--ease-decelerate`) | 0 → 1 |
| Segment blurred | tooltip `opacity` | 0 | 0 | — | 1 → 0 |
| Pointer enters a segment | tooltip `opacity` | 150ms (`--duration-short-3`) | 300ms (`--duration-medium-5`) | `ease-out` (`--ease-decelerate`) | 0 → 1 |
| Pointer enters a label in a warm group | tooltip `opacity` | 0 | 0 | — | 0 → 1, no fade |
| Pointer leaves a segment | tooltip `opacity` | 0 | 0 | — | 1 → 0 |

The fill row is the reduced-motion path only; the default highlight hides its layer and crossfades that fill in 120ms (`--duration-short-2`). The label fade is declared on `:focus-visible`/`:hover`, so losing the state removes the transition instead of starting the reverse one. The phase-row entrance stagger delays only `opacity`/`translate`; colour and scale are never delayed.

- `src/components/theme/theme-toggle.css:458` — reduced-motion fill crossfade (120ms (`--duration-short-2`))
- `src/components/theme/theme-toggle.css:306` — tooltip hidden by default
- `src/components/theme/theme-toggle.css:310` — focused label fade-in
- `src/components/theme/theme-toggle.css:316` — hovered label, 300ms (`--duration-medium-5`)
- `src/components/theme/theme-toggle.css:323` — released label, no transition

Once a label in the nav has opened, the group is warm: the next label opens on the frame the pointer reaches it, with no delay and no fade, and the group goes cold 300ms after the pointer leaves the nav. The first label still pays the 300ms, which is what keeps incidental travel from flashing labels across the bar.

- `src/components/nav/use-tooltip-warm.ts:6` — `TOOLTIP_WARM_MS = 300`
- `src/components/nav/use-tooltip-warm.ts:18` — the group's warm state
- `src/components/theme/theme-toggle.css:331` — warm segment labels drop the transition
- `src/components/home/nav-items.css:80` — warm glyph label drops the transition

## Selection highlight — stretch & snap

Both radiogroups (Day/Night/Auto and the Day phase row) paint the selection with one SVG capsule inside the track instead of a per-segment fill. On a change the leading edge leaves first; the trailing edge holds for the lag, so the capsule spans both segments and then contracts onto the target with no overshoot. The edges are retargeted from the shape's current position, so a fast flip never restarts from zero and a second selection mid-flight stays the only destination. The layer is exactly the track box, so nothing paints outside it.

| Trigger | Property | Duration | Delay | Easing | From → to |
| --- | --- | --- | --- | --- | --- |
| Selection moves, leading edge | highlight path `d` | 180ms (`--duration-short-6`) | 0 | ease-out cubic, `1-(1-t)^3` | current edge → destination edge |
| Selection moves, trailing edge | highlight path `d` | 220ms (`--duration-short-7`) | 120ms (`--duration-short-2`) | ease-out quint, `1-(1-t)^5` | current edge → destination edge |
| Selection moves (Day phase row) | same as above | 180ms (`--duration-short-6`) / 220ms (`--duration-short-7`) | 0 / 120ms (`--duration-short-2`) | same | current edge → destination edge |
| Hover moves between segments | hover path `d` | 180ms (`--duration-short-6`) / 220ms (`--duration-short-7`) | 0 / 120ms (`--duration-short-2`) | same | previous hover edge → hovered segment |
| Hover pill appears | hover layer `opacity` | 150ms (`--duration-short-3`) | 0 | `ease-out` (`--ease-decelerate`) | 0 → 0.55 |
| Hover pill leaves | hover layer `opacity` | 150ms (`--duration-short-3`) | 0 | `ease-out` (`--ease-decelerate`) | 0.55 → 0 |
| Selection enters, reduced motion | fill `background-color` | 120ms (`--duration-short-2`) | 0 | `ease-out` (`--ease-decelerate`) | transparent → `--toggle-selected` |

The timings are the shipped constants `LEADING_DURATION_MS = 180`, `TRAILING_DURATION_MS = 220` and `TRAILING_DELAY_MS = 120`; the rest silhouette is the Figma 34x28 pill at a 6px radius, 2px inside the track. Hover runs the same shape at the documented 0.55 weight and is gated to `(hover: hover) and (pointer: fine)`. Reduced motion hides the layer and keeps the 120ms (`--duration-short-2`) fill crossfade.

- `src/components/theme/theme-toggle.tsx:303` — `TRAILING_DELAY_MS = 120`
- `src/components/theme/theme-toggle.tsx:304` — `LEADING_DURATION_MS = 180`
- `src/components/theme/theme-toggle.tsx:305` — `TRAILING_DURATION_MS = 220`
- `src/components/theme/theme-toggle.tsx:311` — leading ease-out cubic
- `src/components/theme/theme-toggle.tsx:315` — trailing ease-out quint
- `src/components/theme/theme-toggle.tsx:324` — rest pill path (34x28, radius 6)
- `src/components/theme/theme-toggle.tsx:407` — the one-path runner and its rAF loop
- `src/components/theme/theme-toggle.css:414` — clipped track-sized highlight layer
- `src/components/theme/theme-toggle.css:433` — hover layer opacity and 0.55
- `src/components/theme/theme-toggle.css:458` — reduced-motion layer hide + fill crossfade

## Nav hover (Glide)

The home nav's three labels and the design-system glyph share one capsule instead of each carrying its own hover fill. The glyph is the fourth target of the same run — the capsule crosses the divider to it and back — and the run sits to the right of the orb head, which the capsule never reaches. The nav keeps the selection highlight's stretch & snap shape but not its implementation: it is a state-driven pair of springs (below), not the toggle's fixed-duration flight, because a pointer can retarget it faster than a flight can finish. The toggle's own 180 / 120 + 220 motion is unchanged.

The capsule is two edges, each its own damped spring (`src/components/home/glide-spring.ts`). A move only changes where the springs are heading, so both edges keep their current position **and** velocity: the pill can be redirected mid-flight the way a CSS transition retargets, instead of replaying a flight from a stored start. Nothing snaps while the pointer is inside the run, and `data-visible` (the "pointer is in the run" state) is never removed by a move.

| Trigger | Property | Duration | Delay | Easing | From → to |
| --- | --- | --- | --- | --- | --- |
| Hover moves, leading edge | capsule `clip-path` | ~185ms to rest | 0 | spring `k=1100`, `ζ=0.9` | current edge → target edge |
| Hover moves, trailing edge | capsule `clip-path` | ~205ms to rest | 100ms (`--duration-short-1`) from rest | spring `k=900`, `ζ=0.9` | current edge → target edge |
| Hover moves mid-flight | both edges | remaining spring travel | not re-armed | same springs, new target | current edge and velocity → new target edge |
| Reversing mid-flight | both edges | as above | 0 | same springs, roles swap | current edge and velocity → target edge |
| First item entered | capsule layer `opacity` | 150ms (`--duration-short-3`) | 0 | `ease-out` (`--ease-decelerate`) | 0 → 0.55, placed on the item with no travel |
| Pointer leaves the run | capsule layer `opacity` | 150ms (`--duration-short-3`) | 0 | `ease-out` (`--ease-decelerate`) | 0.55 → 0 |
| Move across `data-glide-break` | capsule layer `opacity` | 150ms (`--duration-short-3`) out, 150ms (`--duration-short-3`) in | 0 | `ease-out` (`--ease-decelerate`) | fades out where it is, re-places while blank, fades back in |
| Item hovered | item `color` | 150ms (`--duration-short-3`) | 0 | `ease-out` (`--ease-decelerate`) | `on-surface-variant` → `on-surface` |
| Item pressed | `scale` | 150ms (`--duration-short-3`) | 0 | `ease-out` (`--ease-decelerate`) | 1 → 0.96 |
| Glyph hovered | tooltip `opacity` | 150ms (`--duration-short-3`) | 300ms (`--duration-medium-5`) | `ease-out` (`--ease-decelerate`) | 0 → 1 |
| Glyph focused | tooltip `opacity` | 150ms (`--duration-short-3`) | 0 | `ease-out` (`--ease-decelerate`) | 0 → 1 |
| Hover enters, reduced motion | item fill `background-color` | 120ms (`--duration-short-2`) | 0 | `ease-out` (`--ease-decelerate`) | transparent → neutral hover fill at 55% |

Spring constants, from `glide-spring.ts`: `GLIDE_LEAD_SPRING = { stiffness: 1100, dampingRatio: 0.9 }`, `GLIDE_TRAIL_SPRING = { stiffness: 900, dampingRatio: 0.9 }`. The runner steps them by the frame's `dt`, clamped to `GLIDE_MAX_STEP_S = 1/30`, and treats an edge as at rest under `GLIDE_REST_PX = 0.4` and `GLIDE_REST_VELOCITY = 12` px/s, then stops the rAF loop. The step is the closed-form solution of the oscillator, so the path does not depend on how the interval is split.

The leading edge is whichever edge points the way the pill is travelling and gets the stiff spring; the trailing edge gets the soft one. A move from rest also holds the trailing edge for `TRAIL_HOLD_MS = 100` so the capsule stretches out of the old item before it closes. The hold is never re-armed by a retarget and is dropped when the direction reverses, so a fast sweep can never freeze the trail. Measured against the toggle's curve, a single move still peaks at the same width within a couple of pixels and settles by ~300ms.

`data-glide-break` cuts the run: the capsule never stretches across the divider, so a move across it sets `data-fading` (fade out in place), re-places while blank and fades back in. `data-visible` is not touched by that, so the trace still reads "in the run" throughout. A retarget during the fade only updates the pending destination — the timer is never restarted — so a sweep cannot leave the capsule hidden; a pointer that leaves during the fade cancels the re-place.

A frame writes one property: the capsule keeps the run's width and carries the pill as a `clip-path` inset, so the edges move independently while no width or other layout property changes. At rest the pill is the hovered item's box at the `--radius-md` token, filled with a neutral 5% mix of the ink into `--surface-container` (`color-mix(in oklab, var(--on-surface) 5%, var(--surface-container))`) and revealed at the original `0.55` weight. Hover is gated to `(hover: hover) and (pointer: fine)`, focus is a 2px `primary` ring on the item, and Work carries `aria-current="page"` on `/work` only (the home page keeps the plain resting style). Reduced motion hides the capsule: the hovered item carries the same fill at 55% alpha and crossfades it in 120ms (`--duration-short-2`) with no travel, so the state change survives without the movement.

- `src/components/home/glide-spring.ts:32` — lead spring `k=1100`, `ζ=0.9`
- `src/components/home/glide-spring.ts:43` — trail spring `k=900`, `ζ=0.9`
- `src/components/home/glide-spring.ts:52` — frame clamp `1/30`
- `src/components/home/glide-spring.ts:55` — rest thresholds
- `src/components/home/glide-spring.ts:82` — closed-form edge step (retarget keeps `v0`)
- `src/components/home/nav-items.tsx:40` — break fade, matched to the CSS 150ms (`--duration-short-3`)
- `src/components/home/nav-items.tsx:45` — `TRAIL_HOLD_MS = 100`
- `src/components/home/nav-items.tsx:90` — the one capsule runner shared by every item
- `src/components/home/nav-items.tsx:125` — `data-glide-break` detection
- `src/components/home/nav-items.tsx:162` — the only snap paths: entry and break re-place
- `src/components/home/nav-items.tsx:176` — per-frame spring step and `clip-path` write
- `src/components/home/nav-items.tsx:240` — break: fade out, re-place, fade in; timer never restarted
- `src/components/home/nav-items.tsx:266` — pointer left the run: fade out, keep the edges
- `src/components/home/nav-items.tsx:299` — real entry: place, no travel
- `src/components/home/nav-items.tsx:336` — direction, hold arming, reversal
- `src/components/home/nav-items.tsx:380` — the item run: labels, divider, glyph as the fourth target
- `src/components/home/nav-items.css:19` — press `scale: 0.96`, 150ms (`--duration-short-3`) `ease-out` (`--ease-decelerate`)
- `src/components/home/nav-items.css:33-49` — capsule fill: neutral 5% ink mix
- `src/components/home/nav-items.css:77` — hover reveal at the 0.55 weight
- `src/components/home/nav-items.css:81` — `data-fading` blanks the capsule for a break
- `src/components/home/nav-items.css:98` — glyph tooltip, 300ms (`--duration-medium-5`) delay
- `src/components/home/nav-items.css:165` — reduced-motion capsule hide
- `src/components/home/nav-items.css:170-178` — reduced-motion hover fill crossfade

## Nav orb gaze

The orb's two matte eyes look toward a fine pointer. The pair moves as one so the face keeps its spacing; each bar is still the 3.4 × 8 the Figma head ships. The eye container's `transform` is the home's own closed-form `glide-spring` oscillator, not Motion: the nav lives in the root layout, and PR #41 keeps Motion out of every route's first-load JS. The approved Motion tuning (k=340, c=26, m=0.6) converts to the unit-mass spring `ω² = 340/0.6`, `ζ = 26/(2√(340·0.6)) ≈ 0.91`, slightly underdamped, so a retarget keeps its velocity and the face never snaps. Travel is capped at 4.5 × 2.8px at the 36px size and scales with the head; the offset is the pointer direction times `min(distance / 60px, 1)`, so the eyes rest when the pointer is on the head and reach a full look at the tuned 60px reach. The dev harness at `/dev/proto/orb-eyes` exposes strength and reach; its 4× head uses the same component.

| Trigger | Property | Timing | Easing | From → to |
| --- | --- | --- | --- | --- |
| Fine pointer moves | eye-pair `transform` | closed-form spring `ω²=566.7`, `ζ=0.91` | spring | current offset → direction × `min(distance / 60, 1)` × 4.5 / 2.8px |
| Pointer on the head | same | same spring | spring | current → 0, 0 |
| Real pointer leave or window blur | same | same spring | spring | current → 0, 0 |
| Theme crossfade's synthetic leave | — | held | — | aim stays |
| Reduced motion or coarse pointer | — | no listener | — | held at 0, 0 |

The eyes are decorative (`aria-hidden`); the Home link keeps its name and 44px target. The effect is gated to `(hover: hover) and (pointer: fine)` and `prefers-reduced-motion: no-preference`, and both queries are watched live. A theme crossfade disables hit tests for its length and reports a `pointerleave`; `isPhaseSwitching()` distinguishes it from a real leave, the same guard `NavItems` uses for its hover state. Scroll and resize re-aim at the last pointer so the gaze stays attached when the head moves.

- `src/components/home/gaze-orb.tsx:32-46` — travel, 60px reach, converted spring
- `src/components/home/gaze-orb.tsx:88-150` — closed-form eye-pair spring and aim
- `src/components/home/gaze-orb.tsx:168-177` — theme-crossfade leave guard
- `src/components/home/gaze-orb.tsx:207-228` — fine-pointer / reduced-motion gates
- `src/components/home/gaze-orb.tsx:258-280` — the head and the moving eye pair
- `src/components/home/glide-spring.ts:82-140` — the shared closed-form spring step
- `src/components/home/home-nav.tsx:54` — the shipped nav mounts the gaze orb
- `src/components/home/gaze-orb.test.tsx` — aim, crossfade guard, reduced motion, coarse pointer, no Motion import
- `src/components/home/home-nav.test.tsx` — the fine-pointer integration test

## Home card hover ring

Every ring host (the home cards, the tracker widget, the carousel columns, the nav bar) is one surface: a frame, the glow inside it, and the fill. Growth animates the layers' layout `inset`, not a `clip-path` or a `transform`. At rest the fill is the Figma card box and the frame is one pixel larger and transparent. On hover or focus the fill grows to (grow − 1px) and the frame to grow, so the 1px edge keeps its width while the fill grows 2.5px x / 5px y into the gutters (`--ring-grow-x` 3.5px, `--ring-grow-y` 6px for the frame edge).

| Trigger | Property | Duration | Delay | Easing | From → to |
| --- | --- | --- | --- | --- | --- |
| Card hovered | surface `inset` + `border-radius` | 800ms (`--duration-long-3`, `--ring-grow`) | 0 | `cubic-bezier(0.165, 0.84, 0.44, 1)` (`--ease-spring-grow`) | `0` → `-(grow − 1px)`, radius 12 → 11 |
| Card hovered | frame `inset` | 800ms (`--duration-long-3`, `--ring-grow`) | 0 | `cubic-bezier(0.165, 0.84, 0.44, 1)` (`--ease-spring-grow`) | `-1px` → `-grow` |
| Card hovered | frame `opacity` | 100ms (`--duration-short-1`) | 0 | `linear` (`--ease-linear`) | 0 → 1 |
| Pointer leaves | surface + frame `inset` | 800ms (`--duration-long-3`, `--ring-grow`) | 0 | `cubic-bezier(0.165, 0.84, 0.44, 1)` (`--ease-spring-grow`) | back to rest |
| Pointer leaves | frame `opacity` | 100ms (`--duration-short-1`) | 0 | `linear` (`--ease-linear`) | 1 → 0 |
| Keyboard focus | same as hover | same | same | same | the focused card grows too |

Why `inset`: clip-path and transform edges are antialiased at fractional positions, so mid-grow the 1px ring straddled two device pixels (about 2px wide for most of the 800ms) and then settled to one crisp pixel when the animation ended. Layout edges are pixel-snapped and the frame and fill always differ by exactly 1px, so the ring is one pixel at every frame. Measured at DSF 1 on the nav bar, a carousel column and the featured card, day and night: two-pixel rows at 100ms to 400ms before, one pixel at every sample after.

Cost (headless Chromium trace of one 1440x900 hover, three runs): layout 0.7 to 1.1ms over 4 to 6 layouts (the transform version ran none); the featured card's `RasterTask` was 37 to 69ms over 124 to 168 tasks against 14 to 46ms over 48 to 57 for the transform version; the nav bar was about the same either way. Headless software rendering ran every frame near 150ms in both versions, so dropped frames could not be compared; check a real-GPU Chrome trace. The ring-follow glow variables (`ring-pointer.tsx`) still own the style recalc.

> **Note for performance audits (2026-11-21).** The extra layout and raster work is the price of a 1px edge that stays sharp, and was accepted on purpose. Do not switch the grow back to `transform: scale` or an animated `clip-path` to save paint: the 2026-11-16 perf pass (`7fcb219`) moved the featured card to `scale`, and that (plus the older clip-path grow on every other host) is what made the ring "light up, then thin" on hover. Fixed in PR #94. A cheaper approach is welcome only if it keeps the edge exactly 1 device pixel on every frame. Verify by sampling the top edge at 100/200/400/800ms in day and night, at DSF 1 and 2. Still open: a real-GPU Chrome trace to confirm no dropped frames.

Reduced motion is unchanged: the reduced path above reveals the ring inside the card with no growth.

- `src/components/home/ring-hover.css` — `.ring-frame`, `.ring-surface` rest geometry and the `inset` transitions; hover, focus and reduced-motion rules
- `src/components/home/home-cards.tsx` — `.ring-card` is now only a marker on the featured card
- `src/components/home/ring-pointer.tsx:6` — the glow's pointer-follow variables

## Day phase row entrance — "Stagger + icons"

The row is a 4-segment track (Clock · Dawn · Midday · Dusk) above the toggle on the homepage and below it in the drawer. It scales out of the toggle's nearest corner (bottom right when it sits above, top right when it hangs below), then the segments fade and rise left to right, then each icon settles 60ms after its own segment.

| Trigger | Property | Duration | Delay | Easing | From → to |
| --- | --- | --- | --- | --- | --- |
| Row opens | `opacity` | 400ms (`--duration-long-1`) | 0 | `cubic-bezier(0.23, 1, 0.32, 1)` (`--ease-emphasized-decelerate`) | 0 → 1 |
| Row opens | `transform` | 400ms (`--duration-long-1`) | 0 | `cubic-bezier(0.23, 1, 0.32, 1)` (`--ease-emphasized-decelerate`) | `scale(0.96)` → `none`, origin bottom right (top right in the drawer) |
| Row opens | `visibility` | 0 | 0 | — | hidden → visible |
| Row closes | `opacity` | 240ms (`--duration-medium-1`) | 0 | `ease-in` (`--ease-accelerate`) | 1 → 0 |
| Row closes | `transform` | 240ms (`--duration-medium-1`) | 0 | `ease-in` (`--ease-accelerate`) | `none` → `scale(0.96)` |
| Row closes | `visibility` | 0 | 240ms (`--duration-medium-1`) | — | visible → hidden after the fade |
| Segment 1 (Clock) | `opacity`, `translate` | 360ms (`--duration-medium-7`) | 120ms (`--duration-short-2`) | `cubic-bezier(0.23, 1, 0.32, 1)` (`--ease-emphasized-decelerate`) | 0 / `0 3px` → 1 / `0 0` |
| Segment 2 (Dawn) | `opacity`, `translate` | 360ms (`--duration-medium-7`) | 170ms (`--duration-short-5`) | `cubic-bezier(0.23, 1, 0.32, 1)` (`--ease-emphasized-decelerate`) | 0 / `0 3px` → 1 / `0 0` |
| Segment 3 (Midday) | `opacity`, `translate` | 360ms (`--duration-medium-7`) | 220ms (`--duration-short-7`) | `cubic-bezier(0.23, 1, 0.32, 1)` (`--ease-emphasized-decelerate`) | 0 / `0 3px` → 1 / `0 0` |
| Segment 4 (Dusk) | `opacity`, `translate` | 360ms (`--duration-medium-7`) | 270ms (`--duration-medium-3`) | `cubic-bezier(0.23, 1, 0.32, 1)` (`--ease-emphasized-decelerate`) | 0 / `0 3px` → 1 / `0 0` |
| Row closes | segment `opacity`, `translate` | 240ms (`--duration-medium-1`) | 0 | `ease-in` (`--ease-accelerate`) | 1 / `0 0` → 0 / `0 3px` |

The enter/exit durations are read from `--phase-row-exit-ms` so the component and the CSS cannot drift. While the row is open the nav is raised to `z-index: 2`, held through the 240ms (`--duration-medium-1`) exit.

- `src/components/theme/theme-toggle.css:25` — registered `--phase-row-exit-ms` (240)
- `src/components/theme/theme-toggle.css:36` — closed rest pose `scale(0.96)`, origin bottom right
- `src/components/nav/nav-dock.css:111` — the drawer's row hangs below, so it grows from its top corner
- `src/components/theme/theme-toggle.css:41` — `--phase-enter-delay`, raised to the crossfade duration during a theme change
- `src/components/theme/theme-toggle.css:55` — 400ms (`--duration-long-1`) enter transition, delayed by `--phase-enter-delay`
- `src/components/theme/theme-toggle.css:62` — 240ms (`--duration-medium-1`) `ease-in` (`--ease-accelerate`) exit, visibility delayed by the exit
- `src/components/theme/theme-toggle.css:72` — 360ms (`--duration-medium-7`) segment fade/rise
- `src/components/theme/theme-toggle.css:85` — stagger 120 / 170 / 220 / 270ms (`--duration-short-2` / `--duration-short-5` / `--duration-short-7` / `--duration-medium-3`)
- `src/components/theme/theme-toggle.css:99` — segment closed pose `0 3px`
- `src/components/theme/theme-toggle.css:9` — nav raise while open or exiting
- `src/components/theme/theme-toggle.tsx:23` — `PHASE_ROW_EXIT_MS = 240` fallback
- `src/components/theme/theme-toggle.tsx:550` — exit fallback timer, exit + 50ms

## Icon settle

Every phase icon arrives from an offset pose: the icon box grows from `scale(0.745)` while its rays, hands or sun swing or lift into place. The settle is 600ms (`--duration-long-2`) with a small overshoot.

| Glyph | Part | Pose it settles from |
| --- | --- | --- |
| `day` — Midday | rays | `rotate(-76.5deg)` |
| `day` — Midday | icon box | `scale(0.745)` |
| `auto` — Auto clock | hands | `rotate(-102deg)` |
| `auto` — Auto clock | icon box | `scale(0.745)` |
| `dayclock` — the row's Clock | rays and hands | `rotate(-76.5deg)` / `rotate(-102deg)` |
| Dawn | sun | `translateY(6.8px)` (rises from below the horizon) |
| Dawn | icon box | `scale(0.745)` |
| Dusk | sun and rays | `translateY(-6.8px)` (sinks from above the horizon) |
| Dusk | icon box | `scale(0.745)` |
| Night (moon) | icon box | `rotate(-40deg) scale(0.745)` (hover replay only) |

| Trigger | Property | Duration | Delay | Easing | From → to |
| --- | --- | --- | --- | --- | --- |
| Row opens, segment 1 | `transform` | 600ms (`--duration-long-2`) | 180ms (`--duration-short-6`) | `cubic-bezier(0.34, 1.3, 0.64, 1)` (`--ease-spring`) | pose → `none` |
| Row opens, segment 2 | `transform` | 600ms (`--duration-long-2`) | 230ms (`--duration-short-8`) | `cubic-bezier(0.34, 1.3, 0.64, 1)` (`--ease-spring`) | pose → `none` |
| Row opens, segment 3 | `transform` | 600ms (`--duration-long-2`) | 280ms (`--duration-medium-4`) | `cubic-bezier(0.34, 1.3, 0.64, 1)` (`--ease-spring`) | pose → `none` |
| Row opens, segment 4 | `transform` | 600ms (`--duration-long-2`) | 330ms (`--duration-medium-6`) | `cubic-bezier(0.34, 1.3, 0.64, 1)` (`--ease-spring`) | pose → `none` |
| Icon hovered (row already open) | `transform` | 600ms (`--duration-long-2`) | 0 | `cubic-bezier(0.34, 1.3, 0.64, 1)` (`--ease-spring`) | current or pose → `none`, plays once |

Icon delays are the segment delay + 60ms (120→180, 170→230, 220→280, 270→330). Hover replays the settle through the Web Animations API with `fill: none`, so it always ends at rest; if the animation is already mid-flight the current computed transform becomes the start. Hover is ignored while the row is still entering, and the entering flag is held for 990ms (330ms (`--duration-medium-6`) last delay + 600ms (`--duration-long-2`) settle + 60ms) so a hover cannot stack a second animation.

- `src/components/theme/theme-toggle.tsx:59` — settle duration 600ms (`--duration-long-2`) and `cubic-bezier(0.34, 1.3, 0.64, 1)` (`--ease-spring`)
- `src/components/theme/theme-toggle.tsx:61` — `scale(0.745)` pose
- `src/components/theme/theme-toggle.tsx:64` — hover poses per glyph, including Night `rotate(-40deg)`
- `src/components/theme/theme-toggle.tsx:94` — WAAPI `animate()` call, `fill: "none"`
- `src/components/theme/theme-toggle.tsx:358` — hover skip while entering or under reduced motion
- `src/components/theme/theme-toggle.tsx:20` — `ROW_ENTER_SETTLE_MS = 990`
- `src/components/theme/theme-toggle.css:97` — entrance poses only under `prefers-reduced-motion: no-preference`
- `src/components/theme/theme-toggle.css:101` — rays `rotate(-76.5deg)`
- `src/components/theme/theme-toggle.css:106` — hands `rotate(-102deg)`
- `src/components/theme/theme-toggle.css:111` — dawn sun `translateY(6.8px)`
- `src/components/theme/theme-toggle.css:124` — dusk sun and rays `translateY(-6.8px)`
- `src/components/theme/theme-toggle.css:129` — icon box `scale(0.745)`
- `src/components/theme/theme-toggle.css:158` — 600ms (`--duration-long-2`) settle transition, first segment
- `src/components/theme/theme-toggle.css:203` — 600ms (`--duration-long-2`) settle transition, last segment

## Row close

The row belongs to Day. It closes 100ms (`--duration-short-1`) after the pointer leaves the region formed by Day, the 4px gap bridge and the row itself, so travel between toggle and row never closes it.

| Trigger | Property | Duration | Delay | Easing | From → to |
| --- | --- | --- | --- | --- | --- |
| Pointer leaves Day + bridge + row | close timer | 100ms (`--duration-short-1`) | 0 | — | scheduled → row exit starts |
| Keyboard focus inside the row | close timer | — | — | — | cancelled while focus stays inside |
| Escape | row | — | — | — | closes immediately, focus returns to Day |
| Leaving Day mode | row | — | — | — | closes immediately, no linger |

- `src/components/theme/theme-toggle.tsx:17` — `PHASE_ROW_CLOSE_DELAY_MS = 100`
- `src/components/theme/theme-toggle.tsx:609` — the close timer
- `src/components/theme/theme-toggle.tsx:600` — keyboard focus holds the row open
- `src/components/theme/theme-toggle.tsx:890` — hover region enter/leave
- `src/components/theme/theme-toggle.tsx:1004` — the gap bridge that keeps the region continuous

## Work drawer — panel and backdrop

The intercepted reader is one fixed panel over the live homepage. On open it FLIPs out of the featured card, on close back into the card's live rect. Only `transform` and `opacity` animate; the panel keeps its final layout box the whole time, and the card → panel pose is measured once, before the first paint. A close that interrupts the open retargets from the current pose instead of restarting.

The drawer's open is the home carousel's step, read from its source (`carousel-settings.ts` / `easeSpec`) rather than written down: 900ms on `cubic-bezier(0.25, 0.8, 0.25, 1)`. The close is Stripe's dialog close, 300ms on CSS `ease` (`cubic-bezier(0.25, 0.1, 0.25, 1)`), for every part of it: the panel, the nav, the backdrop, the desktop shadow, and the content at ~86% of the run. Dat picked it on 2026-11-20 after an A/B on `proto/stripe-drawer` (the "timed" variant), over the carousel's 350ms interrupted-step run on `cubic-bezier(0.22, 1, 0.36, 1)`. Browser Back plays the same close on a cloned layer through the Navigation API; without the API (Firefox) Back has no reverse flight and the route simply changes, as before.

| Trigger | Property | Duration | Delay | Easing | From → to |
| --- | --- | --- | --- | --- | --- |
| Card opened | panel `transform` | 900ms | 0 | `cubic-bezier(0.25, 0.8, 0.25, 1)` | card rect → panel box (`translate` + `scale`, origin top left) |
| Study → study | panel, shadow, backdrop, nav | 0 | — | — | stay put; only the article swaps (see "Work drawer — study hand-off") |
| Reverse morph | panel `transform` | 300ms | 0 | `ease` (`0.25, 0.1, 0.25, 1`) | current pose → the card's live rect |
| Close with no card on screen | panel `opacity`, `scale` | 300ms | 0 | `ease` | 1 → 0, `scale(1)` → `scale(0.95)` about the visible centre |
| Opened or closed, reduced motion | panel `opacity` | 120ms | 0 | `ease-out` | 0 → 1 / 1 → 0, `transform: none` |
| Close interrupts the open | panel `transform` | 300ms | 0 | `ease` | retargeted from the live pose, never from zero |
| Resize mid-open | panel | — | — | — | completes the flight |
| Backdrop in | `opacity` | 320ms | 0 | `ease-out` | 0 → 1 (0.4 black; 0.62 in Night) |
| Backdrop out | `opacity` | 300ms | 0 | `ease` | 1 → 0 |
| Desktop shadow on close (768+) | panel `box-shadow` | 300ms | 0 | `ease` | panel elevation → the card's flat `--shadow-card` |
| Content out on close | scroll column `opacity` | 260ms (~86% of the close) | 0 | `ease` | 1 → 0, tracking the panel's own shrink |
| Backdrop / content, reduced motion | `opacity` | 120ms | 0 | `ease-out` | 0 → 1 / 1 → 0 |

The close's frame-stall cap follows the flight: a Back ghost is removed at `DRAWER_CLOSE_S × 1000 + 260` = 560ms at the latest, and the in-page close waits at most the flight's own 300ms (`landWithin`) before it settles closed. No timer reopens the drawer.

- `src/components/work/carousel-step.ts:23` — `CAROUSEL_OPEN_S` = `DEFAULT_SETTINGS.duration / 1000` (900ms)
- `src/components/work/carousel-step.ts:24` — `CAROUSEL_EASE`, parsed from `easeSpec` (`0.25, 0.8, 0.25, 1`)
- `src/components/work/carousel-step.ts:35` — `DRAWER_CLOSE_S = 0.3`
- `src/components/work/carousel-step.ts:36` — `DRAWER_CLOSE_EASE` = CSS `ease` (`0.25, 0.1, 0.25, 1`)
- `src/components/work/use-morph.ts:100` — the drawer's one open/close timing pair, handed to the panel and the nav
- `src/components/work/use-morph.ts:113` — `CLOSE_CAP_MS`, the Back ghost's stall cap
- `src/components/work/use-morph.ts:473` — the open flight, transform only
- `src/components/work/use-morph.ts:921` — the reverse pose into the card's live rect
- `src/components/work/use-morph.ts:931` — the no-card close, `scale(0.95)` + fade
- `src/components/work/use-morph.ts:716` — browser Back's cloned-layer exit, on the same timing
- `src/components/work/use-morph.ts:86` — 120ms opacity path (`FADE_S`)
- `src/components/work/drawer-shell.css:24` — backdrop in 320ms `ease-out`
- `src/components/work/drawer-shell.css:25` — backdrop out 300ms `ease`
- `src/components/work/drawer-shell.css:26` — content out 260ms `ease`
- `src/components/work/drawer-shell.css:27` — reduced-motion 120ms `ease-out`
- `src/components/work/drawer-shell.css:82` — desktop shadow crossfade, 300ms `ease`

## Work drawer — nav dock

The one nav lives in the root layout and never remounts, so opening a study FLIPs it from the home slot to the panel's top row on the panel's own curve. Home is CSS geometry (1200px frame, 1136px bar, `max(pad + offset, 50dvh + offset/2 - 2rem)` with offsets 716px at 1280, 604 at 1024, 804 at 768 and 824 below), corrected at runtime against `[data-nav-slot]` when it drifts by more than 0.5px. The reader position is `--wd-panel-inset + --wd-nav-inset`: 44px from the viewport top at 768 and up, 16px below.

| Trigger | Property | Duration | Delay | Easing | From → to |
| --- | --- | --- | --- | --- | --- |
| Study opened | dock `transform` | 900ms | 0 | `cubic-bezier(0.25, 0.8, 0.25, 1)` | home top → reader top (`translateY` of the measured delta) |
| Study closed | dock `transform` | 300ms | 0 | `ease` (`0.25, 0.1, 0.25, 1`), locked to the panel | reader top → home top |
| Reduced motion, or no card | dock `opacity` | 60ms out + 60ms in | 0 | `ease-out` | 1 → 0 → 1, no transform |
| Study → study | dock | 0 | 0 | — | stays at the reader position |
| Resize mid-flight | dock | — | — | — | lands the move |
| Home rest, drifted | dock `top` | 0 | — | — | slot top when the CSS is off by > 0.5px |
| Restore with no drawer | dock `transform` | 480ms open / 300ms close | 0 | `cubic-bezier(0.32, 0.72, 0, 1)` / `ease-in` | its own default, for the moves no panel drives (see `morph.ts`) |

- `src/components/nav/nav-dock.tsx:144` — the timing the drawer hands over, used for every drawer flight
- `src/components/nav/nav-dock.tsx:29` — 60ms half of the reduced-motion crossfade
- `src/components/nav/nav-dock.tsx:109` — the `translateY` flight, measured from the live rect
- `src/components/nav/nav-dock.tsx:119` — resize lands the flight
- `src/components/nav/nav-dock.tsx:163` — 0.5px slot-drift correction
- `src/components/work/morph.ts:16` — the nav's own default, used only with no drawer behind it
- `src/components/nav/nav-dock.css:15` — home geometry
- `src/components/nav/nav-dock.css:59` — reader top `panel inset + nav inset`

## Work drawer — content cascade

The cascade is a handoff from the panel, not a second entrance: it is released at the reveal, 600ms into the 900ms open (300ms before the panel lands). Cover first, then the header, then the body, on one even 80ms beat. The move and the defocus share the drawer's curve and duration; the defocus strength is one token, `--wd-defocus-blur` (10px).

| Block | Starts at | Opacity + 10px rise | Defocus |
| --- | --- | --- | --- |
| Cover | 0ms | 900ms `cubic-bezier(0.25, 0.8, 0.25, 1)` | none |
| Title | 80ms | same | 900ms, same curve, `blur(10px)` → none |
| Subtitle | 160ms | same | same |
| Meta | 240ms | same | same |
| p1 | 320ms | same | same |
| p2 | 400ms | same | same |
| p3 and below | 480ms | same | same |

Every block holds its start state (`backwards` fill), so nothing paints at its end state before its beat. The cover carries no filter (blur on the large media was the one measured cost). The keyframes are unchanged from the 800ms version: only the duration and the curve moved, so the cascade still resolves to `filter: none`.

- `src/components/work/entrance.css:47` — `--wd-enter-ease` and `--wd-enter-blur-ease`, the drawer's curve for both
- `src/components/work/entrance.css:49` — 900ms for both
- `src/components/work/entrance.css:54` — `--wd-defocus-blur: 10px`
- `src/components/work/entrance.css:81` — `blur(var(--wd-defocus-blur))` start
- `src/components/work/entrance.css:95` — two animations, fade then defocus
- `src/components/work/entrance.css:103` — both ride the block's beat, no head start
- `src/components/work/entrance.css:117` — 80ms beat, title
- `src/components/work/entrance.css:137` — 480ms, p3 and below
- `src/components/work/use-morph.ts:61` — `REVEAL_LEAD_S = 0.3`, the release 300ms before the panel lands
- `src/components/work/use-morph.ts:323` — the reveal timer: `CAROUSEL_OPEN_S − REVEAL_LEAD_S` (900 − 300)
- `src/components/work/use-morph.ts:276` — a study hand-off joins this cascade from its first frame

## Nav motion blur

Approved in PR #68. A vertical-only blur on the nav dock while it flies between the homepage row and the drawer's row, on drawer enter and exit. It is a layer on top of the flight: timing, easing, distance and resting position are untouched, and the filter is removed at rest.

| Item | Value |
| --- | --- |
| Peak | `PEAK_PX = 4` (`stdDeviation` `0 <px>`, Y only) |
| Strength | `4 × min(1, speed / REFERENCE_SPEED)`, clamped to `4px` at and above the reference speed |
| `REFERENCE_SPEED` | `22` px per 60Hz frame, the nav's speed at half the drawer's travel |
| Speed | the dock's live vertical velocity from `getBoundingClientRect().top` each frame, normalised to 60Hz so 120Hz screens match |
| Off | reduced motion; WebKit (including every iOS browser); the filter is cleared when the flight settles, on unmount, or `250ms` after the handed duration |

- `src/components/nav/nav-motion-blur.tsx` — `PEAK_PX`, `REFERENCE_SPEED`, the per-frame loop

## Work reader — scroll ruler

The ruler is chrome beside the article, not part of it: it is a sibling of the scroll column, so the column's own entrance and close fades never covered it. It joins the content cascade instead of riding the phase law: held invisible while the content is pending, then the cascade's next beat, blurred at 8px and resolving as the last paragraph does.

| Trigger | Property | Duration | Delay | Easing | From → to |
| --- | --- | --- | --- | --- | --- |
| Content released (`reveal`) | ruler `opacity`, `filter` | 900ms | 560ms | `cubic-bezier(0.25, 0.8, 0.25, 1)` | 0 / `blur(8px)` → 1 / `none` |
| Close starts (`closing`) | ruler `opacity`, `filter` | 160ms | 0 | `ease-out` | 1 / `none` → 0 / `blur(8px)` |
| Reveal / closing, reduced motion | `opacity` only | 120ms | 0 | `ease-out` | the same states, `filter: none` |

The strength is its own token, `--wd-ruler-blur: 8px`: Dat chose a strength that visibly smears the ticks at the start, and the article's 10px is for paragraphs. At rest the rule is `filter: none`, not `blur(0)`, so no filtered layer stays promoted — `none` interpolates from the blur as the identity, so the intro still melts. Nothing clips the bleed: the ruler, its frame and the layer are `overflow: visible` with no `contain`, and the fit measure keeps the column 161px clear of the panel's clipped edge at 1280.

The 560ms is `calc(480ms + 80ms)`: the last block's beat plus the same 80ms step, so the ruler is the next beat after the content rather than a fade of its own.

Two implementation notes, both measured, both about the frame that starts a fade:

- The reveal change is also the frame that starts the ruler's transitions, so nothing may hold it. The `data-phase` MutationObserver therefore measures on the **next** frame rather than in the mutation's own (a forced layout there held the landing frame ~210ms); the geometry from the mid-morph measure is already right, so the correction is sub-pixel.
- For the same reason the ruler's measure **skips itself while the phase is `closing`**: the content entrance's last blocks are still ending when a close begins, each bubbling `animationend` re-measured, and that forced layout held the fade's first frame (~110ms of a 160ms exit). The next open remounts the reader and measures afresh.

- `src/components/work/reader.css:292` — `--wd-ruler-blur: 8px`, the ticks' own defocus strength
- `src/components/work/reader.css:295` — `--wd-ruler-enter-delay: calc(480ms + 80ms)`
- `src/components/work/reader.css:328` — held: transparent and blurred while `pending` or `closing`
- `src/components/work/reader.css:343` — the cascade's next beat: 900ms on the content's curve, settling to `filter: none`
- `src/components/work/reader.css:352` — closing: the 160ms blur-fade
- `src/components/work/reader.css:406` — reduced motion: `filter: none`, opacity only, no delay
- `src/components/work/entrance.css:49` — `--wd-enter-duration: 900ms`, the beat it shares with the content
- `src/components/work/scroll-ruler.tsx:313` — the close-time measure skip
- `src/components/work/scroll-ruler.tsx:548` — the phase measure, deferred one frame

## Work reader — ruler indicator snap

The scroll ruler's bright mark is not a progress bar. It holds a section's tick for as long as that section is being read and snaps to the next one when that heading crosses the reader's 124px landing line. The snap is the theme toggle's stretch & snap, turned upright: same curves, same lag, same retarget rule, no new tokens.

| Trigger | Property | Duration | Delay | Easing | From → to |
| --- | --- | --- | --- | --- | --- |
| A heading crosses the landing line | mark leading edge `translateY` | 180ms (`--duration-short-6`) | 0 | ease-out cubic, `1-(1-t)^3` | current edge → the new tick's edge |
| A heading crosses the landing line | mark trailing edge `translateY` | 220ms (`--duration-short-7`) | 120ms (`--duration-short-2`) | ease-out quint, `1-(1-t)^5` | current edge → the new tick's edge |
| A fling crosses several sections | both edges | as above | not re-armed | same curves | current edges → the latest target, once |
| A tick is clicked | both edges | as above | as above | same curves | current edges → the clicked tick, no stepping through the sections between |
| Reduced motion | — | 0 | 0 | — | placed on the target tick in one write |

The mark is one element: its top edge is a `translateY` and its height a `scaleY` from `transform-origin: top center`, so a move is one transform per frame and never a layout change. Both edges are captured from the bar's current position when a new target arrives, so a second crossing mid-flight retargets it instead of restarting from the old tick. Scrolling only sets the section index in React — one render per crossing, never per frame — and the flight is a `requestAnimationFrame` loop that writes the node directly. Above the first crossing the mark rests on the first tick; at the very bottom it takes the last section, whose heading may never reach the line.

- `src/components/work/scroll-ruler.tsx:140` — the mark's two edges (`edgesFor`)
- `src/components/work/scroll-ruler.tsx:168` — the flight: curves, lag, retarget from the live edges
- `src/components/work/ruler-model.ts:169` — `activeTick`, the crossing rule
- `src/components/theme/theme-toggle.tsx:299` — the constants and both eases it reuses

## Work drawer — study hand-off

"Next project" swaps the article, not the drawer. The outgoing article leaves on the reader's own 140ms `ease-in` fade and the route moves after it; the incoming mount joins the open drawer instead of rebuilding it. The panel, its shadow/elevation, the backdrop and the nav stay put — no FLIP, no close, no nav flight — and only the content changes: the scroll resets to the top and the article plays the drawer's own open cascade from its first frame (see "Work drawer — content cascade"). Back and Forward play the same swap for the same reason.

| Trigger | Property | Duration | Delay | Easing | From → to |
| --- | --- | --- | --- | --- | --- |
| Next project | outgoing scroll column `opacity` | 140ms | 0 | `ease-in` | 1 → 0, held to the last frame |
| Next project | route | — | after the fade | — | push to `/work/<slug>`, with the entry's depth |
| Incoming study | panel, shadow, backdrop, nav | 0 | — | — | stay exactly where they are |
| Incoming study | content cascade | 900ms | 0 | `cubic-bezier(0.25, 0.8, 0.25, 1)` | the open's cover → title → meta → body cascade, same 80ms beats and 10px defocus |
| Incoming study | scroll column `opacity` | 0 | — | — | held at 0 for the `pending` frame, then 1 while the cascade runs |
| Incoming study | ruler `opacity`, `filter` | 900ms | 560ms | `cubic-bezier(0.25, 0.8, 0.25, 1)` | 0 / `blur(8px)` → 1 / `none`, the next beat after the last block |
| Back / Forward | route | — | — | — | the previous study, through the same swap |
| Close after a swap | panel `transform`, nav `transform` | 300ms | 0 | `ease` (`0.25, 0.1, 0.25, 1`) | the study on screen's card, or the drawer's origin card |
| Reduced motion | scroll column + ruler `opacity` | 120ms | 0 | `ease-out` | one opacity pass, `filter: none`, no transform |

The hand-off is a module flag, not the tree: the flag is set while any drawer is mounted, so the incoming mount knows it is the same drawer even when the route change was the browser's (Back/Forward). "Next project" also announces itself, because its click is where the incoming entry learns its history depth. Next keys the intercepted page by its slug, so the reader remounts either way; nothing else about the drawer does.

- The release waits two frames. The first paints `data-reveal="pending"`, which is also the ruler's `opacity: 0 / blur(8px)` state; the second sets `data-reveal="on"` and the cascade starts. With one frame the mount and the release collapse into the same rendering update, the ruler has no before-change style to transition from, and it snaps in at full strength instead of taking its beat.
- Each swap pushes its own entry carrying `workDepth`. Close goes back `depth + 1` entries in one step, so it lands on the homepage instead of reopening the previous study; Back returns to that study and replays this same swap.
- Close picks the study on screen's card first and the drawer's origin second. A study reached by "Next project" usually has no card on the homepage (the carousel renders the current step), which is the origin-card fallback; a study that does have one closes into its own.
- The backdrop never replays: `data-handoff` pins it at opacity 1 for the swap, so the layer mounting does not re-run its 320ms entrance under the panel's edge.
- Reduced motion drops the fade-out wait and the cascade. The incoming column and ruler take one 120ms `ease-out` opacity pass with `filter: none`, so the swap is still a state change, not a movement.

- `src/components/work/progression.ts:19` — `PROGRESSION_EXIT_MS = 140`
- `src/components/work/progression.ts:44` — the drawer-session flag shared across the remount
- `src/components/work/progression.ts:91` — the 140ms fade, then the route
- `src/components/work/progression.ts:107` — the same fade for Back/Forward
- `src/components/work/use-morph.ts:158` — the incoming mount reads the flag / announcement once
- `src/components/work/use-morph.ts:276` — the hand-off branch: no FLIP, two-frame release
- `src/components/work/use-morph.ts:387` — close: current study's card, then the origin
- `src/components/work/use-morph.ts:456` — close: `depth + 1` entries back to the homepage
- `src/components/work/expand-shell.tsx:55` — the flag is set for the session and cleared when the route leaves `/work/`
- `src/components/work/expand-shell.tsx:114` — `data-handoff` on the layer
- `src/components/work/expand-shell.css:94` — the backdrop held at 1 for the swap
- `src/components/work/parts.tsx:365` — the click announces, then pushes with the depth
- `src/components/work/entrance.css:103` — the cascade with no head start (900ms, the open's beat)
- `src/components/work/reader.css:295` — `--wd-ruler-enter-delay: calc(480ms + 80ms)`, the 560ms beat

## Work drawer — geometry and popover sides

One set of root tokens positions the drawer, so the nav, the blur zone, the reading column, the shared back row and the rail cannot drift apart. The drawer's nav sits 44px from the viewport top at 768 and up (16px below) and the study starts 32px under it (24px below 768).

| Token | Below 768 | 768 and up | Read by |
| --- | --- | --- | --- |
| `--wd-panel-inset` | 0px | 16px | panel inset, nav top |
| `--wd-nav-inset` | 16px | 28px | nav top, blur height, back row top padding |
| `--wd-nav-height` | 4rem | 4rem | nav box, blur height, back row top padding |
| `--wd-nav-content-gap` | 24px | 32px | back row top padding; the index column's top padding |
| `--wd-phase-row-gap` | 4px | 4px | the picker row's side offset |

The Day phase row opens above the toggle on the homepage and below it in the drawer, always at `--wd-phase-row-gap`. Each track's labels point away from the other track: home has the row above, so the toggle's labels go below and the row's go above; the reader has the row below, so the toggle's labels go above and the row's go below. The glyph's label keeps the reader's downward side.

- `src/app/globals.css:258` — the token block
- `src/app/globals.css:267` — the 768 overrides
- `src/components/work/reader.css:30` — the shared back row's top padding
- `src/components/work/reader.css:46` — the reading column, now without the nav clearance
- `src/components/work/work-index.css:23` — the index column's top padding
- `src/components/nav/nav-dock.css:72` — home label side
- `src/components/nav/nav-dock.css:77` — reader label side
- `src/components/nav/nav-dock.css:103` — the reader's picker row, 4px below the toggle

## Work drawer — blur stack and reduced motion

The progressive blur over the reader's top edge is six static `backdrop-filter` bands (1, 2, 4, 8, 16, 32px) sharing the nav's box; nothing in it animates, only the content moves under it. `prefers-reduced-transparency` or no `backdrop-filter` support replaces the bands with one solid gradient from the panel surface.

| Path | Behaviour |
| --- | --- |
| Open | panel opacity 120ms `ease-out`, no transform; nav crossfades over 2 × 60ms; backdrop 120ms |
| Cascade | `animation: none` on the cover and every text block; the scroll column is one 120ms opacity pass |
| Hand-off | no fade-out wait and no cascade; the incoming column and ruler take one 120ms `ease-out` opacity pass, `filter: none` |
| Content out | 260ms `ease`, ~86% of the 300ms close, 120ms `ease-out` reduced |
| Reach-to-top pair, rail | 120ms `ease-out`, visibility steps with the fade |
| Picker row | existing rows: opacity only 120ms, no scale, no icon settle |
| Ruler indicator | placed on the target tick in one write, no flight |

- `src/components/work/blur-stack.tsx:4` — six bands
- `src/components/work/blur-stack.css:96` — reduced-transparency / no-support fallback
- `src/components/work/entrance.css:171` — reduced-motion `animation: none`
- `src/components/work/entrance.css:184` — the hand-off column's one 120ms opacity pass
- `src/components/work/reader.css:331` — reach-to-top reduced path

## Reduced motion

The theme change keeps its crossfade — a colour change is not motion — but at 150ms (`--duration-short-3`) instead of 400ms (`--duration-long-1`). Everything else drops movement: one opacity fade for the whole row, no scale, no segment rise, no icon settle, no press scale.

| Element | Behaviour |
| --- | --- |
| Theme change | same whole-page crossfade, 150ms (`--duration-short-3`) `ease-in-out` (`--horizon-transition-duration`) |
| Row | opacity only, 120ms (`--duration-short-2`) `ease-out` (`--ease-decelerate`); `transform: none`; visibility delayed by the same 120ms (`--duration-short-2`) |
| Selection highlight | layer hidden; the segment fill crossfades over 120ms (`--duration-short-2`) and the label colour over 150ms (`--duration-short-3`) |
| Segments | no opacity or translate animation; colour always transitions over 150ms (`--duration-short-3`) |
| Icons | stay at rest; entrance poses and settles are inside `prefers-reduced-motion: no-preference` |
| Hover capsule | hidden; the segment fill is the only hover feedback, following the pointer without travel |
| Nav hover capsule | hidden; the hovered nav item carries the neutral hover fill at 55% over 120ms (`--duration-short-2`), no travel |
| Press | `scale: 1` (no 0.96 dip) |
| Frame-line spotlight | mask replaced by a whole-line opacity fade capped at 0.4 strength, 150ms (`--duration-short-3`) |

- `src/components/theme/theme-toggle.css:458` — reduced-motion highlight hide + 120ms (`--duration-short-2`) fill
- `src/components/theme/theme-toggle.css:358` — reduced-motion row/segment block
- `src/components/theme/theme-toggle.css:362` — `--phase-row-exit-ms: 120`
- `src/components/theme/theme-toggle.css:366` — 120ms (`--duration-short-2`) opacity-only enter
- `src/components/theme/theme-toggle.tsx:677` — settle skipped under reduced motion
- `src/components/home/frame-line-spotlight.tsx:207` — reduced spotlight path
- `src/components/home/frame-line-spotlight.css:39` — 150ms (`--duration-short-3`) reduced fade

## Frame lines and spotlight

The four 1px page frame lines share one rest colour across all four phases: `#d4dce4`, written as `oklch(89% 0.0138 247.97)`. Hover spotlights keep each light phase's accent hue at full strength; Night uses its `primary` at 0.85.

| Phase | Rest line | Spotlight accent | Opacity |
| --- | --- | --- | --- |
| Dawn | `#d4dce4` | `oklch(64% 0.147 309.23)` ≈ `#a670cf` | 1 |
| Midday | `#d4dce4` | `oklch(64% 0.147 251.74)` ≈ `#3f8fe2` | 1 |
| Dusk | `#d4dce4` | `oklch(64% 0.146 63.06)` ≈ `#c97500` | 1 |
| Night | `rgb(255 255 255 / 0.08)` | `var(--primary)` | 0.85 |

| Trigger | Property | Duration | Delay | Easing | From → to |
| --- | --- | --- | --- | --- | --- |
| Pointer moves near a line | spotlight mask and `--frame-spot-light` | per frame | 0 | `smoothstep` proximity, 80px catchment, 400px pool | 0 → sampled light |
| Light value changes | glow `opacity` | 160ms (`--duration-short-4`) | 0 | `cubic-bezier(0.32, 0.72, 0, 1)` (`--ease-emphasized-standard`) | previous → sampled |

- `src/app/globals.css:294` — Midday `--frame-line`
- `src/app/globals.css:365` — Dawn `--frame-line`
- `src/app/globals.css:435` — Dusk `--frame-line`
- `src/app/globals.css:298` — Midday spotlight accent
- `src/app/globals.css:368` — Dawn spotlight accent
- `src/app/globals.css:438` — Dusk spotlight accent
- `src/app/globals.css:508` — Night spotlight `var(--primary)` at 0.85
- `src/components/home/frame-line-spotlight.css:36` — 160ms (`--duration-short-4`) opacity transition
- `src/components/home/frame-line-spotlight.tsx:18` — proximity, pool radius and falloff constants

## Glyph clipping

Dawn and Dusk carry permanent `clipPath`s so the sun is masked by the horizon instead of drawn over it. The clips are static: they never animate, which is why the sun can rise or sink inside them.

| Glyph | Clip rect | Effect |
| --- | --- | --- |
| Dawn | `x 0 y 0 w 16 h 13` | hides the sun below the horizon while it rises; clears the 1.4px horizon stroke at y 11.3–12.7 |
| Dusk | `x 0 y 9.6 w 16 h 6.4` | hides the sun above the horizon while it sinks; clears the horizon stroke at y 9.8–11.2 |

- `src/components/theme/theme-toggle.tsx:173` — dawn clipPath
- `src/components/theme/theme-toggle.tsx:194` — dusk clipPath
- `src/components/theme/theme-toggle.tsx:134` — per-instance clip id from `useId`

## Home page entrance — Soft focus

Everything on `/` arrives together: a theme-tinted veil clears while each card rises 7px, unblurs from 8px and fades in, 60ms (`--soft-stagger`) apart from the bottom up, and the horizon glow softens on the same clock. The layout itself never blurs — there is no full-viewport `backdrop-filter` — because that averaged cards, gutters and shadows into blotches at 8px (measured on the prototype: the blur dropped the glow's dither energy 15x while the 1–24px residual only fell from 4.19 to 1.08 at 8px versus 2.05 at 4px, and the amplified residual was card edges, not noise).

| Element | Property | Duration | Delay | Easing | From → to |
| --- | --- | --- | --- | --- | --- |
| Veil (`.entrance-soft`) | `opacity` | 1400ms (`--soft-duration`) | 0 | `cubic-bezier(0.4, 0, 0.2, 1)` (`--ease-calm`) | 1 → 0, then `visibility: hidden` |
| Card (nav, item 7) | `opacity`, `translate`, `filter` | 1100ms (`--soft-card-duration`) | 250ms (`--soft-card-delay`) | `cubic-bezier(0.4, 0, 0.2, 1)` (`--ease-calm`) | 0 / `0 7px` / `blur(8px)` → 1 / `0 0` / `blur(0)` |
| Card (project, item 3) | same | 1100ms (`--soft-card-duration`) | 310ms | same | same |
| Card (sliver 1, item 4) | same | 1100ms (`--soft-card-duration`) | 370ms | same | same |
| Card (sliver 2, item 5) | same | 1100ms (`--soft-card-duration`) | 430ms | same | same |
| Card (sliver 3, item 6) | same | 1100ms (`--soft-card-duration`) | 490ms | same | same |
| Card (tracker, item 1) | same | 1100ms (`--soft-card-duration`) | 550ms | same | same |
| Card (play, item 2) | same | 1100ms (`--soft-card-duration`) | 610ms | same | same |
| Glow, CSS fallback | `filter` on `.horizon-motion-layer` | 1400ms (`--soft-duration`) | 0 | same | `blur(8px)` → `blur(0)`; its grain sibling stays sharp |
| Glow, WebGL | `uSoftUv` uniform (four-tap coverage box, dither applied after) | 1400ms (`--soft-duration`) | 0 | same | 8px radius → 0, then pinned at 0 |
| A return to `/` | the same rules | — | — | — | cancelled once `html[data-entrance-played]` is set: a client-side return does not replay, a hard load does |

Per-card delays are `250ms + index × 60ms` (`--soft-card-delay` + index × `--soft-stagger`) in horizon order (nav 0 at the bottom, then the project card, the three slivers, and the top band left to right), so the lowest card arrives first and the last lands at 1710ms. The 310–610ms delays in the table are that sum computed in CSS, so they have no single token; the two base steps do. The start pose is in the server markup and the CSS with `backwards` fill: no JS gate, no sharp-to-blurred pop, and the content rests visible if the animation never runs.

| Reduced motion | Behaviour |
| --- | --- |
| Cards | one 120ms (`--entrance-reduced-duration`) `ease-out` (`--ease-decelerate`) opacity fade, no rise, no blur |
| Veil | `display: none` |
| Glow | no softness animation, no filter; the light is simply there |

The cost stays on the compositor: `opacity`, `translate` and `filter` per card, plus two 1400ms (`--soft-duration`) tracks for the veil and the glow, and nothing left behind — `filter: none` and `--soft-softness: 0px` once it ends (verified in computed styles). The shader reads `--soft-softness` once when the animation starts and then runs the value on its own clock, so no computed style is read per frame after the entrance.

- `src/components/home/home-entrance.css:37` — veil layer, rest state hidden
- `src/components/home/home-entrance.css:138` — `--soft-blur: 8px`
- `src/components/home/home-entrance.css:141` — `--soft-card-delay: var(--duration-medium-2)` (250ms)
- `src/components/home/home-entrance.css:144` — `--soft-stagger: 60ms`
- `src/components/home/home-entrance.css:151` — the Calm curve, scoped to the shipped entrance
- `src/components/home/home-entrance.css:214` — card animation and the `250 + --entrance-h * 60` delay (`--soft-card-delay` + n × `--soft-stagger`)
- `src/components/home/home-entrance.css:235` — `entrance-soft-card-split` keyframes (7px rise, 8px → 0 blur)
- `src/components/home/home-entrance.css:263` — CSS fallback glow blur
- `src/components/home/home-entrance.css:273` — registered `--soft-softness` and its animation
- `src/components/home/home-entrance.css:303` — reduced-motion branch
- `src/components/home/home-entrance.css:327` — the one-play-per-document gate
- `src/components/home/home-entrance.tsx:10` — `SHIPPED_ENTRANCE_TOTAL_MS = 1710`
- `src/components/home/home-entrance.tsx:27` — marks `html[data-entrance-played]` after the settle
- `src/components/home/home-layout.tsx:137` — the veil node (server-rendered)
- `src/components/horizon/horizon-shader.tsx:353` — reads the radius once (`readSoftRadius`)
- `src/components/horizon/horizon-shader.tsx:872` — starts the shader's own softness clock
- `src/components/horizon/horizon-shader.tsx:139` — the four-tap coverage box, dither applied after

## Work drawer — shipped entry, swap and close (2026-11-19)

The drawer is one surface for `/work` and every `/work/<slug>`: it opens from the nav's Work capsule on the index and from the clicked homepage card on a study, and it never remounts between entries. The open is the home carousel's step, read from its own source (`carousel-step.ts`) rather than copied: 900ms on `cubic-bezier(0.25, 0.8, 0.25, 1)`. The panel keeps its final layout box the whole time and only `transform`/`opacity` animate; a close that interrupts the open retargets from the current pose.

| Trigger | Property | Duration | Delay | Easing | From → to |
| --- | --- | --- | --- | --- | --- |
| Index opened (nav Work) | panel `transform` | 900ms | 0 | `cubic-bezier(0.25, 0.8, 0.25, 1)` | Work capsule rect → panel box (`translate` + `scale`, origin top left) |
| Index opened (nav Work) | dock `transform` | 900ms | 0 | same | home row → the panel's top row |
| Study opened (homepage card) | panel `transform` | 900ms | 0 | same | the clicked card's live rect → panel box |
| Index → study, study → index, study → study | outgoing view `opacity` | 160ms | 0 | `cubic-bezier(0.23, 1, 0.32, 1)` | 1 → 0, frozen over the incoming view |
| Same swap | incoming view `opacity` | 240ms (`--duration-medium-1`) | 0 | `cubic-bezier(0.23, 1, 0.32, 1)` | 0 → 1 |
| "← Work" (shared Breadcrumb) | the same cross-fade, towards `/work` | 160ms / 240ms | 0 | same | the study's view → the index's view; the panel does not move |
| Close (index Esc/backdrop, or the logo anywhere) | panel `transform` | 300ms | 0 | `ease` (`0.25, 0.1, 0.25, 1`) | current pose → the capsule or card's live rect (scale + fade when there is no origin) |
| Opened, reduced motion | panel `opacity` | 120ms | 0 | `ease-out` | 0 → 1, no transform |
| Swap/close, reduced motion | `opacity` only | 120ms | 0 | `ease-out` | the same states, no movement |

The content swap snapshots the outgoing view before React mutates the DOM, so the copy is the view that was on screen rather than the new route's: it stays inert and `aria-hidden`, keeps the reader's scroll position, and has its inner animations and transitions neutralised so it paints at rest.

**Close B.** Esc and the backdrop step a study back to the index; on the index they close the drawer. The logo closes from anywhere. The shared "← Work" Breadcrumb is the same step back, and browser Back is the platform's. A step back uses `router.back()` only when the entry behind this one is the index; after "Next project" the entry behind is another study, so the index is pushed instead.

**Esc guard.** One burst of presses cannot step back and then close: Esc is ignored while a step-back transition is in flight, and for `ESC_BURST_MS = 350ms` after the index lands. Auto-repeat from a held key is ignored too (`event.repeat`). A single deliberate press is unchanged: one steps back, a later one closes.

**The lifecycle rule.** One machine owns the drawer: the phase (`closed | opening | open | closing`), one generation, the running flight, the close promise, the reveal timer and the entry. Every transition goes through `commit()` — bump the generation, stop the flight, set the phase — so an async completion commits only while its generation is current. A close always settles `closed` once its flight ends, whether the route exit lands now, later, or never: the shell is off the screen (`visibility: hidden`) and the page lock and homepage inertness are released from the phase. Only a real re-entry reopens it — a new Work/card click, or the route coming back to `/work*`. A timer never reopens; the old 1.5s fallback was removed because a slow exit was mistaken for a cancelled one and sprang the drawer open.

- `src/components/work/use-morph.ts:100` — the open/close timing pair handed to the panel and the nav
- `src/components/work/carousel-step.ts:23` — `CAROUSEL_OPEN_S` (900ms, read from `DEFAULT_SETTINGS.duration`)
- `src/components/work/carousel-step.ts:24` — `CAROUSEL_EASE` (`0.25, 0.8, 0.25, 1`)
- `src/components/work/carousel-step.ts:35` — `DRAWER_CLOSE_S = 0.3`
- `src/components/work/carousel-step.ts:36` — `DRAWER_CLOSE_EASE` (CSS `ease`, `0.25, 0.1, 0.25, 1`)
- `src/components/work/use-morph.ts:192` — `findOrigin`: the study's visible card, else the nav's Work capsule
- `src/components/work/use-morph.ts:417` — `flyOpen`: the pose, the flight and the nav's flight
- `src/components/work/use-morph.ts:481` — the dock flies on the drawer's own open timing
- `src/components/work/use-morph.ts:86` — `FADE_S = 0.12`, the reduced-motion opacity path
- `src/components/work/drawer-shell.tsx:148` — the frozen copy is marked `data-leave`
- `src/components/work/drawer-shell.tsx:157` — the copy's 160ms fade
- `src/components/work/drawer-shell.css:163` — the incoming view's 240ms `wd-view-in`
- `src/components/work/drawer-shell.tsx:194` — `requestExit`: step back on a study, close on the index
- `src/components/work/drawer-shell.tsx:211` — the logo's close registration
- `src/components/work/drawer-shell.tsx:28` — `ESC_BURST_MS = 350`
- `src/components/work/drawer-shell.tsx:205` — the burst window after the index lands
- `src/components/work/drawer-actions.tsx:53` — auto-repeat is not a fresh press
- `src/components/work/use-morph.ts:673` — `stepBack`
- `src/components/work/use-morph.ts:676` — uses history only when the index is the entry behind
- `src/components/work/breadcrumb.tsx` — the shared "Home"/"Work"/title Breadcrumb; its reader actions call `close` and `stepBack`
- `src/components/work/work-list.tsx` — the index's Soft-focus slot for the Breadcrumb
- `src/components/work/use-morph.ts:301` — the one lifecycle machine
- `src/components/work/use-morph.ts:338` — `commit`: generation bump, flight stop, phase
- `src/components/work/use-morph.ts:880` — `close`: play, then settle, no latch
- `src/components/work/use-morph.ts:909` — a close with no panel still settles closed
- `src/components/work/use-morph.ts:547` — the hide transition closes the shell
- `src/components/work/use-morph.ts:531` — re-entry, the only way back open
- `src/components/work/use-morph.ts:862` — a click re-enters a closed-but-on-screen shell

## Work index — hover thumbnail list (2026-11-22)

The /work index is one list of case studies inside the drawer panel, under the nav. While a row is current — a pointer hover, or keyboard focus with no pointer — one 480x360 thumbnail follows or parks, the other rows drop to 40%, and the fresh divider next to the current row fades away. There is no grid, no layout switch and no per-row preview. When the left margin can hold the margin panel (next section), the same media is shown there instead.

| Trigger | Property | Duration | Delay | Easing | From → to |
| --- | --- | --- | --- | --- | --- |
| Thumbnail enters | inner layer `opacity` | 200ms | 0 | `cubic-bezier(0.23, 1, 0.32, 1)` | 0.6 → 1 |
| Thumbnail enters | inner layer `transform` | 200ms | 0 | same | `scale(0.96)` → `scale(1)` |
| Thumbnail leaves the list | inner layer `opacity` | 150ms | 0 | `--ease-decelerate` | 1 → 0 |
| Image crossfade between rows | back image `opacity` | 200ms | 0 | `--ease-emphasized-decelerate` | 0 → 1 (the old front → 0) |
| Image crossfade during a fling | back image `opacity` | 120ms | 0 | same | same |
| Non-current rows dim | `.wd-work-row` `opacity` | 200ms | 80ms grace after leaving a row | `--ease-emphasized-decelerate` | 1 → 0.4 |
| Dividers next to the current row | item `::before` `opacity` | 200ms | 0 | same | 1 → 0 |
| Visible rows enter with the drawer | `opacity` / `transform` / `filter` | 700ms | `40ms × slot` (max 12 rows) | `--ease-calm` | 0 / `7px` down / `8px` blur → 1 / 0 / none |
| Index arrives with the panel | `.wd-index-scroll` `opacity` | 300ms (`--duration-medium-5`) | held at 0 until `data-reveal="on"` | `--ease-emphasized-decelerate` | 0 → 1, one pass |
| "← Home" enters with the index | `.wd-breadcrumb` `opacity` / `transform` / `filter` | 700ms | 0 | `--ease-calm` | 0 / `7px` down / `8px` blur → 1 / 0 / none |

- **1:1 tracking, no smoothing.** Each pointer move schedules one `requestAnimationFrame` write of `translate3d(cursor − layer origin − half the box, 0)` from the latest `clientX`/`clientY`. There is no lerp, spring or `dt`. The outer box only ever transforms; the inner layer owns opacity and scale, so the entrance cannot fight the tracking.
- **Cursor none.** The OS cursor paints above the DOM, so the list sets `cursor: none` on the rows while a pointer owns the thumbnail. It is keyed to the pointer (not to keyboard focus) and is removed on leaving the rows or the list, and over the nav or the dev-only surfaces; keyboard focus parks the thumbnail with the normal cursor, and touch never hides it.
- **The 0.6 start.** The thumbnail's first painted frame is already 60% opaque, so the frame that hides the cursor always has an image under it. The scale still starts at 0.96 and both run on the same 200ms curve. The exit keeps its 150ms fade.
- **Dim and dividers.** The 40% dim sits on the row child, not the list item, so the item's `--outline-variant` hairline stays at full opacity. A list-level dim state with an 80ms grace keeps it from flashing between rows, including while a stationary pointer is tracked through a scroll. The current row and the row after it drop their lines so the rounded hover fill never sits on one.
- **Entrance.** Only the rows visible at open stagger, capped at 12; rows below the fold are already visible and never animate on scroll. The animation uses `fill-mode: backwards`: the from-state holds through the stagger delay and the final state returns to the cascade, so the 40% dim still applies after the animation. (`both` held `opacity: 1` over the dim rule — the dim bug this replaced.)
- **Ways home.** The shared Breadcrumb is the list's first Soft-focus beat, with no delay; the rows keep their own 40ms stagger. In the reader the same component sits above the article and has no entrance of its own: it rides the scroll column's reveal. Neither animates on scroll.
- **Reduced motion.** The thumbnail is opacity-only over 120ms (no scale), the row dim and divider fades are 120ms, and the entrance does not run. The 1:1 cursor tracking stays: it is direct manipulation, not an animation.
- **Touch.** No thumbnail at all; the list is the plain links, with the normal cursor.

- `src/components/work/work-list.tsx` — placement and the 1:1 rAF write; focus parking; the 80ms dim grace; the 12-row entrance cap; the portal layer
- `src/components/work/work-list.css` — the 0.6 entry, 150ms exit, crossfade, dim, divider fade, reduced motion; the Breadcrumb's Soft-focus beat
- `src/components/work/work-index.css` — the column and the arrival fade
- `src/components/work/breadcrumb.tsx` / `breadcrumb.css` — the shared way back, its nav-item hover/press/focus and the Glide capsule reuse
- `src/components/work/reader.css` — the reader's back row and the reach-to-top rail

## Work index — margin thumbnail (2026-11-22)

When the centred list leaves an empty left margin wide enough for it — a fine
pointer and at least 320px between the reading surface's gutter and the list —
the hover media is a 4:3 panel in that margin instead of the cursor-follow
thumbnail. The list itself never moves: same 1120px column, same typography. The
panel is sticky, shows nothing until a row is current, and the cursor stays
visible. Below the gate the shipped cursor thumbnail is used unchanged.

| Trigger | Property | Duration | Delay | Easing | From → to |
| --- | --- | --- | --- | --- | --- |
| A row becomes current | panel `opacity` | 200ms | 0 | `cubic-bezier(0.23, 1, 0.32, 1)` | 0 → 1 |
| Pointer leaves the list | panel `opacity` | 150ms | 0 | `--ease-decelerate` | 1 → 0 |
| Media swaps between rows | stacked layer `opacity` | 1000ms | 0 | `cubic-bezier(0.19, 1, 0.22, 1)` | 0 → 1 (the old front → 0) |
| Reduced motion, media swap | — | 0 | 0 | — | instant |
| Reduced motion, panel enter/exit | `opacity` | 120ms (`--duration-short-2`) | 0 | `ease-out` | 0 → 1 / 1 → 0 |

- **Geometry.** The reading surface's left edge plus 16px starts the box; the list's left edge minus 32px ends it. Width is whatever is left, capped at 600px; when capped it right-aligns to the list so it keeps hugging it. Height is the cursor thumbnail's 4:3, the radius is `--radius-lg`, the shadow `--shadow-card`, the fill `--surface-container`, and there is no border. `placePanel` writes the box to the fixed clip layer; the list is not involved.
- **Sticky.** The top is the first row's top; on scroll it pins at the nav's visible top (`nav bottom + 12px`) until the pointer leaves the list. Idle is empty: the panel is `opacity: 0` with no placeholder.
- **Gate.** Measured, not a breakpoint: with the shipped 1120px column the margin first reaches 320px at 1839px (1838px → 319.5px, cursor fallback; 1839px → 320px, panel). The pointer must also be fine; on touch no thumbnail is shown.
- **Interruption.** The crossfade is an opacity transition on two stacked images, so a row change mid-fade retargets from the current blend instead of restarting.

- `src/components/work/work-list.tsx` — `PANEL_*`, `measurePanel`, `placePanel`, the fixed clip layer's panel
- `src/components/work/work-list.css` — the panel box, enter/exit, 1s crossfade and reduced-motion branch

## Now-playing card & satellite

The persistent player has two surfaces: the top-left card on `/`, and the satellite dot on the nav orb off-home. Both read the same store. The card shell (art, title, button) subscribes with `usePlayerStatus`; only `NowPlayingTimebar` uses `usePlayer`, so the 4 Hz playhead and pointer preview re-render the timebar alone.

| Trigger | Property | Duration | Delay | Easing | From → to |
| --- | --- | --- | --- | --- | --- |
| Card play/pause pressed | `transform` | 100ms (`--duration-short-1`) | 0 | — | `scale(1)` → `scale(0.95)` |
| Card icon swap | `opacity`, `transform` | 150ms (`--duration-short-3`) | 0 | `cubic-bezier(0.23, 1, 0.32, 1)` (`--ease-emphasized-decelerate`) | `scale(0.9)` → `scale(1)` |
| Slider track hover/focus/drag | `transform` (`scaleY`) | 150ms (`--duration-short-3`) | 0 | `ease-out` (`--ease-decelerate`) | 1 → 2 (2px → 4px at the 275px card) |
| Slider fill follows the playhead | `clip-path` | 250ms (`--duration-medium-2`) | 0 | `linear` | current progress → next progress |
| Slider thumb appears | `opacity`, `transform` | 150ms (`--duration-short-3`) | 0 | `ease-out` | `scale(0.8)` → `scale(1)`; position follows the value, no layout transition |
| Satellite enter | `opacity` | 400ms (`--duration-long-1`) | 0 | `cubic-bezier(0.23, 1, 0.32, 1)` (`--ease-emphasized-decelerate`) | 0 → 1 |
| Satellite exit | `opacity` | 100ms (`--duration-short-1`) | 0 | `ease-in` (`--ease-accelerate`) | 1 → 0 |
| Satellite dot → button (hover/focus/paused) | face `width`, `height`; glyph `opacity` | 400ms (`--duration-long-1`) | 0 | `cubic-bezier(0.23, 1, 0.32, 1)` (`--ease-emphasized-decelerate`) | 13px dot ↔ 24px button; the 2px ring stays 2px and the 7px glyph crossfades with the 10px icon |
| Satellite playing | dot ring `scale`, `opacity` | 1600ms loop | 0 | `ease-out` (`--ease-decelerate`) | `scale(1)`/0.35 → `scale(1.6)`/0, only while visible and playing |
| Satellite icon swap | `opacity`, `transform` | 150ms (`--duration-short-3`) | 0 | `ease-out` (`--ease-decelerate`) | active `scale(1)`/1 ↔ inactive `scale(0.8)`/0, stacked play/pause glyphs |
| Satellite pressed | `transform` | 100ms (`--duration-short-1`) | 0 | — | `scale(1)` → `scale(0.96)` |
| Reduced motion, card | icon `opacity` | 150ms (`--duration-short-3`) | 0 | `linear` | opacity only, no transform; spinner slows to 2.4s |
| Reduced motion, satellite | `opacity` | 0ms on hide / 150ms (`--duration-short-3`) otherwise | 0 | `linear` | instant hide when leaving home; grow/shrink and glyph swap snap; no press scale or pulse |

- **Hit areas.** The slider's visual bar stays 1.5–2px tall, but its `::before` target is 41px tall at the largest card. The satellite's `::before` target is 40px and grows only right and bottom, so it never adds target area over the Home orb. The card button already carries a 40px target.
- **Pointers.** The satellite grow is gated to `(hover: hover) and (pointer: fine)`; `:focus-visible` grows it for keyboard. A mouse resume sets `data-suppress-hover` until the pointer leaves the orb shell, so the button shrinks back to the dot even with the cursor still over it, and only regrows on the next pointer entry. The Home link comes before the satellite in DOM order, so Tab reaches the orb first and the satellite second.
- **Exit trigger.** The dock sets `data-nav-leaving` on the same frame it starts the home flight, before the route change that lands after the 300ms close. The satellite reads that attribute, so its 100ms exit finishes inside both the 300ms drawer close and the 120ms browser-Back fade. A settled `data-nav-state="home"` also hides it, so a fresh load or a re-revealed Activity copy cannot flash it.
- **Token match.** The satellite enter and grow/shrink use the Day phase row's nav-overlay entrance: 400ms (`--duration-long-1`) on `--ease-emphasized-decelerate`. The exit is shortened to 100ms (`--duration-short-1`, the next scale step down) so it finishes before the shortest nav return, the 120ms browser-Back fade.
- **One face.** The dot and the button are the same element: its width and height animate 13px ↔ 24px from a fixed centre, so the 2px surface ring stays 2px instead of thinning with a `transform: scale`. The 10px icon and the 7px dot glyph are stacked in that face and crossfade over the same 400ms, so leaving hover shrinks one continuous shape.
- **Dot glyph.** The resting 13px dot carries the transport state as a 7px pause or play glyph in `--palette-neutral-50`, the eye colour. Both glyphs stay mounted and crossfade with opacity plus `scale(0.8)` → `scale(1)` over 150ms, so a state flip mid-swap retargets instead of restarting. The play triangle is nudged 0.5px right to read optically centred. The pause uses a compact two-bar path so the bars keep a visible gap at 7px on 1x screens.
- **Reduced motion.** The card keeps the state change as an opacity fade, drops icon and press transforms, and slows the spinner. The satellite hide is instant when leaving home; its grow/shrink and glyph crossfade snap, and its press scale and pulse are removed. The slider fill still tracks the playhead because it communicates progress; the track and thumb stop resizing and fading.
- **Phases.** The satellite dot and the card button both paint `--orb-gradient`, so the four phase gradients (Day, Dawn, Dusk, Night) come from the same token as the nav orb.

- `src/components/home/now-playing-card.tsx` — `NowPlayingCard` (status) and `NowPlayingTimebar` (playhead)
- `src/components/home/now-playing-card.css` — card press, icon fade, slider track, fill and thumb, hit targets, reduced motion
- `src/components/player/player.css` — shared orb-gradient button press 0.95
- `src/components/player/orb-player.css` — satellite dot/glyph/grow, pulse, 40px target, fine-pointer gate, reduced motion

## Daily painting card (2026-11-26)

The top-right card is a standard ring host. No pointer spotlight and no tilt remain; the motion is the image placeholder fade, the full-view dialog, the shared card hover ring, and the dialog close control. Tokens are from `src/app/globals.css`.

| Trigger | Property | Duration | Delay | Easing | From → to |
| --- | --- | --- | --- | --- | --- |
| Painting bytes load | LQIP `opacity` | 400ms (`--duration-long-1`) | 0 | `linear` (`--ease-linear`) | 1 → 0 when `.art-image[data-loaded="true"]`; the LQIP keeps its static `blur(16px) saturate(0.9)` and `scale(1.08)`; the `<img>` itself has no opacity transition |
| Card hover / leave | ring surface `inset`, `border-radius` | 800ms (`--duration-long-3`, `--ring-grow`) | 0 | `cubic-bezier(0.165, 0.84, 0.44, 1)` (`--ease-spring-grow`) | rest `inset: 0`, radius 12px → `inset: calc(var(--ring-grow) * -1 + 1px)`, radius 11px, and back |
| Card hover / leave | ring frame `inset` | 800ms (`--duration-long-3`, `--ring-grow`) | 0 | `cubic-bezier(0.165, 0.84, 0.44, 1)` (`--ease-spring-grow`) | `-1px` → `-grow`, and back; the frame stays exactly 1px wider than the surface |
| Card hover / leave | ring frame `opacity` | 100ms (`--duration-short-1`) | 0 | `linear` (`--ease-linear`) | 0 → 1 on entry, 1 → 0 on leave |
| Fine pointer over the card | ring glow `opacity` | 250ms (`--duration-medium-2`, `--ring-fade`) | 0 | `linear` (`--ease-linear`) | 0 → 1 while the pointer is in the host |
| Fine pointer over the card | ring glow `transform` | 1000ms (`--duration-long-4`, `--ring-follow`) | 0 | `cubic-bezier(0.16, 1, 0.3, 1)` (`--ease-spring-follow`) | follows the pointer's `--ring-mx` / `--ring-my` offset; the 614px glow is masked to the host |
| Full view opens | dialog `opacity`, `transform` | 240ms (`--duration-medium-1`) | 0 | `cubic-bezier(0.23, 1, 0.32, 1)` (`--ease-emphasized-decelerate`) | opacity 0 + `translateY(10px)` → opacity 1 + `translateY(0)`; `animation-fill-mode: both` |
| Full view opens | dialog backdrop `opacity` | 240ms (`--duration-medium-1`) | 0 | `linear` (`--ease-linear`) | 0 → 1; the `rgb(0 0 0 / 0.55)` fill and `blur(3px)` are static |
| Full view closes | dialog and backdrop | 0ms | — | — | native `dialog.close()` plus unmount; there is no exit animation; focus returns to the frame button |
| Close control hovered | `background-color` | 150ms (`--duration-short-3`) | 0 | `ease-out` (`--ease-decelerate`) | 88% `surface-container-low` → `surface-container-high` |
| Close control pressed | `transform` | 150ms (`--duration-short-3`) | 0 | `ease-out` (`--ease-decelerate`) | `scale(1)` → `scale(0.94)` |

The card has no spotlight, tilt, frame-button press scale or label motion. Its only hover motion is the shared ring above; its only press motion is the dialog close control.

**Reduced motion.** The LQIP `transition` is removed, so the placeholder disappears on the loaded frame. The ring keeps the state change without growth: surface and frame snap to rest, frame `opacity` fades in 100ms (`--duration-short-1`) `linear`, and the glow fades in 250ms (`--duration-medium-2`) `linear` with no transform. The dialog open becomes `art-dialog-fade`, 150ms (`--duration-short-3`) `linear` `both`, opacity only; the backdrop animation is `none`; the close control has `transform: none` and `transition: none`. The dialog close is still immediate. Focus return and the native modal semantics are unchanged.

- `src/components/home/art-card/art-card.css` — LQIP opacity, dialog open/backdrop, close-control hover/press, reduced-motion block
- `src/components/home/art-card/art-card.tsx` — the dialog mounts only while open; the dialog close is native and unmounts
- `src/components/home/art-card/art-dialog.tsx` — focus moves to Close on open and returns to the frame button on close
- `src/components/home/ring-hover.css` — shared ring surface/frame/glow, pointer follow and reduced-motion path

## Drag canvas - Motion & Stills (2026-11-23)

The live `/work/motion-and-stills` study is the approved canvas prototype inside the WorkDrawer, with the dev panel removed and the locked defaults fixed in `canvas-reader.tsx`. Source: `src/components/canvas/*` and `src/components/work/canvas-reader.tsx`.

### Physics

| Value | Setting |
| --- | --- |
| Momentum decay | `0.95` per 60fps frame; `minVelocity = 0.01` px/frame |
| Pointer to velocity | mouse `0.1`, touch `0.3`; release adds `2×` the last pointer delta |
| Wheel | `0.05` per normalised pixel |
| Click / pan lock | tap within `5px` and `300ms`; clicks blocked for `100ms` after a drag |
| Held keys | acceleration `3.4` px/frame per 60fps frame; cruise `25` px/frame; reduced step `120px` |
| Camera | `CAMERA_Z = 500`; drag zoom to `475`, easing at `0.975` per 60fps frame |
| Parallax | limit `0.025`; easing at `0.82` per 60fps frame |
| Plane crop | texture zoom `1.06` (cover), `1.0` at the viewer focus |
| Video budget | 12 playing on desktop, 6 on mobile; visible check every `80ms`; `160px` margin; starts freeze above `3` px/frame, resume below `0.4` after `220ms` |

### Intro timeline

Times are from the first frame with posters ready. The eases are the power curves in `intro.ts`.

| Beat | Delay | Duration | Ease | Value |
| --- | --- | --- | --- | --- |
| Camera push | 1300ms | 2000ms | power4.inOut | z `700 -> 500` |
| Grid spread | 1500ms | 2000ms | power4.inOut | gap `8 ->` measured pitch |
| Plane opacity | 500-1250ms stagger | 2000ms | power3.out | 0 -> 1 |
| Gray to colour | per-plane opacity delay (500-1250ms) | 900ms | power3.out | `uGray 1 -> 0` |
| Texture zoom | 1250ms | 2250ms | power3.inOut | `1.3 -> 1` |
| Intro end | - | 3500ms | - | - |
| Videos join | 3250ms | - | - | - |
| Reduced motion | - | 200ms | - | opacity only |

The gray reveal is per plane: it starts on that plane's opacity delay, so a tile is grey when it first becomes visible and colourises over 900ms power3.out while the 2s fade is still running. The last tile finishes at 2150ms. With the global 2s gray gone, the intro ends at the last remaining tween, the 3.5s texture zoom. Reduced motion pins `uGray` to 0.

- `src/components/canvas/intro.ts:19` — `grayDurationMs` 900
- `src/components/canvas/intro.ts:25` — `endMs` 3500 (was 4250)
- `src/components/canvas/intro.ts:112` — `introGray(elapsed, delay)` per plane
- `src/components/canvas/infinite-canvas.tsx:3053` — each plane writes its own `uGray`

### Chrome entrance (approved 2026-11-27)

The bottom chrome (the breadcrumb and hint pill) waits for the canvas intro clock, so it never appears over a grid that has not started. It enters from `translateY(4px)`, `opacity: 0` and `blur(4px)` to rest over **700ms** on `cubic-bezier(0.45, 0, 0.55, 1)`; only transform, opacity and filter animate. This surface has one chrome cluster, so the 40ms stagger has nothing to stagger. Reduced motion keeps a **160ms** opacity-only fade. A 3s fallback reveals it if WebGL cannot start. It runs once per canvas mount with the intro, not on tile opens or viewer closes.

| Trigger | Property | Duration | Delay | Easing | From -> to |
| --- | --- | --- | --- | --- | --- |
| Intro clock starts | chrome pill `opacity`, `transform`, `filter` | 700ms | 0 | `cubic-bezier(0.45, 0, 0.55, 1)` | `0`, `translateY(4px)`, `blur(4px)` -> `1`, none, none |
| Reduced motion | chrome pill `opacity` | 160ms | 0 | `--ease-decelerate` | 0 -> 1 |

- `src/components/work/canvas-reader.css:123` — `cv-chrome-in`, the 700ms rise and defocus
- `src/components/work/canvas-reader.css:212` — reduced-motion `cv-chrome-fade`, 160ms opacity only
- `src/components/work/canvas-reader.tsx:99` — `markIntroStarted`
- `src/components/work/canvas-reader.tsx:141` — `data-chrome` pending/in
- `src/components/canvas/infinite-canvas.tsx:690` — `onIntroStart` fires when the intro clock starts

### Keyboard (approved 2026-11-27)

The canvas is one focusable region, not one tab stop per tile. A Tab focus, or the focus returned by a keyboard viewer close, selects the centre tile (or the tile the viewer closed on) and gives it the same 1.08x hover lift. While a tile is selected, ArrowLeft/Right/Up/Down glide the selection one grid cell at **700ms power3.inOut** (`cubic-bezier(0.65, 0, 0.35, 1)`), wrapping at both edges and retargeting from the current scroll if another key lands mid-glide. Enter opens the selected tile. Escape clears the selection and returns the surface to continuous pan; a pointer press, wheel or pointer move also clears it. With no tile selected, held arrows keep the existing acceleration/cruise pan (`3.4` px/frame per 60fps frame, cruise `25`). The viewer's own ArrowLeft/ArrowRight slide stepping is unchanged because it runs on the open viewer, not the grid. Reduced motion snaps the scroll and ticks the selection with no glide.

- `src/components/canvas/keyboard-nav.ts:17` — `KEYBOARD_GLIDE_MS` 700 and the power3.inOut progress
- `src/components/canvas/infinite-canvas.tsx:4697` — `onGridKeyDown`, the capture handler for the focused tile
- `src/components/canvas/infinite-canvas.tsx:3448` — `updateHover`, which gives the focused tile the lift
- `src/components/canvas/infinite-canvas.tsx:3521` — `closeTarget`, which keeps the closed tile above siblings

### Open and close (retuned 2026-11-27)

Open and close are each one timeline, owned by `TRANSITION` in `transition.ts`; the DOM viewer is chrome around a WebGL plane, so the media is not swapped mid-flight. On the live study the canvas-owned open still starts from the hover/breath-lifted mesh, so the click does not snap the tile down. The canvas-owned close lands on the resting tile (`plane.tileWidth`/`tileHeight`), not on that lifted mesh: the idle handoff clears hover and starts the breath at 0, so a snapshot of the lifted size would leave the tile a few percent too big until the first idle frame.

Open: the clicked plane's periodic copy glides to the centre for **1000ms power3.inOut** (`glideMs` / `glideProgress`). `centrePlaneScroll` targets `nearestPeriodic(-base, scroll, 2 × halfPeriod)`, so a panned canvas opens the copy nearest the current scroll instead of flying back to the first-load slot. The camera travels to `CAMERA_Z` on the same progress, and the other planes fade over **900ms power3.inOut** (`fadeOutMs` / `fadeOutProgress`). The grow starts **150ms before the glide ends** (`growDelayMs` 850ms) and runs **600ms power3.out** (`growMs` / `growProgress`) to the `fitBox` focus rect (0.88 × 0.8 of the viewport), while the crop goes `1.06 -> 1` (`TEXTURE_ZOOM`). The canvas reports opened at **1450ms** (`growDelayMs + growMs`); the viewer chrome joins 200ms later (`captionDelayMs`) and fades in over 180ms.

Close, first the tile: the viewer holds the focus rect through the **200ms cross-fade window** (`closeCrossFadeMs`) while its caption and close button leave over **150ms** (`closeCaptionMs`; the CSS uses the same literal on `opacity` with `--ease-decelerate`). The featured plane then shrinks focus -> resting tile over **600ms power3.inOut** (`closeShrinkMs` / `closeShrinkProgress`), 200-800ms. Every other plane stays at **opacity 0 until 710ms**, so the grid is not visible under the shrinking media. The grid scroll (`closeScrollOffset`) and lens warp (`closeFadeProgress` on `uStrength`) return on that same 200-800ms clock.

Close, then the grid: the sibling planes are the tail. Their fade starts at **710ms** (`closeSiblingFadeDelayMs`, 85% of the shrink; the featured plane is at 109.5x71 against its 97x64 resting slot) and runs **300ms** (`closeSiblingFadeMs` / `closeSiblingFadeProgress`). The featured tile lands at **800ms** with only the first **10.8%** of the sibling fade visible, and the grid finishes at **1010ms** (`closeTotalMs`). The viewer chrome waits for that tail, so the close hands back an idle, fully painted grid.

The featured plane holds `renderOrder = 2` for the whole close while every sibling stays at 0, so a sibling whose plane overlaps the large focus rect can never paint over the media being closed. The 0/1 hover ordering only applies when idle. `closeTotalMs` is 1010ms, not 800ms: the shrink, scroll and lens all land at 800ms, and the 210ms after that is the intentional sibling fade behind the landed tile. The viewer-owned Arrow close is unchanged.

| Trigger | Property | Duration | Delay | Easing | From -> to |
| --- | --- | --- | --- | --- | --- |
| Tile clicked | grid `scroll` | 1000ms (`glideMs`) | 0 | power3.inOut (`glideProgress`) | current scroll -> `centrePlaneScroll(base, scroll, halfPeriod)` |
| Tile clicked | camera `z` | 1000ms (same) | 0 | power3.inOut | current -> `CAMERA_Z` 500 |
| Tile clicked | other planes `opacity` | 900ms (`fadeOutMs`) | 0 | power3.inOut (`fadeOutProgress`) | 1 -> 0 |
| Tile clicked | plane `scale`, `uPlaneSizes`, `uZoom` | 600ms (`growMs`) | 850ms (`growDelayMs`) | power3.out (`growProgress`) | tile -> `fitBox`, crop `1.06 -> 1` |
| Close | caption + close `opacity` | 150ms (`closeCaptionMs`) | 0 | `ease-out` (`--ease-decelerate`) | 1 -> 0 |
| Close | target plane `scale` | 600ms (`closeShrinkMs`) | 200ms (`closeCrossFadeMs`) | power3.inOut (`closeShrinkProgress`) | focus -> `restWidth` × `restHeight`, crop `1 -> 1.06` |
| Close | grid `scroll` | 600ms (same) | 200ms (`closeCrossFadeMs`) | power3.inOut (`closeScrollOffset`) | focus offset -> pre-open `fromScrollX`/`fromScrollY` |
| Close | lens `uStrength` | 600ms (`closeFadeMs`) | 200ms (`closeCrossFadeMs`) | power3.inOut (`closeFadeProgress`) | 0 -> resting warp (0.23) |
| Close | other planes `opacity` | 300ms (`closeSiblingFadeMs`) | 710ms (`closeSiblingFadeDelayMs`) | power3.inOut (`closeSiblingFadeProgress`) | 0 -> 1 |
| Close | featured plane `renderOrder` | instant | 0 | - | 2 for the whole close; siblings 0 |
| Close, tile lands | target plane at rest | 0 | 0 | - | `tileWidth` x `tileHeight` at 800ms; siblings at 10.8% |
| Close completes | viewer unmount, grid tail done | 0 | 0 | - | sibling fade 1 at `closeTotalMs` 1010ms |
| Reduced motion, open | scroll + plane pose | 0 | 0 | - | one frame: focus pose, canonical `-base` scroll, other planes 0 |
| Reduced motion, close | other planes `opacity` | 200ms (`reducedFadeMs`) | 0 | linear (`reducedOpacity`) | 0 -> 1, then the target is restored at rest on the same 200ms |

After an Arrow step the DOM viewer owns the media and the frame, not the WebGL plane. That close still uses `closeShrinkMs` **600ms**, but it is a WAAPI FLIP from the frame's current transform to the landing tile rect on `cubic-bezier(0, 0, 0.58, 1)`, starting immediately (no 200ms hold); the canvas grid stays hidden and `landClose` reveals the target tile when both the FLIP and the media prep finish. That path's easing is not power3.inOut.

Reduced motion lands directly. The open writes the focus pose, the canonical `-base` scroll, and the other planes at 0 in one frame (`openPlane` reduced branch), with no glide or grow. The close writes the pre-open scroll in one frame, puts the target tile back at rest immediately, and fades the other planes in over **200ms** (`reducedFadeMs` / `reducedOpacity`, linear); there is no shrink, scroll-reverse or lens animation, so the canvas-owned close takes 200ms instead of 1010ms.

### Close invariant (2026-11-25, retimed 2026-11-27)

Dat approved the original invariant on 2026-11-25 (bd pf-9cv.13, PR #121); the 800ms landing and 1010ms grid tail were approved on 2026-11-27 (bd pf-9cv.19, PR #132, `6763810`).

- **Landing then tail.** At **800ms** the shrink, scroll and lens restore all read 1, the target plane is at `tileWidth` x `tileHeight`, and the sibling fade is 10.8% through. At `closeTotalMs` **1010ms** the sibling fade also reads 1, every plane is at rest, and the viewer unmounts. The 210ms between them is the intentional grid tail, not a frozen landing.
- **Within 0.5px.** The target plane's projected rect at the **800ms** landing frame equals the tile's resting rect within **0.5px**, and it holds that rect on the first idle frame and after. Measured: canvas-owned paths **0.0px** (Escape, close button, outside click; video and image; after a resize); the viewer-owned Arrow path **0.5px** on x, **0** on y.
- **Breathing clock.** `landClose` resets `breathIdleSince` to 0 and clears `breathLevel`/`breathActive`/`breathAmplitude`, so the first idle frame restarts the 1s delay and 1.2s fade instead of applying the pre-open idle time in one frame. The canvas-owned close never pauses, so its non-idle frames already reset the clock.

- `src/components/canvas/transition.ts:22` — `TRANSITION`: `glideMs` 1000, `fadeOutMs` 900, `growDelayMs` 850, `growMs` 600, `captionDelayMs` 200, `closeCaptionMs` 150, `closeCrossFadeMs` 200, `closeShrinkMs` 600, `closeFadeDelayMs` 0, `closeFadeMs` 600, `closeSiblingFadeDelayMs` 710, `closeSiblingFadeMs` 300, `closeTotalMs` 1010, `reducedFadeMs` 200
- `src/components/canvas/transition.ts:139` — `glideProgress`, power3.inOut over `glideMs`
- `src/components/canvas/transition.ts:147` — `growProgress`, power3.out after `growDelayMs`
- `src/components/canvas/transition.ts:171` — `closeFadeProgress`, the lens return on the 200-800ms shrink clock
- `src/components/canvas/transition.ts:185` — `closeSiblingFadeProgress`, 710-1010ms
- `src/components/canvas/transition.ts:195` — `closeShrinkProgress`
- `src/components/canvas/transition.ts:211` — `closeScrollOffset`, the open's scroll run in reverse
- `src/components/canvas/transition.ts:239` — `resizeOpenScroll`, the retarget used when the grid is rebuilt
- `src/components/canvas/transition.ts:275` — `closeComplete` at `closeTotalMs`
- `src/components/canvas/wrap.ts:43` — `nearestPeriodic`
- `src/components/canvas/wrap.ts:62` — `centrePlaneScroll`
- `src/components/canvas/infinite-canvas.tsx:2677` — the open targets `centrePlaneScroll(...)`
- `src/components/canvas/infinite-canvas.tsx:2684` — `restWidth`/`restHeight` from `plane.tileWidth`/`tileHeight`; `tileWidth`/`tileHeight` from the lifted mesh
- `src/components/canvas/infinite-canvas.tsx:2717` — reduced open writes the focus pose in one frame
- `src/components/canvas/infinite-canvas.tsx:223` — `CLOSE_TARGET_RENDER_ORDER` 2
- `src/components/canvas/infinite-canvas.tsx:2973` — the lens returns on `closeFadeProgress`
- `src/components/canvas/infinite-canvas.tsx:3145` — the close's shrink and reduced fade
- `src/components/canvas/infinite-canvas.tsx:3149` — siblings fade on `closeSiblingFadeProgress`
- `src/components/canvas/infinite-canvas.tsx:3157` — the close lands on `restWidth`/`restHeight`
- `src/components/canvas/infinite-canvas.tsx:3522` — `closeTarget` for the close's render order
- `src/components/canvas/infinite-canvas.tsx:3545` — target `renderOrder` 2, every sibling 0 while closing
- `src/components/canvas/infinite-canvas.tsx:3740` — the scroll reverse on the shrink timeline
- `src/components/canvas/infinite-canvas.tsx:3752` — the close completes at `closeTotalMs`
- `src/components/canvas/infinite-canvas.tsx:4114` — `landClose`
- `src/components/canvas/infinite-canvas.tsx:4142` — the breathing clock reset after a DOM close
- `src/components/canvas/infinite-canvas.tsx:4311` — `rebindTransitionAfterResize`
- `src/components/canvas/infinite-canvas.tsx:4455` — the rebuilt-grid close also uses the sibling fade
- `src/components/canvas/focus-viewer.tsx:508` — a canvas-owned close waits `closeTotalMs` before unmounting
- `src/components/canvas/focus-viewer.tsx:585` — the viewer-owned FLIP, `closeShrinkMs` 600ms
- `src/components/canvas/focus-viewer.tsx:599` — that FLIP's `cubic-bezier(0, 0, 0.58, 1)`, not power3.inOut
- `src/components/canvas/focus-viewer.css:174` — chrome out 150ms `--ease-decelerate`
- `src/components/canvas/focus-viewer.css:185` — chrome in 180ms after `captionDelayMs` 200ms

### Breathing

| Value | Setting |
| --- | --- |
| Amplitude | **±6%** of the plane's resting size (default `0.06`) |
| Period | **5s**, shared by every tile |
| Wave | `0.6` radians of phase per `col + row` grid step, so the ripple runs diagonally; the phase uses the grid index, not the wrapped screen position |
| Curve | `1 + amplitude × sin(2π·t/period - (col + row)·wave)`; the phase is absolute `performance.now` time |
| Idle delay | **1s** after the canvas settles; after a DOM close, counted from `landClose` |
| Fade in | **1.2s** smoothstep amplitude envelope |
| Fade out | **300ms** exponential amplitude ease when a drag, wheel or key glide starts |
| Settle threshold | `0.1` px/frame |
| Render cadence | every rAF; the phase is sampled at native refresh, no frame skipping. Stops when the document or route is hidden |

The amplitude is 0 during the intro, open/close transitions, the viewer and reduced motion. Only the amplitude is enveloped; the phase never resets. On the DOM/viewer-owned close the canvas has been paused behind the viewer, so `landClose` resets `breathIdleSince` and the level to 0; otherwise the first idle frame would apply the pre-open idle time and jump to the full 6% in one frame. The canvas-owned close never pauses, and each non-idle frame already resets the idle clock. The scale is the whole mesh multiplied by the breathing scale, then by the hover scale; the texture crop (`uZoom`) is not touched. Plane edges use analytic 1px coverage (`fwidth`) on top of the render target's 4x MSAA where the target is at or below 10M pixels; the lens pass samples the target linearly.

### Hover

| Value | Setting |
| --- | --- |
| Lift | **1.08×** (slider 1.00-1.20), multiplied on top of the breath |
| In | **280ms**, power3.out |
| Out | **400ms**, power3.inOut |
| Retarget | each plane's tween restarts from the value it had reached, so fast passes and interruptions never jump |
| Pick | one inverse-lens raycast per frame at the last pointer position, idle only (not intro, drag/glide, transition or viewer) |
| Intent | the cursor and the `View` chip wait **200ms** on the same tile; leaving or changing tiles cancels the wait. The 1.08x lift is not delayed |
| Label | a pointer-following `View` chip, clamped inside the canvas; `opacity` 150ms, reduced motion 0ms |
| Cursor | pointer over a tile after the intent, grab in the gaps, grabbing while dragging; no hover on touch |
| Order | idle only: the hovered/tweening plane raises `renderOrder` to 1; the closing featured plane takes 2 above every sibling |
| Reduced motion | cursor change after the same intent, no scale; the label appears without a fade |

- `src/components/canvas/hover.ts:35` — `intentMs` 200
- `src/components/canvas/infinite-canvas.tsx:3448` — `updateHover`, the intent clock and the cursor/label commit
- `src/components/canvas/infinite-canvas.css:39` — `.cv-hover-label`, the `View` chip

### Globe lens

Full-screen post-pass: the scene renders into a **1.6×** render target (30% source margin each side) at the canvas DPR capped at 2, and one quad samples it through the aspect-corrected barrel map `t = q × (1/1.6) × (1 + k·r²)`. The centre stays 1:1 with the flat view; the 30% margin keeps edge samples inside the target. One sRGB encode happens in the post pass; the scene target stays linear premultiplied. MSAA is 4x up to 10M target pixels; larger targets use the analytic plane-edge AA. The lens sample is LinearFilter.

| Value | Setting |
| --- | --- |
| Default mode | **globe** |
| Strength | **0.23** (max 0.50) |
| Drag boost | **+0.30** at a fast drag, on top of the base (max 0.30); speed threshold `8` px/frame |
| Vignette | **0.25** (max 0.25), smoothstep rim fade |
| Easing | `0.08` per 60fps frame |
| Flat comparison | `?lens=flat` on the dev route |

### Runtime and performance

The live study pauses the canvas when the route is not active, which stops the rAF and pauses every canvas video; the InfiniteCanvas effect disposes its renderer, render target, textures and video elements on unmount. The capability probe is cached and its context released, so the three open/close cycle test returns to the same context baseline (no leaked canvas contexts). Production idle + hover at 1440×900 with 12 videos measured **p95 8.1ms, max 8.9ms**, 0 frames over 17ms and 0 long tasks; GPU WebGL work was ~75ms per 10s with videos and ~23ms per 10s breathing + hover only.

## Human Contact - embed <-> live (2026-11-25)

Approved 2026-11-25 (bd pf-9cv.9; PR #119, `1faa998`). The `/work/human-contact` case study and `/live/human-contact` do not invent a route curve: they reuse the canvas tile's motion. `human-contact-motion.ts` imports `TRANSITION` and `POWER3_IN_OUT_EASE` from `src/components/canvas/transition.ts` and writes the durations into the `--human-contact-*` custom properties that `globals.css` reads, so there is no second set of numbers in CSS. The live page is the only named participant: its snapshot starts at the embed's stored rect on the way in and ends on it on the way out, so the motion does not depend on the destination page pairing with the source.

| Trigger | Property | Duration | Easing | From -> to |
| --- | --- | --- | --- | --- |
| Open (embed -> live) | live snapshot `transform`, `clip-path` | 1000ms (`openMs` = `glideMs`) | power3.inOut (`POWER3_IN_OUT_EASE`, `cubic-bezier(0.65, 0, 0.35, 1)`) | embed rect: `translate` + `scale`, origin `0 0`, inset crop -> viewport: `translate(0, 0) scale(1)`, `inset(0 0 0 0)` |
| Open | live snapshot `opacity` | first 18% (180ms) | power3.inOut | 0 -> 1 over the real embed, so the container-query type scale does not pop |
| Open | old root `opacity` (the case study) | 900ms (`pageFadeMs` = `fadeOutMs`) | power3.inOut | 1 -> 0 |
| Close (live -> embed) | old snapshot `transform`, `clip-path` | 600ms (`closeMs` = `closeShrinkMs`) | power3.inOut | viewport -> the stored embed rect |
| Close | snapshot `opacity` | last 20% (480-600ms) | power3.inOut | 1 -> 0 over the real embed, so the landing frame has no content pop |
| Close | new root `opacity` (the case study) | 600ms (same close duration) | power3.inOut | 0 -> 1 |
| Reduced motion | - | 0 | - | no `<ViewTransition>`; both directions land directly |
| No stored rect (direct load) | - | 0 | - | plain navigation, no morph |

The close is exact because the embed stores its viewport rect on the forward click (`rememberTile`) and the drawer restores the study's internal scroll to that rect before the close snapshot is taken (`HumanContactEmbed` layout effect), then the close keyframes end on those same variables. Measured at 1440x900: the open started from `{272.5, 193.7, 880, 495}` and the close ended on exactly that rect, with no landing snap.

Reduced motion returns the children with no `<ViewTransition>` at all when the preference is reduce or there is no stored rect, so both routes land directly. If the preference flips between the routes, `globals.css` forces `animation-duration: 0s` on every `view-transition` pseudo.

- `src/components/human-contact/human-contact-motion.ts:11` — imports `POWER3_IN_OUT_EASE` and `TRANSITION` from the canvas
- `src/components/human-contact/human-contact-motion.ts:19` — `HUMAN_CONTACT_MOTION`: `openMs` = `glideMs`, `closeMs` = `closeShrinkMs`, `pageFadeMs` = `fadeOutMs`, `ease` = `POWER3_IN_OUT_EASE`
- `src/components/human-contact/human-contact-motion.ts:26` — writes the durations and ease into the `--human-contact-*` custom properties
- `src/components/human-contact/human-contact-motion.ts:137` — `humanContactTileTransform`, the cover map and clip insets
- `src/components/human-contact/human-contact-motion.ts:158` — `applyHumanContactTileVars`
- `src/components/human-contact/human-contact-motion.ts:185` — `markHumanContactDirection`, the `data-human-contact-transition` attribute
- `src/components/human-contact/human-contact-transition.tsx:54` — reduced motion or no stored rect: no view transition
- `src/components/human-contact/human-contact-transition.tsx:57` — the one named participant and its open/close types
- `src/components/human-contact/human-contact-embed.tsx:59` — `rememberTile`, the rect and geometry stored on the forward click
- `src/components/human-contact/human-contact-embed.tsx:43` — the return restore, scrolls the study back to the stored rect before the close snapshot
- `src/components/human-contact/human-contact-embed.tsx:88` — the link carries `transitionTypes={[HUMAN_CONTACT_OPEN]}` and calls `rememberTile`
- `src/app/globals.css:166` — `::view-transition-new(.human-contact-open)`, 1000ms on the canvas ease
- `src/app/globals.css:177` — `::view-transition-old(.human-contact-close)`, 600ms on the same ease
- `src/app/globals.css:183` — `human-contact-open` keyframes, opacity 1 by 18%
- `src/app/globals.css:206` — `human-contact-close` keyframes, opacity holds to 80%
- `src/app/globals.css:229` — the open's root fade, 900ms
- `src/app/globals.css:244` — the close's root fade-in, 600ms
- `src/app/globals.css:262` — reduced motion forces every view-transition pseudo to 0s

## Work reader — Lenis smooth scroll (2026-11-27)

Approved 2026-11-27 (bd pf-9cv.18; trial merged in PR #133). The case-study reader inside the work drawer is the only surface with Lenis. The window, the index, the canvas and every overlay keep native scrolling. One `SmoothScroll` component is mounted in the root layout, but it binds a single Lenis to the live `#wd-reader-scroll` element: `wrapper`, `content` (`.wd-reader-column`) and `eventsTarget` are all the reader, so Lenis never sees a wheel outside it. The classes land on the reader, not `<html>`.

| Setting | Value | Why |
| --- | --- | --- |
| Version | `lenis` 1.3.29 | the current stable 1.3.x |
| `lerp` | 0.1 | the reference's smoothing; same value in the trial |
| `autoRaf` | true | Lenis owns one rAF loop; no second clock |
| `wheelMultiplier` | 1 | raw wheel delta, no acceleration |
| `syncTouch` | false | touch is the browser's; no touch preventDefault path |
| `allowNestedScroll` | false | never discover or adopt another nested scroll box |
| Reduced motion | no instance; `.lenis` absent | native scrolling, not a slower lerp |

- **Scope and binding.** `READER_SELECTOR` is `.wd-expand-layer:not([data-phase="closed"]) .wd-drawer-view:not([data-leave]) #wd-reader-scroll`. A `MutationObserver` watches child-list changes and the `data-phase` / `data-leave` attributes, then rebinds: a study swap destroys the old instance and binds the new reader; the index (`#wd-index-scroll`, not matched), the canvas (no `#wd-reader-scroll`) and a closing shell (phase `closed`) get no instance. This is the fix for the trial's `allowNestedScroll: "smooth"` caveat, which auto-adopted the index if it ever overflowed.
- **Exclusions.** The WebGL canvas, its focus viewer and the art dialog carry `data-lenis-prevent` and sit outside this scoped instance. The attributes keep the exclusion explicit if a page-level instance is ever added. Drag, wheel zoom and pan in the canvas keep their own handlers.
- **Native scroll wins.** A pointerdown or keydown inside the reader stops Lenis inertia before its next write (`scrollTo(actualScroll, { immediate: true, force: true })`). A native `scroll` event whose position leaves Lenis' last written value by 2px or more also yields. Without this, the reader's "↑ Top" clicked 120ms into a wheel was pulled back to the wheel's target; measured after the fix it lands at 0.
- **Reduced motion.** The instance is destroyed and `.lenis` is removed; the reader keeps the browser's native scroll. The effect reads `matchMedia("(prefers-reduced-motion: reduce)")` directly as well as the `useReducedMotion` hook, so a reduced-motion load never constructs Lenis while the hook is still on its server snapshot.
- **Hydration.** The first bind is deferred one animation frame and the live preference is checked first. Lenis adds its class to a server-rendered element; doing that during hydration produced an attribute mismatch before the deferral.
- **Rebind evidence.** Live at 1440x900: reader 632 → 1398 over 17 sampled frames; an index forced to 2400px scrolls natively in one frame with no `.lenis`; the injected unrelated scroller never gets `.lenis`; reduced motion jumps 607 in one frame; a study swap leaves the new reader `.lenis` and top 0; the nav top stays 43.52px.
- **Trial history.** The draft trial (PR #133, `fe51dec`) used `allowNestedScroll: "smooth"` on a window instance; reviewer pf-9cv.18 caught that it could adopt any nested scroller. This section records the shipped scoped form.

- `src/components/motion/smooth-scroll.tsx` — the reader selector, one-frame first bind, MutationObserver rebind, the Lenis options, native-scroll yield and pointer/key inertia stop
- `src/components/motion/smooth-scroll.css` — the standard Lenis rules and the `html.lenis` overscroll lock
- `src/components/work/reader.tsx` — the reader scroller and `.wd-reader-column` the instance binds to
- `src/components/canvas/infinite-canvas.tsx` / `focus-viewer.tsx`, `src/components/home/art-card/art-dialog.tsx` — `data-lenis-prevent` on the excluded surfaces
- `src/app/layout.tsx` — the single `SmoothScroll` mount
- `src/components/motion/smooth-scroll.test.tsx` — scope, rebind, reduced-motion, pointer/key stop, native-yield, CSS and exclusion coverage

