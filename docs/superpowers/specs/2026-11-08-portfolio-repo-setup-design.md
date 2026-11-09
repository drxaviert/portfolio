# Portfolio repo setup — design

## Intent
Set up the repo for a design-engineer portfolio so that real design and build work can start on top of it. The visual design isn't finished yet, so the setup has to stay design-neutral: plumbing ready, look undecided.

## Goals
- A working Next.js project on `main`, with tooling and tests, that builds cleanly.
- A neutral theme-token skeleton (colour, type, spacing, radius) with light/dark plumbing, ready to fill from the finished design.
- GitHub Actions CI that checks every push and PR.
- `main` pushed to the existing public repo `github.com/drxaviert/portfolio`, ready for Vercel to import.

## Non-goals
- Any page design, layout, copy, or brand choice (no hero, nav, bento, or real fonts).
- Vercel project creation (the user imports the repo on vercel.com).
- Reusing yesterday's test scaffold (deleted on purpose).

## Anti-goals
- Hard-coded colours or design values that pre-empt the design.
- A setup that builds locally but fails on Vercel or in CI.

## Constraints
- Stack: Next.js (App Router), TypeScript, Tailwind CSS v4, Motion (`motion`), MDX (`@next/mdx`), pnpm.
- Keep `opencode.json` and `.mcp.json` unchanged.
- Repo is public: no secrets, keys, or personal data committed.

## Approaches
- **A. One OpenCode worker builds scaffold + CI, then review, merge and push (chosen).** CI depends on the scaffold's scripts, so one worker keeps them consistent and avoids a merge.
- B. Two parallel workers (scaffold, CI): rejected. The CI worker would have to guess script names, and it adds a merge for little time saved.
- Bare `create-next-app` only: rejected. No tests, tokens, or CI.

## Decided
- Theme: class-based light/dark (`.dark` on `<html>`), defaulting to the system preference, no flash of the wrong theme on load, choice persisted in `localStorage` (wrapped in try/catch). A minimal accessible toggle component, unstyled beyond basics.
- Tokens: semantic CSS variables (for example `--background`, `--foreground`, `--muted`, `--border`, `--accent`) with neutral greyscale placeholder values for light and dark, exposed through Tailwind v4 `@theme`. Also type scale, spacing base and radius tokens with neutral defaults. Fonts: system font stack placeholder only.
- Placeholder Home page (`/`): renders the site name placeholder and the theme toggle only.
- Scripts: `dev`, `build`, `start`, `lint`, `typecheck`, `test`, `format`.
- Tests: Vitest + Testing Library, including a real test of theme toggling and persistence.
- CI: GitHub Actions on push and pull_request: pnpm install (frozen lockfile), lint, typecheck, test, build, on the Node version that Vercel defaults to.
- Node version pinned via `engines` and `.nvmrc` (or `packageManager` for pnpm) so CI, Vercel and local all match.
- README: stack, scripts, structure, how tokens are meant to be filled in.

## Left to the builder
Exact package versions, ESLint/Prettier config details, file layout under `src/`, MDX wiring details (it must build under the default Next.js bundler), test file layout.

## Process
Built by one Orca OpenCode worker (`opencode-go/deepseek-v4.1-flash`) in its own worktree, using Codebase Memory and Superpowers. The orchestrator reviews and re-runs checks, then merges to `main` and pushes with the user's approval. The user then imports the repo on vercel.com.
