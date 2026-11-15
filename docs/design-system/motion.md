# Design system motion — 2026-11-13

The shipped motion of the theme toggle, the Day phase row, the home nav's Glide capsule and the Work drawer, recorded from the code (toggle and nav from PR #12, `5bbfba9` / `d574d89`; drawer at `98b6429`). Values here are the ones the app actually runs, so new components reuse them instead of re-inventing a curve or a stagger.

## Principles

- One curve family per job: `cubic-bezier(0.23, 1, 0.32, 1)` (`--ease-emphasized-decelerate`) for entrances, `ease-in` (`--ease-accelerate`) for exits, `cubic-bezier(0.34, 1.3, 0.64, 1)` (`--ease-spring`) for the icon settle.
- Calm and ambient entrances use `cubic-bezier(0.4, 0, 0.2, 1)` (`--ease-calm`): it leaves at zero velocity and settles on a long tail, so light and content arrive without anything launching.
- A theme change is one crossfade of the whole page, not a colour transition per element: everything changes on the same frame because it is the same image pair.
- The drawer flies on `cubic-bezier(0.32, 0.72, 0, 1)` (panel and nav together), its content cascades on `cubic-bezier(0.22, 1, 0.36, 1)`, and the blur resolving on top of that fade runs slower, on `cubic-bezier(0.25, 0.1, 0.25, 1)`.
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
- **The selection capsule crossfades with the page** when the theme changes, instead of flying: a snapshot cannot contain live motion. It still runs the full stretch & snap on every selection change that is not a theme change (the Day phase row, and Day/Night/Auto when the theme is already that mode).
- `data-phase-switching` stays on `<html>` for the length of the crossfade and carries the kind (`click` / `auto`), which is what selects the duration in CSS.

- `src/lib/theme.ts:334` — the crossfade runner (snapshot, write, announce, settle)
- `src/lib/theme.ts:256` — `isPhaseSwitching()`, the "the page is a snapshot" predicate
- `src/app/globals.css:103` — `::view-transition-old(root)` fade and the 400ms (`--duration-long-1`) / auto tokens
- `src/app/globals.css:16` — why the tokens are no longer transitioned
- `src/components/theme/theme-toggle.css:49` — `--phase-enter-delay` holds the row entrance
- `src/components/horizon/horizon-shader.tsx:621` — one draw per token mutation
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
| Hover enters, reduced motion | item fill `background-color` | 120ms (`--duration-short-2`) | 0 | `ease-out` (`--ease-decelerate`) | transparent → 55% `surface-container` |

Spring constants, from `glide-spring.ts`: `GLIDE_LEAD_SPRING = { stiffness: 1100, dampingRatio: 0.9 }`, `GLIDE_TRAIL_SPRING = { stiffness: 900, dampingRatio: 0.9 }`. The runner steps them by the frame's `dt`, clamped to `GLIDE_MAX_STEP_S = 1/30`, and treats an edge as at rest under `GLIDE_REST_PX = 0.4` and `GLIDE_REST_VELOCITY = 12` px/s, then stops the rAF loop. The step is the closed-form solution of the oscillator, so the path does not depend on how the interval is split.

The leading edge is whichever edge points the way the pill is travelling and gets the stiff spring; the trailing edge gets the soft one. A move from rest also holds the trailing edge for `TRAIL_HOLD_MS = 100` so the capsule stretches out of the old item before it closes. The hold is never re-armed by a retarget and is dropped when the direction reverses, so a fast sweep can never freeze the trail. Measured against the toggle's curve, a single move still peaks at the same width within a couple of pixels and settles by ~300ms.

`data-glide-break` cuts the run: the capsule never stretches across the divider, so a move across it sets `data-fading` (fade out in place), re-places while blank and fades back in. `data-visible` is not touched by that, so the trace still reads "in the run" throughout. A retarget during the fade only updates the pending destination — the timer is never restarted — so a sweep cannot leave the capsule hidden; a pointer that leaves during the fade cancels the re-place.

