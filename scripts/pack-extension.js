#!/usr/bin/env node
// Zips the BUILT browser extension (extension/dist) into public/downloads so the
// landing page can offer it as a "load unpacked" download. Also writes
// extension.json (a small manifest the landing page reads for version / size).
//
// Run `npm run build:extension` first (the `pack:extension` script does this).
// Cross-platform: uses PowerShell's Compress-Archive on Windows and `zip`
// elsewhere. Files are zipped at the archive root (manifest.json at top level)
// so users can extract and point "Load unpacked" straight at the folder.

const fs = require('fs')
const path = require('path')
const { execFileSync } = require('child_process')

const root = path.resolve(__dirname, '..')
const extDir = path.join(root, 'extension')
const distDir = path.join(extDir, 'dist')
const publicDownloads = path.join(root, 'public', 'downloads')
const zipName = 'lilacrypt-extension.zip'
const zipPath = path.join(publicDownloads, zipName)

if (!fs.existsSync(path.join(distDir, 'manifest.json'))) {
  console.error(
    `No built extension at ${distDir}. Run "npm run build:extension" first.`,
  )
  process.exit(1)
}

const { version } = JSON.parse(fs.readFileSync(path.join(extDir, 'manifest.json'), 'utf8'))

fs.mkdirSync(publicDownloads, { recursive: true })
fs.rmSync(zipPath, { force: true })

if (process.platform === 'win32') {
  // PowerShell's Compress-Archive writes backslash path separators, which break
  // extraction on macOS/Linux. Build the archive with .NET ZipArchive instead,
  // forcing forward-slash entry names (subfolders like assets/ must be correct).
  const ps = `
    $ErrorActionPreference = 'Stop'
    Add-Type -AssemblyName System.IO.Compression
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $src = '${distDir.replace(/'/g, "''")}'
    $zip = '${zipPath.replace(/'/g, "''")}'
    $fs = [System.IO.File]::Open($zip, [System.IO.FileMode]::Create)
    $arch = New-Object System.IO.Compression.ZipArchive($fs, [System.IO.Compression.ZipArchiveMode]::Create)
    Get-ChildItem -Recurse -File -LiteralPath $src | ForEach-Object {
      $rel = $_.FullName.Substring($src.Length + 1).Replace('\\', '/')
      $entry = $arch.CreateEntry($rel, [System.IO.Compression.CompressionLevel]::Optimal)
      $out = $entry.Open()
      $bytes = [System.IO.File]::ReadAllBytes($_.FullName)
      $out.Write($bytes, 0, $bytes.Length)
      $out.Dispose()
    }
    $arch.Dispose()
    $fs.Dispose()
  `
  execFileSync('powershell', ['-NoProfile', '-Command', ps], { stdio: 'inherit' })
} else {
  // `zip -r <zip> .` from inside the folder keeps files at the archive root
  execFileSync('zip', ['-r', '-q', zipPath, '.'], { cwd: distDir, stdio: 'inherit' })
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
