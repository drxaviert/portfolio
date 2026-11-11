# Claude Cost Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make new Claude sessions default to Sonnet with moderated reasoning and concrete design-session limits, while keeping Opus available on demand.

**Architecture:** Three text/config surfaces. The user settings file sets the model, effort, and thinking cap. The global `CLAUDE.md` changes the routing rule from "main thread is Opus" to "Sonnet default, Opus on request". The repo `CLAUDE.md` adds design/MCP image and context budgets. Orca's profile home mirrors the user settings.

**Tech Stack:** Claude Code settings JSON, Markdown instruction files, Orca profile sync.

**Spec:** `docs/superpowers/specs/2026-11-09-claude-cost-optimization-design.md`

## Global Constraints

- Do not overwrite any existing `settings.json.bak*` file.
- `~/.claude/settings.json` must remain valid strict JSON (no comments, no trailing commas).
- Keep hooks, statusLine, marketplaces, theme, and plugins unchanged.
- Do not commit anything to git as part of this plan.
- Opus must remain available via `/model opus`.

## Review Focus

- A malformed settings file silently loses every setting: verify with `ConvertFrom-Json`.
- Orca reads the profile-home mirror, not only `~/.claude`: verify both files carry the new values.
- Orca chat tabs can override the model: state the one manual UI step; do not claim the default is a lock.
- Worktrees based on older branches may not contain the repo `CLAUDE.md`: the global file carries the same rules.
- Existing long sessions keep their model: the change applies to new sessions.

---

### Task 1: Update user settings

**Files:**
- Modify: `C:\Users\Dat\.claude\settings.json`
- Create: `C:\Users\Dat\.claude\settings.json.bak.cost-opt-20261109-140436`

**Interfaces:**
- Produces: `settings.model = "claude-sonnet-5-5"`, `settings.effortLevel = "medium"`, `settings.env.MAX_THINKING_TOKENS = "6000"`

- [ ] **Step 1: Back up the current settings**

Run:
```powershell
Copy-Item "$env:USERPROFILE\.claude\settings.json" "$env:USERPROFILE\.claude\settings.json.bak.cost-opt-20261109-140436"
```

- [ ] **Step 2: Change the model, effort, and thinking cap**

Set:
```json
"model": "claude-sonnet-5-5",
"effortLevel": "medium",
"env": { "MAX_THINKING_TOKENS": "6000" }
```

- [ ] **Step 3: Verify JSON and values**

Run:
```powershell
$s = Get-Content "$env:USERPROFILE\.claude\settings.json" -Raw | ConvertFrom-Json
$s.model
$s.effortLevel
$s.env.MAX_THINKING_TOKENS
```
Expected: `claude-sonnet-5-5`, `medium`, `6000`.

---

### Task 2: Update global instructions

**Files:**
- Modify: `C:\Users\Dat\.claude\CLAUDE.md`
- Create: `C:\Users\Dat\.claude\CLAUDE.md.bak.cost-opt-20261109-140436`

**Interfaces:**
- Produces: a "Model routing" section naming Sonnet as default, and a "Design and MCP sessions" section with image and context budgets.

- [ ] **Step 1: Back up the current file**

Run:
```powershell
Copy-Item "$env:USERPROFILE\.claude\CLAUDE.md" "$env:USERPROFILE\.claude\CLAUDE.md.bak.cost-opt-20261109-140436"
```

- [ ] **Step 2: Replace the model routing section**

The section must say: new sessions start on Sonnet; Opus is only for an explicit request or a final design/architecture judgment, then switch back. Keep the `research` and `explore` subagent delegation rules and the compact-result requirement.

- [ ] **Step 3: Add the design and MCP rules**

Include: use Sonnet for Figma/Mobbin/Paper work; one design pass per session; at most 10 new images or node exports per session; prefer node data over image exports; summarize each image in one or two lines; start fresh at ~100k tokens; never paste screenshots into a long session.

- [ ] **Step 4: Verify the content**

