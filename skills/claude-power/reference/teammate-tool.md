# TeammateTool — Full Reference

Persistent agents with inboxes and a shared task queue. The actual swarm system. Unlike Agent tool (fire-and-forget), teammates persist until explicitly shut down, can message each other, and share a task queue with dependency tracking.

## File Structure It Creates

```
~/.claude/teams/{team-name}/
  config.json              ← team metadata, member list, agent IDs, backend types
  inboxes/
    team-lead.json         ← leader's inbox (array of JSON messages)
    worker-1.json          ← each teammate gets their own inbox

~/.claude/tasks/{team-name}/
  1.json                   ← {id, subject, description, status, owner, blockedBy, blocks}
  2.json
  3.json
```

## All 13 Operations

### Team Lifecycle
```javascript
// Create a team (call first)
Teammate({ operation: "spawnTeam", team_name: "my-fleet", description: "..." })

// Discover existing teams
Teammate({ operation: "discoverTeams" })

// Join request (teammate → leader)
Teammate({ operation: "requestJoin", team_name: "my-fleet", proposed_name: "worker-1", capabilities: "code review, testing" })

// Approve / reject join (leader)
Teammate({ operation: "approveJoin", target_agent_id: "worker-1", request_id: "join-123" })
Teammate({ operation: "rejectJoin", target_agent_id: "worker-1", request_id: "join-123", reason: "team full" })

// Clean up team when done
Teammate({ operation: "cleanup" })
```

### Messaging
```javascript
// Direct message to one teammate
Teammate({ operation: "write", target_agent_id: "worker-1", value: "focus on auth.ts only" })

// Broadcast to all teammates
Teammate({ operation: "broadcast", name: "team-lead", value: "status check — what is everyone working on?" })
```

### Shutdown Protocol
```javascript
// Leader asks teammate to shut down
Teammate({ operation: "requestShutdown", target_agent_id: "worker-1", reason: "task complete" })

// Teammate approves shutdown
Teammate({ operation: "approveShutdown", request_id: "shutdown-123" })

// Teammate rejects (still busy)
Teammate({ operation: "rejectShutdown", request_id: "shutdown-123", reason: "still on task #3" })
```

### Plan Approval Gate
```javascript
// Leader approves/rejects a plan before teammate executes
Teammate({ operation: "approvePlan", target_agent_id: "architect", request_id: "plan-456" })
Teammate({ operation: "rejectPlan", target_agent_id: "architect", request_id: "plan-456", feedback: "add rate limiting" })
```

## Spawning a Teammate (vs Plain Agent)

```javascript
// Step 1: create the team
Teammate({ operation: "spawnTeam", team_name: "coset-builders" })

// Step 2: spawn teammate INTO that team (use TaskCreate tool, not Agent tool)
TaskCreate({
  team_name: "coset-builders",
  name: "security-reviewer",
  subagent_type: "general-purpose",
  prompt: "You are a security reviewer on team coset-builders...",
  run_in_background: true
})
```

Difference vs plain Agent: registered in config.json, has own inbox, can claim shared tasks, can message teammates, persists until shutdown.

## Task Queue with Dependencies

```javascript
TaskCreate({ subject: "Research", description: "...", activeForm: "Researching..." })   // → 1.json
TaskCreate({ subject: "Implement", description: "...", activeForm: "Implementing..." }) // → 2.json
TaskCreate({ subject: "Test", description: "...", activeForm: "Testing..." })           // → 3.json

// Dependencies: implement waits for research, test waits for implement
TaskUpdate({ taskId: "2", addBlockedBy: ["1"] })
TaskUpdate({ taskId: "3", addBlockedBy: ["2"] })

// When task 1 → "completed", task 2 auto-flips to "available"
// Workers polling TaskList() race to claim it
```

## Worker Claim Pattern (what worker prompts should say)

```
1. Call TaskList() — see available tasks
2. Find one: status=pending, no owner, not blocked
3. Claim it: TaskUpdate({ taskId: "X", owner: "MY_NAME", status: "in_progress" })
4. Do the work
5. Complete: TaskUpdate({ taskId: "X", status: "completed" })
6. Send findings to team-lead via Teammate write
7. Go to step 1. If no tasks available, send idle_notification and exit.
```

## Message Formats

```json
// Regular message
{ "from": "worker-1", "text": "findings here", "timestamp": "...", "read": false }

// Shutdown request (leader → teammate)
{ "type": "shutdown_request", "requestId": "shutdown-abc@worker-1", "from": "team-lead", "reason": "done" }

// Auto-sent when teammate goes idle
{ "type": "idle_notification", "from": "worker-1", "completedTaskId": "2", "completedStatus": "completed" }

// Plan approval request (teammate → leader, when planModeRequired=true)
{ "type": "plan_approval_request", "from": "architect", "requestId": "plan-xyz", "planContent": "..." }

// Permission escalation (teammate → leader)
{ "type": "permission_request", "requestId": "perm-123", "toolName": "Bash", "input": {"command": "npm install"} }
```

## Spawn Backends (How Teammates Physically Run)

Auto-detected from environment.

| Backend | Trigger | What runs | Visibility | Persistence |
|---|---|---|---|---|
| `in-process` | Not in tmux/iTerm2 | Async task in same Node.js process | Hidden | Dies with leader |
| `tmux` | `$TMUX` set | Separate `claude` in new tmux pane | Full visibility | Survives leader exit |
| `iterm2` | In iTerm2 + `it2` CLI | Splits iTerm2 window | Side-by-side | Dies with window |

Force backend: `CLAUDE_CODE_SPAWN_BACKEND=tmux`

**Key insight:** Running `claude` inside a tmux session → teammates auto-appear as visible tmux panes. This is how you get a visible agent fleet on a box without extra setup.

## The 5-Minute Heartbeat Timeout

Teammates must update their heartbeat file. If no heartbeat for 5 minutes → marked inactive → their in-progress tasks become reclaimable by other workers. Built-in crash recovery.

## Environment Variables Injected into Teammates

```bash
CLAUDE_CODE_TEAM_NAME="fleet-name"
CLAUDE_CODE_AGENT_ID="worker-1@fleet-name"
CLAUDE_CODE_AGENT_NAME="worker-1"
CLAUDE_CODE_AGENT_TYPE="general-purpose"
CLAUDE_CODE_PLAN_MODE_REQUIRED="false"
CLAUDE_CODE_PARENT_SESSION_ID="session-xyz"
```

Use in prompts: `"Your name is $CLAUDE_CODE_AGENT_NAME. Sign all messages with it."`
