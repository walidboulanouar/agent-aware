# agent-aware

One command to make your Claude Code agents self-aware.

```bash
npx agent-aware
```

That's it.

## What it does

Installs **3 skills** to `~/.claude/skills/`, **3 hooks** into `~/.claude/settings.json`, and injects the self-awareness protocol into your `CLAUDE.md`. Everything is idempotent — running it again won't duplicate anything.

## The meta-principle

> An agent that understands its own token budget is an agent that never gets stuck.
>
> Instead of running into context limits unexpectedly, it:
> 1. Estimates before starting
> 2. Checkpoints proactively
> 3. Spawns subagents when the task is too large
> 4. Reports progress in terms humans can understand: "I'm at 60% context, 40% task complete, spawning 2 subagents for the remaining work"
>
> This is what separates agents that can run autonomously for hours from agents that silently degrade and fail.

## Hooks

Three hooks wired into `~/.claude/settings.json` automatically. They are global — active in every Claude Code session on this machine.

### `context-status` (UserPromptSubmit)

Runs before every prompt is processed. Reads the session JSONL, estimates how full the context window is, and injects the result as a system attachment the agent sees before answering.

Token estimation works in two modes:

- **Measured** — if the session has had a context compaction event, `preTokens` from the compact boundary is used directly. Accurate.
- **Estimated** — for fresh sessions with no compaction yet, falls back to JSONL byte count / 6. Approximate but non-zero from the start.

Context window detection:
- Opus models (1M context) → `1,000,000` denominator
- All other models → `200,000`

What the agent sees injected before each prompt:

```
[CONTEXT: ~23% full · 46,000 tokens (estimated) · 312 entries · OK]
```

At 60%+ it adds an action line:

```
[CONTEXT: ~63% full · 126,000 tokens (measured) · 890 entries · HIGH]
[ACTION: Write checkpoint to .claude/checkpoint.md. Delegate remaining work to a subagent.]
```

The hook is silent below 8,000 tokens (too early to add noise).

Levels: `OK` (<40%) · `MODERATE` (40-59%) · `HIGH` (60-74%) · `CRITICAL` (75%+)

### `checkpoint-pulse` (PostToolUse)

Fires after every tool call. Maintains a counter in `/tmp/.agent-aware-pulse-{SESSION_ID}`. Every 15 tool calls it injects:

```
[CHECKPOINT PULSE: Tool call #15. Self-check: What was the goal? What have you done? Write state to .claude/checkpoint.md before continuing.]
```

This catches agents that have gone far off track before the context gets too full to recover.

### `session-cleanup` (Stop)

Fires when the session ends. Deletes the `/tmp/.agent-aware-pulse-{SESSION_ID}` counter file so stale counters don't accumulate across sessions.

## Settings merge

`cli.js` reads `~/.claude/settings.json`, checks whether `agent-aware` entries already exist in each hook array, and only appends if not present. Safe to run multiple times. Never overwrites unrelated hooks.

## Skills installed

### `/agent-self-awareness`

The operational implementation of the meta-principle.

- Self-inventory (4 questions before any task)
- Tool capability table
- Token budget routing table
- Delegation rules (when to subagent vs do yourself)
- 3 verification levels (self / independent / adversarial)
- Assumption audit checklist
- Self-check loop (every ~15 tool calls)
- When to stop and ask the human

### `/agent-orchestration-guide`

Complete reference for parallel execution in Claude Code.

- Quick pick table (7 primitives: Subagent, Fork, Workflow, /batch, Agent View, Teams, Routine)
- What subagents inherit vs don't
- All 17 subagent frontmatter fields
- How to steer a running subagent mid-task
- How to read subagent JSONL transcripts
- 5 swarm patterns with full code (fan-out, pipeline, adversarial verify, loop-until-dry, budget-aware)
- Hard limits table

### `/claude-power`

The native capabilities most people never discover. Uses self-disclosure — a lightweight index file pointing to reference docs the agent pulls on demand, so it doesn't burn tokens loading everything upfront.

- `/fork` — full parent context in a worker (most underused command)
- Subagent definition files with all 17 frontmatter fields
- Model routing — haiku for search, opus for architecture
- Effort levels — extended thinking control (low / high / xhigh / max)
- Permission modes — stop clicking "yes" on every edit
- Background agents + fire-and-forget with `initialPrompt`
- Worktrees — isolated parallel builds, `.worktreeinclude` for secrets
- Session resume — pick up any session days later
- Hooks — run code on PreToolUse, PostToolUse, UserPromptSubmit, Stop
- Memory system — user / project / local persistence scopes
- Routines — scheduled agents, no human trigger needed
- /batch — mechanical multi-file refactors
- Agent View — coordinate multiple sessions
- Reading subagent JSONL transcripts live
- MCP servers scoped to specific agents
- ScheduleWakeup — self-pacing loops with cache-aware delays
- SendMessage — steer a running agent mid-task
- Computer use — screen control, mouse, keyboard
- The settings file — full control surface
- The 5-level CLAUDE.md hierarchy

## Usage

```bash
cd your-project
npx agent-aware
```

After running, in any Claude Code session:

```
/agent-self-awareness
/agent-orchestration-guide
/claude-power
```

Skills are global — they work in every project on this machine.

## License

MIT — Walid Boulanouar / AY Automate
