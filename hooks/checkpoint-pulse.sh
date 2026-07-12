#!/bin/bash
# agent-aware: checkpoint-pulse hook
# Fires on PostToolUse — counts tool calls per session and reminds the
# agent to checkpoint every 15 calls before context degrades.

PAYLOAD=$(cat)
SESSION_ID=$(echo "$PAYLOAD" | python3 -c "import json,sys; print(json.load(sys.stdin).get('session_id',''))" 2>/dev/null)

[ -z "$SESSION_ID" ] && exit 0

COUNTER_FILE="/tmp/.agent-aware-pulse-${SESSION_ID}"

# Increment counter
if [ -f "$COUNTER_FILE" ]; then
  COUNT=$(cat "$COUNTER_FILE")
  COUNT=$((COUNT + 1))
else
  COUNT=1
fi
echo "$COUNT" > "$COUNTER_FILE"

# Fire reminder every 15 tool calls
if [ $((COUNT % 15)) -eq 0 ]; then
  echo "[CHECKPOINT PULSE: Tool call #${COUNT}. Self-check: What was the goal? What have you done? Write state to .claude/checkpoint.md before continuing.]"
fi

exit 0
