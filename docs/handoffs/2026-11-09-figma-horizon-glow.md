# Handoff — Horizon time-of-day glow (Figma), 2026-11-09

**Figma file:** Portfolio `18bX1w3gLtGeKJ2KS2K2BT`, page "Design".
**Chosen direction:** row 3 of frame `115:621` "Horizon · time of day · frosted" → "Variant · no rim, solid cards".

## Chosen frames (no rim, solid cards)
| Phase | Node | Base |
|---|---|---|
| Dawn (Stripe "Sunrise") | `115:1037` | light |
| Day (Stripe "Daytime") | `115:1088` | light |
| Dusk (Stripe "Dusk") | `115:1139` | light |
| Night (Stripe "Night") | `115:1190` | dark |

Each frame = clone of Final · Glass rim head A, with:
- **Background** — child `bg / stripe gradient` (at back): vertical linear gradient, flat neutral to 70% height, then a barely-tinted bottom edge. Light base `#F8FAFD`; Night base `#0D0D0D` → `#15151F`-ish. Two blurred ellipses (`blob left …`, `blob right …`, LAYER_BLUR 180) at the bottom corners, ~6% opacity (Night ≈3–6%). Colors come from the board "Time-of-day color · Stripe test" (`103:2238`), heavily muted.
- **Cards** — rim removed: outer card frames carry the original fills (work cards graded `#D9D9D9/#E5E5E5/#F2F2F2`, dark `#404040/#333333/#262626`; others `#FFFFFF` / `#191919`), radius 12, linked to effect styles **shadow-light** / **shadow-dark**. Inner `content` frames are transparent with no effects.
- **Orb head** — face vector gets the phase "ray" gradient (base color 0–35%, tip mixed 45% toward base at the bottom); specular highlight (55% white vector) hidden, not deleted. Night face is white.

Rows 1–2 of `115:621` (frosted / frosted rim + solid inner) and frames `114:42`, `114:46…`, `115:410` are earlier explorations — candidates for cleanup, ask before deleting.

## User feedback that shaped this
- Wants **serene, ethereal, subtle** — like stripe.com's stats section (`stats-section--time-dusk`). Light mode must be as quiet as dark mode.
- Dark mode must stay neutral near-black; blue tints "take away the clean premium feel".
- Prefers Horizon placement (color at bottom edge + corners) over centered radial glow.
- Orb should be matte, not shiny.

## Tooling
- Bridge: `powershell -File C:\Users\Dat\.claude\skills\figma-connect\scripts\ensure-bridge.ps1` (dies on restart). Plugin channel changes on every reconnect — ask the user.
- Claude Code + OpenCode/DeepSeek now both use the fork MCP server (`claude-talk-to-figma-mcp\dist\talk_to_figma_mcp\server.js`, 92 tools incl. `set_gradient`, `set_effect_style_id`). Needs a Claude Code restart to load in-session.
- Raw WebSocket helpers in `docs/handoffs/figma-scripts/` (`ws.js` = promise `call(cmd, params)`, `fig.js` = run a JSON list of commands). Update the channel constant first.
- Session-budget hook (`~/.claude/hooks/handoff-budget.cjs`, PostToolUse `*`) injects a "write a handoff now" instruction at ≥100k context or ≥10 images; limits via `HANDOFF_TOKEN_LIMIT` / `HANDOFF_IMAGE_LIMIT`.
- Gotchas: local effect style ids end with a comma (`S:<key>,`); `get_node_info` positions are floats (compare with ranges); plugin coerces shadow `radius: 0` to 5, so pass `0.0001`.

## Possible next steps
- 1px hairline (≈6% black) on light cards if edges look too faint near the top.
- Prototype: wire the four phases to the Light/Dark switch (1.2s crossfade, cubic-bezier(0.65,0,0.35,1) per the board).
- Implement in code: CSS vars for the phase palettes + `prefers-color-scheme` / time-of-day switch.

