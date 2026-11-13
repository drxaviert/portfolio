# Handoff: Site-wide motion review (2026-11-13)

## Goal
Review motion across the whole portfolio site, find what's missing or off, then log the motion you approve to the design system.

## State
- main at 5679688. Day phase picker shipped (PR #12), its motion is logged in docs/design-system/motion.md (PR #13)
  and on the Figma Design System page, frame "Motion · Day phase picker" (node 157:348). Handoff archived (PR #14).
- motion.md is the pattern to follow: one table per interaction (trigger, property, duration, delay, easing,
  from→to) plus `path:line` sources. Curve families in use: entrances cubic-bezier(0.23,1,0.32,1), exits ease-in,
  icon settle cubic-bezier(0.34,1.3,0.64,1), pill cubic-bezier(0.2,0.8,0.2,1).
- No worktree is open for this yet.

## Next
1. Read-only audit (DeepSeek worker): list every animated or transitioned element in src/, plus the static ones
   that should move. Use the find-animation-opportunities and review-animations skills, with the emil-* criteria
   in the brief. Output a ranked list with path:line, current values and proposed values.
2. The user picks which items to change. Build those in a new worktree (feat/motion-pass); try options behind
   dev sliders if needed.
3. After approval, add each one to motion.md and to the Figma motion frame (DeepSeek worker; ask the user for the
   plugin channel).

## Gotchas
- Horizon ambient WebGL: Safari always uses the CSS fallback. Check reduced motion for every item.
- Rest geometry comes from Figma; hover only grows outward.
- Use `pnpm dev:log`, not a piped `next dev`.
