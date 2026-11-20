# Motion tokens — as built (2026-11-18)

This file is the value registry: every curve and duration token exactly as defined, plus the aliases
and literals that recur. The choreography (which property, on which trigger, at which beat) lives in
[motion.md](./motion.md); it is not duplicated here.

## Easing tokens

Defined in the motion-scale block, `src/app/globals.css:333-377`. Keywords stay keywords.

| Token | Value | Source | Main consumers |
| --- | --- | --- | --- |
| `--ease-standard` | `ease-in-out` | `src/app/globals.css:334` | whole-page crossfade (`:110-122`), horizon drift/breathe (`src/components/horizon/horizon-motion.css:86`, `:103`) |
| `--ease-decelerate` | `ease-out` | `:335` | interaction feedback everywhere: nav colour/scale (`src/components/home/nav-items.css:12-14`), segment feedback (`src/components/theme/theme-toggle.css:304-314`), ruler ticks (`src/components/work/scroll-ruler.css:72-74`) |
| `--ease-accelerate` | `ease-in` | `:336` | exits: phase-row close (`src/components/theme/theme-toggle.css:69-71`) |
| `--ease-linear` | `linear` | `:337` | opacity-only fades: ring edge and glow (`src/components/home/ring-hover.css:84`, `:111`) |
| `--ease-emphasized-decelerate` | `cubic-bezier(0.23, 1, 0.32, 1)` | `:338` | phase-row entrance 400ms (`theme-toggle.css:59-64`), row segments 360ms (`:76-81`) |
| `--ease-emphasized-standard` | `cubic-bezier(0.32, 0.72, 0, 1)` | `:339` | frame-line spotlight opacity (`src/components/home/frame-line-spotlight.css:96`, `:121`) |
| `--ease-spring` | `cubic-bezier(0.34, 1.3, 0.64, 1)` | `:340` | icon settle (`theme-toggle.css:214`, `:229`, `:244`, `:259`) |
| `--ease-spring-grow` | `cubic-bezier(0.165, 0.84, 0.44, 1)` | `:341` | ring grow (`ring-hover.css:31`) |
| `--ease-spring-follow` | `cubic-bezier(0.16, 1, 0.3, 1)` | `:342` | ring glow follow (`ring-hover.css:32`) |
| `--ease-step` | `steps(1)` | `:343` | z-index raise (`ring-hover.css:47`) |
| `--ease-calm` | `cubic-bezier(0.4, 0, 0.2, 1)` | `:376` | shipped home entrance (`src/components/home/home-entrance.css:162`) |

## Duration tokens

| Token | Value | Token | Value |
| --- | --- | --- | --- |
| `--duration-short-1` | `100ms` (`:345`) | `--duration-medium-4` | `280ms` (`:356`) |
| `--duration-short-2` | `120ms` (`:346`) | `--duration-medium-5` | `300ms` (`:357`) |
| `--duration-short-3` | `150ms` (`:347`) | `--duration-medium-6` | `330ms` (`:358`) |
| `--duration-short-4` | `160ms` (`:348`) | `--duration-medium-7` | `360ms` (`:359`) |
| `--duration-short-5` | `170ms` (`:349`) | `--duration-long-1` | `400ms` (`:360`) |
| `--duration-short-6` | `180ms` (`:350`) | `--duration-long-2` | `600ms` (`:361`) |
| `--duration-short-7` | `220ms` (`:351`) | `--duration-long-3` | `800ms` (`:362`) |
| `--duration-short-8` | `230ms` (`:352`) | `--duration-long-4` | `1000ms` (`:363`) |
| `--duration-medium-1` | `240ms` (`:353`) | `--duration-extra-long-1` | `4000ms` (`:364`) |
| `--duration-medium-2` | `250ms` (`:354`) | `--duration-extra-long-2` | `7800ms` (`:365`) |
| `--duration-medium-3` | `270ms` (`:355`) | `--duration-extra-long-3` | `8000ms` (`:366`) |
| | | `--duration-extra-long-4` | `8200ms` (`:367`) |
| | | `--duration-ambient-1` | `16s` (`:368`) |
| | | `--duration-ambient-2` | `110s` (`:369`) |