A frame writes one property: the capsule keeps the run's width and carries the pill as a `clip-path` inset, so the edges move independently while no width or other layout property changes. At rest the pill is the hovered item's box at the `--radius-md` token. Hover is gated to `(hover: hover) and (pointer: fine)`, focus is a 2px `primary` ring on the item, and Work keeps `aria-current="page"`. Reduced motion hides the capsule: the hovered item carries the 55% `surface-container` fill and crossfades it in 120ms (`--duration-short-2`) with no travel, so the state change survives without the movement.

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
- `src/components/home/nav-items.css:61` — hover weight 0.55
- `src/components/home/nav-items.css:64` — `data-fading` blanks the capsule for a break
- `src/components/home/nav-items.css:83` — glyph tooltip, 300ms (`--duration-medium-5`) delay
- `src/components/home/nav-items.css:111` — reduced-motion capsule hide
- `src/components/home/nav-items.css:119` — reduced-motion 55% fill crossfade

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

| Trigger | Property | Duration | Delay | Easing | From → to |
| --- | --- | --- | --- | --- | --- |
| Card opened | panel `transform` | 480ms | 0 | `cubic-bezier(0.32, 0.72, 0, 1)` | card rect → panel box (`translate` + `scale`, origin top left) |
| Study → study (no card) | panel | 0 | 0 | — | settles in place, no move |
| Reverse morph | panel `transform` | 300ms | 0 | `ease-in` | current pose → the card's live rect |
| Reverse morph, or no card | panel `opacity` | 120ms | 0 | `ease-out` | 1 → 0 |
| Opened, reduced motion | panel `opacity` | 120ms | 0 | `ease-out` | 0 → 1, `transform: none` |
| Close interrupts the open | panel `transform` | 300ms | 0 | `ease-in` | retargeted from the live pose, never from zero |
| Resize mid-open | panel | — | — | — | completes the flight |
| Backdrop in | `opacity` | 320ms | 0 | `ease-out` | 0 → 1 (0.4 black; 0.62 in Night) |
| Backdrop out | `opacity` | 240ms | 0 | `ease-in` | 1 → 0 |
| Content out on close | scroll column `opacity` | 140ms | 0 | `ease-in` | 1 → 0 |
| Backdrop / content, reduced motion | `opacity` | 120ms | 0 | `ease-out` | 0 → 1 / 1 → 0 |

- `src/components/work/morph.ts:20` — `MORPH_EASE` `cubic-bezier(0.32, 0.72, 0, 1)`
- `src/components/work/morph.ts:21` — `MORPH_OPEN_S = 0.48`
- `src/components/work/morph.ts:22` — `MORPH_CLOSE_S = 0.3`
- `src/components/work/use-morph.ts:159` — the open flight, transform only
- `src/components/work/use-morph.ts:218` — the reverse pose into the card's live rect
- `src/components/work/use-morph.ts:31` — 120ms opacity path (`FADE_S`)
- `src/components/work/expand-shell.css:18` — backdrop in 320ms `ease-out`
- `src/components/work/expand-shell.css:19` — backdrop out 240ms `ease-in`
- `src/components/work/expand-shell.css:20` — content out 140ms `ease-in`
- `src/components/work/expand-shell.css:21` — reduced-motion 120ms `ease-out`

## Work drawer — nav dock

The one nav lives in the root layout and never remounts, so opening a study FLIPs it from the home slot to the panel's top row on the panel's own curve. Home is CSS geometry (1200px frame, 1136px bar, `max(pad + offset, 50dvh + offset/2 - 2rem)` with offsets 716px at 1280, 604 at 1024, 804 at 768 and 824 below), corrected at runtime against `[data-nav-slot]` when it drifts by more than 0.5px. The reader position is `--wd-panel-inset + --wd-nav-inset`: 44px from the viewport top at 768 and up, 16px below.

