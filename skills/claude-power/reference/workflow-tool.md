# Workflow Tool — Full Reference

Deterministic multi-agent pipelines. Scripts, not conversations. Structured output with schema validation. Budget-aware scaling.

## Core Primitives

```javascript
// pipeline: no barrier — items flow through stages independently
// Item A enters stage 2 while item B is still in stage 1
// Wall-clock = slowest single-item chain (not sum of slowest per stage)
pipeline(items, stageA, stageB, stageC)

// parallel: full barrier — awaits ALL before returning
// Use ONLY when stage N genuinely needs all stage N-1 results
parallel([() => agent(...), () => agent(...)])

// agent: one worker with optional structured output
agent("find bugs", {
  schema: BUGS_SCHEMA,    // forces StructuredOutput, returns typed object
  label: "bug-finder",    // display label in /workflows
  phase: "Find",          // groups agents in progress display
  model: "haiku",         // model override (omit = inherit)
  isolation: "worktree",  // isolated git branch
  agentType: "Explore"    // custom agent type
})

// phase: group subsequent agents in progress display
phase("Research")
phase("Implement")
phase("Verify")

// log: emit progress message
log("found 12 issues, verifying...")

// sub-workflows
workflow("saved-name", args)
workflow({ scriptPath: "path/to/script.js" }, args)
```

## Schema Output — Most Underused Feature

When you pass a JSON schema, the subagent is forced to return valid structured data. No text parsing. No hallucinated JSON. Retries automatically on mismatch.

```javascript
const FINDINGS_SCHEMA = {
  type: "object",
  properties: {
    bugs: {
      type: "array",
      items: {
        type: "object",
        properties: {
          file: { type: "string" },
          line: { type: "number" },
          severity: { type: "string", enum: ["low", "medium", "high", "critical"] },
          description: { type: "string" }
        },
        required: ["file", "line", "severity", "description"]
      }
    }
  },
  required: ["bugs"]
}

const result = await agent("find security bugs", { schema: FINDINGS_SCHEMA })
// result.bugs is a real typed array. Guaranteed valid.
```

## Budget Control

```javascript
budget.total        // null if no target set by user
budget.spent()      // output tokens used this turn (shared pool)
budget.remaining()  // max(0, total - spent()), Infinity if no target

// Scale fleet size to budget
const FLEET_SIZE = budget.total ? Math.floor(budget.total / 100_000) : 5

// Loop until budget exhausted
while (budget.total && budget.remaining() > 50_000) {
  const result = await agent("find more bugs", { schema: BUGS_SCHEMA })
  bugs.push(...result.bugs)
  log(`${bugs.length} found, ${Math.round(budget.remaining() / 1000)}k remaining`)
}
```

## Fleet Patterns

### Fan-Out + Aggregate
```javascript
export const meta = { name: 'fan-out', description: 'Parallel search + synthesis' }

const findings = await parallel([
  () => agent("find auth vulnerabilities"),
  () => agent("find SQL injection risks"),
  () => agent("find secrets in env vars"),
])
const report = await agent(`synthesize: ${JSON.stringify(findings.filter(Boolean))}`)
return report
```

### Pipeline (fastest — default choice)
```javascript
const results = await pipeline(
  FILES,
  file => agent(`analyze ${file}`, { schema: ISSUES_SCHEMA, phase: "Analyze" }),
  issues => agent(`fix: ${JSON.stringify(issues)}`, { phase: "Fix", isolation: "worktree" }),
  (fix, originalFile) => agent(`write tests for ${originalFile}`, { phase: "Test" })
)
// Stage callbacks: (prevResult, originalItem, index)
// Use originalItem in later stages — don't thread context through stage 1's return value
```

### Adversarial Verify
```javascript
const VERDICT = {
  type: "object",
  properties: { refuted: { type: "boolean" }, reason: { type: "string" } },
  required: ["refuted", "reason"]
}

const verified = await parallel(findings.map(f => async () => {
  const votes = await parallel([
    () => agent(`Try hard to REFUTE: "${f.desc}". Default refuted=true if uncertain.`, { schema: VERDICT }),
    () => agent(`Try hard to REFUTE: "${f.desc}". Default refuted=true if uncertain.`, { schema: VERDICT }),
    () => agent(`Try hard to REFUTE: "${f.desc}". Default refuted=true if uncertain.`, { schema: VERDICT }),
  ])
  const survived = votes.filter(Boolean).filter(v => !v.refuted).length >= 2
  return survived ? f : null
}))
return verified.filter(Boolean)
```

### Loop-Until-Dry
```javascript
const seen = new Set()
const confirmed = []
let dry = 0
const key = b => `${b.file}:${b.line}`

while (dry < 2) {
  const found = (await parallel(FINDERS.map(f => () =>
    agent(f.prompt, { phase: "Find", schema: BUGS })
  ))).filter(Boolean).flatMap(r => r.bugs)

  const fresh = found.filter(b => !seen.has(key(b)))
  if (!fresh.length) { dry++; log(`dry round ${dry}/2`); continue }

  dry = 0
  fresh.forEach(b => seen.add(key(b)))
  confirmed.push(...fresh)
}
// Dedup against `seen` (all found), NOT `confirmed` (accepted only)
// Otherwise rejected findings reappear every round and loop never converges
return confirmed
```

## Hard Limits

| Limit | Value |
|---|---|
| Max concurrent agents | 16 (excess queues, doesn't fail) |
| Max total agents per workflow | 1000 |
| Max items per parallel() or pipeline() | 4096 |
| Max nesting depth | 5 levels |

## Script Requirements

```javascript
// Every script must start with meta (pure literal — no variables or calls)
export const meta = {
  name: "my-workflow",
  description: "What it does",
  phases: [
    { title: "Find", detail: "search for issues" },
    { title: "Verify", detail: "adversarial check" }
  ]
}

// Body runs in async context — await directly
// NO: Date.now(), Math.random(), new Date() — breaks resume
// YES: JSON, Math, Array, standard JS built-ins
// NO: filesystem, Node.js APIs (use agent() to shell out)
```

Monitor: `/workflows`
Resume: `Workflow({ scriptPath: "path", resumeFromRunId: "wf_abc123" })`
