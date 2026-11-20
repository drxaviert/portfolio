# Design system motion — 2026-11-13

The shipped motion of the theme toggle, the Day phase row, the home nav's Glide capsule and the Work drawer, recorded from the code (toggle and nav from PR #12, `5bbfba9` / `d574d89`; drawer at `98b6429`; the shipped drawer, its close rules and the index layout switch approved at `cb6785a`, 2026-11-19, in the last two sections). Values here are the ones the app actually runs, so new components reuse them instead of re-inventing a curve or a stagger.

## Principles

- One curve family per job: `cubic-bezier(0.23, 1, 0.32, 1)` (`--ease-emphasized-decelerate`) for entrances, `ease-in` (`--ease-accelerate`) for exits, `cubic-bezier(0.34, 1.3, 0.64, 1)` (`--ease-spring`) for the icon settle.
- Calm and ambient entrances use `cubic-bezier(0.4, 0, 0.2, 1)` (`--ease-calm`): it leaves at zero velocity and settles on a long tail, so light and content arrive without anything launching.
- A theme change is one crossfade of the whole page, not a colour transition per element: everything changes on the same frame because it is the same image pair.
- The drawer opens on `cubic-bezier(0.25, 0.8, 0.25, 1)` (panel and nav together) and closes on `cubic-bezier(0.22, 1, 0.36, 1)`; its content cascades and the blur resolving on top of that fade both run on the open curve, while the nav's own default flight, with no drawer behind it, uses `cubic-bezier(0.32, 0.72, 0, 1)` (`morph.ts`).
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

## Home card hover ring

The featured card's ring is the same surface every host carries (a frame, the glow inside it, and the fill), but its growth is a transform, not a clip. Both layers are clipped once — the surface to the Figma card box, the frame one pixel larger — and a shared `scale` moves those clips outward, so the 1px edge survives while the fill grows 2.5px x / 5px y into the gutters. The clips never animate, so a hover no longer repaints the frame layer, which carries the 614px glow.

| Trigger | Property | Duration | Delay | Easing | From → to |
| --- | --- | --- | --- | --- | --- |
| Card hovered | surface + frame `transform` | 800ms (`--duration-long-3`, `--ring-grow`) | 0 | `cubic-bezier(0.165, 0.84, 0.44, 1)` (`--ease-spring-grow`) | `scale(1)` → `scale(1.0066, 1.024)` at xl |
| Card hovered | frame `opacity` | 100ms (`--duration-short-1`) | 0 | `linear` (`--ease-linear`) | 0 → 1 |
| Pointer leaves | surface + frame `transform` | 800ms (`--duration-long-3`, `--ring-grow`) | 0 | `cubic-bezier(0.165, 0.84, 0.44, 1)` (`--ease-spring-grow`) | `scale(…)` → `scale(1)` |
| Pointer leaves | frame `opacity` | 100ms (`--duration-short-1`) | 800ms (`--ring-grow`) | `linear` (`--ease-linear`) | 1 → 0, after the ring has closed |
| Keyboard focus | same as hover | same | same | same | the focused card grows too |

| Card | Surface | `--ring-card-scale-x` / `-y` | Fill growth |
| --- | --- | --- | --- |
| Stacked, below md | 358×420 | 1.014 / 1.0238 | 2.5px x / 5px y |
| md | 444×560 | 1.0113 / 1.0179 | 2.5px x / 5px y |
| lg | 656×360 | 1.0076 / 1.0278 | 2.5px x / 5px y |
| xl | 753×416 | 1.0066 / 1.024 | 2.5px x / 5px y |

