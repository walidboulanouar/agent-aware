#!/usr/bin/env node

const fs = require('fs')
const path = require('path')
const os = require('os')

const CLAUDE_DIR = path.join(os.homedir(), '.claude')
const SKILL_DIR = path.join(CLAUDE_DIR, 'skills')
const HOOK_DIR = path.join(CLAUDE_DIR, 'hooks', 'agent-aware')
const SETTINGS_FILE = path.join(CLAUDE_DIR, 'settings.json')
const SKILLS_SRC = path.join(__dirname, '..', 'skills')
const HOOKS_SRC = path.join(__dirname, '..', 'hooks')
const TEMPLATE = path.join(__dirname, '..', 'templates', 'claude-md-block.md')
const MARKER = '<!-- agent-aware:start -->'

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true })
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name)
    const destPath = path.join(dest, entry.name)
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath)
    } else {
      fs.copyFileSync(srcPath, destPath)
    }
  }
}

function installSkills() {
  const skills = fs.readdirSync(SKILLS_SRC)
  for (const skill of skills) {
    const src = path.join(SKILLS_SRC, skill)
    const dest = path.join(SKILL_DIR, skill)
    if (fs.statSync(src).isDirectory()) {
      copyDir(src, dest)
      console.log(`  installed skill: ${skill}`)
    }
  }
}

function installHooks() {
  fs.mkdirSync(HOOK_DIR, { recursive: true })
  for (const file of fs.readdirSync(HOOKS_SRC)) {
    const src = path.join(HOOKS_SRC, file)
    const dest = path.join(HOOK_DIR, file)
    fs.copyFileSync(src, dest)
    fs.chmodSync(dest, 0o755)
  }

  // Merge hook entries into ~/.claude/settings.json
  let settings = {}
  if (fs.existsSync(SETTINGS_FILE)) {
    try { settings = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8')) } catch {}
  }

  if (!settings.hooks) settings.hooks = {}

  const contextHook = {
    matcher: '*',
    hooks: [{ type: 'command', command: path.join(HOOK_DIR, 'context-status.sh') }]
  }
  const pulseHook = {
    matcher: '*',
    hooks: [{ type: 'command', command: path.join(HOOK_DIR, 'checkpoint-pulse.sh') }]
  }

  // Merge without duplicating — check if already registered
  if (!settings.hooks.UserPromptSubmit) settings.hooks.UserPromptSubmit = []
  if (!settings.hooks.PostToolUse) settings.hooks.PostToolUse = []

  const alreadyHasContext = settings.hooks.UserPromptSubmit.some(h =>
    h.hooks && h.hooks.some(hh => hh.command && hh.command.includes('agent-aware'))
  )
  const alreadyHasPulse = settings.hooks.PostToolUse.some(h =>
    h.hooks && h.hooks.some(hh => hh.command && hh.command.includes('agent-aware'))
  )

  if (!alreadyHasContext) settings.hooks.UserPromptSubmit.push(contextHook)
  if (!alreadyHasPulse) settings.hooks.PostToolUse.push(pulseHook)

  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2))
  console.log('  hooks: context-status (UserPromptSubmit)')
  console.log('  hooks: checkpoint-pulse (PostToolUse every 15 calls)')
}

function injectClaudeMd() {
  const claudeMd = path.join(process.cwd(), 'CLAUDE.md')
  const block = fs.readFileSync(TEMPLATE, 'utf8')

  if (fs.existsSync(claudeMd)) {
    const existing = fs.readFileSync(claudeMd, 'utf8')
    if (existing.includes(MARKER)) {
      console.log('  CLAUDE.md: already up to date')
      return
    }
    fs.writeFileSync(claudeMd, existing + '\n\n' + block)
    console.log('  CLAUDE.md: injected agent-aware block')
  } else {
    fs.writeFileSync(claudeMd, block)
    console.log('  CLAUDE.md: created with agent-aware block')
  }
}

console.log('\nagent-aware — installing...\n')

fs.mkdirSync(SKILL_DIR, { recursive: true })
installSkills()
installHooks()
injectClaudeMd()

console.log('\ndone. your agents are now self-aware.\n')
console.log('skills:')
console.log('  /agent-self-awareness      — meta-principle, self-check loop, assumption audit')
console.log('  /agent-orchestration-guide — which primitive to use, inheritance, swarm patterns')
console.log('  /claude-power              — 20+ native features most people never use')
console.log('')
console.log('hooks (active in every session):')
console.log('  context-status   — injects token estimate before each prompt')
console.log('  checkpoint-pulse — checkpoint reminder every 15 tool calls')
console.log('')
