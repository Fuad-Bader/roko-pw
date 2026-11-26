# Desktop downloads

This folder holds the packaged desktop installers that the landing page offers
for download, plus a `downloads.json` manifest the page reads at runtime.

**The binaries and manifest are not committed** (they're git-ignored — installers
are ~80 MB). Generate them locally:

```bash
# Windows installer (run on Windows):
npm --prefix desktop run dist:win
```

That command:

1. builds the Electron app (`electron-vite build`),
2. packages a Windows NSIS installer into `desktop/dist/`,
3. copies the installer here and writes `downloads.json`.

Until you run it, the landing page's download button shows "Desktop app coming
soon" — it degrades gracefully when no manifest is present.

## Other platforms

macOS (`.dmg`) and Linux (`.AppImage`) targets are already configured in
`desktop/package.json`, but must be built on their own OS (or in CI). The
`publish-landing.js` script picks up `.exe`, `.dmg` and `.AppImage` files from
`desktop/dist/`, so building on each platform and re-running it will populate the
manifest with all three.

## Windows build note

electron-builder downloads a `winCodeSign` bundle that contains macOS symlinks;
on Windows without Developer Mode/admin, 7-Zip can't create those symlinks and
the installer step fails. If you hit that, pre-extract the cache without the
`darwin` folder once:

```bash
7za x -snld -y "%LOCALAPPDATA%\electron-builder\Cache\winCodeSign\winCodeSign-2.6.0.7z" \
  -o"%LOCALAPPDATA%\electron-builder\Cache\winCodeSign\winCodeSign-2.6.0" -xr!darwin
```