| Trigger | Property | Duration | Delay | Easing | From → to |
| --- | --- | --- | --- | --- | --- |
| Study opened | dock `transform` | 480ms | 0 | `cubic-bezier(0.32, 0.72, 0, 1)` | home top → reader top (`translateY` of the measured delta) |
| Study closed | dock `transform` | 300ms | 0 | `ease-in` | reader top → home top |
| Reduced motion, or no card | dock `opacity` | 60ms out + 60ms in | 0 | `ease-out` | 1 → 0 → 1, no transform |
| Study → study | dock | 0 | 0 | — | stays at the reader position |
| Resize mid-flight | dock | — | — | — | lands the move |
| Home rest, drifted | dock `top` | 0 | — | — | slot top when the CSS is off by > 0.5px |

- `src/components/nav/nav-dock.tsx:111` — open 480 / close 300 on the panel's constants
- `src/components/nav/nav-dock.tsx:29` — 60ms half of the reduced-motion crossfade
- `src/components/nav/nav-dock.tsx:109` — the `translateY` flight, measured from the live rect
- `src/components/nav/nav-dock.tsx:119` — resize lands the flight
- `src/components/nav/nav-dock.tsx:163` — 0.5px slot-drift correction
- `src/components/nav/nav-dock.css:15` — home geometry
- `src/components/nav/nav-dock.css:59` — reader top `panel inset + nav inset`

## Work drawer — content cascade

The cascade is a handoff from the panel, not a second entrance: it is released at the reveal, 360ms into the 480ms open (120ms before the panel lands). Cover first, then the header, then the body, on one even 80ms beat.

| Block | Starts at | Opacity + 10px rise | Defocus |
| --- | --- | --- | --- |
| Cover | 0ms | 800ms `cubic-bezier(0.22, 1, 0.36, 1)` | none |
| Title | 80ms | same | 800ms `cubic-bezier(0.25, 0.1, 0.25, 1)`, `blur(10px)` → none |
| Subtitle | 160ms | same | same |
| Meta | 240ms | same | same |
| p1 | 320ms | same | same |
| p2 | 400ms | same | same |
| p3 and below | 480ms | same | same |

Every block holds its start state (`backwards` fill), so nothing paints at its end state before its beat. The blur has its own longer curve: the fade is at 92% by 400ms while the defocus still measures 3.2px there, so the text resolves instead of snapping sharp. The cover carries no filter (blur on the large media was the one measured cost). The window ends 1280ms after the reveal, 1640ms after the click.

- `src/components/work/entrance.css:37` — fade curve `cubic-bezier(0.22, 1, 0.36, 1)`
- `src/components/work/entrance.css:40` — defocus curve `cubic-bezier(0.25, 0.1, 0.25, 1)`
- `src/components/work/entrance.css:41` — 800ms for both
- `src/components/work/entrance.css:74` — `blur(10px)` start
- `src/components/work/entrance.css:88` — two animations, fade then defocus
- `src/components/work/entrance.css:93` — both ride the block's beat and the hand-off lead
- `src/components/work/entrance.css:110` — 80ms beat, title
- `src/components/work/entrance.css:130` — 480ms, p3 and below
- `src/components/work/use-morph.ts:177` — reveal at open − 120ms
- `src/components/work/parts.tsx:415` — `--wd-beat-lead` on the incoming panel

## Work drawer — study hand-off

"Next project" is not a route swap with an empty beat: the outgoing article leaves on the reader's own 140ms close fade, the route is pushed 49ms into it, and the incoming entrance mounts 120ms in.

| Trigger | Property | Duration | Delay | Easing | From → to |
| --- | --- | --- | --- | --- | --- |
| Next project | outgoing scroll column `opacity` | 140ms | 0 | `ease-in` | 1 → 0, held to the last frame |
| Next project | route commit | — | 49ms (35% of 140) | — | push / replace lands inside the fade |
| Incoming study | cascade | — | −120ms lead | — | the entrance's first paint is already ~55% in |
| Reduced motion | — | 0 | 0 | — | one commit, no fade, no lead |

