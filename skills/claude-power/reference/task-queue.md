# Task Queue — Full API

Shared task queue used by TeammateTool agents. Tasks are JSON files in `~/.claude/tasks/{team-name}/`. Multiple agents race to claim and complete them.

## All 6 Tools

```javascript
// Create a task
TaskCreate({
  subject: "Analyze auth module",
  description: "Read auth.ts and all files it imports. Find security issues. Write findings to /tmp/auth-findings.json",
  activeForm: "Analyzing auth module..."   // shown in UI while running
})
// Returns: { taskId: "1" }

// List all tasks (what workers poll)
TaskList()
// Returns: [{ id, subject, status, owner, blockedBy, blocks, createdAt }]

// Get full task details
TaskGet({ taskId: "1" })
// Returns: { id, subject, description, status, owner, blockedBy, blocks, output, ... }

// Update a task (claim it, mark done, add dependencies)
TaskUpdate({
  taskId: "1",
  status: "in_progress",          // pending / in_progress / completed / failed
  owner: "worker-1",              // who owns it
  addBlockedBy: ["2", "3"],       // add blockers (task waits for these)
  removeBlockedBy: ["2"],         // remove a blocker
  addBlocks: ["5"],               // this task blocks task 5
})

// Stream output from a running task (works while task is running)
TaskOutput({ taskId: "1" })
// Returns: { output: "..." }   (accumulated stdout so far)

// Kill a running task
TaskStop({ taskId: "1" })
```

## Task Status Flow

```
pending → in_progress → completed
                      → failed
```

When a task's blockers all reach `completed`, the task auto-flips from `pending` to available for claiming.

## Worker Claim Pattern

What a worker agent's prompt should instruct it to do:

```
1. Call TaskList() — see all tasks
2. Filter: status=pending, owner=null, blockedBy=[] (empty)
3. Race to claim: TaskUpdate({ taskId: X, owner: MY_NAME, status: "in_progress" })
   (If two workers claim simultaneously, one wins — file rename is atomic)
4. Do the work
5. Complete: TaskUpdate({ taskId: X, status: "completed" })
6. Write findings: send via Teammate write to team-lead, or write to a file
7. Back to step 1. If no tasks available → send idle_notification → exit
```

## Dependency Graph Example

```javascript
// Research must happen before implement
// Implement must happen before test
// Security review can happen in parallel with test
TaskCreate({ subject: "Research", description: "..." })           // → id: 1
TaskCreate({ subject: "Implement", description: "..." })          // → id: 2
TaskCreate({ subject: "Test", description: "..." })               // → id: 3
TaskCreate({ subject: "Security review", description: "..." })    // → id: 4

TaskUpdate({ taskId: "2", addBlockedBy: ["1"] })   // implement waits for research
TaskUpdate({ taskId: "3", addBlockedBy: ["2"] })   // test waits for implement
TaskUpdate({ taskId: "4", addBlockedBy: ["2"] })   // security waits for implement

// Timeline:
// t=0: task 1 available → worker-A claims
// t=1: task 1 done → task 2 unblocks → worker-B claims
// t=2: task 2 done → tasks 3 and 4 unblock → worker-C and worker-D race
```

## Task File Format

```json
{
  "id": "1",
  "subject": "Analyze auth module",
  "description": "Read auth.ts...",
  "activeForm": "Analyzing...",
  "status": "in_progress",
  "owner": "worker-1",
  "blockedBy": [],
  "blocks": ["2"],
  "createdAt": 1783773484442,
  "updatedAt": 1783773490533
}
```
