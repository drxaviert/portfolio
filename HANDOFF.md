# Portfolio - session handoff (2026-11-17)

Paste this into a fresh session. It supersedes the 2026-11-09 handoff.

## Repo state (verified 2026-11-17)

| Item   | Value                                                                   |
| ------ | ----------------------------------------------------------------------- |
| Local  | `C:\Users\Dat\orca\portfolio`, branch `main`, clean, synced with origin |
| HEAD   | `b5cc189 Merge pull request #52 from drxaviert/polish/metadata-a11y`    |
| Remote | `git@github.com:drxaviert/portfolio.git` (public, pushed)               |
| CI     | `CI` workflow green on `b5cc189`; `OG image` workflow in progress       |
| Vercel | Connected: status green; branch push = preview, `main` = production     |
| Stack  | Node 24 (`.nvmrc`, `engines 24.x`; local v24.21.0), pnpm 10.34.9        |
| App    | Next 16.4.5 App Router, React 19.3, Tailwind v4, Motion 14, MDX, three  |

`NEXT_PUBLIC_SITE_URL` is unset in the repo; metadata falls back to `http://localhost:3000`, so the
Vercel project needs it for real OG/robots/sitemap URLs.

## What is shipped on main

- **Home + Horizon background** - phase glow and prototype home (#2), frame-line spotlight (#3),
  ambient WebGL drift/breathe with CSS fallback (#4), tuned glow (#8), background dim (#11), one
  compositor fade on phase change (#24), Soft focus entrance (#25), card ring scale with a 300ms
  content lead (#39), motion out of `/` first-load JS (#41); invisible perf batch (#37).
- **Nav** - Glide hover capsule (#20), no stretch across the DS glyph (#21), interruptible springs
  (#23), no shrink on theme/phase switch (#28), hover glow no longer adds a scrollbar (#36), real
  `<button>` placeholders and safe-area reader thumbs (#40).
- **Theme toggle** - Day/Night/Auto phases (#1), Day sub-row from Auto (#12, docs #13), stretch and
  snap selection highlight (#17), Day row closes on pointer leave (#46).
- **Cards / carousel** - Figma rest box and outward ring (#6), shadow card edge (#9), finger-sized
  targets and composited spotlight (#16), stepped middle-row carousel with hover peek (#33).
- **Work drawer + case-study reader** - Featured card + Expand drawer (#29), follow-ups and `/work`
  redirect (#30), back/nav restore (#31), scroll ruler (#32), first-click latency (#38), reader
  warm-up (#43), deferred `inert` (#45), focus return after close (#48), reader typography (#51).
- **Typography** - next-project arrow and 16px tuner floor (#50), reader 16px body, scale tokens and
  12px floor for T1-T4/T6 (#51); audit in `docs/handoffs/2026-11-17-typography-audit.md`.
- **Metadata / OG** - site metadata, OG card, icon, robots and sitemap (#52). The OG workflow
  recaptures `/` at 1920x1008 and commits the PNG back with `[skip ci]`.
- **Design-system docs** - `docs/design-system/tokens.md` and `motion.md` are the spec source (#7,
  #13, #26). The public procedural page is still on the design-system branch (below).
- **Tests / CI** - GitHub Actions `CI` runs install, lint, typecheck, test, build; 40 Vitest files;
  `OG image` workflow owns the social card.

## Locked design decisions

- Horizon: very subtle time-of-day glow, no rim, matte orb, neutral dark base (`horizon-glow-direction`).
- Cards and modals have no stroke; separate with `shadow-light` / `shadow-dark` (`cards-shadow-not-stroke`).
- Figma boxes are the resting geometry; hover grows outward only (`figma-is-size-source`, #6).
- Nav hover is the Glide capsule, reusing the toggle's stretch-and-snap motion (`nav-hover-glide`).
- Toggle is Day - Night - Auto, icon-only from 768px, Auto default and persisted, local-clock phases
  (`theme-toggle-auto`).
- Drawer is Featured + Expand, nav visible and identical, `/work/[slug]` intercepting route + MDX
  (`work-drawer-direction`).
- Keep the approved motion; do not re-propose a shorter ring or glow (`motion-pass-rejected`).
- Approved motion is logged in `docs/design-system/motion.md`, not Figma (`log-motion-to-design-system`).
- Design-system page = procedural token engine, defaults parity-tested against `globals.css`
  (`procedural-design-system-page`).
- No real work yet; studies stay placeholders until Dat supplies material (`real-work-intake`).

## Worktrees and branches

| Worktree                                    | Branch                    | HEAD      | Status                                                                 |
| ------------------------------------------- | ------------------------- | --------- | ---------------------------------------------------------------------- |
| `C:\Users\Dat\orca\portfolio`               | `main`                    | `b5cc189` | clean, synced                                                          |
| `workspaces\portfolio\design-system`        | `drxaviert/design-system` | `c28714f` | 34 commits after #26, 35 unpushed, 184 behind; **parked by Dat, keep** |
| `workspaces\portfolio\typography-lows`      | `fix/typography-lows`     | `b5cc189` | clean, no commits yet; T5 + T7-T12 in progress                         |
| `workspaces\portfolio\reader-typography`    | `fix/reader-typography`   | `541e14b` | merged in #51; leftover worktree, removable                            |
| `C:\Users\Dat\orca\portfolio-design-canvas` | `feat/design-canvas`      | `f43621d` | 30 ahead / 322 behind, unpushed; separate design-canvas project        |

The design-system branch adds `/design-system` (redirects `/dev/system`) and the live procedural token
engine. No PR is open yet.

Throwaway test branches with no worktree: `drxaviert/aquarium` (`8e9702e`, 2 ahead) and
`drxaviert/html-in-canvas` (`f1ee891`, 1 ahead). Both unpushed; Dat closes them. Many merged `fix/*`,
`docs/*`, `perf/*` branches remain local and can be pruned after worktree cleanup.

## Open work

1. **Typography audit** - T1-T4 and T6 shipped in #51. T5 (tracker levels 0-1 are invisible on the
   card) and T7-T12 (italic/`font-synthesis`, display leading, `::selection`, curly punctuation,
   tooltip overflow, long-title wrap) are next on `fix/typography-lows`, which has no commits yet.
   Brief: `docs/handoffs/2026-11-17-typography-audit.md`.
2. **Real case-study content** - imported 20 live studies from dattran.design in
   `feat/import-live-projects`; media slots are listed in
   `docs/work-media-manifest.md`. The three written placeholders are gone.
3. **Design-system branch PR** - the parked procedural page needs a rebase, review and PR.
4. **`viewport-fit=cover`** - Dat decision. Without it the safe-area insets from #40 are 0.

## Working rules

- Opus orchestrates: plans, specs, reviews, merges. It does not implement.
- Implementation runs on OpenCode DeepSeek workers. Never pass `--model` or `--effort`;
  `opencode.json` pins `opencode-go/deepseek-v4.1-flash`.
- Start dev servers with `pnpm dev:log`, never bare `pnpm dev` (piped output wedges Next).
- When handing Dat a test link, give `http://localhost:<port>` and `http://192.168.2.33:<port>`.
- Once Dat approves a job, merge its PR and push `main` without asking again. Commit bodies say what
  changed and why.
- A guard hook blocks worktree removal, so Dat runs the orca worktree removal command. Release the
  job's workers first and check for uncommitted or unpushed work.

## Known gotchas

- `pnpm format:check` fails on 16 files on `main`: Windows writes CRLF while Prettier expects LF.
  CI does not run `format:check`, so this is not a red build.
- Without `viewport-fit=cover`, `env(safe-area-inset-*)` is 0; the #40 thumb inset is inert.
- LAN dev only hydrates with `allowedDevOrigins` (`192.168.2.33`, `192.168.2.28` in
  `next.config.ts`). Check it in a fresh worktree before sharing a LAN link.
- Set `NEXT_PUBLIC_SITE_URL` on Vercel, or canonical/OG URLs say `localhost:3000`.
- The `OG image` bot commit lands on `main` by itself; pull with `--ff-only`.
