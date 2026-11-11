# Worker brief: toggle reorder + icon-only desktop test (2026-11-10)

Figma file 18bX1w3gLtGeKJ2KS2K2BT, page "Design". Plugin channel is now **1bhk4343** (bridge ws://localhost:3055 is running). Join it before any command.

## Task A: reorder the theme toggle to Day · Night · Auto (it is Day · Auto · Night now)
Reorder the segments so they run Sun (Day), then Moon (Night), then Clock (Auto). This is a left-to-right order in segmented toggles and top-to-bottom in the menu. Apply it everywhere the toggle appears:
- Frame 122:7858 "Theme toggle · 3-segment": every variant in it (labelled 256×32 light and night, icon-only 104×32 at 768, etc.).
- Phone theme button frames 124:8503 (light) and 124:8532 (night): the button shows the current mode's icon, so just confirm nothing there depends on the order.
- Open-state menu frame 124:8553: reorder the menu rows to Day, Night, Auto. Keep the check mark on whichever option it is on now.
- The toggle in all 20 navs inside the dim sections: 121:1349 (Day), 121:2589 (Night), 121:3828 (Dawn), 121:5067 (Dusk).

How: in auto-layout parents, move the Night segment to index 1 and Auto to index 2. Keep the **selected state on the same mode**: if Auto was selected, it stays selected, now in the 3rd slot. Do not change sizes, colours, radius 8, the 84px segments, the 16px icons at 1.4 stroke, or Work Sans Medium 16. Leave the original (non-dim) sections at y 13700–20500 alone.

## Task B: icon-only desktop test (comparison frame)
1. Find one 1024+ (desktop) nav in the Day dim section and one in the Night dim section.
2. Duplicate each nav twice into a NEW frame "Toggle test · desktop labelled vs icon-only", placed to the right of 122:7858 with 200px clearance. Use a 2×2 grid with rows Light / Night and columns "Labelled 256×32" / "Icon-only 104×32", and put a small text label above each column.
3. In the icon-only copies, swap the labelled toggle for the icon-only 768 version: 104×32, 32px segments, 16px icons, same track and selected colours. Light: track #E5E5E5, selected white. Night: track #0D0D0D, selected #333333. Use the new Day · Night · Auto order. Keep the nav's other spacing and alignment intact, with the toggle in the same anchor position.
4. Add a tooltip mock in each icon-only copy, hanging under the Auto segment. It should be a small pill reading "Auto · follows your clock": Work Sans Regular 13, padding 6/10, radius 6, 6px below the toggle. Light: bg #1A1A1A with white text. Night: bg #F2F2F2 with #191919 text.

## Constraints
- Edit only the nodes listed above and the new comparison frame. Delete nothing.
- At most 3 screenshot exports in total. Verify with node data (child order, sizes) instead of images.
- Any failure to reorder an instance (e.g. a locked component) counts as a failure: report it, don't work around it by detaching unless the toggle is already a plain frame.

## Evidence to report (≤25 lines)
- The number of toggles reordered, per section and frame, plus any that you skipped and why.
- For 3 sample toggles (one each from 122:7858, 124:8553 and a dim nav): the child order of names after the change, and which segment is selected.
- The ID of the new comparison frame and the IDs of its 4 navs.
