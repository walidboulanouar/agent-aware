# Hooks — Full Reference

Hooks run shell commands around tool calls and session events. They can block execution (non-zero exit = blocked) or inject data back into Claude's context (stdout → Claude sees it).

## Configuration

In `~/.claude/settings.json` (global) or `.claude/settings.json` (project):

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [{ "type": "command", "command": "./scripts/validate.sh" }]
      }
    ],
    "PostToolUse": [...],
    "UserPromptSubmit": [...],
    "Notification": [...],
    "Stop": [...],
    "SubagentStop": [...]
  }
}
```

## All 6 Hook Types

| Hook | Fires when | Can block? | stdin payload |
|---|---|---|---|
| `PreToolUse` | Before any tool call | Yes — non-zero exit = blocked | `{session_id, tool_name, tool_input}` |
| `PostToolUse` | After tool call completes | No | `{session_id, tool_name, tool_input, tool_response}` |
| `UserPromptSubmit` | User submits a message | Yes — can also rewrite prompt | `{session_id, prompt}` |
| `Notification` | Permission prompts | Yes | `{session_id, message, type}` |
| `Stop` | Session ends | No | `{session_id}` |
| `SubagentStop` | A subagent finishes | Yes | `{session_id, subagent_id}` |

## Matcher Syntax

```json
{ "matcher": "Bash" }          // exact tool name
{ "matcher": "Edit|Write" }    // regex OR
{ "matcher": "Bash(git:*)" }   // tool + argument pattern
{ "matcher": "*" }             // all tools
```

## Hook Behaviors

**Block execution:** exit code != 0 → tool call blocked, Claude sees the stderr as context.

**Inject context:** stdout → added to Claude's context as a tool result supplement.

**Rewrite prompt** (UserPromptSubmit only): write new prompt to stdout → Claude sees the rewritten version.

## What You Can Do With Each

### PreToolUse on Bash
```bash
#!/bin/bash
# validate.sh — receives {tool_name, tool_input} on stdin
PAYLOAD=$(cat)
CMD=$(echo "$PAYLOAD" | python3 -c "import json,sys; print(json.load(sys.stdin)['tool_input']['command'])")

# Block dangerous patterns
if echo "$CMD" | grep -qE "rm -rf|DROP TABLE|git push --force"; then
  echo "BLOCKED: dangerous command pattern detected" >&2
  exit 1
fi

# Rewrite: intercept git commands and route through rtk
if echo "$CMD" | grep -q "^git "; then
  echo "rtk $CMD"  # stdout → injected as context
fi
exit 0
```

### PostToolUse on Edit/Write
```bash
#!/bin/bash
# auto-lint every file after it's written
PAYLOAD=$(cat)
FILE=$(echo "$PAYLOAD" | python3 -c "import json,sys; print(json.load(sys.stdin)['tool_input']['file_path'])")
npx eslint "$FILE" --fix 2>/dev/null || true
```

### UserPromptSubmit — Prompt Queue
```bash
#!/bin/bash
# Queue this prompt if Claude is busy; otherwise let it through
PAYLOAD=$(cat)
PROMPT=$(echo "$PAYLOAD" | python3 -c "import json,sys; print(json.load(sys.stdin)['prompt'])")
STATUS=$(cat ~/.claude/sessions/*.json 2>/dev/null | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('status','idle'))" 2>/dev/null)

if [ "$STATUS" = "working" ]; then
  echo "$PROMPT" >> ~/.claude/prompt-queue.txt
  echo "queued — Claude is busy" >&2
  exit 1  # block current submission
fi
```

### Notification — Remote Approval
```bash
#!/bin/bash
# Forward permission prompts to Slack instead of blocking
PAYLOAD=$(cat)
MSG=$(echo "$PAYLOAD" | python3 -c "import json,sys; print(json.load(sys.stdin).get('message',''))")
curl -s -X POST "$SLACK_WEBHOOK" -d "{\"text\": \"Claude needs permission: $MSG\"}"
# exit 0 = approve automatically (after notifying)
# exit 1 = block (human must intervene in terminal)
exit 0
```

### Stop — Post-Session Automation
```bash
#!/bin/bash
# Run retro + process prompt queue when session ends
sheal retro 2>/dev/null

# Fire queued prompts into next session
if [ -f ~/.claude/prompt-queue.txt ]; then
  NEXT=$(head -1 ~/.claude/prompt-queue.txt)
  tail -n +2 ~/.claude/prompt-queue.txt > ~/.claude/prompt-queue.tmp
  mv ~/.claude/prompt-queue.tmp ~/.claude/prompt-queue.txt
  claude -p "$NEXT" &
fi
```

### SubagentStop — Aggregate Results
```bash
#!/bin/bash
# Collect subagent output into a shared results file
PAYLOAD=$(cat)
AGENT_ID=$(echo "$PAYLOAD" | python3 -c "import json,sys; print(json.load(sys.stdin).get('subagent_id',''))")
# Read the subagent's last output from its JSONL transcript and append to results
python3 ~/.claude/scripts/extract-subagent-result.py "$AGENT_ID" >> ~/.claude/fleet-results.jsonl
```

## Hook Type in Config

```json
{
  "type": "command",
  "command": "./scripts/validate.sh"
}
```

Currently only `"command"` type is supported. The command receives the payload on stdin, can write to stdout (injected into Claude's context) and stderr (shown in terminal), and signals blocking via exit code.
