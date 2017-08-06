'use strict'

// =====================================================
// Wiki.js
// Installation Script
// =====================================================

const path = require('path')
const spawn = require('child_process').spawn
const installDir = path.resolve(__dirname, '../..')
const cmd = (process.platform !== 'win32')
  ? 'curl -s -S -o- https://wiki.js.org/install.sh | bash'
  : `PowerShell.exe -NoProfile -ExecutionPolicy Bypass -Command "iex ((New-Object System.Net.WebClient).DownloadString('https://wiki.js.org/install.ps1'))"`

console.info(`Executing installation script for ${process.platform} platform...`)

let inst = spawn(cmd, [], {
  cwd: installDir,
  env: process.env,
  shell: true,
  stdio: 'inherit',
  detached: true
})

inst.unref()
