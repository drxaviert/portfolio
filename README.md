# Portfolio

A design-neutral Next.js scaffold for a design-engineer portfolio: tooling,
theme plumbing, tests and CI are in place, while the visual design is still
undecided.

## Stack

- [Next.js](https://nextjs.org/) (App Router, Turbopack) with React and
  TypeScript
- [Tailwind CSS v4](https://tailwindcss.com/) via PostCSS
- [Motion](https://motion.dev/) for animation
- MDX (`@next/mdx`) for content pages
- [Vitest](https://vitest.dev/) + Testing Library for tests
- ESLint and Prettier
- pnpm

## Requirements

- Node `24.x` (see `.nvmrc` and the `engines` field)
- pnpm `10.34.9` (pinned through `packageManager`; run
  `corepack enable` or use the matching pnpm version)

## Getting started

```sh
pnpm install
pnpm dev
```

The app runs at http://localhost:3000.

## Scripts

| Script              | What it does                     |
| ------------------- | -------------------------------- |
| `pnpm dev`          | Start the dev server             |
| `pnpm build`        | Production build                 |
| `pnpm start`        | Serve the production build       |
| `pnpm lint`         | Run ESLint                       |
| `pnpm typecheck`    | Type-check with `tsc --noEmit`   |
| `pnpm test`         | Run the Vitest suite once        |
| `pnpm format`       | Format the repo with Prettier    |
| `pnpm format:check` | Check formatting without writing |

## Structure

```text
.
├── .github/workflows/ci.yml   # GitHub Actions checks
├── src/
│   ├── app/                   # App Router routes, layout and global CSS
│   ├── components/            # React components
│   └── lib/                   # Framework-free modules (theme, scripts)
├── mdx-components.tsx         # MDX component mapping
├── next.config.ts             # Next.js + MDX configuration
├── vitest.config.ts           # Test runner configuration
└── vitest.setup.ts            # Testing Library / jest-dom setup
```

Routes live in `src/app`; `page.tsx` is the placeholder home page, and any
`page.mdx` file becomes a route as well. Import local modules through the
`@/*` alias, which maps to `src/*`.

## Design tokens

All tokens are CSS custom properties in
[`src/app/globals.css`](src/app/globals.css), named after Material 3 roles. Each
of the four time-of-day phases (dawn, day, dusk, night) sets a full palette
under `[data-phase="…"]` on `<html>`; `:root` is the no-script Day fallback.

- Colour roles: `--surface`, `--surface-container-low` …
  `--surface-container-highest`, `--on-surface`, `--on-surface-variant`,
  `--outline`, `--outline-variant`, `--primary`, `--on-primary`, `--secondary`,
  `--tracker-0`–`--tracker-4`, `--toggle-track`, `--toggle-selected`.
- `@theme inline` exposes them to Tailwind, so utilities such as `bg-surface`
  and `text-on-surface-variant` follow the active phase.
- Cards and menus take `--shadow-card` through the `shadow-card` utility: three
  soft black layers on Dawn, Day and Dusk, a 1px white ring at 8% on Night.
  They never get a border.
- Type scale (`--text-xs` to `--text-4xl`), radius (`--radius-sm` to
  `--radius-lg`) and the spacing base (`--spacing`) sit in `@theme`.
- `/dev/system` renders every token, the tracker ramps, the shadows and the
  toggle in all four phases. It is dev-only and returns 404 in production.

## Theme

`data-mode` and `data-phase` on `<html>` drive the tokens; `.dark` stays in sync
for Night.

- `Mode = "day" | "night" | "auto"`, `Phase = "dawn" | "day" | "dusk" | "night"`.
- Auto follows the local clock: dawn 5–8, day 8–17, dusk 17–20, night 20–5.
  Day follows the same clock but mirrors the night hours back onto their
  neighbours — 20–2 reads as day, 2–5 as dawn — so it never shows night. Night
  is always Night. The default, on a first visit, is Auto.
- `src/lib/theme.ts` holds `phaseFor`, the storage contract
  (`readStoredMode`, `writeStoredMode`) and the migration of the old
  `light`/`dark` values.
- `src/lib/theme-script.ts` is an inline pre-paint script, rendered in the
  layout's `<head>`, that mirrors the same logic so there is no flash of the
  wrong phase. The provider re-checks the hour every 60 s and on
  `visibilitychange`.
- `src/components/theme/` contains the provider and the 3-segment toggle
  (Day · Night · Auto). At 768 and up it is an icon-only 104×32 radiogroup with
  tooltips; below that it is a 32×32 button that opens a menu above it.

## Testing

Tests use Vitest with Testing Library and jsdom. Test files sit next to the
code they cover (`*.test.ts`, `*.test.tsx`). Run them with `pnpm test`.

## CI

[`.github/workflows/ci.yml`](.github/workflows/ci.yml) runs on every push to
`main` and on every pull request: it installs with a frozen lockfile, then
runs lint, typecheck, tests and the production build on the Node version from
`.nvmrc`, with the pnpm version from `packageManager`.

## Deploy

Deploys go through [Vercel](https://vercel.com/): import the GitHub repository
in the Vercel dashboard and Vercel builds it with the same scripts. No
repository-specific Vercel configuration is committed. The Node version comes
from `.nvmrc`/`engines`, so local, CI and Vercel stay aligned.
