---
name: claude-power
description: The native capabilities of Claude Code that most people never discover. Covers hidden primitives, agent config, model routing, hooks, memory, worktrees, resume, fork, computer use, extended thinking, and more. Read this to stop using Claude Code like a chatbot.
---

# Claude Power — What Most People Miss

Most people use Claude Code like a chat interface. It is a full agent operating system.
This is what it actually can do.

---

## 1. /fork — The Most Underused Command

```
/fork write unit tests for the auth changes we just made
```

Spawns a worker that has your **full conversation history** — every file you read, every decision you made, all context. Normal subagents start blind. Fork starts knowing everything.

- Cheaper than a new session (reuses prompt cache)
- Cannot spawn another fork (one level only)
- Enable: `CLAUDE_CODE_FORK_SUBAGENT=1`

Use it when: you want a parallel worker that doesn't need re-briefing.

---

## 2. Subagent Definition Files

Most people invoke agents by typing. You can define them as files:

```markdown
---
name: security-reviewer
description: Reviews code for vulnerabilities. Use proactively on any auth changes.
tools: Read, Grep, Glob
model: opus
permissionMode: default
effort: high
color: red
---

You are a security expert. Your job is to find vulnerabilities, not confirm safety.
Report every finding with file, line, severity, and reproduction steps.
```

Save to `.claude/agents/security-reviewer.md` → available in this project.
Save to `~/.claude/agents/security-reviewer.md` → available everywhere.

Then: `@"security-reviewer (agent)" check the new payment flow`

**"Use proactively" in description** = Claude auto-delegates matching tasks without being asked.

---

## 3. Model Routing — Don't Run Everything on Opus

```markdown
---
name: file-finder
model: haiku        # 20x cheaper than opus
tools: Glob, Grep
---
```

| Task type | Model |
|---|---|
| File search, grep, simple reads | haiku |
| Code generation, reasoning | sonnet |
| Architecture, complex analysis, adversarial review | opus |
| Creative, long-form writing | fable |

Explicitly set `model: haiku` for search agents. They don't need Opus. Most workflows waste 80% of cost running searches on the wrong model.

---

## 4. Effort Levels — Extended Thinking

```markdown
---
effort: xhigh   # low / medium / high / xhigh / max
---
```

Or inline: `Think very carefully about this.` / `Think step by step.`

- `low` — skip thinking, fastest
- `high` — standard extended thinking
- `xhigh` — deep reasoning, slower, better for architecture and security
- `max` — maximum thinking budget, use only for hardest problems

Most people never set this. Opus on `max` effort on a hard architecture problem is a different tool than default Opus.

---

## 5. Permission Modes

```markdown
---
permissionMode: acceptEdits
---
```

| Mode | What it does |
|---|---|
| `default` | Asks for every tool use |
| `acceptEdits` | Auto-approves file edits, asks for bash/network |
| `auto` | Auto-approves most things |
| `dontAsk` | Approves everything except dangerous ops |
| `bypassPermissions` | No prompts at all (dangerous — use in isolated envs only) |
| `plan` | Read-only, can only plan and explain |

Run sandboxed agents (boxes, CI) with `bypassPermissions`. Run code reviewers with `plan`. Stop clicking "yes" on every edit with `acceptEdits`.

---

## 6. Background Agents + Fire-and-Forget

```markdown
---
name: indexer
background: true
---
```

Spawns and immediately returns control to you. Agent runs while you keep working.

Combined with `initialPrompt`:
```markdown
---
name: indexer
background: true
initialPrompt: "Index all TypeScript files and write a summary to .claude/index.md"
---
```

The agent starts automatically, does its job, writes output to a file, done.

---

## 7. Worktrees — Isolated Parallel Builds

```bash
claude --worktree feature-auth
```

Creates an isolated git worktree at `.claude/worktrees/feature-auth/`. You work there without touching main. Agents can work in their own worktrees simultaneously:

```markdown
---
isolation: worktree   # each subagent gets its own isolated copy
---
```

Want gitignored files (.env, secrets) in the worktree? Create `.worktreeinclude`:

```
.env
.env.local
secrets/
```

Branch from a PR: `claude --worktree "#1234"`

---

## 8. Session Resume

```bash
claude --resume                          # resume most recent session
claude --resume f244a980-49e4-40e1-83fd  # resume specific session by ID
```

Every session is stored as JSONL. You can resume days later with full context intact. Sessions kept for 30 days (configurable via `cleanupPeriodDays`).

Find session IDs:
```bash
ls -t ~/.claude/projects/**/*.jsonl | head -5
```

---

## 9. Hooks — Run Code on Agent Events

Six hook points:

```json
{
  "hooks": {
    "PreToolUse": [
      { "matcher": "Bash", "hooks": [{ "type": "command", "command": "./scripts/validate.sh" }] }
    ],
    "PostToolUse": [...],
    "SubagentStart": [...],
    "SubagentStop": [...],
    "Stop": [...],
    "Notification": [...]
  }
}
```

Examples:
- `PreToolUse` on `Bash` → block dangerous commands before they run
- `PostToolUse` on `Write` → auto-lint every file after it's written
- `SubagentStart` → log which agent started and when
- `Stop` → send a Slack message when the session finishes

