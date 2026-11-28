# Drag canvas (Motion & Stills)

Route: `/work/motion-and-stills` (`CanvasReader` -> `InfiniteCanvas`; dev proto at `/dev/proto/canvas`).

## Content
- `CANVAS_MEDIA` in `src/components/canvas/items.ts`: the Optimized-folder set, grouped by project.
- Files from a project's `not-canvas` subfolder have manifests but stay off the canvas.

## Grouping
- `clusterLayout` (`src/components/canvas/clusters.ts`) fills every grid cell; each project
  grows as one 4-connected patch of cells. No offsets: tiles sit on the grid with a uniform gutter.
- Patches are seeded centre-out in viewport units, so the layout re-flows on live resize.
- Single-item projects are single cells; large projects (Personal) form large patches.

## Featured order
- `FEATURED_PROJECTS`: Google, NIOD, Tribeca Film Festival, Ordinary, Cash App are seeded first,
  so the first view (1440x900) shows them around the centre.

## Actions
- Drag/scroll pans; click a tile opens the focus viewer; arrow keys glide to the adjacent tile.
- Viewer project chip (`ProjectChip`, `focus-viewer.tsx`): a Next `Link` to
  `projectHref(project)` (`/work/<slug>`). A press that moves more than
  `PAN_TUNING.click.maxDistancePx` is a drag and does not navigate.
- Projects without a case study (Infiniti, Attitude) render a plain label.

## States
- Chip: hover (hover-capable pointers only), press scale 0.97, focus-visible ring, 44px hit area.
- Hover tag (`.cv-hover-tag`): after 200ms on a tile, a pill names the tile's project
  (`projectLabel`), follows the pointer, `pointer-events: none`, hidden on `hover: none` (touch).

## Media
- Tiles play the small `canvas.mp4` rendition; the focus viewer plays the full-size `video.mp4`
  and draws the widest image source (`fullResSource`).
- `pnpm post --original` serves the source file byte-for-byte as that full-size asset
  (SHA-256 verified in R2); no HLS ladder or size caps in that mode.