## Breakpoints (added 2026-11-09)
Section `117:152` "Day · breakpoints" (page Design, y=13700): Day no-rim reflowed at 375 (`117:153`), 768 (`117:205`), 1024 (`117:257`), 1440 source copy (`117:309`), 1920 (`117:361`).
- 1920: 1136 max-width column centred. 1024/768: 32 gutters; tab cards narrowed (1024 fits a 768-tall viewport).
- 375: 16 gutters, highlight full-width, work tabs become horizontal bars, nav compact (divider, DS icon, theme labels and Dark segment hidden → single sun toggle).
- Blobs scaled to width; blur reduced below 0.9× (375 → 81, 768 → 96, 1024 → 128).
- Open: mobile "Project name" probably wants a smaller type step and 20–24 padding.

## Session close (2026-11-10)
- Global rule added to ~/.claude/CLAUDE.md (Model routing): Opus only orchestrates, no exceptions; all hands-on work goes to a DeepSeek worker first, Sonnet if needed.
- Next: DeepSeek worker applies mobile title fix (smaller type step, 20-24 padding in highlight card of 117:153) and replicates the breakpoint section for Dawn/Dusk/Night. Brief must include channel, node ids, layout boxes from the build, and that ws.js must be copied as .cjs (repo is type:module) and work cards are rotated 180 deg.

## Frame lines (2026-11-10)
- Stripe-style 1px vertical hairlines at the content-column edges, outside the cards, in the 4 chosen time-of-day frames and the 5 Day breakpoint frames: frame-line/left|right, 117:413-430, index just above bg.
- Light frames: #E5EDF5 solid. Night: white 8% (placeholder; Stripe's dark token unverified).
- PRODUCTION: border-inline 1px solid #E5EDF5 on a max-width wrapper (Stripe: .stats-section__border, max-width content+2px, margin-inline auto) with mix-blend-mode: multiply (light) / exclusion (dark). Figma lacks blend via plugin: set Multiply/Exclusion manually on frame-line/* layers. Note also placed in Figma section 117:152.
- Research report: C:/Users/Dat/AppData/Local/Temp/claude/d69626ef595bb6b7/b776f243-2c4a-419d-8c11-7f085a4ff0cf/scratchpad/frame-lines-report.md

## Session 3 (2026-11-10) — all phases at all breakpoints
- Sections on page Design, stacked below 117:152 Day: 117:432 Night (375 117:433, 768 117:487, 1024 117:541, 1440 117:595, 1920 117:649), 117:812 Dawn (117:813/869/925/981/1037), 117:1093 Dusk (117:1094/1150/1206/1262/1318). Each is a Day clone with only bg stops, blob colors and orb ray gradient swapped (Night also recolors cards #404040/#333333/#262626 + #191919, shadow-dark, text, Theme=Dark head). 14 Night layers per frame are literal paints, not variable-bound.
- 375 title fix (Day + all clones): Project name 40→32, leading 35.2, highlight padding 20.
- Night orb face: ray gradient #E7FFF9 @0 / @0.35 → #A1A9ED @1 (115:1190 + Night breakpoints); matte, specular hidden.
- Frame lines: Multiply on light, Exclusion on dark (set via figma-console `figma_execute` + Desktop Bridge plugin; talk-to-figma has no blendMode setter). Added frame-line/top|bottom spanning between the vertical lines' outer edges; gap g from content (top: above topmost card, bottom: below nav) = 64 at 1440/1920 (y 57/966 and 85/994). Lines exist ONLY at 1440 and 1920 (+ phase frames 115:1037/1088/1139/1190); removed from 375/768/1024 per user. Code: show frame lines only at ≥1440px.
- Horizontal-line constraint is SCALE; vertical lines MIN — corners only align at design sizes.
- Tooling: figma-console (Desktop Bridge, port 9223) can run arbitrary plugin JS — use it for anything the talk-to-figma fork lacks.
- Next: optional 1px hairline on light cards; prototype the phase/theme switch; implement in code (CSS vars per phase, frame lines ≥1440).
