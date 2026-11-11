# Ring hover critique — /dev/prototype (2026-11-11)

Read-only review. No file under `src/` touched. Browser: Chrome at 1440/1024/375, Day/Night,
reduced-motion on/off, hover, Tab focus, touch emulation. Measurements from element screenshots
and computed styles.

## Verdict

- **Cards — tweak.** Geometry, curve and clipping hold. Fix re-entry origin, permanent
  `will-change`, and focus/title parity.
- **Nav — tweak.** Same fixes; keyboard focus lights the wrong part of the bar.
- **Toggle — tweak, not a ring surface.** Every segment only benefits from the *nav* host, so a
  33×28 button lights the whole 1136px bar. That matches the decision record's rejected
  "Ring + nav items"; keep it, but fix the invisible focus ring.

## Findings (most severe first)

1. **Toggle focus ring is invisible** — `src/components/theme/theme-toggle.tsx:55` (also 216,
   244–245). `outline-none` sets `--tw-outline-style: none`; `focus-visible:outline-2` compiles
   to `outline-style: var(--tw-outline-style)`, so computed style is `2px none` and nothing
   paints on segments, the mobile trigger or menu rows. Fix: `outline-none` → `outline-hidden`
   (v4) or add `focus-visible:outline-solid`. Observed: Tab to Day at 1024, tooltip shows, nav
   ring opens, no outline; computed `2px none`.
2. **Keyboard focus lights the nav centre, not the focused control** —
   `src/app/dev/prototype/ring-hover.css:136-139` + `ring-pointer.tsx` (pointer only). `--ring-mx`
   is 0 on focus, so with Day focused at the bar's right end the lit border sits at x≈300–600
   (`#80b8e1`) and the control at x≈900 is unlit (`#e5edf5`). Fix: a document `focusin` handler,
   guarded by `e.target.matches(':focus-visible')`, that sets `--ring-mx/my` from the focused
   element's centre with the same math as the pointer.
3. **Pointer tracking is not rAF-throttled and re-reads layout per move** —
   `src/app/dev/prototype/ring-pointer.tsx:21-30`. `getBoundingClientRect()` on every
   `pointermove` plus two custom-property writes on the host (invalidates the card subtree);
   measured **0.41 ms/move** with a style flush on the 224-cell tracker (≈5 ms/frame at 120 Hz).
   Fix: cache the rect on `pointerenter`, coalesce into rAF, and write the vars to `.ring-glow`
   itself instead of the host so the custom property isn't inherited.
4. **Every glow is permanently layer-promoted** — `ring-hover.css:76`. `will-change: transform`
   on all 7 glows promotes 7 × 614² layers (≈10 MB GPU) at opacity 0. Fix: delete it (transform
   and opacity transitions promote themselves) or apply it only on `:hover`/`:focus-visible`.
5. **Re-entry starts from the previous exit point** — `ring-pointer.tsx:23-30`. The vars persist
   after `pointerleave`, so returning at a different corner makes the light slide across the card
   on the 1000 ms follow curve. Fix: on `pointerenter`, set the vars with `--ring-follow: 0ms`
   for one frame (or reset the vars on `pointerleave`).
6. **Reduced motion permanently opens the ring at rest** — `ring-hover.css:151-166`. With RM on,
   every frame rests at inset 0/1px, so the approved 6px/3.5px inset look disappears and each
   fill is ~12px taller / 7px wider than normal rest. If that was not the intent, keep the rest
   clip and set only `transition: none` (hover snaps open). `.ring-title` also keeps its 800 ms
   transition under RM (line 174) — add `transition: none`.
7. **Two non-composited clip-path animations + fixed glow size** — `ring-hover.css:47,84,22`.
   Frame *and* surface animate `clip-path` for 800 ms (paint-bound, worst on the 1136×64 nav);
   and 614px makes the 160px tracker ring uniformly lit while the 849px play card/nav get a
   ~450px cursor segment. Fix (lower priority): shorten the close, promote only while hovered,
   and make `--ring-glow-size` per host if parity matters.
8. **Low:** `--ring-shift-x: 4.8px` (`ring-hover.css:28`) puts the title on a fractional pixel at
   DPR1 — use 5px. The focus block (121–139) omits the title shift, so a focusable card would
   open the ring without the 4px/4.8px shift — add the title rule to it.

## What works — do not change

- Hover is gated `@media (hover: hover) and (pointer: fine)`; Tailwind v4 also wraps its
  `hover:`/`group-hover:` variants in `@media (hover: hover)`, so no sticky hover on touch
  (both matchMedia queries false under touch emulation).
