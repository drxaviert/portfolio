# Handoff: v7 play card, variable binding, and /dev/prototype (2026-11-11)

Follows `2026-11-11-faithful-v4-and-corner-button.md`. Orca run `run_90f0a459a8ff`. The talk-to-figma channel is now `jyptcofg`, and Figma has the **Design** page open.

## Decisions (user)
- Play card strands and orbs: use **v3 sizing** (stroke and orb size from v3 Day 148:16181), white, an orb on every tip, and an even fade (no ghosted top with solid sides). Keep the v4 gentle-bend geometry, ≤68% height.
- Play card background: **match the page horizon glow**, started fresh. Rejected: v5 white→blue and v6 yellow/green/blue (the `--play-*` mix). The horizon glow exists only in Figma (Day frame 115:1088 "bg / stripe gradient"); the code body is flat `--surface`.
- Corner button: **on hold**. The user wants to think about it. Don't build it.
- Figma label captions (`#1a1a1f` / `#6b6b78`): unimportant, so leave them unbound.

## State
- **v6 Day** built (card 149:16512) and rejected. Export: C:/Users/Dat/orca/portfolio-handoff-images/play-cards/faithful-v6-day.png.
- **v7 Day IN PROGRESS** on DeepSeek worker dispatch `ctx_1bf3f3cf63f9`, building a new row below v6 in section 133:13342. Export target: C:/Users/Dat/orca/portfolio-handoff-images/play-cards/faithful-v7-day.png. It may need the user to switch Figma to the Exploration page.
- **Variable binding DONE** (Sonnet with figma-console): 55 fills and strokes in the play-card v3–v5 rows and the work-card section, all with unchanged colours. Day and Night are separate collections ("Color · Light" / "Color · Dark"), so no modes were needed. Left as literals: gradients, strand art, Night `#fff2ea` art strokes, 0%-opacity fills, labels.
- **Prototype DONE** at `/dev/prototype` (src/app/dev/prototype/: page.tsx, horizon-background.tsx, prototype-nav.tsx, tracker-widget.tsx), built from the Design page's 1440 Day/Night frames with an empty top-right play-card shell. Typecheck, lint, 45/45 tests and HTTP 200 all pass. eslint.config.mjs now ignores `docs/handoffs/figma-scripts/**`. Known gaps: Work Sans isn't loaded; the title is 40px against the 36px token step; the horizon blob hues were mapped to tokens.

## Gotchas
- DeepSeek/OpenCode workers have no figma-console. Send binding work to Sonnet. figma-console also needs the **Desktop Bridge** plugin running (port 9223).
- The talk-to-figma channel changes on every plugin reconnect. Workers stall silently, so send them the new channel.

## Next
1. Review the v7 Day export when the worker reports, then show it to the user.
2. After approval, build Dawn, Dusk and Night v7, each over its own phase horizon glow.
3. Prototype follow-ups as the user requests: load Work Sans, then drop the play art in once v7 is approved.
4. Faithful in code: phase tokens matching the horizon glow, remove unpicked variants in src/components/play/variants/, and add cursor sway (v4 bend as the rest pose).
5. Commit only when asked. The branch has a lot of uncommitted work.