The factors are `1 + 2 × (grow − 1px) / card size`, with `--ring-grow-x` 3.5px and `--ring-grow-y` 6px. The subtracted pixel is the edge the fill leaves for the frame, so each card lands its frame on the shipped 3.5px x / 6px y outer boundary. A scale cannot add fixed pixels to every width, so the scope is the featured card only (`home-cards.tsx`, and the carousel's front slot): the nav, the slivers and the narrower carousel columns keep the clip-path grow.

Why transform: animating `clip-path` repaints the ring layer every frame. Measured over one 1440×900 hover, `RasterTask` was 11.8ms across 443 tasks with `GPUTask` at 121.2ms, and 0.1ms across 7 tasks with 25.3ms after. Neither version runs layout; the remaining style recalc (~0.4ms a frame) belongs to the pointer-follow glow variables (`ring-pointer.tsx`), not the ring.

Reduced motion is untouched: the growth block sits inside `prefers-reduced-motion: no-preference`, so the reduced path above still reveals the ring inside the card with no growth.

- `src/components/home/ring-hover.css:271` — the card ring: static clips, transform growth
- `src/components/home/ring-hover.css:296` — growth only under `no-preference`
- `src/components/home/ring-hover.css:298` — scale factors, base and per breakpoint (md 304, lg 311, xl 318)
- `src/components/home/ring-hover.css:329` — rest: surface clip on the Figma box, frame 1px larger
- `src/components/home/ring-hover.css:381` — hover: one scale on the surface and the frame
- `src/components/home/home-cards.tsx:59` — `.ring-card` on the featured card
- `src/components/home/carousel/home-carousel.tsx:244` — the front slot carries `.ring-card`
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

The drawer's timing is the home carousel's step, read from its source (`carousel-settings.ts` / `easeSpec`) rather than written down: the open is 900ms on `cubic-bezier(0.25, 0.8, 0.25, 1)`, the close is the run the row gives an interrupted step, 350ms on `cubic-bezier(0.22, 1, 0.36, 1)`.

| Trigger | Property | Duration | Delay | Easing | From → to |
| --- | --- | --- | --- | --- | --- |
| Card opened | panel `transform` | 900ms | 0 | `cubic-bezier(0.25, 0.8, 0.25, 1)` | card rect → panel box (`translate` + `scale`, origin top left) |
| Study → study | panel, shadow, backdrop, nav | 0 | — | — | stay put; only the article swaps (see "Work drawer — study hand-off") |
| Reverse morph | panel `transform` | 350ms | 0 | `cubic-bezier(0.22, 1, 0.36, 1)` | current pose → the card's live rect |
| Reverse morph, or no card | panel `opacity` | 120ms | 0 | `ease-out` | 1 → 0 |
| Opened, reduced motion | panel `opacity` | 120ms | 0 | `ease-out` | 0 → 1, `transform: none` |
| Close interrupts the open | panel `transform` | 350ms | 0 | `cubic-bezier(0.22, 1, 0.36, 1)` | retargeted from the live pose, never from zero |
| Resize mid-open | panel | — | — | — | completes the flight |
| Backdrop in | `opacity` | 320ms | 0 | `ease-out` | 0 → 1 (0.4 black; 0.62 in Night) |
| Backdrop out | `opacity` | 240ms | 0 | `ease-in` | 1 → 0 |
| Content out on close | scroll column `opacity` | 300ms (~86% of the close) | 0 | `cubic-bezier(0.22, 1, 0.36, 1)` | 1 → 0, tracking the panel's own shrink |
| Backdrop / content, reduced motion | `opacity` | 120ms | 0 | `ease-out` | 0 → 1 / 1 → 0 |

- `src/components/work/carousel-step.ts:26` — `CAROUSEL_OPEN_S` = `DEFAULT_SETTINGS.duration / 1000` (900ms)
- `src/components/work/carousel-step.ts:27` — `CAROUSEL_EASE`, parsed from `easeSpec` (`0.25, 0.8, 0.25, 1`)
- `src/components/work/carousel-step.ts:37` — `CAROUSEL_CLOSE_S = 0.35` (the row's `SETTLE_MS`)
- `src/components/work/carousel-step.ts:38` — `CAROUSEL_CLOSE_EASE` = `RETARGET_BEZIER` (`0.22, 1, 0.36, 1`)
- `src/components/work/use-morph.ts:65` — the drawer's one open/close timing pair, handed to the panel and the nav
- `src/components/work/use-morph.ts:279` — the open flight, transform only
- `src/components/work/use-morph.ts:354` — the reverse pose into the card's live rect
- `src/components/work/use-morph.ts:50` — 120ms opacity path (`FADE_S`)
- `src/components/work/expand-shell.css:18` — backdrop in 320ms `ease-out`
- `src/components/work/expand-shell.css:19` — backdrop out 240ms `ease-in`
- `src/components/work/expand-shell.css:20` — content out 300ms on the FLIP's retarget curve
- `src/components/work/expand-shell.css:21` — reduced-motion 120ms `ease-out`

## Work drawer — nav dock

The one nav lives in the root layout and never remounts, so opening a study FLIPs it from the home slot to the panel's top row on the panel's own curve. Home is CSS geometry (1200px frame, 1136px bar, `max(pad + offset, 50dvh + offset/2 - 2rem)` with offsets 716px at 1280, 604 at 1024, 804 at 768 and 824 below), corrected at runtime against `[data-nav-slot]` when it drifts by more than 0.5px. The reader position is `--wd-panel-inset + --wd-nav-inset`: 44px from the viewport top at 768 and up, 16px below.

| Trigger | Property | Duration | Delay | Easing | From → to |
| --- | --- | --- | --- | --- | --- |
| Study opened | dock `transform` | 900ms | 0 | `cubic-bezier(0.25, 0.8, 0.25, 1)` | home top → reader top (`translateY` of the measured delta) |
| Study closed | dock `transform` | 350ms | 0 | `cubic-bezier(0.22, 1, 0.36, 1)` | reader top → home top |
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
| Close after a swap | panel `transform`, nav `transform` | 350ms | 0 | `cubic-bezier(0.22, 1, 0.36, 1)` | the study on screen's card, or the drawer's origin card |
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
| Hand-off | no fade-out wait and no cascade; the incoming column and ruler take one 120ms `ease-out` opacity pass, `filter: none` |
| Content out | 300ms on the close's retarget curve, 120ms `ease-out` reduced |
| Thumb pair, rail | 120ms `ease-out`, visibility steps with the fade |
| Picker row | existing rows: opacity only 120ms, no scale, no icon settle |
| Ruler indicator | placed on the target tick in one write, no flight |

- `src/components/work/blur-stack.tsx:4` — six bands
- `src/components/work/blur-stack.css:96` — reduced-transparency / no-support fallback
- `src/components/work/entrance.css:171` — reduced-motion `animation: none`
- `src/components/work/entrance.css:184` — the hand-off column's one 120ms opacity pass
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

## Work drawer — shipped entry, swap and close (2026-11-19)

The drawer is one surface for `/work` and every `/work/<slug>`: it opens from the nav's Work capsule on the index and from the clicked homepage card on a study, and it never remounts between entries. The open is the home carousel's step, read from its own source (`carousel-step.ts`) rather than copied: 900ms on `cubic-bezier(0.25, 0.8, 0.25, 1)`. The panel keeps its final layout box the whole time and only `transform`/`opacity` animate; a close that interrupts the open retargets from the current pose.

| Trigger | Property | Duration | Delay | Easing | From → to |
| --- | --- | --- | --- | --- | --- |
| Index opened (nav Work) | panel `transform` | 900ms | 0 | `cubic-bezier(0.25, 0.8, 0.25, 1)` | Work capsule rect → panel box (`translate` + `scale`, origin top left) |
| Index opened (nav Work) | dock `transform` | 900ms | 0 | same | home row → the panel's top row |
| Study opened (homepage card) | panel `transform` | 900ms | 0 | same | the clicked card's live rect → panel box |
| Index → study, study → index, study → study | outgoing view `opacity` | 160ms | 0 | `cubic-bezier(0.23, 1, 0.32, 1)` | 1 → 0, frozen over the incoming view |
| Same swap | incoming view `opacity` | 240ms (`--duration-medium-1`) | 0 | `cubic-bezier(0.23, 1, 0.32, 1)` | 0 → 1 |
| "← Work" | the same cross-fade, towards `/work` | 160ms / 240ms | 0 | same | the study's view → the index's view; the panel does not move |
| Close (index Esc/backdrop, or the logo anywhere) | panel `transform` | 350ms | 0 | `cubic-bezier(0.22, 1, 0.36, 1)` | current pose → the capsule or card's live rect (scale + fade when there is no origin) |
| Opened, reduced motion | panel `opacity` | 120ms | 0 | `ease-out` | 0 → 1, no transform |
| Swap/close, reduced motion | `opacity` only | 120ms | 0 | `ease-out` | the same states, no movement |

The content swap snapshots the outgoing view before React mutates the DOM, so the copy is the view that was on screen rather than the new route's: it stays inert and `aria-hidden`, keeps the reader's scroll position, and has its inner animations and transitions neutralised so it paints at rest.

**Close B.** Esc and the backdrop step a study back to the index; on the index they close the drawer. The logo closes from anywhere. "← Work" is the same step back, and browser Back is the platform's. A step back uses `router.back()` only when the entry behind this one is the index; after "Next project" the entry behind is another study, so the index is pushed instead.

**Esc guard.** One burst of presses cannot step back and then close: Esc is ignored while a step-back transition is in flight, and for `ESC_BURST_MS = 350ms` after the index lands. Auto-repeat from a held key is ignored too (`event.repeat`). A single deliberate press is unchanged: one steps back, a later one closes.

**The lifecycle rule.** One machine owns the drawer: the phase (`closed | opening | open | closing`), one generation, the running flight, the close promise, the reveal timer and the entry. Every transition goes through `commit()` — bump the generation, stop the flight, set the phase — so an async completion commits only while its generation is current. A close always settles `closed` once its flight ends, whether the route exit lands now, later, or never: the shell is off the screen (`visibility: hidden`) and the page lock and homepage inertness are released from the phase. Only a real re-entry reopens it — a new Work/card click, or the route coming back to `/work*`. A timer never reopens; the old 1.5s fallback was removed because a slow exit was mistaken for a cancelled one and sprang the drawer open.

- `src/components/work/use-morph.ts:101` — the open/close timing pair handed to the panel and the nav
- `src/components/work/carousel-step.ts:26` — `CAROUSEL_OPEN_S` (900ms, read from `DEFAULT_SETTINGS.duration`)
- `src/components/work/carousel-step.ts:27` — `CAROUSEL_EASE` (`0.25, 0.8, 0.25, 1`)
- `src/components/work/carousel-step.ts:37` — `CAROUSEL_CLOSE_S = 0.35`
- `src/components/work/carousel-step.ts:38` — `CAROUSEL_CLOSE_EASE` (`0.22, 1, 0.36, 1`)
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
- `src/components/work/reader-rail.tsx:88` — "← Work" calls the same step back
- `src/components/work/use-morph.ts:301` — the one lifecycle machine
- `src/components/work/use-morph.ts:338` — `commit`: generation bump, flight stop, phase
- `src/components/work/use-morph.ts:880` — `close`: play, then settle, no latch
- `src/components/work/use-morph.ts:909` — a close with no panel still settles closed
- `src/components/work/use-morph.ts:547` — the hide transition closes the shell
- `src/components/work/use-morph.ts:531` — re-entry, the only way back open
- `src/components/work/use-morph.ts:862` — a click re-enters a closed-but-on-screen shell

## Work index — grid / list switch (2026-11-19)

The index header carries a two-segment, icon-only radiogroup (Grid · List). It is the theme toggle's own track: `SegmentTrack` and `Segment` are exported from `theme-toggle.tsx` and the switch passes its glyphs as children, so the capsule's stretch-and-snap glide, the tooltips, the roving focus and the 40px coarse-pointer hit area are the same code, not a copy. The choice is remembered in localStorage (`wd-work-layout`, every access guarded); the grid is the default.

The switch cross-fades the two layouts and morphs the stack height to the incoming layout's: 200ms on `cubic-bezier(0.23, 1, 0.32, 1)`. A new switch finishes the previous one first, so it is interruptible. Reduced motion is instant. Each layout keeps its own last scroll position, so a round trip returns to where each one was (the shorter layout's clamp is applied only when the value is written, not remembered).

No layout flash and no hydration mismatch: both layouts are in the document, and the stylesheet picks one from `data-work-layout` on `<html>`, which the root layout's head script sets before paint on a hard load. The control reads that attribute through `useSyncExternalStore` (server snapshot grid), so hydration starts from the markup and settles on the real value. A client navigation reads the store and applies the attribute in a layout effect before paint.

| Trigger | Property | Duration | Delay | Easing | From → to |
| --- | --- | --- | --- | --- | --- |
| Switch | outgoing layout `opacity` | 180ms | 0 | `cubic-bezier(0.23, 1, 0.32, 1)` | 1 → 0 over the incoming |
| Switch | incoming layout `opacity` | 200ms | 0 | same | 0 → 1 |
| Switch | stack `height` | 200ms | 0 | same | current height → the incoming layout's height |
| Switch, reduced motion | — | 0 | — | — | instant swap |
| Selection moves | capsule path | 180ms leading / 220ms trailing | 0 / 120ms | same as the theme toggle | current edge → target edge |

- `src/components/work/layout-toggle.tsx:51` — `LayoutToggle`
- `src/components/theme/theme-toggle.tsx:612` — `SegmentTrack`, shared with the theme toggle
- `src/components/theme/theme-toggle.tsx:739` — `Segment` (glyph or children)
- `src/components/theme/theme-toggle.tsx:299` — the capsule's 120ms lag / 180ms leading / 220ms trailing
- `src/components/work/work-index.tsx:24` — `LAYOUT_SWITCH_MS = 200`
- `src/components/work/work-index.tsx:25` — the switch's ease-out curve
- `src/components/work/work-index.tsx:208` — the stack height morph
- `src/components/work/work-index.tsx:212` — the outgoing layout's fade
- `src/components/work/work-index.tsx:217` — the incoming layout's fade
- `src/components/work/work-index.tsx:172` — the scroll restore
- `src/components/work/work-index.tsx:69` — each layout's own remembered scroll
- `src/components/work/layout-preference.ts:14` — `wd-work-layout`
- `src/components/work/layout-preference.ts:51` — the snapshot the control reads
- `src/components/work/layout-preference.ts:73` — apply, store, announce
- `src/lib/layout-script.ts:10` — the pre-paint bootstrap
- `src/app/layout.tsx:59` — the bootstrap in the root head
- `src/components/work/work-index.css:113` — the attribute picks the visible layout
