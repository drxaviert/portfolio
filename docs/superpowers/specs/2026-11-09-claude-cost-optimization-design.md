# Claude cost optimization: design

Date: 2026-11-09
Status: approved (Approach A)

## Intent

Cut Claude subscription burn from Orca-launched Claude work without giving up Opus
entirely. Evidence from the 2026-11-09 diagnosis: two Opus sessions ran in parallel on
Nov 8 21:00-23:59 EST, logged ~64M cache-read tokens, and cost ~$23-25 API-equivalent.
The dominant session used Opus for 133 calls, grew to ~380k context, and exported 37
Figma PNGs plus 87 JPGs.

## Goals

- New Claude sessions default to Sonnet.
- Lower reasoning/thinking spend per call.
- Keep Opus available as an explicit choice for final design judgment.
- Make the image/context rules concrete enough to change behavior in design sessions.

## Non-goals

- No change to hooks, plugins, MCP servers, or Orca's UI code.
- No attempt to back-compute or control the subscription percentage.
- No editing of existing session transcripts.

## Anti-goals

- Locking the user out of Opus.
- Silently shipping a config that fails JSON validation.
- Changing project source code as part of this optimization.

## Constraints

- `~/.claude/settings.json` is the user-level source; Orca mirrors it into the active
  profile home at `%APPDATA%\orca\claude-profiles\0c58ed56-...\home\settings.json`.
- Existing backups must not be overwritten.
- Orca chat tabs can override the global model; the config sets the default floor, not a
  hard lock.

## Approach chosen

**A - Cheap by default.** Sonnet default, `effortLevel: medium`, thinking cap 6000, and
concrete design-session rules in the global and repo `CLAUDE.md`. Opus remains one
`/model opus` away.

## Decisions

- Model: `claude-sonnet-5-5`.
- Effort: `medium`.
- `MAX_THINKING_TOKENS`: `6000` (was `12000`).
- Global rules: Sonnet default; Opus only on explicit request or final judgment.
- Design rules: one pass per session; <=10 new images per session; prefer node data over
  images; fresh session at ~100k tokens.
- Repo-level `CLAUDE.md` repeats the design rules for this repository.
- Verification: JSON parse plus value assertions; profile mirror check.

## Left to the builder

Nothing open. Exact edits and verification are in the plan.
