#!/usr/bin/env node

const fs = require('fs')
const path = require('path')
const os = require('os')

const SKILL_DIR = path.join(os.homedir(), '.claude', 'skills')
const SKILLS_SRC = path.join(__dirname, '..', 'skills')
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
injectClaudeMd()

console.log('\ndone. your agents are now self-aware.\n')
console.log('skills installed to ~/.claude/skills/')
console.log('  /agent-self-awareness      — meta-principle, self-check loop, assumption audit')
console.log('  /agent-orchestration-guide — which primitive to use, inheritance, swarm patterns')
console.log('  /claude-power              — 20 native features most people never use')
console.log('')
