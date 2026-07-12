---
name: agent-orchestration-guide
description: Complete reference for choosing and operating parallel execution primitives in Claude Code. Use when deciding whether to spawn subagents, forks, workflows, or teams — and how to steer, observe, and resume them. Also covers inheritance model, token budget routing, and reprompting running agents.
---

# Agent Orchestration Guide

> Read this before spawning any subagent or parallel worker.

---

## Quick Pick — Which Primitive to Use

| Situation | Use |
|---|---|
| Side task that would flood conversation with noise | **Subagent** |
| Worker needs full conversation history | **Fork** (`/fork`) |
| Large job needing many agents, loops, cross-checking | **Dynamic Workflow** |
| Mechanical change across many files, each gets a PR | **/batch** |
| Several independent sessions, you coordinate | **Agent View** (`claude agents`) |
| Claude plans, assigns, workers message each other | **Agent Teams** (experimental) |
| Task runs on schedule without human trigger | **Routine** |

---

## Subagent — What It Inherits

**Always inherited:**
```
CLAUDE.md (all levels)     YES
Git status                 YES
All MCP servers            YES
All internal tools         YES — unless restricted
Parent permission mode     YES — unless overridden
Parent model               YES — unless overridden
```

**Never inherited (subagent starts fresh):**
```
Parent conversation history    NO  — use Fork if it needs this
Files the parent already read  NO  — must re-read itself
Skills parent already invoked  NO  — unless listed in skills: frontmatter
Anything only in conversation  NO  — if it's not in a file, subagent can't see it
```

---

## Subagent File Format (all 17 fields)

```markdown
---
name: my-agent
description: What it does. Add "Use proactively" for auto-delegation.
tools: Read, Grep, Glob, Bash
disallowedTools: Write, Edit
model: haiku
permissionMode: acceptEdits
isolation: worktree
memory: project
maxTurns: 30
skills:
  - agent-self-awareness
  - agent-orchestration-guide
color: blue
background: true
effort: high
initialPrompt: "start by reading..."
hooks:
  PreToolUse:
    - matcher: "Bash"
      hooks:
        - type: command
          command: "./scripts/validate.sh"
---

System prompt here. CLAUDE.md loads on top of this.
```

**Where to save:**
- `.claude/agents/` — project scope (check into git)
- `~/.claude/agents/` — all projects on this machine

---

## Invoke Subagents

```bash
# Natural language (Claude decides)
Use the code-reviewer agent to check the auth changes

# @-mention (guaranteed)
@"code-reviewer (agent)" look at the auth changes

# Entire session as that agent
claude --agent code-reviewer
```

---

## Fork — Full Parent Context

```
/fork draft unit tests for the parser changes so far
```

Use fork when the worker needs full conversation history. Cheaper (reuses prompt cache).

| | Fork | Subagent |
|---|---|---|
| Context | Full parent history | Fresh start |
| Cost | Cheaper (shared cache) | Separate cache |
| System prompt | Same as parent | From definition file |

Enable: `CLAUDE_CODE_FORK_SUBAGENT=1`

---

## Steer a Running Subagent

```
SendMessage(to="agent-id", message="focus only on auth.ts, skip the rest")
```

Find agent ID in:
`~/.claude/projects/{project}/{session}/subagents/agent-{id}.meta.json`

---

## Read Subagent Work

JSONL transcript — every tool call, step, error:
```
~/.claude/projects/{encoded-path}/{session}/subagents/agent-{id}.jsonl
```

Encoded path: replace every `/` with `-` in the absolute project path.

```bash
# Tail a running subagent live
tail -f ~/.claude/projects/{project}/{session}/subagents/agent-{id}.jsonl
```

---

## Dynamic Workflow — Swarm Engine

Use when: 6+ agents, loops, adversarial verify, budget-aware scaling.

```javascript
// pipeline = no barrier (fastest — default)
pipeline(ITEMS, find, verify, fix)

// parallel = barrier (all finish before continuing)
await parallel(ITEMS.map(item => () => agent(item, {schema: SCHEMA})))
```

**4 swarm patterns** (full code in `swarm-patterns.md`):
```
Fan-out      → N parallel finders, one synthesizes
Pipeline     → items flow through stages independently (fastest)
Adversarial  → find, then N skeptics try to REFUTE, majority rules
Loop-dry     → keep finding until 2 empty consecutive rounds
```

Monitor: `/workflows`
Limits: 16 concurrent, 1000 total, 4096 items per call, depth 5.

---

## Token Budget Routing

| Estimated tokens | Route |
|---|---|
| < 5K | Inline in main session |
| 5K–30K | Single subagent |
| 30K–100K | Subagent + checkpoint at midpoint |
| 100K–500K | Dynamic Workflow |
| > 500K | Routine or Agent Teams |

Checkpoint rule: every ~15 tool calls, write state to `.claude/checkpoint.md`.
Tool call latency: computer-use = 3-20s/action, browser = 2-15s/page. Design accordingly.

---

## Built-in Agents (Always Available)

| Agent | When used |
|---|---|
| Explore | Codebase search |
| Plan | Plan mode research |
| general-purpose | Complex multi-step tasks |

Override a built-in: create `~/.claude/agents/{name}.md` with same `name` field.

---

## Worktrees — File Isolation

```bash
claude --worktree feature-auth
```

In subagent frontmatter: `isolation: worktree`

Copy gitignored files (.env etc): create `.worktreeinclude` in project root.

---

## Nested Subagents

Max depth: 5 levels. Fixed.
Block all spawning: omit `Agent` from tools list entirely.
