# Handoff — /dev/prototype audited against Figma, 2026-11-10

Figma page "Design" (file `18bX1w3gLtGeKJ2KS2K2BT`), channel `jyptcofg`. Audited the
1440 Day (121:2003) and Night (121:3243) frames first, then Dawn/Dusk 1440
(121:4482, 121:5721) and the 375/768/1024/1920 Day frames. Code measured in the
browser at each viewport. No commit.

## Checked properties

| Element | Figma value (node) | Code before | Status |
| --- | --- | --- | --- |
| Page bg gradient, Day | #f8fafd 0/70%, #f3f7fd 82%, #ecf4fd 100% (121:2004) | `--surface` #e5e5e5 to 72%, tracker-2 mixes at 86/100% | fixed (new `--horizon-*`) |
| Page bg gradient, Night | #0d0d0d 0/70%, #0f0f13 90%, #111116 100% (121:3244) | same wrong mix | fixed |
| Page bg gradient, Dawn | #f8fafd 0/70%, #f9f8f7 82%, #f9f4ec 100% (121:4483) | mix | fixed |
| Page bg gradient, Dusk | #f8fafd 0/70%, #f5f8fd 80%, #f9f7f3 100% (121:5722) | mix | fixed |
| Blob left | #60a8e2 6%, 900x420 @-200/860 (121:2005) | tracker-4 6% | fixed |
| Blob right | #0071c1 6%, 1000x460 @700/820 (121:2006) | primary 4% | fixed |
| Blob left/right, Night | #6763e4 6% / #afffea 3% (121:3245/46) | tokens | fixed |
| Blob left/right, Dawn | #ff90b9 / #cb83ff 6% (121:4484/85) | tokens | fixed |
| Blob left/right, Dusk | #b4d8ff / #ffb451 6% (121:5723/24) | tokens | fixed |
| Blob blur | 180 at 1440 (handoff 2026-11-09) | 81/96/128/180 | match |
| Frame lines vertical | 1px #e5edf5, full height, x120/1319 (121:2009/10) | outline-variant (black 8%) | fixed (`--frame-line`) |
| Frame lines horizontal | 1200 wide at content −64 / +64 (121:2007/08) | missing | fixed |
| Content column | 1200 outer / 1136 inner, centred (121:2007–10) | same | match |
| Page padding, 375 | 16px | 32px (`py-8`) | fixed |
| Band heights | 420 / 560 / 360 / 416 (375→1440) | same | match |
| Main-band ratios 768 | 444/120/52/52 (121:1461) | 753/180/83/84 scaled → 457/109/50/51 | fixed |
| Main-band ratios 1024 | 656/140/64/64 (121:1737) | same scaled → 632/151/70/71 | fixed |
| Nav shell | 1136x64, r12, surface-container-low (121:2253) | same | match |
| Nav orb head | 36px, blob-left→blob-right 45°, eyes 3.4x8 @13.5/20.6 (121:2255) | primary circle + 6x10 dots | fixed (`--orb-gradient`) |
| Nav links | Work Sans 500, 16/20, px8, h32, r8, active #f2f2f2 (121:2258–63) | 16/24 line-height | fixed |
| Nav gap at 375 | 24px links→theme button (121:1425) | 8px | fixed |
| Nav divider | 1x20, black 8% (121:2264) | same | match |
| DS icon | 20x20, stroke 1.5, square/circle/square/diamond, on-surface (121:2267) | 3 rects + circle, stroke 1.4, variant | fixed |
| Theme toggle | 104x32 track r8; segments 33.3x28 r6, inset 2 (126:8942) | track match; segments 32x32 r4, inset 4 | fixed (segments 33.33x28 r6 at 2px inset; 375 button bg → `bg-toggle-track` #e5e5e5 / #0d0d0d) |
| Title, ≥768 | Work Sans 600, 40/44, −0.4px (121:2019) | 36/45, −0.36px, system sans | fixed (new `--text-title`) |
| Title, 375 | 32/35.2, −0.4px (121:1362) | 36/45 | fixed (`--text-title-sm`) |
| Title inset | 32px (20px at 375) (121:2019/121:1362) | p-5 / md:p-8 | match |
| Body copy | none in the frames (121:2017 holds only the title) | none rendered | match |
| Band gutters | 12px between top band, main band and nav (121:2003) | `gap-3` | match |
| Card fill/radius/shadow | #fff / #191919, r12, shadow-light/dark (121:2017) | same tokens | match |
| Work slivers | 180/83/84 + #f2f2f2/#e5e5e5/#d9d9d9 (121:2015/13/11) | same tokens | match |
| Play-card shell | 849x276 at 1440, r12, surface-container-low (121:2020) | same | match |
| Tracker card | 275x276, grid inset 26 top / 22 bottom (121:2022) | 26/22 at xl, 20/16 at 375 | fixed |
| Tracker grid 1440 | 223x200.75 @20/20, cells 11.125, gap 3, r2 (121:2024) | 223 wide, fluid cells | match |
| Tracker grid 768/1024 | 165x150, cells 7.5 (121:1744) | 168 wide | fixed |
| Tracker grid 375 | 98x98, 7x7, cells 11.43 (121:1367) | 16x7x2 bands, 120x111 | fixed |
| Tracker band gap | 9px | 9px | match |
| Tracker pager | 6px dots, 6px gap, L4 + 2xL2, 22px above card bottom (121:2249) | 16px above at 375 | fixed |
| Tracker cell pattern | 224 seeded cells (SVG export) | deterministic placeholder | match by design — placeholder data, ramp colours verified |

## Not fixed / left as is

- Tracker cell pattern is still the code's deterministic placeholder; Figma's
  exact 224-cell seed was not copied (content, not layout).
- Play-card art and the work-card corner button stay omitted on purpose.

## Checks

- `pnpm typecheck` exit 0 · `pnpm lint` exit 0 · `pnpm test` exit 0 (45/45)
- GET http://localhost:3000/dev/prototype → 200
