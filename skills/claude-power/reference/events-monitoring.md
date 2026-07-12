# Events + Monitoring — Monitor, RemoteTrigger, PushNotification

Three tools for event-driven agent behavior. Together they turn polling loops into reactive systems.

## Monitor — Event-Driven Wake

Watch a process, file, or stream. When a condition matches, fires a `<task-notification>` immediately — bypasses ScheduleWakeup sleep entirely.

```javascript
Monitor({
  command: "tail -f /var/log/deploy.log",   // what to watch
  trigger: "deploy complete|ERROR",          // regex — fires on match
  persistent: true,                          // survives across turns (arm once)
  label: "deploy-watcher"
})
```

### persistent: true vs false

- `persistent: false` (default) — dies at end of turn. Useless for loops.
- `persistent: true` — survives across turns. Arm it once. It fires whenever condition matches.

### Usage Pattern in a Loop

```javascript
// Arm once at loop start
// (check TaskList first to avoid re-arming on every wake)
const tasks = await TaskList()
const watcherRunning = tasks.some(t => t.subject === "deploy-watcher" && t.status === "running")
if (!watcherRunning) {
  Monitor({
    command: "tail -f ~/.claude/projects/.../subagent-output.log",
    trigger: "DONE|ERROR|completed",
    persistent: true,
    label: "deploy-watcher"
  })
}

// Do work, then sleep
ScheduleWakeup({ delaySeconds: 1200, reason: "fallback if monitor doesn't fire", prompt: "/loop watch-deploy" })

// When monitor fires (before sleep expires):
// <task-notification> arrives → re-enter loop → handle event → reset ScheduleWakeup
```

### What to Watch

```bash
# CI/CD output
"tail -f /tmp/ci-output.log"     trigger: "Tests passed|FAILED"

# File changes
"fswatch -1 ./src/"              trigger: ".*\\.ts"

# Another agent's transcript
"tail -f ~/.claude/projects/.../agent-abc123.jsonl"   trigger: "completed|error"

# HTTP endpoint
"curl -s https://api.example.com/status"   trigger: "ready|healthy"
```

---

## RemoteTrigger — Inbound Webhook

Creates a URL. When that URL is hit (HTTP POST), it wakes this session immediately. Connects external systems (GitHub, n8n, Slack) to Claude agents.

```javascript
const { url } = RemoteTrigger({
  label: "github-pr-webhook",
  description: "fires when a PR is opened"
})
// url = https://hooks.claude.ai/trigger/abc123...
```

### Use Cases

```bash
# n8n workflow hits this URL when a form is submitted
# → Claude agent wakes, reads the payload, processes it

# GitHub webhook on PR open
# → Claude wakes, runs code review agent

# Slack slash command
# → Claude wakes, handles the command
```

### Payload Access

The payload sent to the webhook URL is available in the `<task-notification>` message content when the session re-invokes.

---

## PushNotification — Alert User's Mobile

Sends a push notification to the user's phone/device when an agent needs attention or finishes a long task.

```javascript
PushNotification({
  title: "Agent needs you",
  body: "Security audit found 3 critical issues — review before deploying",
  urgency: "high"   // low / normal / high
})
```

### When to Use

- Long-running overnight agent finishes
- Agent hits a decision that requires human input (irreversible action)
- Adversarial verify finds something critical
- Fleet-level error requiring attention

Do not spam. Use for genuine need-human moments, not progress updates.

---

## Combining All Three

Pattern: long-running autonomous agent with full event coverage.

```javascript
// 1. Arm Monitor for the thing you're waiting for
Monitor({ command: "tail -f ./deploy.log", trigger: "deployed|FAILED", persistent: true })

// 2. Create RemoteTrigger for external systems to reach you
const { url } = RemoteTrigger({ label: "n8n-callback" })
log(`n8n should POST to: ${url}`)

// 3. Do work

// 4. If agent needs human, push notification
if (needsHuman) {
  PushNotification({ title: "Review needed", body: foundIssue.description, urgency: "high" })
}

// 5. Sleep with fallback
ScheduleWakeup({ delaySeconds: 1200, reason: "fallback if no event fires", prompt: currentPrompt })
```