The lead is a module-level timestamp read once by the incoming mount and cleared: it expires after 900ms so a slow route can never leak it into a normal card open.

- `src/components/work/progression.ts:19` — `PROGRESSION_EXIT_MS = 140`
- `src/components/work/progression.ts:21` — `PROGRESSION_LEAD_MS = 120`
- `src/components/work/progression.ts:27` — `PUSH_RATIO = 0.35`
- `src/components/work/progression.ts:29` — `LEAD_TTL_MS = 900`
- `src/components/work/progression.ts:72` — the 140ms `ease-in` fade, `fill: forwards`
- `src/components/work/parts.tsx:415` — the incoming panel's `--wd-beat-lead`

## Work drawer — geometry and popover sides

One set of root tokens positions the drawer, so the nav, the blur zone, the reading column and the rail cannot drift apart. The drawer's nav sits 44px from the viewport top at 768 and up (16px below) and the study starts 32px under it (24px below 768).

| Token | Below 768 | 768 and up | Read by |
| --- | --- | --- | --- |
| `--wd-panel-inset` | 0px | 16px | panel inset, nav top |
| `--wd-nav-inset` | 16px | 28px | nav top, blur height, column clearance, rail |
| `--wd-nav-height` | 4rem | 4rem | nav box, blur height, column clearance |
| `--wd-nav-content-gap` | 24px | 32px | column top padding, rail sticky top |
| `--wd-phase-row-gap` | 4px | 4px | the picker row's side offset |

The Day phase row opens above the toggle on the homepage and below it in the drawer, always at `--wd-phase-row-gap`. Each track's labels point away from the other track: home has the row above, so the toggle's labels go below and the row's go above; the reader has the row below, so the toggle's labels go above and the row's go below. The glyph's label keeps the reader's downward side.

- `src/app/globals.css:258` — the token block
- `src/app/globals.css:267` — the 768 overrides
- `src/components/work/reader.css:48` — column top padding
- `src/components/work/reader.css:104` — rail sticky top
- `src/components/nav/nav-dock.css:72` — home label side
- `src/components/nav/nav-dock.css:77` — reader label side
- `src/components/nav/nav-dock.css:103` — the reader's picker row, 4px below the toggle

## Work drawer — blur stack and reduced motion

The progressive blur over the reader's top edge is six static `backdrop-filter` bands (1, 2, 4, 8, 16, 32px) sharing the nav's box; nothing in it animates, only the content moves under it. `prefers-reduced-transparency` or no `backdrop-filter` support replaces the bands with one solid gradient from the panel surface.

| Path | Behaviour |
| --- | --- |
| Open | panel opacity 120ms `ease-out`, no transform; nav crossfades over 2 × 60ms; backdrop 120ms |
| Cascade | `animation: none` on the cover and every text block; the scroll column is one 120ms opacity pass |
| Hand-off | no fade and no wait; the incoming column skips its own fade (`data-progression="lead"`) |
| Content out | 140ms `ease-in` on close, 120ms `ease-out` reduced |
| Thumb pair, rail | 120ms `ease-out`, visibility steps with the fade |
| Picker row | existing rows: opacity only 120ms, no scale, no icon settle |

- `src/components/work/blur-stack.tsx:4` — six bands
- `src/components/work/blur-stack.css:96` — reduced-transparency / no-support fallback
- `src/components/work/entrance.css:136` — reduced-motion `animation: none`
- `src/components/work/entrance.css:157` — the hand-off column keeps `opacity: 1`
- `src/components/work/reader.css:253` — thumb-pair reduced path

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
| Nav hover capsule | hidden; the hovered nav item carries the 55% `surface-container` fill over 120ms (`--duration-short-2`), no travel |
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
