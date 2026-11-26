import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: { '@roko/vault-core': resolve('../../packages/vault-core/src') },
    },
    build: {
      rollupOptions: {
        output: {
          format: 'cjs',
          entryFileNames: '[name].js',
        },
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: { '@roko/vault-core': resolve('../../packages/vault-core/src') },
    },
    build: {
      rollupOptions: {
        output: {
          format: 'cjs',
          entryFileNames: '[name].js',
        },
      },
    },
  },
  renderer: {
    resolve: {
      alias: [
        // Personal vault is stored through Electron IPC; must come before the generic alias.
        {
          find: '@roko/vault-core/lib/storage',
          replacement: resolve('./src/renderer/src/lib/storage.ts'),
        },
        { find: '@roko/vault-core', replacement: resolve('../../packages/vault-core/src') },
        { find: '@roko/ui', replacement: resolve('../../packages/ui/src') },
      ],
      // Shared packages resolve React from the repo root; keep a single copy.
      dedupe: ['react', 'react-dom'],
    },
    plugins: [react(), tailwindcss()],
  },
})
