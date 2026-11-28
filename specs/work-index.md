# Work index

Route: `/work` (`WorkIndexPage` -> `WorkIndex` -> `WorkList`), inside the drawer panel.

## Content
- One row per study from `listWork()`: year, title, summary, role.
- Order: Motion & Stills (`PINNED_SLUG`) first, then the featured study (`FEATURED_SLUG`),
  then `WORK_ORDER`.

## Top row
- Breadcrumb ("Home / Work") on the left, the Motion/3D filter pill on the right.
- Both play the list's entrance (`wd-work-soft`) as its first beat when the drawer opens.

## Motion/3D pill
- A toggle button (`aria-pressed`), on by default: every study shows.
- Off: every `role: Motion/3D` study hides except Motion & Stills (`filterWork`).
- The state is kept for the session's client navigation (Home and back keeps it);
  a reload starts on again.

## States
- Filter out: leaving rows stay mounted and `inert`, rise 10px then fade and blur,
  staggered bottom-up over the visible rows; they are removed when the last one ends.
- Filter in: arriving rows play `wd-work-soft`, staggered top-down.
- A click mid-change reverses from the current rows. Reduced motion: 150ms fade.
- Hover thumbnail and dim reset whenever the rows change.

## Layout
- The scroll area reserves the scrollbar gutter on both edges (`stable both-edges`),
  so the column is centred on the panel and nav; the case-study reader does the same.
