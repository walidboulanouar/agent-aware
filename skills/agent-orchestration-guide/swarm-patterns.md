# Swarm Patterns

A swarm = a Dynamic Workflow that fans out many agents in parallel, collects results, and optionally has agents check each other's work.

The engine is the `Workflow` tool. Three primitives:

```javascript
pipeline(items, stage1, stage2)  // no barrier — fastest, default choice
parallel(thunks)                 // barrier — ALL must finish before continuing
agent(prompt, {schema})          // one worker, returns validated object
```

---

## Pattern 1: Fan-Out + Aggregate

Many agents search in parallel, one synthesizes.

```javascript
export const meta = { name: 'fan-out', description: 'Parallel search + synthesis' }

const findings = await parallel([
  () => agent("find auth vulnerabilities"),
  () => agent("find SQL injection risks"),
  () => agent("find secrets in env vars"),
  () => agent("find race conditions"),
  () => agent("find XSS vectors"),
])

const report = await agent(`synthesize: ${JSON.stringify(findings.filter(Boolean))}`)
return report
```

When to use: independent searches with no cross-dependency. Each finder is blind to others — diversity catches what single-angle search misses.

---

## Pattern 2: Pipeline

Items flow through stages independently. Stage 2 starts on item A before item B finishes stage 1. No wasted wait time.

```javascript
export const meta = { name: 'pipeline', description: 'Multi-stage per-item processing' }

const results = await pipeline(
  FILES,
  // Stage 1: analyze
  file => agent(`analyze ${file} for issues`, {label: file, phase: 'Analyze', schema: ISSUES_SCHEMA}),
  // Stage 2: fix (each file's fix starts as soon as analysis finishes)
  issues => agent(`fix: ${JSON.stringify(issues)}`, {phase: 'Fix', isolation: 'worktree'}),
  // Stage 3: test
  (fix, originalFile) => agent(`write tests for changes in ${originalFile}`, {phase: 'Test'})
)
```

Stage callbacks receive `(prevResult, originalItem, index)`. Use `originalItem` in later stages to reference the input.

---

## Pattern 3: Adversarial Verify

N skeptic agents try to REFUTE each finding. Majority rules. Eliminates false positives.

```javascript
export const meta = { name: 'adversarial', description: 'Find then adversarially verify' }

const VERDICT = {
  type: 'object',
  properties: { refuted: { type: 'boolean' }, reason: { type: 'string' } },
  required: ['refuted', 'reason']
}

// Phase 1: find
const { bugs } = await agent("find all bugs in this codebase", {
  phase: 'Find',
  schema: { type: 'object', properties: { bugs: { type: 'array' } }, required: ['bugs'] }
})

// Phase 2: adversarially verify each bug in parallel
const verified = await parallel(bugs.map(bug => async () => {
  const votes = await parallel([
    () => agent(`Try hard to REFUTE: "${bug.desc}". If uncertain, default to refuted=true.`, {schema: VERDICT, phase: 'Verify'}),
    () => agent(`Try hard to REFUTE: "${bug.desc}". If uncertain, default to refuted=true.`, {schema: VERDICT, phase: 'Verify'}),
    () => agent(`Try hard to REFUTE: "${bug.desc}". If uncertain, default to refuted=true.`, {schema: VERDICT, phase: 'Verify'}),
  ])
  const survived = votes.filter(Boolean).filter(v => !v.refuted).length >= 2
  return survived ? bug : null
}))

return verified.filter(Boolean)
```

3 votes, majority (2/3) must NOT refute for a finding to survive.

---

## Pattern 4: Loop-Until-Dry

Keep spawning finders until K consecutive rounds return nothing new.

```javascript
export const meta = { name: 'loop-until-dry', description: 'Find until exhausted' }

const seen = new Set()
const confirmed = []
let dry = 0

const key = b => `${b.file}:${b.line}`

while (dry < 2) {
  const found = (await parallel(FINDERS.map(f => () =>
    agent(f.prompt, {phase: 'Find', schema: BUGS})
  ))).filter(Boolean).flatMap(r => r.bugs)

  const fresh = found.filter(b => !seen.has(key(b)))

  if (!fresh.length) { dry++; log(`dry round ${dry}/2`); continue }

  dry = 0
  fresh.forEach(b => seen.add(key(b)))
  confirmed.push(...fresh)
  log(`${confirmed.length} total, searching again`)
}

return confirmed
```

Dedup against `seen` (ALL found), not `confirmed` (accepted only). Otherwise rejected findings reappear every round and the loop never converges.

---

## Pattern 5: Budget-Aware Loop

Scale depth to how many tokens the user allocated.

```javascript
const bugs = []

while (budget.total && budget.remaining() > 50_000) {
  const result = await agent("Find bugs. Be thorough.", {schema: BUGS_SCHEMA})
  bugs.push(...result.bugs)
  log(`${bugs.length} found, ${Math.round(budget.remaining() / 1000)}k remaining`)
}

return bugs
```

Guard on `budget.total` — without a target, `remaining()` is Infinity and the loop runs to the 1000-agent cap.

---

## Hard Limits

| Limit | Value |
|---|---|
| Max concurrent agents | 16 (excess queues) |
| Max total agents per workflow | 1000 |
| Max items per parallel() or pipeline() | 4096 |
| Max subagent nesting depth | 5 levels |

---

## Workflow vs Subagents

**Use subagents (Agent tool)** when: 1-5 workers, results come back to your conversation, no complex control flow.

**Use Dynamic Workflow** when: 6+ workers, need loops, adversarial cross-checking, structured output with schema validation, or budget-aware scaling.