Main consumers, at token level: `short-1` ring edge fade/z-index, `short-2` warm tooltip/segment 2 and
reduced motion, `short-3` pointer chrome, `short-4` spotlight opacity, `short-5`/`short-7` entrance
stagger, `short-6`/`short-8` entrance stagger, `medium-1` ring fill, `medium-2` ring glow fade,
`medium-5` tooltip delay and shader fade-in, `medium-7` row segment entrance, `long-1` phase row and
theme crossfade, `long-2` icon settle, `long-3` ring grow, `long-4` ring glow follow,
`extra-long-1` clock-driven crossfade, `ambient-1`/`ambient-2` horizon breathe/drift.

## Component aliases

These are component-owned variables that point at a scale token. Recording them keeps the alias chain
visible; the token is the value.

| Alias | Value | Source |
| --- | --- | --- |
| `--horizon-transition-duration` | `var(--duration-long-1)` | `src/app/globals.css:149` |
| `--horizon-transition-ease` | `var(--ease-standard)` | `:150` |
| `--phase-auto-transition-duration` | `var(--duration-extra-long-1)` | `:154` |
| `--phase-auto-transition-ease` | `var(--ease-standard)` | `:155` |
| reduced-motion crossfade durations | `var(--duration-short-3) !important` | `:171-175` |
| `--ring-grow` | `var(--duration-long-3)` | `src/components/home/ring-hover.css:28` |
| `--ring-follow` | `var(--duration-long-4)` | `:29` |
| `--ring-fade` | `var(--duration-medium-2)` | `:30` |
| `--ring-ease` | `var(--ease-spring-grow)` | `:31` |
| `--ring-follow-ease` | `var(--ease-spring-follow)` | `:32` |
| `--entrance-ease` | `var(--ease-emphasized-decelerate)`, then `var(--ease-calm)` when shipped | `src/components/home/home-entrance.css:63`, `:162` |
| `--scale-duration` | `var(--duration-medium-7)` | `home-entrance.css:67` |
| `--ring-fill-duration` | `var(--duration-medium-1)` | `:79` |
| `--sky-glow-duration` | `var(--duration-medium-5)` | `:82` |
| `--sky-delay` | `var(--duration-short-2)` | `:83` |
| `--sky-duration` | `var(--duration-medium-7)` | `:85` |
| `--step-duration` | `var(--duration-short-6)` | `:96` |
| `--step-marker-hold` | `var(--duration-short-1)` | `:99` |
| `--grain-rate` | `var(--duration-short-1)` | `:106` |
| `--grain-delay` | `var(--duration-short-4)` | `:108` |
| `--dawn-content-duration` | `var(--duration-long-2)` | `:137` |
| `--soft-card-delay` | `var(--duration-medium-2)` | `:146` |
| `--entrance-reduced-duration` | `var(--duration-short-2)` | `:152` |
| `--wd-enter-ease`, `--wd-enter-blur-ease` | `cubic-bezier(0.25, 0.8, 0.25, 1)` (literal) | `src/components/work/entrance.css:47-48` |
| `--wd-enter-duration` | `900ms` (literal) | `:49` |
| `--wd-fade-reduced` | `120ms ease-out` (literal) | `:50`; `src/components/work/drawer-shell.css:27` |
| `--wd-actions-in` | `240ms cubic-bezier(0.23, 1, 0.32, 1)` | `src/components/work/reader.css:268` |
| `--wd-actions-out` | `140ms ease-in` | `:269` |
| `--wd-actions-reduced` | `120ms ease-out` | `:270` |
| `--wd-ruler-out` | `160ms ease-out` | `:291` |
| `--wd-ruler-enter-delay` | `calc(480ms + 80ms)` | `:295` |
| `--wd-backdrop-in` | `320ms ease-out` | `src/components/work/drawer-shell.css:24` |
| `--wd-backdrop-out` | `300ms ease` (the drawer close) | `:25` |
| `--wd-content-out` | `260ms ease` (~86% of the 300ms close) | `:26` |
| `--phase-row-exit-ms` | `240` (registered default `240`) | `src/components/theme/theme-toggle.css:25-32` |
| `--phase-enter-delay` | `0ms`, raised to `var(--horizon-transition-duration)` while a phase is switching | `theme-toggle.css:39`, `:50-52` |

