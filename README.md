# agent-aware

One command to make your Claude Code agents self-aware.

```bash
npx agent-aware
```

That's it.

---

## What it does

Installs two skills to `~/.claude/skills/` and injects the self-awareness protocol into your `CLAUDE.md`.

**The Meta-Principle:**

> An agent that understands its own token budget is an agent that never gets stuck.
>
> Instead of running into context limits unexpectedly, it:
> 1. Estimates before starting
> 2. Checkpoints proactively
> 3. Spawns subagents when the task is too large
> 4. Reports progress in terms humans can understand: "I'm at 60% context, 40% task complete, spawning 2 subagents for the remaining work"
>
> This is what separates agents that can run autonomously for hours from agents that silently degrade and fail.

---

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

---

## Usage

```bash
# Install in the current project
cd your-project
npx agent-aware
```

After running:
- `~/.claude/skills/agent-self-awareness/` — available in all Claude Code sessions on this machine
- `~/.claude/skills/agent-orchestration-guide/` — same
- `CLAUDE.md` — the self-awareness protocol block injected (or created)

Then in any Claude Code session:

```
/agent-self-awareness
/agent-orchestration-guide
```

---

## What gets added to CLAUDE.md

A self-contained block with the meta-principle, token budget routing table, self-check loop, and assumption audit. Idempotent — running `npx agent-aware` again won't duplicate it.

---

## License

MIT — Walid Boulanouar / AY Automate
