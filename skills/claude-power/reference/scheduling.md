# Scheduling — CronCreate vs ScheduleWakeup

Two scheduling systems. Different tradeoffs.

## ScheduleWakeup — In-Session Loop

Ends the current turn. Re-invokes with a prompt after N seconds. Context can survive (if within cache window).

```javascript
ScheduleWakeup({
  delaySeconds: 270,           // min 60, max 3600 (clamped by runtime)
  reason: "watching CI run",   // shown to user
  prompt: "/loop check-deploy" // what fires on wake — pass /loop prompt verbatim
})
```

### Cache Window Rule

| Delay | Effect |
|---|---|
| Under 270s | Cache stays warm — faster, cheaper next turn |
| 300s+ | Cache miss — full context reload, pays again |
| 1200-1800s | Right for idle ticks — accept miss, don't burn tokens polling |

Never sleep 300s exactly — worst of both worlds (misses cache, doesn't save much time).

### Self-Referential Loop Pattern

```
Turn 1: do work → ScheduleWakeup(delay=270s, prompt="/loop /ship-backlog")
Turn 2: /loop /ship-backlog re-entered → do work → ScheduleWakeup again
Turn N: repeat until ScheduleWakeup is NOT called → loop stops
```

### When Woken by Monitor (not sleep)

If a `<task-notification>` fires before the sleep expires, you're re-invoked immediately. Handle the event, then call ScheduleWakeup again with the same delay to reset the safety net. The Monitor remains the primary wake signal.

---

## CronCreate — Cloud Schedule

Registers with Anthropic's infrastructure. Fires even after session close. Each fire = fresh independent session (no shared memory — use files for state).

```javascript
CronCreate({
  cron: "*/5 * * * *",   // standard cron expression
  prompt: "/ship-backlog", // what runs at each fire
  recurring: true          // false = one-shot
})
// Returns: { jobId: "cron-xyz" }
// Auto-expires after 7 days

CronDelete({ jobId: "cron-xyz" })  // cancel
CronList()                          // see active jobs
```

### Common Cron Expressions

```
*/5 * * * *    every 5 minutes
0 * * * *      every hour
0 9 * * 1-5   weekdays at 9am
0 0 * * *      daily at midnight
```

### State Between Fires

Each CronCreate fire starts a fresh session — no conversation memory. To pass state between fires, write to files:

```bash
# Agent writes result
echo '{"found": 12, "lastRun": "..."}' > ~/.claude/cron-state/my-task.json

# Next fire reads it
cat ~/.claude/cron-state/my-task.json
```

---

## Key Differences

| | ScheduleWakeup | CronCreate |
|---|---|---|
| Session | Continues current session | Fresh session every fire |
| Context | Survives (if in cache) | None — use files |
| Survives close | No | Yes |
| Max interval | 3600s (1hr) | Any cron expression |
| Auto-expire | No | 7 days |
| Use for | Self-pacing loops, polling CI | Recurring tasks, daily jobs |
