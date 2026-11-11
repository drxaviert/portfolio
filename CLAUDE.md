# Portfolio repo rules

Next.js portfolio; design work runs in Orca worktrees.

## Design and MCP sessions

- Opus orchestrates. Delegate Figma, Mobbin, Paper, and browser/design work to a DeepSeek OpenCode worker when it can do it; otherwise Sonnet. Opus makes the final judgment.
- One design pass per session. Start a fresh session for implementation after exploration.
- Image budget: at most 10 new images or node exports per session. Prefer node data and text scans over screenshots. Summarize each image in one or two lines before the next tool call.
- At ~100k tokens, write a 10-line handoff and start a fresh session; do not wait for auto-compact.
- Never paste screenshots into a session longer than ~50k tokens.

## Worktree hygiene

- Keep the orchestrator chat separate from implementation chats.
- Check for `package.json` before running `pnpm`; a design branch may not include one.