Save in `.claude/settings.json` (project) or `~/.claude/settings.json` (global).

---

## 10. Memory System

Three persistence scopes:

```markdown
---
memory: project   # writes to .claude/memory/ (checked into git)
---
```

| Scope | Where | Who sees it |
|---|---|---|
| `user` | `~/.claude/memory/` | You, all projects |
| `project` | `.claude/memory/` | Everyone on this project |
| `local` | `.claude/memory.local/` | You, this project only |

The agent writes what it learns to these directories. Next session starts knowing it.

---

## 11. Routines — Scheduled Agents

Create `.claude/routines/daily-review.md`:

```markdown
---
name: daily-review
schedule: "0 9 * * *"   # 9am every day
---

Review the git log from the last 24 hours. Write a summary to .claude/daily-review.md.
Flag any files touched more than 3 times (churn indicator).
```

Runs on schedule, headless, no human trigger needed.

---

## 12. /batch — Mechanical Multi-File Changes

```
/batch rename the `user_id` parameter to `userId` across all TypeScript files
```

Claude identifies all matching files, proposes a plan, applies the change to each file in its own subagent, each gets a separate diff for review. Built for refactors.

---

## 13. Agent View — Coordinate Multiple Sessions

```bash
claude agents          # opens the agent coordination UI
```

See all running Claude sessions across your machine. Send messages between them. Coordinate without a parent orchestrator.

---

## 14. Read Subagent Transcripts

Every subagent writes a full JSONL transcript:

```
~/.claude/projects/{encoded-path}/{session}/subagents/agent-{id}.jsonl
```

Every tool call, every reasoning step, every error. Readable while the agent is still running.

```bash
tail -f ~/.claude/projects/.../subagents/agent-abc123.jsonl
```

Encoded path = replace every `/` with `-` in the absolute project path.

---

## 15. MCP Servers Per Subagent

Give specific agents specific tools:

```markdown
---
name: browser-agent
mcpServers:
  playwright:
    type: stdio
    command: npx
    args: ["-y", "@playwright/mcp@latest"]
---
```

Only this agent has Playwright. Main session and other agents don't.

---

## 16. ScheduleWakeup — Self-Pacing Loops

```javascript
// inside a /loop skill or Workflow
ScheduleWakeup({
  delaySeconds: 270,   // wake up in 4.5 min (stays in cache)
  prompt: "/loop check the deploy",
  reason: "polling CI run"
})
```

The agent sleeps, wakes itself up, continues. Prompt cache window = 5 minutes. Sleep under 270s = cache stays warm (cheaper). Sleep over 300s = cache miss (pay again).

---

## 17. Steer a Running Agent Mid-Task

```javascript
SendMessage(to: "agent-id", message: "skip auth.ts, focus only on the payment module")
```

You can redirect, refocus, or add constraints to an agent that's already working. It cannot change its initial task, but mid-task corrections work cleanly.

---

## 18. Computer Use — Screen Control

```markdown
---
name: browser-tester
tools: computer-use
permissionMode: auto
---
```

Enable in settings first:
```json
{ "computerUse": { "enabled": true } }
```

The agent can see your screen, move the mouse, click, type, take screenshots. Latency: 3-20 seconds per action. Budget time accordingly. Use for UI testing, form filling, anything that needs a real browser interaction.

---

## 19. The Settings File — Full Control Surface

`~/.claude/settings.json` (global) or `.claude/settings.json` (project):

```json
{
  "model": "claude-opus-4-8",
  "agent": "my-default-agent",
  "permissionMode": "acceptEdits",
  "cleanupPeriodDays": 30,
  "worktree": { "baseRef": "head" },
  "computerUse": { "enabled": false },
  "permissions": {
    "allow": ["Bash(git:*)"],
    "deny": ["Bash(rm:*)", "Agent(Explore)"]
  },
  "env": {
    "MY_VAR": "value"
  }
}
```

Most people never touch this file. It controls the default model, default agent, what tools are allowed/denied, worktree behavior, cleanup, and environment variables injected into every session.

---

## 20. The 5-Level CLAUDE.md Hierarchy

Claude reads CLAUDE.md files from multiple locations, merged in order:

```
1. ~/.claude/CLAUDE.md          global — applies everywhere
2. /project/CLAUDE.md           project root
3. /project/.claude/CLAUDE.md   project .claude dir
4. /project/src/CLAUDE.md       subdirectory (if working there)
5. /project/CLAUDE.local.md     local override, not committed
```

Later files override earlier ones. Use `CLAUDE.local.md` for personal preferences that shouldn't go into git. Use `~/.claude/CLAUDE.md` for global rules that apply to every project on your machine.

---

## Quick Reference — Things to Try Today

```bash
# Resume yesterday's session
claude --resume

# Fork with full context
/fork [task that needs everything you've discussed]

# Isolated parallel build
claude --worktree feature-x

# Batch refactor
/batch [describe the mechanical change]

# See all running agents
claude agents

# Give an agent a CLAUDE.md of its own
# .claude/agents/my-agent.md with full frontmatter
```
