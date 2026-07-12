#!/bin/bash
# agent-aware: session-cleanup hook
# Fires on Stop — removes the checkpoint-pulse counter file for this session
# so /tmp doesn't accumulate stale counter files across sessions.

PAYLOAD=$(cat)
SESSION_ID=$(echo "$PAYLOAD" | python3 -c "import json,sys; print(json.load(sys.stdin).get('session_id',''))" 2>/dev/null)

[ -n "$SESSION_ID" ] && rm -f "/tmp/.agent-aware-pulse-${SESSION_ID}"

exit 0
