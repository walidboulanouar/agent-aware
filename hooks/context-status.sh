#!/bin/bash
# agent-aware: context-status hook
# Fires on UserPromptSubmit — injects current token estimate so the agent
# always knows how full its context is before starting work.

PAYLOAD=$(cat)
SESSION_ID=$(echo "$PAYLOAD" | python3 -c "import json,sys; print(json.load(sys.stdin).get('session_id',''))" 2>/dev/null)

[ -z "$SESSION_ID" ] && exit 0

# Find this session's JSONL transcript
JSONL=$(find ~/.claude/projects -name "${SESSION_ID}.jsonl" 2>/dev/null | head -1)
[ -z "$JSONL" ] && exit 0

# Extract latest preTokens from compact_boundary system events
PRE_TOKENS=$(python3 -c "
import json
tokens = 0
with open('$JSONL') as f:
    for line in f:
        try:
            d = json.loads(line)
            if d.get('type') == 'system' and 'preTokens' in d:
                tokens = d['preTokens']
        except:
            pass
print(tokens)
" 2>/dev/null || echo "0")

# Count total entries as a depth signal
ENTRIES=$(wc -l < "$JSONL" 2>/dev/null || echo "0")
ENTRIES=$(echo "$ENTRIES" | tr -d ' ')

# Only inject if we have real data and context is meaningfully used
if [ "$PRE_TOKENS" -gt 20000 ]; then
  PCT=$((PRE_TOKENS * 100 / 200000))

  if [ "$PCT" -ge 75 ]; then
    LEVEL="CRITICAL"
  elif [ "$PCT" -ge 60 ]; then
    LEVEL="HIGH"
  elif [ "$PCT" -ge 40 ]; then
    LEVEL="MODERATE"
  else
    LEVEL="OK"
  fi

  echo "[CONTEXT: ~${PCT}% full · ${PRE_TOKENS} tokens used · ${ENTRIES} session entries · status: ${LEVEL}]"

  if [ "$PCT" -ge 60 ]; then
    echo "[ACTION: Write checkpoint to .claude/checkpoint.md. Consider delegating remaining work to a subagent.]"
  fi
fi

exit 0
