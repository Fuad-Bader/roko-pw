import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import { copyFileSync, existsSync, mkdirSync } from 'node:fs'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const here = fileURLToPath(new URL('.', import.meta.url)) // .../extension/
const dist = resolve(here, 'dist')

// Static MV3 files that aren't bundled by Vite but must sit at the extension
// root next to the built HTML/JS so the manifest can reference them.
const STATIC_FILES = [
  'manifest.json',
  'background.js',
  'content.js',
  'crypto.js',
  'passkeys.js',
]

function copyStatic(): Plugin {
  return {
    name: 'copy-extension-static',
    apply: 'build',
    closeBundle() {
      mkdirSync(dist, { recursive: true })
      for (const f of STATIC_FILES) {
        const src = resolve(here, f)
        if (existsSync(src)) copyFileSync(src, resolve(dist, f))
        else this.warn(`static file missing, skipped: ${f}`)
      }
    },
  }
}

export default defineConfig({
  root: resolve(here, 'ui'),
  base: './',
  plugins: [react(), tailwindcss(), copyStatic()],
  resolve: {
    alias: [
      // Override storage with the chrome.storage adapter — must precede @/lib.
      { find: '@/lib/storage', replacement: resolve(here, 'ui/lib/storage.ts') },
      { find: '@/lib', replacement: resolve(here, '../lib') },
      { find: '@/', replacement: resolve(here, '../') + '/' },
      { find: '@components', replacement: resolve(here, '../app/components') },
    ],
  },
  build: {
    outDir: dist,
    emptyOutDir: true,
    rollupOptions: {
      input: {
        vault: resolve(here, 'ui/vault.html'),
        popup: resolve(here, 'ui/popup.html'),
      },
    },
  },
})
