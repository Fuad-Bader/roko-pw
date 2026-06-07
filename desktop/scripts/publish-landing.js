#!/usr/bin/env node
// Copies the freshly built desktop installer(s) from desktop/dist into the
// Next.js app's public/downloads folder so the landing page can serve them.
// Also writes downloads.json (a manifest the landing page reads for filename,
// size and version) so the UI stays in sync with whatever was actually built.

const fs = require('fs')
const path = require('path')

const distDir = path.resolve(__dirname, '..', 'dist')
const publicDownloads = path.resolve(__dirname, '..', '..', 'public', 'downloads')
const { version } = require('../package.json')

if (!fs.existsSync(distDir)) {
  console.error(`No dist/ folder at ${distDir}. Run the build first (npm run build:win).`)
  process.exit(1)
}

fs.mkdirSync(publicDownloads, { recursive: true })

// Installer extensions we care about, mapped to a platform label.
const PLATFORMS = [
  { ext: '.exe', os: 'windows' },
  { ext: '.dmg', os: 'mac' },
  { ext: '.AppImage', os: 'linux' },
]

const artifacts = []
for (const entry of fs.readdirSync(distDir)) {
  const match = PLATFORMS.find((p) => entry.toLowerCase().endsWith(p.ext.toLowerCase()))
  if (!match) continue
  const src = path.join(distDir, entry)
  const dest = path.join(publicDownloads, entry)
  fs.copyFileSync(src, dest)
  const { size } = fs.statSync(dest)
  artifacts.push({ os: match.os, file: entry, url: `/downloads/${entry}`, size })
  console.log(`copied ${entry} (${(size / 1e6).toFixed(1)} MB) → public/downloads/`)
}

if (artifacts.length === 0) {
  console.error('No installers (.exe/.dmg/.AppImage) found in dist/.')
  process.exit(1)
}

const manifest = { version, builtAt: new Date().toISOString(), artifacts }
fs.writeFileSync(path.join(publicDownloads, 'downloads.json'), JSON.stringify(manifest, null, 2))
console.log(`wrote downloads.json (version ${version}, ${artifacts.length} artifact(s))`)
