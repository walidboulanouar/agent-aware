---
name: claude-power
description: Native Claude Code capabilities most people never discover. Quick pick table + pointers to reference files. Read this first — pull reference files only when you need the full detail on a specific capability.
---

# Claude Power

Most people use Claude Code like a chat interface. It is a full agent operating system.
This is the quick map. Pull reference files for full depth.

---

## Multi-Agent Systems — Quick Pick

| System | Use when | Full detail |
|---|---|---|
| **Agent tool** | Fire-and-forget subagent, returns result | built-in |
| **TeammateTool** | Persistent agents with inboxes + shared task queue | `reference/teammate-tool.md` |
| **Workflow tool** | Deterministic fan-out pipelines, schema output, budget control | `reference/workflow-tool.md` |
| **CronCreate** | Cloud-scheduled sessions, survives session close | `reference/scheduling.md` |
| **ScheduleWakeup** | Self-pacing loop within a session | `reference/scheduling.md` |

---

## All Deferred Tools — What Exists

These tools require `ToolSearch({query: "select:ToolName"})` before calling. Most people never know they exist.

### Scheduling
| Tool | One-liner |
|---|---|
| `ScheduleWakeup` | End session, re-invoke with prompt after N seconds |
| `CronCreate` | Register cloud cron (survives close). Returns jobId. |
| `CronList` | List active cron jobs |
| `CronDelete` | Cancel by jobId |

### Task Queue (shared between teammates)
| Tool | One-liner |
|---|---|
| `TaskCreate` | Create a task with subject + description |
| `TaskList` | List all tasks with status/owner/blockedBy |
| `TaskGet` | Full task details by ID |
| `TaskUpdate` | Update status / owner / blockedBy / blocks |
| `TaskOutput` | Stream output from a running task |
| `TaskStop` | Kill a running task |

Full API: `reference/task-queue.md`

### Events + Monitoring
| Tool | One-liner |
|---|---|
| `Monitor` | Watch process/file/stream. `persistent:true` survives turns. Fires `<task-notification>` on match — bypasses sleep. |
| `RemoteTrigger` | Create a webhook URL that wakes this session when hit |
| `PushNotification` | Send push to user's mobile device |

Full API: `reference/events-monitoring.md`

### Session Control
| Tool | One-liner |
|---|---|
| `EnterPlanMode` | Block execution, force planning phase |
| `ExitPlanMode` | Exit plan mode and execute |
| `EnterWorktree` | Give agent an isolated git branch |
| `ExitWorktree` | Exit worktree (auto-cleans if no changes) |

### Web + MCP
| Tool | One-liner |
|---|---|
| `WebFetch` | Fetch a URL, returns content |
| `WebSearch` | Search the web |
| `ListMcpResourcesTool` | List resources from connected MCP servers |
| `ReadMcpResourceTool` | Read a specific MCP resource |
| `ToolSearch` | Load deferred tool schemas before calling them |
| `NotebookEdit` | Edit Jupyter notebooks |

---

## Things Most People Never Try

```bash
# Resume any session by ID
claude --resume f244a980-49e4

# Fork with full parent conversation history
/fork [task that needs context from this conversation]

# Isolated parallel build
claude --worktree feature-x

# Batch mechanical multi-file change
/batch rename userId to user_id across all TypeScript files

# See all running Claude sessions on this machine
claude agents

# Gitignored files in worktrees
echo ".env" >> .worktreeinclude
```

---

## Subagent Frontmatter — The Fields Nobody Uses

```markdown
---
name: my-agent
model: haiku              # route cheap work to haiku (20x cheaper)
effort: xhigh             # extended thinking: low/medium/high/xhigh/max
permissionMode: acceptEdits  # stop clicking yes on every edit
background: true          # fire-and-forget, returns control immediately
initialPrompt: "start..."  # auto-submitted as first turn (--agent mode)
memory: project           # persist to .claude/memory/ (checked into git)
isolation: worktree        # each spawn gets clean git branch
color: red                # visual fleet management
skills:
  - agent-self-awareness   # preload skill at startup
mcpServers:
  playwright:              # extra MCP only this agent gets
    type: stdio
    command: npx
    args: ["-y", "@playwright/mcp@latest"]
---
```

Full field reference: `../agent-orchestration-guide/SKILL.md`

---

## Model Routing — Stop Running Everything on Opus

| Task | Model |
|---|---|
| File search, grep, simple reads | `haiku` |
| Code generation, reasoning | `sonnet` |
| Architecture, adversarial review, complex analysis | `opus` |
| Creative, long-form writing | `fable` |

Set explicitly in subagent frontmatter or Workflow `agent()` calls. Most workflows waste 80% of cost running searches on the wrong model.

---

## Hooks — The Interception Layer

Six hook points. Full patterns: `reference/hooks-reference.md`

| Hook | Fires when | Can block? |
|---|---|---|
| `PreToolUse` | Before any tool call | Yes |
| `PostToolUse` | After tool call | No |
| `UserPromptSubmit` | User submits message | Yes (can rewrite prompt) |
| `Notification` | Permission prompts | Yes |
| `Stop` | Session ends | No |
| `SubagentStop` | Subagent finishes | Yes |

---

## Sessions Registry — Native Fleet View

Every running Claude instance writes a live status file. No hook, no MCP, no API — just file reads.

```bash
# Who's running and what are they doing
cat ~/.claude/sessions/*.json

# Live watch
watch -n2 'ls ~/.claude/sessions/*.json | xargs -I{} cat {}'
```

Full structure + fleet patterns: `reference/sessions-registry.md`

---

## The 5-Level CLAUDE.md Hierarchy

```
~/.claude/CLAUDE.md          global
/project/CLAUDE.md           project root
/project/.claude/CLAUDE.md   project .claude dir
/project/src/CLAUDE.md       subdirectory (if working there)
/project/CLAUDE.local.md     local only, not committed
```

Later overrides earlier. Use `CLAUDE.local.md` for personal preferences not for git.

---

## Reference Files (read when you need depth)

All paths relative to this skill's directory:

| File | What it covers |
|---|---|
| `reference/workflow-tool.md` | pipeline/parallel/agent, schema output, budget control, all fleet patterns |
| `reference/teammate-tool.md` | All 13 TeammateTool ops, task queue with deps, message formats, spawn backends, heartbeat |
| `reference/scheduling.md` | CronCreate vs ScheduleWakeup, cache window rules, loop chaining |
| `reference/events-monitoring.md` | Monitor (persistent), RemoteTrigger webhooks, PushNotification |
| `reference/task-queue.md` | TaskCreate/List/Get/Update/Output/Stop full API + worker claim pattern |
| `reference/sessions-registry.md` | Session file structure, fleet status reading, encoded path format |
| `reference/hooks-reference.md` | All 6 hooks, matcher syntax, what you can do with each |
