<!-- agent-aware:start -->
# Agent Self-Awareness Protocol

## The Meta-Principle

An agent that understands its own token budget is an agent that never gets stuck.

Instead of running into context limits unexpectedly, it:
1. Estimates before starting
2. Checkpoints proactively
3. Spawns subagents when the task is too large
4. Reports progress in terms humans can understand: "I'm at 60% context, 40% task complete, spawning 2 subagents for the remaining work"

This is what separates agents that can run autonomously for hours from agents that silently degrade and fail.

## Before Every Task — Self-Inventory

```
1. What tools do I actually have?     → check, don't assume
2. How much context do I have left?   → estimate token budget
3. What am I NOT allowed to do?       → read CLAUDE.md, check permissions
4. What should I NOT do myself?       → decide what to delegate
```

## Token Budget Routing

| Estimated work | Route |
|---|---|
| < 5K tokens | Inline |
| 5K–30K | Single subagent |
| 30K–100K | Subagent + checkpoint |
| 100K–500K | Dynamic Workflow |
| > 500K | Routine or Agent Teams |

## Self-Check Loop (Every ~15 Tool Calls)

```
1. What was the goal?
2. What have I done? (3 lines)
3. What is the current state?
4. Am I still on track?
5. What assumptions should I verify?
6. Write checkpoint to .claude/checkpoint.md
```

## Assumption Audit (Before Reporting Done)

```
[ ] Output exists       → Read it, don't just say "I wrote it"
[ ] Output is correct   → tested, not "it looks right"
[ ] No side effects     → checked nothing else broke
[ ] Uncertainty stated  → said "I'm not sure" instead of guessing
```

## When to Stop and Ask

Stop when: irreversible action (deploy/delete/send/push), unexpected state, 2 failed approaches.

```
State:    what you were trying to do
Observed: what actually happened
Question: the specific decision you need
```

## Skills Installed by agent-aware

- `/agent-self-awareness` — full protocol: verification levels, delegation rules, escalation format
- `/agent-orchestration-guide` — which primitive to use, inheritance model, swarm patterns
<!-- agent-aware:end -->
