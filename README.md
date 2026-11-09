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

- Node `22.x` (see `.nvmrc` and the `engines` field)
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
[`src/app/globals.css`](src/app/globals.css). They are placeholder values —
neutral greyscale, system fonts, default-looking type scale, spacing and
radius — and are meant to be replaced with the final design.

- Semantic colour tokens: `--background`, `--foreground`, `--muted`,
  `--muted-foreground`, `--border`, `--accent`, `--accent-foreground`.
- Light values live in `:root`; dark values live under `.dark`.
- `@theme inline` exposes the tokens to Tailwind as `--color-*`, so utilities
  such as `bg-background` and `text-muted-foreground` follow the theme.
- Type scale (`--text-xs` to `--text-4xl`), radius (`--radius-sm` to
  `--radius-lg`) and the spacing base (`--spacing`) sit in `@theme`.

## Theme

The theme is class-based: `.dark` on `<html>` selects the dark values.

- `src/lib/theme.ts` holds the storage contract (`readStoredTheme`,
  `writeStoredTheme`, `resolveTheme`). Storage failures are swallowed.
- `src/lib/theme-script.ts` is an inline pre-paint script, rendered in the
  layout's `<head>`, that applies the right class before React hydrates so
  there is no flash of the wrong theme.
- `src/components/theme/` contains the provider and an accessible toggle. A
  stored choice wins; otherwise the theme follows `prefers-color-scheme`.

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