## Literal curves in TS

These own their values so they run before CSS loads (`motion.md`, "Tokens"). Each is repeated here as
the shipped number, not as a proposal to tokenise.

| Constant | Value | Source |
| --- | --- | --- |
| `DEFAULT_SETTINGS.duration` | `900` ms | `src/components/home/carousel/carousel-settings.ts:20` |
| `DEFAULT_SETTINGS.ease` | `"quick"` → `cubic-bezier(0.25, 0.8, 0.25, 1)` | `:21-22`; `src/components/home/carousel/carousel-math.ts:101` |
| `smooth` | `cubic-bezier(0.5, 0, 0.1, 1)` | `carousel-math.ts:102` |
| `glide` | `cubic-bezier(0.65, 0, 0.35, 1)` | `:103` |
| `quint-out` | `cubic-bezier(0.22, 1, 0.36, 1)` | `:104` |
| `sheet` | `cubic-bezier(0.32, 0.72, 0, 1)` | `:105` |
| `RETARGET_BEZIER` | `quint-out` = `cubic-bezier(0.22, 1, 0.36, 1)` | `:113` |
| `FAR_STEP_STRETCH` | `0.15` (run × 1.15 per extra slot) | `:467` |
| `MORPH_EASE` | `[0.32, 0.72, 0, 1]` | `src/components/work/morph.ts:22` |
| `MORPH_OPEN_S` / `MORPH_CLOSE_S` | `0.48` s / `0.3` s | `:23-24` |
| `CLOSE_SCALE` | `0.95` | `:30` |
| `CAROUSEL_OPEN_S` | `DEFAULT_SETTINGS.duration / 1000` = `0.9` s | `src/components/work/carousel-step.ts:26` |
| `CAROUSEL_CLOSE_S` | `0.35` s | `:37` |
| `FADE_S` (drawer) | `0.12` s | `src/components/work/use-morph.ts:56` |
| `REVEAL_LEAD_S` | `0.3` s | `:61` |
| `FADE_S` (nav dock) | `0.06` s (half of 120ms) | `src/components/nav/nav-dock.tsx:35` |
| `SNAP_PX` | `0.5` px | `:36` |
| `PROGRESSION_EXIT_MS` | `140` ms | `src/components/work/progression.ts:19` |
| `JUMP_HOLD_MS` | `1200` ms | `src/components/work/scroll-ruler.tsx:89` |
| `ICON_SETTLE_DURATION` | `600` ms | `src/components/theme/theme-toggle.tsx:75` |
| `ICON_SETTLE_EASING` | `cubic-bezier(0.34, 1.3, 0.64, 1)` | `:76` |
| `TRAILING_DELAY_MS` / `LEADING_DURATION_MS` / `TRAILING_DURATION_MS` | `120` / `180` / `220` ms | `:299-301` |
| `PHASE_ROW_CLOSE_DELAY_MS` | `100` ms | `:18` |
| `PHASE_ROW_EXIT_MS` | `240` ms | `:28` |
| `ROW_ENTER_SETTLE_MS` | `990` ms | `:25` |
| `FADE_DURATION_MS` (glide) | `150` ms | `src/components/home/nav-items.tsx:47` |
| `TRAIL_HOLD_MS` | `100` ms | `:52` |
| `GLIDE_LEAD_SPRING` | stiffness `1100`, dampingRatio `0.9` | `src/components/home/glide-spring.ts:32-35` |
| `GLIDE_TRAIL_SPRING` | stiffness `900`, dampingRatio `0.9` | `:43-46` |
| `hover peek` timing | reveal `450ms`, retract `350ms`, leave `120ms` | `src/components/home/carousel/hover-peek.ts:36-38` |
| `PEEK_EASING` | `cubic-bezier(0.22, 1, 0.36, 1)` | `:45` |
| `TURN_EASING` | `cubic-bezier(0.4, 0, 0.2, 1)` | `:47` |
| `PEEK_FADE_MS` | `120` ms | `:48` |
| `LAYOUT_SWITCH_MS` | `200` ms (not a scale step; the outgoing layout fades over `200 - 20` = `180` ms = `--duration-short-6`) | `src/components/work/work-index.tsx:29` |
| `LAYOUT_SWITCH_EASE` | `cubic-bezier(0.23, 1, 0.32, 1)` = `--ease-emphasized-decelerate` (WAAPI cannot read the variable) | `:30` |

