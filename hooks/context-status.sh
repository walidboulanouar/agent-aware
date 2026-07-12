#!/bin/bash
# agent-aware: context-status hook
# Fires on UserPromptSubmit — injects current token estimate so the agent
# always knows how full its context is before starting work.
#
# Token estimation strategy:
#   1. If compact_boundary events exist in JSONL → use preTokens (measured)
#   2. Otherwise → estimate from JSONL byte size (works from session start)
# Context window detection:
#   - opus model detected → 1,000,000 tokens
#   - all others          → 200,000 tokens

PAYLOAD=$(cat)
SESSION_ID=$(echo "$PAYLOAD" | python3 -c "import json,sys; print(json.load(sys.stdin).get('session_id',''))" 2>/dev/null)

[ -z "$SESSION_ID" ] && exit 0

JSONL=$(find ~/.claude/projects -name "${SESSION_ID}.jsonl" 2>/dev/null | head -1)
[ -z "$JSONL" ] && exit 0

python3 -c "
import json, os, sys

path = '$JSONL'
if not os.path.exists(path): sys.exit(0)

entries = 0
content_chars = 0
pre_tokens = 0
model_hint = ''

with open(path) as f:
    for line in f:
        entries += 1
        content_chars += len(line)
        try:
            d = json.loads(line)
            if d.get('type') == 'system' and 'preTokens' in d:
                pre_tokens = d['preTokens']
            if d.get('type') == 'assistant':
                m = d.get('message', {}).get('model', '')
                if m: model_hint = m
        except:
            pass

# Context window by model family
ctx_window = 1_000_000 if 'opus' in model_hint.lower() else 200_000

# Best token estimate
if pre_tokens > 0:
    token_est = pre_tokens
    source = 'measured'
else:
    # Fallback: JSONL JSON has ~6x overhead vs raw content
    token_est = content_chars // 6
    source = 'estimated'

# Too early — don't add noise
if token_est < 8000: sys.exit(0)

pct = min(99, token_est * 100 // ctx_window)

if pct >= 75:   level = 'CRITICAL'
elif pct >= 60: level = 'HIGH'
elif pct >= 40: level = 'MODERATE'
else:           level = 'OK'

print(f'[CONTEXT: ~{pct}% full · {token_est:,} tokens ({source}) · {entries} entries · {level}]')

if pct >= 60:
    print('[ACTION: Write checkpoint to .claude/checkpoint.md. Delegate remaining work to a subagent.]')
" 2>/dev/null

exit 0
