# Handoff: work drawer, spec and plan done (2026-11-13)

**Goal:** ship the `/work/[slug]` case-study reader.

## Decisions (Dat)

- **Setup:** Featured, Expand, Header nav, Margin content.
- **Why:** he likes the nav as a header; the Margin layout gives him freedom with his content.
- **Blur:** content scrolls under the nav, visible but heavily blurred toward the top. Stacked `backdrop-filter` bands were picked over alternatives.
- **Close row:** removed because it was "too far to reach". The ways back are:
  - a sticky "← Work" link in the left margin;
  - Esc;
  - browser back;
  - the nav's logo and "Work" link;
  - below 1024px, round buttons at the bottom of the screen.
- **Back-to-top:** "↑ Top" appears after one screen of scrolling.
- **Resize bug:** must be fixed. Root cause: the prototype measures geometry once and never re-measures on resize.
- **Faux-UI:** the featured card uses the faux-UI **Tiles** scene. Scenes arrive by merging `drxaviert/faux-ui` into main, which needs Dat's OK.

## Files

- Spec, approved: `docs/superpowers/specs/2026-11-13-work-drawer-design.md`
- Plan, 8 tasks: `docs/superpowers/plans/2026-11-13-work-drawer.md`
- Commits: `9aebef3`, `e3c6026`, `d11e72f`, plus a final a11y-row commit.

## Gotchas

- `HomeNav` items are `<span>`s. Task 4 turns the logo and "Work" into Links, with zero visual change.
- The repo has no parity script. The 24/24 nav parity check is done by hand (rects plus computed styles).

## Next

- Dat must review the plan and choose the execution method (subagent-driven vs native). Then dispatch DeepSeek workers task by task with `--worktree current`.
- Before telling the orchestrator `worker_done`, check what scope it expects. The original brief said to report after the spec and plan were done.

## Motion to log (after approval)

| Motion | Values |
|---|---|
| Expand open | 480ms, `cubic-bezier(0.32, 0.72, 0, 1)` |
| Expand close | 300ms ease-in |
| Content fade | in 240ms `cubic-bezier(0.23, 1, 0.32, 1)`; out 140ms |
| Title flight | Same timing as the expand. Fades out over 180ms ease-out after a 50ms delay. Now transform-based. |
| "↑ Top" fade | 150ms |
| Reduced motion | Opacity only, 120ms ease-out |
