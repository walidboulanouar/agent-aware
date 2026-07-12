---
name: agent-self-awareness
description: How an agent should reason about what it has, what it can do, what to delegate, and how to verify without assumptions. Read before starting any non-trivial autonomous task. Covers self-inventory, verification levels, assumption audit, and when to stop and escalate.
---

# Agent Self-Awareness

## The Meta-Principle

An agent that understands its own token budget is an agent that never gets stuck.

Instead of running into context limits unexpectedly, it:
1. Estimates before starting
2. Checkpoints proactively
3. Spawns subagents when the task is too large
4. Reports progress in terms humans can understand: "I'm at 60% context, 40% task complete, spawning 2 subagents for the remaining work"

This is what separates agents that can run autonomously for hours from agents that silently degrade and fail.

---

## Step 0 — Self-Inventory Before Any Task

Answer these 4 questions before doing anything:

```
1. What tools do I actually have?        → check, don't assume
2. How much context do I have left?      → estimate token budget
3. What am I NOT allowed to do?          → read CLAUDE.md, check permissions
4. What pieces should I NOT do myself?   → decide what to delegate
```

---

## What Tools You Have

| Tool present | What it means you can do |
|---|---|
| Read, Glob, Grep | Read any file, understand codebases |
| Write, Edit | Modify files, build |
| Bash | Execute shell commands |
| Agent | Spawn subagents, delegate, parallelize |
| Workflow | Run multi-agent scripts, orchestrate swarms |
| WebFetch, WebSearch | Research, access internet |
| mcp__* | Access external services (Slack, GitHub, etc.) |
| ScheduleWakeup | Schedule future loops |
| computer-use | Control screen (only when explicitly enabled) |

**If a tool is not in your list, you cannot use it. Report the missing capability. Do not attempt workarounds.**

---

## Context Budget

- Every file Read consumes tokens (~250-300 tokens per KB)
- Quality degrades before the hard limit — at 75% full, output quality drops
- At 60% full: write checkpoint, summarize large results, consider delegating

**Checkpoint rule:** every ~15 tool calls, write current state to `.claude/checkpoint.md`.

---

## Token Budget — Quick Routing

| Estimated tokens | Route |
|---|---|
| < 5K | Inline in main session |
| 5K–30K | Single subagent |
| 30K–100K | Subagent + checkpoint at midpoint |
| 100K–500K | Dynamic Workflow |
| > 500K | Routine or Agent Teams |

---

## What to Delegate vs Do Yourself

**Delegate when:**
- Task produces large output you'll never reference again
- Task can run in parallel with other work
- Task needs a cheaper model or specialized tools
- You're at >60% context and the task is non-trivial

**Do yourself when:**
- Fits in current context with 25% headroom
- Result feeds directly into your next step
- Sequential and depends on your current context

**Rule:** if the work would flood your context with output you won't look at again, it belongs in a subagent.

---

## Verification Without Assumptions

**Never trust what "should" be true. Only trust what you can observe right now.**

| Instead of assuming... | Verify by... |
|---|---|
| "The file was written" | Read it back |
| "The command succeeded" | Check exit code + output |
| "The test passes" | Run it |
| "The API is reachable" | Make a test call |
| "The branch exists" | `git branch --list` |
| "My understanding is correct" | Re-read the source file |
| "Nothing else needs to change" | Grep for all references first |

### 3 Verification Levels

**Level 1 — Self-verify:**
```
After writing code     → run linter / compiler / tests
After editing a file   → Read it back and confirm the change is there
After a bash command   → check the output, not just that it ran
```

**Level 2 — Independent subagent verify:**
```
Spawn a subagent with no knowledge of what you did.
Give it the observable state and ask: "does this match the spec?"
Its job is to FIND problems, not confirm success.
```

**Level 3 — Adversarial verify:**
```
Spawn N agents whose explicit job is to REFUTE your conclusion.
Instruction: "Try hard to find why this is wrong. Default to 'wrong' if uncertain."
Accept only if majority fails to refute.
```

Use Level 3 for: security findings, architectural decisions, test coverage claims.

---

## The Assumption Audit (Before Reporting Done)

```
[ ] Output exists       → Read it, don't just say "I wrote it"
[ ] Output is correct   → tested/verified, not "it looks right"
[ ] No side effects     → did this break anything else?
[ ] All references found → searched before claiming scope complete
[ ] No assumed uptime   → tested any external service you relied on
[ ] No inferred success → confirmed success directly, not from lack of error
[ ] Uncertainty stated  → said "I'm not sure" instead of guessing
```

---

## Good vs Bad Agent Behavior

```
BAD:  "The tests probably pass since the logic looks correct."
GOOD: [runs tests] "3 tests fail. Here is the output."

BAD:  "The database schema should have a users table."
GOOD: [reads schema] "Yes, users table confirmed at line 14."

BAD:  "I've completed the refactor."
GOOD: "Done. Verified: linter 0 errors, tests all pass, output files confirmed."
```

---

## The Self-Check Loop (Every ~15 Tool Calls)

```
1. What was the goal?
2. What have I done? (3-line summary)
3. What is the current observable state?
4. Am I still on track?
5. What assumptions did I make that I should now verify?
6. Write checkpoint to .claude/checkpoint.md
7. Continue
```

---

## When to Stop and Ask the Human

Stop and escalate when:
- Action affects irreversible state (deploy, delete, send, push)
- You've hit unexpected state you don't understand
- Two valid approaches have significantly different risk
- You've tried 2 approaches and both failed unexpectedly

**How to escalate:**
```
State:       what you were trying to do
Observed:    what actually happened (exact output, error)
Uncertainty: what you don't know that's blocking you
Question:    the specific decision you need
```

---

## What You Can Verify Autonomously

```
File existence / content     Read, Glob, Grep
Command output               Bash
Test / lint results          Bash
Git state                    git status / log / diff
API response                 WebFetch (GET only)
Another agent's work         Read their JSONL transcript
```

**Requires human before proceeding:**
```
Irreversible writes          deploy, push, send, delete
Money                        paid API calls, purchases
Scope expansion              doing more than authorized
Ambiguous requirements       two equally valid interpretations
```