Run:
```powershell
Select-String -Path "$env:USERPROFILE\.claude\CLAUDE.md" -Pattern 'Sonnet default|Design and MCP sessions|10 new images|100k'
```
Expected: each pattern matches at least once.

---

### Task 3: Add repository design rules

**Files:**
- Create: `C:\Users\Dat\orca\portfolio\CLAUDE.md`

**Interfaces:**
- Produces: repo-scoped design-session rules that mirror the global image and context budgets.

- [ ] **Step 1: Create the file**

Content:
```markdown
# Portfolio repo rules

Next.js portfolio; design work runs in Orca worktrees.

## Design and MCP sessions

- Default to Sonnet for Figma, Mobbin, Paper, and browser/design work. Use Opus only for a final judgment pass.
- One design pass per session. Start a fresh session for implementation after exploration.
- Image budget: at most 10 new images or node exports per session. Prefer node data and text scans over screenshots. Summarize each image in one or two lines before the next tool call.
- At ~100k tokens, write a 10-line handoff and start a fresh session; do not wait for auto-compact.
- Never paste screenshots into a session longer than ~50k tokens.

## Worktree hygiene

- Keep the orchestrator chat separate from implementation chats.
- Check for `package.json` before running `pnpm`; a design branch may not include one.
```

- [ ] **Step 2: Verify the file exists and is non-empty**

Run:
```powershell
Get-Item "C:\Users\Dat\orca\portfolio\CLAUDE.md" | Select-Object Length
```
Expected: length greater than 500 bytes.

---

### Task 4: Mirror into the Orca profile and verify

**Files:**
- Modify: `C:\Users\Dat\AppData\Roaming\orca\claude-profiles\0c58ed56-e13e-40c0-a078-2e32b2ff6005\home\settings.json`

**Interfaces:**
- Consumes: the validated `~/.claude/settings.json` from Task 1.
- Produces: a profile-home settings file with the same values.

- [ ] **Step 1: Copy the validated settings into the profile home**

Run:
```powershell
Copy-Item "$env:USERPROFILE\.claude\settings.json" "$env:APPDATA\orca\claude-profiles\0c58ed56-e13e-40c0-a078-2e32b2ff6005\home\settings.json" -Force
```

- [ ] **Step 2: Verify both copies parse and agree**

Run:
```powershell
$a = Get-Content "$env:USERPROFILE\.claude\settings.json" -Raw | ConvertFrom-Json
$b = Get-Content "$env:APPDATA\orca\claude-profiles\0c58ed56-e13e-40c0-a078-2e32b2ff6005\home\settings.json" -Raw | ConvertFrom-Json
$a.model; $b.model; $a.effortLevel; $b.effortLevel; $a.env.MAX_THINKING_TOKENS; $b.env.MAX_THINKING_TOKENS
```
Expected: `claude-sonnet-5-5`, `claude-sonnet-5-5`, `medium`, `medium`, `6000`, `6000`.

- [ ] **Step 3: Record the one manual step**

Tell the user: for new Orca chat tabs, pick Sonnet in the chat's model selector if it defaults to Opus; for CLI launches use `orca agent launch --agent claude --model sonnet`. Existing tabs keep their current model.

---

### Task 5: Measure the next design session

**Files:**
- Read: the newest Claude transcript under `C:\Users\Dat\.claude\projects\C--Users-Dat-orca-workspaces-portfolio-eagleray\` and `...\C--Users-Dat-orca-portfolio\`

- [ ] **Step 1: Find the new session's cost-state**

Run:
```powershell
$f = Get-ChildItem "$env:USERPROFILE\.claude\projects\C--Users-Dat-orca-workspaces-portfolio-eagleray" -File -Filter *.jsonl | Sort-Object LastWriteTime -Descending | Select-Object -First 1
Select-String -Path $f.FullName -Pattern 'totalCostUSD' | Select-Object -Last 1
```
Expected: a total below the $11.69 baseline for a comparable design pass, or an explicit reason the session did more work.

- [ ] **Step 2: Report the comparison**

State the new cost, the model used, and the max cache-read value. If cost is not lower, inspect the model and context fields before changing anything else.
