# Sessions Registry — Native Fleet View

Every running Claude instance writes a live status file to `~/.claude/sessions/{pid}.json`. No hook, no MCP, no API needed — just file reads.

## Session File Structure

```json
{
  "pid": 78591,
  "sessionId": "f3b68e75-49e4-40e1-83fd-0eff872448f8",
  "cwd": "/Users/walid/Apps/my-project",
  "startedAt": 1783773484442,
  "version": "2.1.170",
  "kind": "interactive",    // "interactive" | "subagent" | "headless"
  "entrypoint": "cli",
  "status": "idle",         // "idle" | "working"
  "updatedAt": 1783773490533
}
```

## Fleet Status — Quick Commands

```bash
# All running Claude instances right now
ls ~/.claude/sessions/*.json

# Human-readable fleet view
python3 -c "
import json, glob, os
for f in glob.glob(os.path.expanduser('~/.claude/sessions/*.json')):
    d = json.load(open(f))
    print(f\"{d['pid']:>6}  {d['status']:<8}  {d['kind']:<12}  {d.get('cwd','')[-50:]}\")
"

# Live watch (updates every 2s)
watch -n2 'python3 -c "
import json,glob,os
for f in glob.glob(os.path.expanduser(\"~/.claude/sessions/*.json\")):
    d = json.load(open(f))
    print(d[\"pid\"], d[\"status\"], d.get(\"cwd\",\"\")[-40:])
"'
```

## Encoded Project Path

Transcripts and subagent files are stored with an encoded path — the absolute project path with every `/` replaced by `-`:

```
/Users/walid/Apps/my-project
→ -Users-walid-Apps-my-project

~/.claude/projects/-Users-walid-Apps-my-project/
  {session-uuid}.jsonl               ← main session transcript
  {session-uuid}/
    subagents/
      agent-{id}.jsonl               ← subagent transcripts
      agent-{id}.meta.json           ← subagent metadata
    tool-results/                    ← oversized tool outputs
```

## Finding Sessions by Project

```bash
# Sessions for a specific project
ls ~/.claude/projects/-Users-walid-Apps-my-project/*.jsonl

# Most recently active sessions (across all projects)
ls -t ~/.claude/projects/**/*.jsonl | head -5

# Identify which session belongs to which agent (by first user message)
python3 -c "
import json, glob, os
for f in sorted(glob.glob(os.path.expanduser('~/.claude/projects/*/*.jsonl')),
                key=os.path.getmtime, reverse=True)[:6]:
    with open(f) as fh:
        for line in fh:
            d = json.loads(line)
            if d.get('type') == 'user':
                m = d.get('message', {}).get('content')
                t = m if isinstance(m, str) else next((c.get('text','') for c in m if c.get('type')=='text'), '')
                if t.strip():
                    print(f.split('/')[-1][:12], '->', t[:80]); break
"
```

## Session Resume

```bash
# Resume most recent session
claude --resume

# Resume specific session by ID
claude --resume f3b68e75-49e4-40e1-83fd-0eff872448f8
```

Sessions kept for 30 days (configurable: `cleanupPeriodDays` in settings.json).

## Reading Subagent Transcripts Live

```bash
# Tail a running subagent
tail -f ~/.claude/projects/{encoded-path}/{session}/subagents/agent-{id}.jsonl

# What's in each JSONL line:
# type=user       → task delegation (what you told it to do)
# type=assistant  → responses + tool_use blocks
# type=tool_result → what each tool returned
# type=system     → compact_boundary events with preTokens count
```

## Kind Values

| kind | What it is |
|---|---|
| `interactive` | You talking to Claude in the terminal |
| `subagent` | Spawned by another session via Agent tool |
| `headless` | Spawned via `claude -p "..."` (no TTY) |