- Reduced motion drops growth, title shift and z-index jump and keeps only the 250 ms glow fade.
- Glow animates transform + opacity only; geometry uses `clip-path` (no layout properties), no
  CLS, radii concentric (12 outer / 11 inner at 1px), glow clipped by the frame (no bleed).
- CSS transitions, not keyframes — interruptible and retargets from the current state; no React
  render per `pointermove`.
- 800 ms growth reads ~400 ms (expo-out ≈84% at 300 ms) and the 1000 ms follow reaches ~75% in
  200 ms, so neither feels slow in practice.
- Per-phase glow tokens; settled day lit ring `#7eb6e0`, night `#5e7491`–`#627d92` (night ≈1.8×
  stronger; decorative, not a control boundary).
- The toggle itself has no hover animation — appropriate for a high-frequency control.

## Not verified

- No real touch hardware (CDP emulation only, no iPad): tap feedback is the menu opening; there
  is no `:active` press state anywhere (the promoted CSS also dropped the proto's
  `.ch-card:active { scale(.99) }`).
- No frame trace on low-end hardware, so the clip-path paint risk is unquantified.
- No focusable card exists on /dev/prototype, so the card keyboard state can't be exercised.
- Chrome only; Safari/Firefox rendering of `clip-path` + `:has` not checked.

## Environment

The dev server on :3000 was pegged at 100% CPU and never answered; killed PID 15576 and
restarted `pnpm dev`. It is running at http://localhost:3000 again.

## Fixed (2026-11-11)

Findings 1–5 approved and fixed; 6 held for later; 7 skipped; 8 only the title shift.

1. **Toggle focus ring** — `theme-toggle.tsx:55-56` (segments), `:216` (mobile trigger),
   `:244-245` (menu rows): `outline-none` → `outline-hidden`, plus `focus-visible:outline-solid`.
   `outline-hidden` alone still sets `--tw-outline-style: none` in v4.3, so `outline-2` stayed
   `2px none`. Verified in Chrome: Tab to Night at 1440 → `solid 2px rgb(253,104,80)` offset 2;
   Tab to Day → `solid 2px rgb(54,135,217)`; 375 trigger → `solid 2px` offset 2; open-menu Day row
   → `solid 2px` offset -2.
2. **Keyboard focus position** — `ring-pointer.tsx:138-166` (`focusin`, `:focus-visible` guard,
   snap from the control centre), listener at `:205`. Verified: Night focused at 1440 →
   `--ring-mx: 500px` written on the glow (host blank), nav border sampled `#4c5a79`–`#5f7891`
   at x≈900–1120 vs `#24242b` at x≤700; Day focused → `--ring-mx: 466.66px` for the segment at
   x=1163.
3. **Pointer tracking** — `ring-pointer.tsx:31-52` (rAF flush), `:54-70` (snap), `:72-92`
   (activate), `:115-136` (move), `:193-199` (scroll/resize refresh): rect cached on enter and
   invalidated on scroll/resize, writes coalesced in rAF to `.ring-glow`. Verified: 500 synthetic
   moves → 2 style mutations, 0.019 ms/event (was 0.41 ms); the host has no inline vars; scrolling
   8px moved `--ring-my` by exactly +8.
4. **`will-change`** — removed from the rest state (`ring-hover.css:76` before), scoped to hover
   (`:107-110`) and focus (`:136-140`). Verified: 5 idle glows `auto`; hovered tracker and focused
   nav `transform`.
5. **Re-entry** — `ring-pointer.tsx:54-70`, `:94-113`, `:168-191`: enter snaps with
   `--ring-follow: 0ms` for two frames, then removes it; `pointerleave` clears the active host so
   the next entry snaps. Verified: enter bottom-right → `--ring-mx: 127.5px`, `--ring-my: 128px`,
   `--ring-follow: 0ms`, transform already there; 3 frames later the follow is blank.
8. `--ring-shift-x` 4.8px → 5px — `ring-hover.css:28`.

Reduced motion and the hover gating were re-checked unchanged: RM frame `inset(0)`, surface
`inset(1px)`, no frame transition, glow opacity-only with `transform: none`; touch `(hover:hover)`
false and the frame stays at `inset(6px 3.5px)`. Checks: `pnpm typecheck` 0 · `pnpm lint` 0 ·
`pnpm test` 45/45. The dev server hung twice during the session (100% CPU) and was restarted;
it is running at http://localhost:3000.
