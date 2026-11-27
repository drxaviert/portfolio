# Cosmic sky (music mode)

Route: every page that mounts `SharedHorizon` (home is the main one); no route of its own.

What is on it
- A decorative top-half sky over the horizon: night stars, a pale aurora by day, dusk stars plus aurora, dawn aurora.
- Two fixed layers, `aria-hidden`, no pointer events: the main sky under the edge blur, and a z-41 star canvas for stars inside the blur band.

Actions
- Press play on "Door to the Cosmos": `<html data-listening="true">` fades the sky in (3.5s, `--ease-calm`); pause fades it out (1.2s).
- Switch the theme phase: the sky repaints in the new phase inside the theme crossfade.
- `?tune=1` opens the Cosmic sky tuning section; `?listen=1` forces the listening state without playback.

States
- Idle / not listening: invisible, no animation frames running.
- Listening: stars twinkle and drift, aurora sways; audio bands (bass, mid, high, energy) add light reactivity. Production audio is YouTube, so bands are 0 and only the ambient motion shows.
- Reduced motion: still frame after a 400ms crossfade, no reactivity.
- No 2D canvas: static CSS fallback of the same looks.
- Tab hidden: the loop stops and resumes on return.
- Resize: repaints in the same frame; stars keep their positions.
- Dusk: the left horizon blob is rose-200 at alpha 0.12 (`--horizon-1`, dusk block in `globals.css`).
- Dusk + music mode: `--horizon-1-listen-damp` (0.65 at dusk, default 1) softens it. The CSS fallback without WebGL is not damped.

Spec: `docs/design-system/motion.md` (Cosmic sky).
