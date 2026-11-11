# Handoff: phases code done, Play card → three.js fibre fan prototype (2026-11-10)

Follows `2026-11-10-design-system-phases.md`. Orca run `run_90f0a459a8ff`. Figma channel was `1bhk4343` (changes on reconnect; ask).

## Done
- **Figma** (worker report `docs/handoffs/2026-11-10-figma-binding-report.md`): Night menu sheet 129:9705 → #262626, bound to Color · Dark surface-container. 4475 literal paints bound to phase variables; ~123 left with no matching variable (0-alpha placeholders, 6% tint blobs, #E5EDF5 guides, black captions).
- **Part B code** on branch `feat/time-of-day-phases`, NOT committed: M3 tokens + `[data-phase]` blocks (`src/app/globals.css`), `phaseFor`/`phaseForHour` (`src/lib/theme.ts`), pre-paint script (`src/lib/theme-script.ts`), provider + Day·Night·Auto toggle (`src/components/theme/`), `/dev/system`. typecheck/lint/test 42/42/build pass.
- **Day mode schedule (user decision):** 05–08 dawn, 08–17 day, 17–20 dusk, 20–02 day, 02–05 dawn (mirrored, never night). Auto: dawn 5–8, day 8–17, dusk 17–20, night 20–5. Night: always night.
- **Play card = top-right `generative-art` card** (Day 1920: 121:2300, 849×276, radius 12). NOT the top-left `emoji` card.
- **Pixel mosaic: tried and rejected.** Sent to worker: move 4 mosaics (133:11660/11447/11661/11662) to Exploration next to "Play mosaic review" 133:12263 and restore the cards Done and verified by the worker: mosaics are on Exploration (x 900, y 12000–13200); cards back to MIN/MIN alignment; Design node counts back to pre-mosaic (Day 1366, the other phases 1365); 0 missing and 0 extra nodes. Variables art/mosaic-1..3 remain unused in all 4 collections.

## Fan prototype: built, waiting for the user's review
- Files: `src/components/play/{fiber-fan,fiber-fan-settings,play-card,play-lab}.tsx|ts`, `src/app/dev/play-card/page.tsx`, `--play-bg-top/mid/bottom`, `--play-strand` and `--play-glow` tokens in each phase block, and a `data-phase-preview` guard in the theme provider so the lab's phase picker isn't overwritten by the clock. three 0.187.0 is in a dynamic chunk of ~135 KB gzip, not loaded on the home page. Default settings: strands 560, angle 168, glow 0.45, push radius 120, push strength 80, stiffness 180, damping 16. All gates pass.
- Original brief (dispatch `ctx_f1dce76942e1`, spec `…/scratchpad/spec-fan.md`, summary in memory `play-card-fiber-fan`): three.js, client-only dynamic import, strands part around the cursor and spring back, one colourway per phase via `--play-*` tokens, dev route `/dev/play-card` with tuning sliders. Not on the home page yet.

## Next
1. (done) Mosaic shelved.
2. Review the fan prototype: run `pnpm dev`, open `/dev/play-card`, tune it with the user, record the final slider values.
3. After approval: wire into the home Play card (link `/play`), then Figma stills per phase.
4. Commit the branch when the user asks (still open: the untracked `AGENTS.md` from next dev, and the docs files).
