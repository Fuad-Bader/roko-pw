#!/usr/bin/env node
// Zips the browser extension folder into public/downloads so the landing page
// can offer it as a "load unpacked" download. Also writes extension.json (a
// small manifest the landing page reads for version / size).
//
// Cross-platform: uses PowerShell's Compress-Archive on Windows and `zip`
// elsewhere. The files are zipped at the archive root (manifest.json at top
// level) so users can extract and point "Load unpacked" straight at the folder.

const fs = require('fs')
const path = require('path')
const { execFileSync } = require('child_process')

const root = path.resolve(__dirname, '..')
const extDir = path.join(root, 'extension')
const publicDownloads = path.join(root, 'public', 'downloads')
const zipName = 'lilacrypt-extension.zip'
const zipPath = path.join(publicDownloads, zipName)

if (!fs.existsSync(path.join(extDir, 'manifest.json'))) {
  console.error(`No extension/manifest.json at ${extDir}.`)
  process.exit(1)
}

const { version } = JSON.parse(fs.readFileSync(path.join(extDir, 'manifest.json'), 'utf8'))

fs.mkdirSync(publicDownloads, { recursive: true })
fs.rmSync(zipPath, { force: true })

if (process.platform === 'win32') {
  // Compress-Archive zips the *contents* when the path ends with \*
  execFileSync(
    'powershell',
    [
      '-NoProfile',
      '-Command',
      `Compress-Archive -Path '${path.join(extDir, '*')}' -DestinationPath '${zipPath}' -Force`,
    ],
    { stdio: 'inherit' },
  )
} else {
  // `zip -r <zip> .` from inside the folder keeps files at the archive root
  execFileSync('zip', ['-r', '-q', zipPath, '.'], { cwd: extDir, stdio: 'inherit' })
}

const { size } = fs.statSync(zipPath)
const manifest = {
  version,
  builtAt: new Date().toISOString(),
  file: zipName,
  url: `/downloads/${zipName}`,
  size,
}
fs.writeFileSync(path.join(publicDownloads, 'extension.json'), JSON.stringify(manifest, null, 2))
console.log(`packed ${zipName} (${(size / 1e6).toFixed(2)} MB, v${version}) → public/downloads/`)