## Literal curves in CSS

| Curve | Occurrences | Source |
| --- | --- | --- |
| `cubic-bezier(0.23, 1, 0.32, 1)` | reader thumb/rail fades; faux-UI entrances | `src/components/work/reader.css:192`, `:268`; `src/components/faux-ui/faux-ui.css:14` (comment) |
| `cubic-bezier(0.25, 0.8, 0.25, 1)` | drawer content entrance (move and defocus) | `src/components/work/entrance.css:47-48` |
| `ease` = `cubic-bezier(0.25, 0.1, 0.25, 1)` | the whole drawer close: panel and nav flight (`DRAWER_CLOSE_EASE`), backdrop out, desktop shadow crossfade, content out | `src/components/work/carousel-step.ts:36`; `src/components/work/drawer-shell.css:25-26`, `:82` |
| `cubic-bezier(0.34, 1.3, 0.64, 1)` | icon settle in CSS transitions | `src/components/theme/theme-toggle.css:214`, `:229`, `:244`, `:259` |
| `ease-in-out` / `ease-out` / `ease-in` / `linear` | keyword literals in component rules | e.g. `src/components/home/carousel/edge-blur.ts:33-35`, `src/components/work/drawer-shell.css:24` |

## Recurring duration literals

Recorded because they appear in more than one file and are not all a scale step:

| Value | Appears in |
| --- | --- |
| `900ms` | `entrance.css:49` (drawer content), `carousel-settings.ts:20` (carousel step / drawer open) |
| `480ms` | `entrance.css:137-139` (last content beat), `reader.css:295` (ruler beat), `morph.ts:23` (nav default open) |
| `320ms` | `drawer-shell.css:24` (backdrop in) |
| `300ms` | `carousel-step.ts:35` (drawer close: panel and nav), `drawer-shell.css:25` (backdrop out), `drawer-shell.css:82` (desktop shadow crossfade), `morph.ts:24` (nav default close), `theme-toggle.css:339` (tooltip delay, via `--duration-medium-5`) |
| `260ms` | `drawer-shell.css:26` (drawer content out) |
| `240ms` | `theme-toggle.css:28`, `:32` (row exit), `reader.css:268` (actions in) |
| `160ms` | `reader.css:291` (ruler exit) |
| `140ms` | `reader.css:269` (actions out), `progression.ts:19` (hand-off exit) |
| `120ms` | reduced-motion fades, `use-morph.ts:56`, `nav-items.tsx` reduced transitions, `hover-peek.ts:48` |
| `100ms` | ring edge fade and z-index step, `nav-items.tsx:52` trail hold, `theme-toggle.tsx:18` row close delay |
| `0.06s` | `nav-dock.tsx:35` (half the 120ms reduced-motion crossfade) |

## Alignment with motion.md

One value-level disagreement was found and is recorded rather than edited. `motion.md:10` states the
drawer flies on `cubic-bezier(0.32, 0.72, 0, 1)`, its content cascades on
`cubic-bezier(0.22, 1, 0.36, 1)`, and the blur resolves on `cubic-bezier(0.25, 0.1, 0.25, 1)`. The code
today:

| Claim in `motion.md:10` | Code today | Source |
| --- | --- | --- |
| panel flies on `0.32, 0.72, 0, 1` | open `0.25, 0.8, 0.25, 1`; close `0.25, 0.1, 0.25, 1` (CSS `ease`, 300ms); `0.32, 0.72, 0, 1` is only the nav's default flight with no drawer behind it | `src/components/work/carousel-step.ts:23-36`; `src/components/work/morph.ts:22` |
| content cascades on `0.22, 1, 0.36, 1` | `0.25, 0.8, 0.25, 1` | `src/components/work/entrance.css:47-49` |
| blur resolves on `0.25, 0.1, 0.25, 1` | same curve as the move, `0.25, 0.8, 0.25, 1` | `src/components/work/entrance.css:47-48` |

`motion.md`'s own drawer sections ("Work drawer — panel and backdrop", line 360, and "content cascade",
lines 414-419) match the code; the principles paragraph at line 10 is the part that does not.
