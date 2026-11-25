#!/usr/bin/env node
// VS Code (itself Electron) sets ELECTRON_RUN_AS_NODE=1 in child processes.
// Setting it to empty string via cross-env is not enough — Electron checks existence.
// Deleting from process.env actually removes it from the child process environment.
delete process.env.ELECTRON_RUN_AS_NODE

const { spawnSync } = require('child_process')
const cmd = process.argv.includes('--preview') ? 'preview' : 'dev'
const result = spawnSync('npx', ['electron-vite', cmd], {
  stdio: 'inherit',
  env: process.env,
  shell: true,
})
process.exit(result.status ?? 0)
