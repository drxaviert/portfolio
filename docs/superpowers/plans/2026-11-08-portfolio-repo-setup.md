# Portfolio Repo Setup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A design-neutral Next.js portfolio scaffold with theme plumbing, tests and GitHub Actions CI, ready to push and import into Vercel.

**Architecture:** Next.js App Router app under `src/`. Design tokens are semantic CSS variables in `src/app/globals.css`, swapped by a `.dark` class on `<html>` and exposed to Tailwind v4 through `@theme inline`. Theme state lives in one small client module plus an inline pre-paint script. CI runs the same pnpm scripts used locally.

**Tech Stack:** Next.js (App Router, latest stable), React, TypeScript, Tailwind CSS v4, `motion`, `@next/mdx`, pnpm, ESLint, Prettier, Vitest + Testing Library + jsdom, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-11-08-portfolio-repo-setup-design.md`

## Global Constraints

- Stack: Next.js (App Router), TypeScript, Tailwind CSS v4, Motion (`motion`), MDX (`@next/mdx`), pnpm.
- Do not modify `opencode.json` or `.mcp.json`.
- Public repo: no secrets, keys or personal data committed.
- No design: no brand colours, custom fonts, hero, nav or layout. Neutral greyscale placeholders and the system font stack only.
- Node 22 everywhere: `"engines": { "node": "22.x" }`, `.nvmrc` containing `22`, CI `node-version: 22`. Pin pnpm through `"packageManager": "pnpm@<installed version>"`.
- Scripts: `dev`, `build`, `start`, `lint`, `typecheck` (`tsc --noEmit`), `test` (`vitest run`), `format` (`prettier --write .`), `format:check`.
- Commit on your own branch in the small commits listed below. Do not push, merge or open PRs.

## Review Focus

- `localStorage` throws (private mode, blocked storage): the theme still works for the session, and nothing crashes. Test in Task 2.
- No stored choice: the theme follows `prefers-color-scheme`. Test in Task 2.
- A stored value that isn't `"light"` or `"dark"`: it's ignored and the system preference is used. Test in Task 2.
- The page loads with the correct theme before React hydrates (no flash) and without a hydration warning. Checked in Task 2 via the built HTML.
- CI and Vercel install with a frozen lockfile and the same Node/pnpm versions as local. Checked in Task 3.

---

### Task 1: Project scaffold and tooling

**Files:**
- Create: `package.json`, `pnpm-lock.yaml`, `.nvmrc`, `.gitignore`, `tsconfig.json`, `next.config.ts`, `mdx-components.tsx`, `postcss.config.mjs`, `eslint.config.mjs`, `.prettierrc.json`, `.prettierignore`, `vitest.config.ts`, `vitest.setup.ts`
- Create: `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css`
- Test: `src/app/page.test.tsx`

**Interfaces:**
- Produces: the `@/*` → `src/*` path alias; the pnpm scripts above; `RootLayout` in `src/app/layout.tsx` (Task 2 wraps its children); `globals.css` imported by the layout (Task 2 fills it with tokens).

- [ ] **Step 1:** Use Codebase Memory (index this worktree, then `get_architecture`) and record what exists (expected: only `opencode.json`, `.mcp.json`, `docs/`).
- [ ] **Step 2:** Scaffold with pnpm: Next.js App Router, TypeScript, Tailwind v4, ESLint, `src/` dir, `@/*` alias. Add `motion` and `@next/mdx` (+ `@mdx-js/loader`, `@mdx-js/react`, `@types/mdx`), Prettier, Vitest, `@testing-library/react`, `@testing-library/jest-dom`, `jsdom`. Set `engines`, `packageManager`, `.nvmrc` and scripts per Global Constraints. `.gitignore` must ignore `.superpowers/`, `.next/`, `node_modules/`, `*.tsbuildinfo`, `.env*` (except `.env.example`).
- [ ] **Step 3:** Configure `next.config.ts` with `createMDX` and `pageExtensions` including `md`/`mdx`, and add `mdx-components.tsx` (`useMDXComponents`).
- [ ] **Step 4: Write the failing test** `src/app/page.test.tsx`: `renders the site name placeholder` asserts a heading with text `Portfolio` is in the document.
- [ ] **Step 5:** Run `pnpm test`. Expected: FAIL (heading not found).
- [ ] **Step 6:** Implement `src/app/page.tsx` as a `<main>` with `<h1>Portfolio</h1>`. `layout.tsx` sets `lang="en"`, metadata title `Portfolio` and description `Design engineer portfolio.`, and imports `globals.css` (Tailwind import only, for now).
- [ ] **Step 7:** Run `pnpm test`. Expected: PASS.
- [ ] **Step 8:** MDX check: temporarily add `src/app/mdx-check/page.mdx` (`# MDX works`), run `pnpm build`, and confirm the route `/mdx-check` is listed. Delete the file. Run `pnpm build` again. Expected: exit 0.
- [ ] **Step 9:** Run `pnpm lint`, `pnpm typecheck`, `pnpm format:check`. Expected: all exit 0.
- [ ] **Step 10:** Commit `chore: scaffold Next.js, Tailwind v4, MDX, Motion and tooling`.

### Task 2: Neutral tokens and light/dark theme

**Files:**
- Modify: `src/app/globals.css`, `src/app/layout.tsx`, `src/app/page.tsx`
- Create: `src/lib/theme.ts`, `src/lib/theme-script.ts`, `src/components/theme/theme-provider.tsx`, `src/components/theme/theme-toggle.tsx`
- Test: `src/lib/theme.test.ts`, `src/components/theme/theme.test.tsx`

**Interfaces:**
- Consumes: `RootLayout`, `globals.css` from Task 1.
- Produces:
  - `type Theme = "light" | "dark"`, `THEME_STORAGE_KEY = "theme"` (in `src/lib/theme.ts`)
  - `readStoredTheme(): Theme | null` — returns null if storage throws or holds anything else
  - `writeStoredTheme(theme: Theme): void` — never throws
  - `resolveTheme(stored: Theme | null, prefersDark: boolean): Theme`
  - `THEME_INIT_SCRIPT: string` (in `src/lib/theme-script.ts`): applies the `dark` class before paint, using the same rules
  - `<ThemeProvider>` and `useTheme(): { theme: Theme; setTheme(t: Theme): void; toggleTheme(): void }`
  - `<ThemeToggle />`: a `<button type="button">` with an `aria-label` of `Switch to dark theme` or `Switch to light theme`

- [ ] **Step 1: Write failing tests** in `src/lib/theme.test.ts`:
  - `resolveTheme` returns the stored value when it's set (`resolveTheme("light", true) === "light"`)
  - it falls back to the system preference (`resolveTheme(null, true) === "dark"`, `resolveTheme(null, false) === "light"`)
  - `readStoredTheme` returns null when storage holds `"blue"`, and null when `localStorage.getItem` throws
  - `writeStoredTheme` does not throw when `localStorage.setItem` throws
- [ ] **Step 2:** Run `pnpm test`. Expected: FAIL (module not found).
- [ ] **Step 3:** Implement `src/lib/theme.ts` per Interfaces, then run `pnpm test`. Expected: PASS.
- [ ] **Step 4: Write failing tests** in `src/components/theme/theme.test.tsx`. Each test starts with a `matchMedia` mock and cleared storage. Tests:
  - `<ThemeToggle>` inside `<ThemeProvider>`: clicking it adds the `dark` class to `document.documentElement` and stores `"dark"`; clicking again removes it and stores `"light"`
  - the aria-label names the target theme
  - with storage throwing, the click still toggles the class
- [ ] **Step 5:** Run `pnpm test`. Expected: FAIL.
- [ ] **Step 6:** Implement the provider, the toggle and `THEME_INIT_SCRIPT`. In `layout.tsx`: add `suppressHydrationWarning` on `<html>`, inline the script in `<head>`, and wrap children in `<ThemeProvider>`. The page renders `<ThemeToggle />` under the heading. Run `pnpm test`. Expected: PASS.
- [ ] **Step 7:** Fill `globals.css`:
  - neutral greyscale semantic variables `--background`, `--foreground`, `--muted`, `--muted-foreground`, `--border`, `--accent`, `--accent-foreground` in `:root` (light) and `.dark`
  - `@custom-variant dark (&:where(.dark, .dark *))`
  - `@theme inline` mapping to `--color-*`, with `--font-sans` set to the system stack
  - `@theme` tokens for a type scale (`--text-xs` to `--text-4xl`), radius (`--radius-sm`, `--radius-md`, `--radius-lg`), and the spacing base `--spacing: 0.25rem`
  - a base layer setting body background and foreground from the tokens

  Add a comment at the top: these are placeholder values to be replaced from the final design.
- [ ] **Step 8:** No-flash check: `pnpm build && pnpm start`, then `curl` `/`. Expected: HTTP 200, and the HTML contains the inline theme script before the body content. Record the output.
- [ ] **Step 9:** Run `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`. Expected: all exit 0.
- [ ] **Step 10:** Commit `feat(theme): add neutral design tokens and flash-free light/dark theme`.

### Task 3: CI workflow and README

**Files:**
- Create: `.github/workflows/ci.yml`, `README.md`

**Interfaces:**
- Consumes: the scripts and the Node/pnpm pins from Task 1.

- [ ] **Step 1:** Write `.github/workflows/ci.yml`, triggered on `push` to `main` and on all `pull_request`. Steps:
  - `actions/checkout`
  - `pnpm/action-setup` (version taken from `packageManager`)
  - `actions/setup-node` with `node-version-file: .nvmrc` and `cache: pnpm`
  - `pnpm install --frozen-lockfile`
  - `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`

  Use current major versions of each action.
- [ ] **Step 2:** Validate locally: run the same sequence in a fresh shell (`pnpm install --frozen-lockfile && pnpm lint && pnpm typecheck && pnpm test && pnpm build`). Expected: all exit 0. Confirm the YAML parses (e.g. with `node -e` and a YAML parser already in the dependency tree, or `npx --yes yaml-lint`).
- [ ] **Step 3:** Write `README.md` covering:
  - the stack, scripts and folder structure
  - where the tokens live and that they're placeholders to replace from the design
  - the Node/pnpm versions
  - that CI runs on push and PRs
  - that deploys go through Vercel importing the GitHub repo
- [ ] **Step 4:** Run `pnpm format:check`. Expected: exit 0. Then `git status --short`. Expected: clean after commit.
- [ ] **Step 5:** Commit `ci: add GitHub Actions checks and README`.

## Done evidence (worker_done report)

Report all of the following:
- the tails of `pnpm install --frozen-lockfile`, `lint`, `typecheck`, `test` (with pass count), `build` and `format:check`, each exiting 0
- the curl status and the evidence that the script is present
- the MDX check output
- `git log --oneline`, and a clean `git status --short`
- the Codebase Memory findings from Task 1 Step 1

Any non-zero exit means the task FAILED: report the exact error.
